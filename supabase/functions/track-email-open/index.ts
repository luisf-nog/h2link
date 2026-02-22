import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pixel 1×1 transparente (GIF)
const GIF_1PX = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="), (c) => c.charCodeAt(0));

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  Pragma: "no-cache",
  Expires: "0",
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function extractIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════
const ANTIVIRUS_DELAY_SECONDS = 60;
const DEBOUNCE_SECONDS = 10;
const MAX_OPENS_PER_HOUR = 20;
const MULTI_IP_WINDOW_SECONDS = 300;
const MULTI_IP_THRESHOLD = 3;
const BLACKLIST_DURATION_HOURS = 24;
const SUSPICION_THRESHOLD = 60;

const BOT_UA_KEYWORDS = [
  "googleimageproxy", "google-http-client", "googlebot", "office365", "outlook-link",
  "mimecast", "proofpoint", "barracuda", "symantec", "ironport", "forcepoint", "messagelabs",
  "curl/", "wget/", "python-requests", "python-urllib", "go-http-client", "java/",
  "apache-httpclient", "okhttp", "axios/", "node-fetch", "libwww-perl", "lwp-trivial", "phpmailer",
  "postman", "insomnia", "httpie", "burpsuite", "nikto", "nessus", "masscan", "zgrab",
  "linkedinbot", "twitterbot", "facebookexternalhit", "slackbot", "discordbot",
  "aws-internal", "amazonbot", "azure-logic-apps", "microsoft-webhook",
];

const VALID_FETCH_DEST = ["image", "empty", ""];

// ═══════════════════════════════════════════════════════════════════
// SUSPICION SCORE
// ═══════════════════════════════════════════════════════════════════

async function computeSuspicion(
  req: Request,
  ip: string,
  // deno-lint-ignore no-explicit-any
  historyRow: Record<string, any>,
  // deno-lint-ignore no-explicit-any
  db: any,
  trackingId: string,
): Promise<{ score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let score = 0;

  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  const fetchDest = (req.headers.get("sec-fetch-dest") ?? "").toLowerCase();
  const secChUa = req.headers.get("sec-ch-ua") ?? null;

  const matchedKeyword = BOT_UA_KEYWORDS.find((kw) => ua.includes(kw));
  if (matchedKeyword) { score += 80; reasons.push(`bot_ua:${matchedKeyword}`); }
  if (!ua || ua.length < 10) { score += 60; reasons.push("empty_ua"); }
  if (fetchDest && !VALID_FETCH_DEST.includes(fetchDest)) { score += 25; reasons.push(`bad_dest:${fetchDest}`); }
  if (secChUa && !fetchDest) { score += 15; reasons.push("ch_ua_no_dest"); }

  const sentAt = historyRow.sent_at ? new Date(historyRow.sent_at as string) : null;
  const secSinceSend = sentAt ? (Date.now() - sentAt.getTime()) / 1000 : ANTIVIRUS_DELAY_SECONDS + 1;
  if (secSinceSend < ANTIVIRUS_DELAY_SECONDS) { score += 50; reasons.push(`fast:${Math.round(secSinceSend)}s`); }

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recentCount } = await db
    .from("pixel_open_events").select("id", { count: "exact", head: true })
    .eq("tracking_id", trackingId).gte("created_at", oneHourAgo);
  if ((recentCount ?? 0) >= MAX_OPENS_PER_HOUR) { score += 70; reasons.push(`rate:${recentCount}`); }

  const debounceFrom = new Date(Date.now() - DEBOUNCE_SECONDS * 1000).toISOString();
  const { count: recentByIp } = await db
    .from("pixel_open_events").select("id", { count: "exact", head: true })
    .eq("tracking_id", trackingId).eq("ip", ip).gte("created_at", debounceFrom);
  if ((recentByIp ?? 0) > 0) { score += 40; reasons.push("debounce"); }

  const windowFrom = new Date(Date.now() - MULTI_IP_WINDOW_SECONDS * 1000).toISOString();
  const { data: recentIps } = await db
    .from("pixel_open_events").select("ip")
    .eq("tracking_id", trackingId).gte("created_at", windowFrom);
  // deno-lint-ignore no-explicit-any
  const distinctIps = new Set((recentIps ?? []).map((r: any) => r.ip)).size;
  if (distinctIps >= MULTI_IP_THRESHOLD) { score += 60; reasons.push(`multi_ip:${distinctIps}`); }

  return { score: Math.min(score, 100), reasons };
}

// ═══════════════════════════════════════════════════════════════════
// BLACKLIST
// ═══════════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function isIpBlacklisted(db: any, ip: string): Promise<boolean> {
  if (ip === "unknown") return false;
  const { data } = await db
    .from("ip_blacklist").select("blocked_until")
    .eq("ip", ip).gt("blocked_until", new Date().toISOString())
    .maybeSingle();
  return !!data;
}

// deno-lint-ignore no-explicit-any
async function autoBlacklistIp(db: any, ip: string, reason: string): Promise<void> {
  if (ip === "unknown") return;
  const blockedUntil = new Date(Date.now() + BLACKLIST_DURATION_HOURS * 3600_000).toISOString();
  await db.from("ip_blacklist").upsert(
    { ip, reason, blocked_until: blockedUntil, hit_count: 1 },
    { onConflict: "ip", ignoreDuplicates: false },
  );
  await db.rpc("increment_blacklist_hit", { p_ip: ip });
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: PIXEL_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    if (!isUuid(id)) return new Response(GIF_1PX, { headers: PIXEL_HEADERS });

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = extractIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    // IP blacklisted?
    if (await isIpBlacklisted(db, ip)) {
      console.log(`[pixel] BLOCKED ip=${ip} tid=${id}`);
      await db.from("pixel_open_events").insert({
        tracking_id: id, ip, user_agent: ua,
        suspicion: 100, is_genuine: false, reasons: ["ip_blacklisted"],
      });
      return new Response(GIF_1PX, { headers: PIXEL_HEADERS });
    }

    // Find send history row
    const { data: historyRow } = await db
      .from("queue_send_history")
      .select("id, opened_at, first_opened_at, open_count, sent_at, queue_id")
      .eq("tracking_id", id).maybeSingle();

    if (!historyRow?.id) {
      // Fallback: legacy my_queue.tracking_id
      const { data: row } = await db
        .from("my_queue")
        .select("id, opened_at, email_open_count")
        .eq("tracking_id", id).maybeSingle();
      if (row?.id) {
        await db.from("my_queue").update({
          email_open_count: (row.email_open_count ?? 0) + 1,
          ...(!row.opened_at && { opened_at: new Date().toISOString() }),
        }).eq("id", row.id);
      }
      return new Response(GIF_1PX, { headers: PIXEL_HEADERS });
    }

    // Compute suspicion score
    const { score, reasons } = await computeSuspicion(req, ip, historyRow, db, id);
    const isGenuine = score < SUSPICION_THRESHOLD;
    const now = new Date();

    // Always log the event
    await db.from("pixel_open_events").insert({
      tracking_id: id, queue_id: historyRow.queue_id ?? null,
      ip, user_agent: ua, suspicion: score, is_genuine: isGenuine, reasons,
    });

    // Auto-blacklist high score
    if (score >= 80 && ip !== "unknown") {
      await autoBlacklistIp(db, ip, reasons.join(", "));
    }

    console.log(`[pixel] tid=${id} ip=${ip} score=${score} genuine=${isGenuine} reasons=${reasons.join("|") || "none"}`);

    // Update metrics only if genuine
    if (isGenuine) {
      const newCount = (historyRow.open_count ?? 0) + 1;
      // deno-lint-ignore no-explicit-any
      const upd: Record<string, any> = { open_count: newCount };
      if (!historyRow.opened_at) upd.opened_at = now.toISOString();
      if (!historyRow.first_opened_at) upd.first_opened_at = now.toISOString();
      await db.from("queue_send_history").update(upd).eq("id", historyRow.id);

      if (historyRow.queue_id) {
        const { data: qRow } = await db
          .from("my_queue")
          .select("id, opened_at, email_open_count")
          .eq("id", historyRow.queue_id).single();
        if (qRow) {
          await db.from("my_queue").update({
            email_open_count: (qRow.email_open_count ?? 0) + 1,
            ...(!qRow.opened_at && { opened_at: now.toISOString() }),
          }).eq("id", qRow.id);
        }
      }
    }
  } catch (err) {
    console.error("[pixel] error:", err);
  }

  return new Response(GIF_1PX, { headers: PIXEL_HEADERS });
});
