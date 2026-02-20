import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

/** Segundos após o envio para começar a contar aberturas genuínas */
const ANTIVIRUS_DELAY_SECONDS = 60;

/** Ignora aberturas do mesmo tracking_id dentro deste intervalo (segundos) */
const DEBOUNCE_SECONDS = 10;

/** Acima deste número de aberturas/hora, o tracking_id é marcado como varrido */
const MAX_OPENS_PER_HOUR = 20;

/** Janela (segundos) para checar múltiplos IPs no mesmo tracking_id */
const MULTI_IP_WINDOW_SECONDS = 300; // 5 min

/** Quantidade de IPs distintos nessa janela que dispara alerta de bot */
const MULTI_IP_THRESHOLD = 3;

/** Horas que um IP fica na blacklist após ser detectado */
const BLACKLIST_DURATION_HOURS = 24;

/** Threshold de suspicion score para considerar uma abertura NÃO genuína */
const SUSPICION_THRESHOLD = 60;

// ═══════════════════════════════════════════════════════════════════
// LISTAS DE FILTRO
// ═══════════════════════════════════════════════════════════════════

/**
 * Palavras-chave no User-Agent que indicam bots/scanners.
 * Mantidas em lowercase para comparação case-insensitive.
 */
const BOT_UA_KEYWORDS = [
  // Email security proxies
  "googleimageproxy",
  "google-http-client",
  "googlebot",
  "office365",
  "outlook-link",
  "mimecast",
  "proofpoint",
  "barracuda",
  "symantec",
  "ironport",
  "forcepoint",
  "messagelabs",
  // Generic HTTP clients (nenhum humano usa esses)
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "java/",
  "apache-httpclient",
  "okhttp",
  "axios/",
  "node-fetch",
  "libwww-perl",
  "lwp-trivial",
  "phpmailer",
  // Pentest / automation
  "postman",
  "insomnia",
  "httpie",
  "burpsuite",
  "nikto",
  "nessus",
  "masscan",
  "zgrab",
  // Social crawlers
  "linkedinbot",
  "twitterbot",
  "facebookexternalhit",
  "slackbot",
  "discordbot",
  // Cloud infra
  "aws-internal",
  "amazonbot",
  "azure-logic-apps",
  "microsoft-webhook",
];

/**
 * Valores esperados no header sec-fetch-dest quando um navegador real
 * carrega uma imagem dentro de um e-mail.
 * Em clientes como Outlook Desktop ou Apple Mail, esse header pode não existir —
 * por isso só PONTUAMOS, nunca bloqueamos por ausência.
 */
const VALID_FETCH_DEST = ["image", "empty", ""];

// ═══════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** Extrai o IP real do request, respeitando proxies confiáveis */
function extractIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ?? // Cloudflare
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

// Pixel 1×1 transparente (GIF)
const GIF_1PX = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="), (c) => c.charCodeAt(0));

const PIXEL_RESPONSE = new Response(GIF_1PX, {
  status: 200,
  headers: {
    "Content-Type": "image/gif",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },
});

// ═══════════════════════════════════════════════════════════════════
// SISTEMA DE SUSPICION SCORE
// ═══════════════════════════════════════════════════════════════════

interface SuspicionResult {
  score: number; // 0–100
  reasons: string[];
}

async function computeSuspicion(
  req: Request,
  ip: string,
  historyRow: Record<string, unknown>,
  db: SupabaseClient,
  trackingId: string,
): Promise<SuspicionResult> {
  const reasons: string[] = [];
  let score = 0;

  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  const fetchDest = (req.headers.get("sec-fetch-dest") ?? "").toLowerCase();
  const secChUa = req.headers.get("sec-ch-ua") ?? null;

  // ── 1. Bot keyword no UA ────────────────────────────────────────
  const matchedKeyword = BOT_UA_KEYWORDS.find((kw) => ua.includes(kw));
  if (matchedKeyword) {
    score += 80;
    reasons.push(`bot_ua_keyword:${matchedKeyword}`);
  }

  // ── 2. UA vazio ou muito curto ──────────────────────────────────
  if (!ua || ua.length < 10) {
    score += 60;
    reasons.push("empty_or_short_ua");
  }

  // ── 3. sec-fetch-dest inválido (só pontua, não bloqueia) ────────
  if (fetchDest && !VALID_FETCH_DEST.includes(fetchDest)) {
    score += 25;
    reasons.push(`invalid_fetch_dest:${fetchDest}`);
  }

  // ── 4. sec-ch-ua presente mas sem sec-fetch-dest (inconsistente) ─
  if (secChUa && !fetchDest) {
    score += 15;
    reasons.push("ch_ua_without_fetch_dest");
  }

  // ── 5. Abertura antes do delay de antivírus ─────────────────────
  const sentAt = historyRow.sent_at ? new Date(historyRow.sent_at as string) : null;
  const secondsSinceSend = sentAt ? (Date.now() - sentAt.getTime()) / 1000 : ANTIVIRUS_DELAY_SECONDS + 1;

  if (secondsSinceSend < ANTIVIRUS_DELAY_SECONDS) {
    score += 50;
    reasons.push(`too_fast:${Math.round(secondsSinceSend)}s`);
  }

  // ── 6. Rate limit: muitas aberturas na última hora ──────────────
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count: recentCount } = await db
    .from("pixel_open_events")
    .select("id", { count: "exact", head: true })
    .eq("tracking_id", trackingId)
    .gte("created_at", oneHourAgo);

  if ((recentCount ?? 0) >= MAX_OPENS_PER_HOUR) {
    score += 70;
    reasons.push(`rate_limit:${recentCount}_opens_last_hour`);
  }

  // ── 7. Debounce: mesma abertura há menos de 10s ─────────────────
  const debounceFrom = new Date(Date.now() - DEBOUNCE_SECONDS * 1000).toISOString();
  const { count: recentByIp } = await db
    .from("pixel_open_events")
    .select("id", { count: "exact", head: true })
    .eq("tracking_id", trackingId)
    .eq("ip", ip)
    .gte("created_at", debounceFrom);

  if ((recentByIp ?? 0) > 0) {
    score += 40;
    reasons.push(`debounce:same_ip_${DEBOUNCE_SECONDS}s`);
  }

  // ── 8. Multi-IP detection: muitos IPs distintos em 5 min ────────
  const windowFrom = new Date(Date.now() - MULTI_IP_WINDOW_SECONDS * 1000).toISOString();
  const { data: recentIps } = await db
    .from("pixel_open_events")
    .select("ip")
    .eq("tracking_id", trackingId)
    .gte("created_at", windowFrom);

  const distinctIps = new Set((recentIps ?? []).map((r: { ip: string }) => r.ip)).size;
  if (distinctIps >= MULTI_IP_THRESHOLD) {
    score += 60;
    reasons.push(`multi_ip:${distinctIps}_distinct_ips`);
  }

  return { score: Math.min(score, 100), reasons };
}

// ═══════════════════════════════════════════════════════════════════
// BLACKLIST
// ═══════════════════════════════════════════════════════════════════

async function isIpBlacklisted(db: SupabaseClient, ip: string): Promise<boolean> {
  if (ip === "unknown") return false;
  const { data } = await db
    .from("ip_blacklist")
    .select("blocked_until")
    .eq("ip", ip)
    .gt("blocked_until", new Date().toISOString())
    .maybeSingle();
  return !!data;
}

async function autoBlacklistIp(db: SupabaseClient, ip: string, reason: string): Promise<void> {
  if (ip === "unknown") return;
  const blockedUntil = new Date(Date.now() + BLACKLIST_DURATION_HOURS * 3600 * 1000).toISOString();

  // Upsert: se já existe, incrementa hit_count e renova o prazo
  await db.from("ip_blacklist").upsert(
    { ip, reason, blocked_until: blockedUntil, hit_count: 1 },
    {
      onConflict: "ip",
      ignoreDuplicates: false,
    },
  );

  // Incrementa hit_count separadamente (upsert não suporta increment nativo)
  await db.rpc("increment_blacklist_hit", { p_ip: ip });
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type",
      },
    });
  }

  // Sempre retorna o pixel — nunca quebra a renderização do e-mail
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    if (!isUuid(id)) return PIXEL_RESPONSE;

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const db = createClient(supabaseUrl, supabaseKey);

    const ip = extractIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    // ── CHECAGEM RÁPIDA: IP na blacklist? ───────────────────────────
    if (await isIpBlacklisted(db, ip)) {
      console.log(`[pixel] BLOCKED ip=${ip} tracking_id=${id}`);
      // Registra o evento mas não atualiza métricas
      await db.from("pixel_open_events").insert({
        tracking_id: id,
        ip,
        user_agent: ua,
        suspicion: 100,
        is_genuine: false,
        reasons: ["ip_blacklisted"],
      });
      return PIXEL_RESPONSE;
    }

    // ── Busca o registro de envio ───────────────────────────────────
    const { data: historyRow } = await db
      .from("queue_send_history")
      .select("id, opened_at, first_opened_at, open_count, sent_at, queue_id")
      .eq("tracking_id", id)
      .maybeSingle();

    if (!historyRow?.id) {
      // Fallback: compatibilidade com e-mails mais antigos (my_queue.tracking_id)
      const { data: row } = await db
        .from("my_queue")
        .select("id, opened_at, email_open_count")
        .eq("tracking_id", id)
        .maybeSingle();

      if (row?.id) {
        await db
          .from("my_queue")
          .update({
            email_open_count: (row.email_open_count ?? 0) + 1,
            ...(!row.opened_at && { opened_at: new Date().toISOString() }),
          })
          .eq("id", row.id);
      }
      return PIXEL_RESPONSE;
    }

    // ── Calcula suspicion score ─────────────────────────────────────
    const { score, reasons } = await computeSuspicion(req, ip, historyRow, db, id);
    const isGenuine = score < SUSPICION_THRESHOLD;
    const now = new Date();

    // ── Log bruto do evento (sempre, independente de ser genuine) ───
    await db.from("pixel_open_events").insert({
      tracking_id: id,
      queue_id: historyRow.queue_id ?? null,
      ip,
      user_agent: ua,
      suspicion: score,
      is_genuine: isGenuine,
      reasons,
    });

    // ── Auto-blacklist se score muito alto ──────────────────────────
    if (score >= 80 && ip !== "unknown") {
      await autoBlacklistIp(db, ip, reasons.join(", "));
      console.log(`[pixel] AUTO_BLACKLIST ip=${ip} score=${score} reasons=${reasons.join("|")}`);
    }

    console.log(
      `[pixel] tracking_id=${id} ip=${ip} score=${score} genuine=${isGenuine} reasons=${reasons.join("|") || "none"}`,
    );

    // ── Atualiza queue_send_history apenas se genuíno ───────────────
    if (isGenuine) {
      const newOpenCount = (historyRow.open_count ?? 0) + 1;
      const updateData: Record<string, unknown> = { open_count: newOpenCount };
      if (!historyRow.opened_at) updateData.opened_at = now.toISOString();
      if (!historyRow.first_opened_at) updateData.first_opened_at = now.toISOString();

      await db.from("queue_send_history").update(updateData).eq("id", historyRow.id);

      // ── Atualiza my_queue (aggregate) ────────────────────────────
      if (historyRow.queue_id) {
        const { data: queueRow } = await db
          .from("my_queue")
          .select("id, opened_at, email_open_count")
          .eq("id", historyRow.queue_id)
          .single();

        if (queueRow) {
          await db
            .from("my_queue")
            .update({
              email_open_count: (queueRow.email_open_count ?? 0) + 1,
              ...(!queueRow.opened_at && { opened_at: now.toISOString() }),
            })
            .eq("id", queueRow.id);
        }
      }
    }
  } catch (err) {
    // Nunca quebra a renderização do e-mail
    console.error("[pixel] unhandled error:", err);
  }

  return PIXEL_RESPONSE;
};

serve(handler);
