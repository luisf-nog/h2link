import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PlanTier = "free" | "gold" | "diamond" | "black";

function getDailyEmailLimit(planTier: PlanTier): number {
  // Keep in sync with src/config/plans.config.ts
  if (planTier === "black") return 450;
  if (planTier === "diamond") return 350;
  if (planTier === "gold") return 150;
  return 5;
}

type EmailProvider = "gmail" | "outlook";

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Convert plain text (with optional **bold**) into simple, reliable HTML.
function textToHtmlEmailBody(input: string): string {
  const normalized = String(input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const escaped = escapeHtml(normalized);
  const withBold = escaped.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");

  const paragraphs = withBold
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\n/g, "<br>"));

  if (paragraphs.length === 0) return "";

  return paragraphs
    .map((p) => `<p style="margin:0 0 12px 0;">${p}</p>`)
    .join("");
}

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  // Optional anti-spam knobs controlled by tier logic (frontend)
  xMailer?: string;
  userAgent?: string;
  dedupeId?: string;
  // optional: used to attach open-tracking pixel to emails sent from the queue
  queueId?: string;
  trackingId?: string;
  // optional override; if omitted we use saved values
  provider?: EmailProvider;
  smtpEmail?: string;
  smtpPassword?: string;
  resumeUrl?: string;
  resumeName?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  useTls: boolean;
  useStartTls: boolean;
}

const SMTP_CONFIGS: Record<EmailProvider, SmtpConfig> = {
  gmail: {
    host: "smtp.gmail.com",
    port: 465,
    useTls: true,
    useStartTls: false,
  },
  outlook: {
    host: "smtp.office365.com",
    port: 587,
    useTls: false,
    useStartTls: true,
  },
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function utf8ToBase64(str: string): string {
  const bytes = encoder.encode(str);
  return base64Encode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

function nowRfc2822(): string {
  return new Date().toUTCString();
}

function createMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  extraHeaders?: string[];
  attachment?: { name: string; content: Uint8Array; mimeType: string };
}): string {
  const { from, to, subject, htmlBody, attachment, extraHeaders } = params;

  const boundary = `----=_Part_${crypto.randomUUID()}`;
  const subjectEncoded = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;

  const baseHeaders = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    `Date: ${nowRfc2822()}`,
    `MIME-Version: 1.0`,
  ];

  const safeExtraHeaders = (extraHeaders ?? []).filter(Boolean);

  const htmlPart = [
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    utf8ToBase64(
      `<div style="font-family: Calibri, sans-serif; font-size: 14px;">${htmlBody}</div>`,
    ),
  ].join("\r\n");

  if (!attachment) {
    return [
      ...baseHeaders,
      ...safeExtraHeaders,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      utf8ToBase64(
        `<div style="font-family: Calibri, sans-serif; font-size: 14px;">${htmlBody}</div>`,
      ),
    ].join("\r\n");
  }

  const attachmentB64 = base64Encode(
    attachment.content.buffer.slice(
      attachment.content.byteOffset,
      attachment.content.byteOffset + attachment.content.byteLength,
    ) as ArrayBuffer,
  );

  const attachmentPart = [
    `Content-Type: ${attachment.mimeType}; name="${attachment.name}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${attachment.name}"`,
    ``,
    attachmentB64,
  ].join("\r\n");

  return [
    ...baseHeaders,
    ...safeExtraHeaders,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    htmlPart,
    `--${boundary}`,
    attachmentPart,
    `--${boundary}--`,
    ``,
  ].join("\r\n");
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`Timeout (${label}) após ${ms}ms`));
      }, ms);
    }),
  ]);
}

async function writeAll(conn: Deno.Conn, data: Uint8Array) {
  let offset = 0;
  while (offset < data.length) {
    const n = await conn.write(data.subarray(offset));
    offset += n;
  }
}

async function readResponse(conn: Deno.Conn, expectedCode?: string): Promise<string> {
  let buf = "";

  while (true) {
    const chunk = new Uint8Array(4096);
    const n = await conn.read(chunk);
    if (n === null) throw new Error("Conexão SMTP encerrada");

    buf += decoder.decode(chunk.subarray(0, n));
    const lines = buf.split("\r\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line) continue;

      if (expectedCode) {
        if (line.startsWith(expectedCode + " ") || line.startsWith(expectedCode + "-")) {
          // ok
        } else if (/^[45]\d\d[ -]/.test(line)) {
          throw new Error(`SMTP erro: ${line}`);
        }
      }

      if (/^\d{3} /.test(line)) {
        return line;
      }
    }
  }
}

async function sendCommand(conn: Deno.Conn, cmd: string, expectedCode: string) {
  await writeAll(conn, encoder.encode(cmd + "\r\n"));
  const line = await readResponse(conn, expectedCode);
  if (!line.startsWith(expectedCode)) {
    throw new Error(`SMTP comando falhou (${cmd}): ${line}`);
  }
  return line;
}

async function sendEmailSMTPTls(params: {
  host: string;
  port: number;
  user: string;
  password: string;
  to: string;
  rawMessage: string;
}) {
  const { host, port, user, password, to, rawMessage } = params;
  const conn = await withTimeout(Deno.connectTls({ hostname: host, port }), 15000, "connectTls");

  try {
    await withTimeout(readResponse(conn), 15000, "greeting");
    await withTimeout(sendCommand(conn, "EHLO localhost", "250"), 15000, "EHLO");

    await withTimeout(sendCommand(conn, "AUTH LOGIN", "334"), 15000, "AUTH LOGIN");
    const userBytes = encoder.encode(user);
    const passBytes = encoder.encode(password);
    await withTimeout(
      sendCommand(
        conn,
        base64Encode(userBytes.buffer.slice(userBytes.byteOffset, userBytes.byteOffset + userBytes.byteLength)),
        "334",
      ),
      15000,
      "AUTH user",
    );
    await withTimeout(
      sendCommand(
        conn,
        base64Encode(passBytes.buffer.slice(passBytes.byteOffset, passBytes.byteOffset + passBytes.byteLength)),
        "235",
      ),
      15000,
      "AUTH pass",
    );

    await withTimeout(sendCommand(conn, `MAIL FROM:<${user}>`, "250"), 15000, "MAIL FROM");
    await withTimeout(sendCommand(conn, `RCPT TO:<${to}>`, "250"), 15000, "RCPT TO");
    await withTimeout(sendCommand(conn, "DATA", "354"), 15000, "DATA");

    await withTimeout(writeAll(conn, encoder.encode(rawMessage + "\r\n.\r\n")), 60000, "write body");
    await withTimeout(readResponse(conn, "250"), 20000, "DATA accept");
    await writeAll(conn, encoder.encode("QUIT\r\n"));
  } finally {
    try {
      conn.close();
    } catch {
      // ignore
    }
  }
}

async function sendEmailSMTPStartTls(params: {
  host: string;
  port: number;
  user: string;
  password: string;
  to: string;
  rawMessage: string;
}) {
  const { host, port, user, password, to, rawMessage } = params;

  const tcpConn = (await withTimeout(Deno.connect({ hostname: host, port }), 15000, "connect")) as Deno.TcpConn;

  try {
    await withTimeout(readResponse(tcpConn), 15000, "greeting");
    await withTimeout(sendCommand(tcpConn, "EHLO localhost", "250"), 15000, "EHLO");

    await writeAll(tcpConn, encoder.encode("STARTTLS\r\n"));
    await withTimeout(readResponse(tcpConn, "220"), 15000, "STARTTLS");

    const tlsConn = await Deno.startTls(tcpConn, { hostname: host });
    await withTimeout(sendCommand(tlsConn, "EHLO localhost", "250"), 15000, "EHLO after STARTTLS");

    await withTimeout(sendCommand(tlsConn, "AUTH LOGIN", "334"), 15000, "AUTH LOGIN");
    const userBytes = encoder.encode(user);
    const passBytes = encoder.encode(password);
    await withTimeout(
      sendCommand(
        tlsConn,
        base64Encode(userBytes.buffer.slice(userBytes.byteOffset, userBytes.byteOffset + userBytes.byteLength)),
        "334",
      ),
      15000,
      "AUTH user",
    );
    await withTimeout(
      sendCommand(
        tlsConn,
        base64Encode(passBytes.buffer.slice(passBytes.byteOffset, passBytes.byteOffset + passBytes.byteLength)),
        "235",
      ),
      15000,
      "AUTH pass",
    );

    await withTimeout(sendCommand(tlsConn, `MAIL FROM:<${user}>`, "250"), 15000, "MAIL FROM");
    await withTimeout(sendCommand(tlsConn, `RCPT TO:<${to}>`, "250"), 15000, "RCPT TO");
    await withTimeout(sendCommand(tlsConn, "DATA", "354"), 15000, "DATA");

    await withTimeout(writeAll(tlsConn, encoder.encode(rawMessage + "\r\n.\r\n")), 60000, "write body");
    await withTimeout(readResponse(tlsConn, "250"), 20000, "DATA accept");
    await writeAll(tlsConn, encoder.encode("QUIT\r\n"));
  } finally {
    try {
      tcpConn.close();
    } catch {
      // ignore
    }
  }
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json(401, { success: false, error: "Unauthorized" });
    }
    const userId = claimsData.claims.sub;

    const body: EmailRequest = await req.json();
    if (!body?.to || !body?.subject || !body?.body) {
      return json(400, { success: false, error: "Missing required fields: to, subject, body" });
    }

    // Prefer saved credentials (secure). Allow body override ONLY if both are present.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ===== DAILY LIMIT ENFORCEMENT =====
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("plan_tier, credits_used_today, credits_reset_date, referral_bonus_limit")
      .eq("id", userId)
      .single();

    if (profileError) {
      return json(500, { success: false, error: "Failed to fetch profile" });
    }

    const today = new Date().toISOString().slice(0, 10);
    let creditsUsed = Number(profile.credits_used_today ?? 0);

    // Reset credits if new day
    if (profile.credits_reset_date !== today) {
      creditsUsed = 0;
      await serviceClient
        .from("profiles")
        .update({ credits_used_today: 0, credits_reset_date: today } as any)
        .eq("id", userId);
    }

    const dailyLimit = getDailyEmailLimit(profile.plan_tier as PlanTier) + Number(profile.referral_bonus_limit ?? 0);

    if (creditsUsed >= dailyLimit) {
      return json(429, { 
        success: false, 
        error: "daily_limit_reached",
        limit: dailyLimit,
        used: creditsUsed 
      });
    }
    // ===== END DAILY LIMIT ENFORCEMENT =====

    const { data: creds, error: credsError } = await serviceClient
      .from("smtp_credentials")
      .select("provider,email,has_password")
      .eq("user_id", userId)
      .maybeSingle();

    if (credsError) throw credsError;

    let provider: EmailProvider | undefined = body.provider;
    let smtpEmail: string | undefined = body.smtpEmail;
    let smtpPassword: string | undefined = body.smtpPassword;

    if (!smtpEmail || !smtpPassword) {
      if (!creds) {
        return json(404, { success: false, error: "SMTP Config not found for this user" });
      }
      if (!creds.has_password) {
        return json(404, { success: false, error: "SMTP password not found for this user" });
      }

      provider = (provider ?? creds.provider) as EmailProvider;
      smtpEmail = creds.email;

      const { data: secret, error: secretError } = await serviceClient
        .from("smtp_credentials_secrets")
        .select("password")
        .eq("user_id", userId)
        .single();

      if (secretError) throw secretError;
      smtpPassword = secret.password;
    }

    const normalizedProvider: EmailProvider = provider === "outlook" ? "outlook" : "gmail";
    const smtpConfig = SMTP_CONFIGS[normalizedProvider];

    let htmlBody = textToHtmlEmailBody(body.body);

    // Open tracking pixel (best-effort)
    try {
      let trackingId = body.trackingId;
      if (!trackingId && body.queueId) {
        const { data: q } = await serviceClient
          .from("my_queue")
          .select("tracking_id")
          .eq("id", String(body.queueId))
          .eq("user_id", userId)
          .maybeSingle();
        trackingId = (q as any)?.tracking_id ?? undefined;
      }

      if (trackingId) {
        const pixelUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/track-email-open?id=${encodeURIComponent(String(trackingId))}`;
        htmlBody +=
          `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
      }
    } catch {
      // ignore
    }

    if (body.dedupeId) {
      const id = String(body.dedupeId).slice(0, 128);
      htmlBody +=
        `<div style="display:none; opacity:0; height:0; width:0; overflow:hidden;">` +
        `${id}` +
        `</div>`;
    }

    const extraHeaders: string[] = [];
    if (body.xMailer) extraHeaders.push(`X-Mailer: ${String(body.xMailer).slice(0, 128)}`);
    if (body.userAgent) extraHeaders.push(`User-Agent: ${String(body.userAgent).slice(0, 128)}`);

    let attachment:
      | { name: string; content: Uint8Array; mimeType: string }
      | undefined;

    if (body.resumeUrl && body.resumeName) {
      try {
        const resp = await withTimeout(fetch(body.resumeUrl), 15000, "fetch attachment");
        if (resp.ok) {
          const arrayBuffer = await withTimeout(resp.arrayBuffer(), 20000, "read attachment");
          attachment = {
            name: body.resumeName,
            content: new Uint8Array(arrayBuffer),
            mimeType: "application/pdf",
          };
        }
      } catch (_e) {
        // ignore attachment errors (non-fatal)
      }
    }

    const rawMessage = createMimeMessage({
      from: smtpEmail!,
      to: body.to,
      subject: body.subject,
      htmlBody,
      extraHeaders,
      attachment,
    });

    if (smtpConfig.useStartTls) {
      await sendEmailSMTPStartTls({
        host: smtpConfig.host,
        port: smtpConfig.port,
        user: smtpEmail!,
        password: smtpPassword!,
        to: body.to,
        rawMessage,
      });
    } else {
      await sendEmailSMTPTls({
        host: smtpConfig.host,
        port: smtpConfig.port,
        user: smtpEmail!,
        password: smtpPassword!,
        to: body.to,
        rawMessage,
      });
    }

    // ===== INCREMENT CREDITS AFTER SUCCESSFUL SEND =====
    await serviceClient
      .from("profiles")
      .update({ 
        credits_used_today: creditsUsed + 1, 
        credits_reset_date: today 
      } as any)
      .eq("id", userId);
    // ===== END INCREMENT CREDITS =====

    return json(200, { success: true, message: "Email sent" });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send email";
    return json(500, { success: false, error: errorMessage });
  }
};

serve(handler);
