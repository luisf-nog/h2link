import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

type PlanTier = "free" | "gold" | "diamond" | "black";
type SendingMethod = "static" | "dynamic";

function getDailyEmailLimit(planTier: PlanTier): number {
  // Keep in sync with src/config/plans.config.ts
  if (planTier === "black") return 500;
  if (planTier === "diamond") return 350;
  if (planTier === "gold") return 150;
  return 5;
}

function getSendingMethod(planTier: PlanTier): SendingMethod {
  // Only Black uses dynamic AI generation
  return planTier === "black" ? "dynamic" : "static";
}

type EmailProvider = "gmail" | "outlook";

interface QueueRow {
  id: string;
  user_id: string;
  status: string;
  job_id: string | null;
  manual_job_id: string | null;
  tracking_id: string;
}

interface ProfileRow {
  id: string;
  plan_tier: PlanTier;
  full_name: string | null;
  age: number | null;
  phone_e164: string | null;
  contact_email: string | null;
  resume_data?: unknown | null;
  resume_url?: string | null;
  credits_used_today?: number | null;
  credits_reset_date?: string | null;
  timezone?: string | null;
  consecutive_errors?: number | null;
  referral_bonus_limit?: number | null;
}

function getLocalHour(params: { timeZone: string; now?: Date }): number {
  const { timeZone, now } = params;
  const dt = now ?? new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(dt);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const hour = Number(hourPart);
  return Number.isFinite(hour) ? hour : 0;
}

function isCircuitBreakerError(message: string): boolean {
  const m = message.toLowerCase();
  // Auth / credentials
  if (m.includes("auth") || m.includes("authentication") || m.includes("senha") || m.includes("password")) return true;
  if (m.includes("535") || m.includes("534") || m.includes("530")) return true;
  // Typical bounces / hard fails
  if (m.includes("550") || m.includes("551") || m.includes("552") || m.includes("553") || m.includes("554")) return true;
  if (m.includes("mailbox") || m.includes("recipient") || m.includes("unknown user") || m.includes("user unknown")) return true;
  return false;
}

// ============ EMAIL VALIDATION ============

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function extractDomain(email: string): string | null {
  const s = String(email).trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at <= 0 || at === s.length - 1) return null;
  const domain = s.slice(at + 1).trim();
  if (!domain || domain.length < 3) return null;
  return domain;
}

async function validateEmailDNS(email: string): Promise<{ valid: boolean; reason?: string }> {
  // Step A: Syntax validation
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, reason: "Formato de e-mail inválido" };
  }

  // Step B: Extract domain
  const domain = extractDomain(email);
  if (!domain) {
    return { valid: false, reason: "Domínio de e-mail inválido" };
  }

  // Step C: MX Lookup
  try {
    const mx = await Deno.resolveDns(domain, "MX");
    if (!Array.isArray(mx) || mx.length === 0) {
      return { valid: false, reason: `Domínio ${domain} sem servidor de e-mail (MX)` };
    }
    return { valid: true };
  } catch (_e) {
    // DNS resolution failed - domain doesn't exist or has no MX records
    return { valid: false, reason: `Domínio ${domain} inativo ou inexistente` };
  }
}

interface PublicJobRow {
  id: string;
  company: string;
  job_title: string;
  email: string;
  visa_type: string | null;
  description?: string | null;
  requirements?: string | null;
}

interface ManualJobRow {
  id: string;
  company: string;
  job_title: string;
  email: string;
  eta_number: string | null;
  phone: string | null;
}

interface EmailTemplateRow {
  id: string;
  subject: string;
  body: string;
  created_at: string;
}

interface SmtpCredsRow {
  provider: string;
  email: string;
  has_password: boolean;
}

interface SmtpSecretRow {
  password: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  useTls: boolean;
  useStartTls: boolean;
}

const SMTP_CONFIGS: Record<EmailProvider, SmtpConfig> = {
  gmail: { host: "smtp.gmail.com", port: 465, useTls: true, useStartTls: false },
  outlook: { host: "smtp.office365.com", port: 587, useTls: false, useStartTls: true },
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  const { from, to, subject, htmlBody, extraHeaders, attachment } = params;
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
    utf8ToBase64(`<div style="font-family: Calibri, sans-serif; font-size: 14px;">${htmlBody}</div>`),
  ].join("\r\n");

  if (!attachment) {
    return [
      ...baseHeaders,
      ...safeExtraHeaders,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      utf8ToBase64(`<div style="font-family: Calibri, sans-serif; font-size: 14px;">${htmlBody}</div>`),
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

function applyTemplate(text: string, vars: Record<string, string>) {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
    out = out.replace(re, v);
  }
  return out;
}

function pickSendProfile(planTier: PlanTier): { xMailer?: string; userAgent?: string; dedupeId?: string } {
  if (planTier === "gold") {
    return { xMailer: "Microsoft Outlook 16.0", userAgent: "Microsoft Outlook 16.0" };
  }
  if (planTier === "diamond") {
    const pool = [
      { xMailer: "iPhone Mail (20A362)", userAgent: "iPhone Mail (20A362)" },
      { xMailer: "Android Mail", userAgent: "Android Mail" },
      { xMailer: "Mozilla Thunderbird", userAgent: "Mozilla Thunderbird" },
      { xMailer: "Microsoft Outlook 16.0", userAgent: "Microsoft Outlook 16.0" },
    ];
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return { ...chosen, dedupeId: crypto.randomUUID() };
  }
  return {};
}

function getDelayMs(planTier: PlanTier): number {
  if (planTier === "gold") return 15_000;
  if (planTier === "diamond") return 15_000 + Math.floor(Math.random() * 30_001); // 15s..45s
  return 0;
}

function hashToIndex(s: string, mod: number): number {
  if (mod <= 1) return 0;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

function stripMarkdownFences(text: string): string {
  let t = String(text ?? "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return t.trim();
}

async function generateDiamondEmail(params: {
  resumeData: unknown;
  job: PublicJobRow;
  visaType: string;
}): Promise<{ subject: string; body: string }> {
  const { resumeData, job, visaType } = params;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("AI not configured");

  const systemPrompt =
    "You are an AI assistant helping a Brazilian worker apply for H-2A (Agricultural) and H-2B (Non-Agricultural) jobs in the USA. " +
    "Write a short, professional, and convincing email (cover letter) using ONLY the user's resume_data as the source of truth. " +
    "\n\nJOB REQUIREMENTS ARE CRITICAL: " +
    "The job requirements section tells you exactly what the employer wants. Address these requirements DIRECTLY in the email. " +
    "For each requirement the candidate meets, highlight it with **bold**. If there's a gap, emphasize willingness to learn. " +
    "\n\nSTRICT ANTI-HALLUCINATION RULES: " +
    "Use ONLY resume_data. Never invent skills, certifications, licenses, tools, years of experience, employers, or locations. " +
    "If the job requires something not present in resume_data, do NOT claim it—emphasize physical stamina, reliability, fast learning, hard work, and willingness to learn. " +
    "\n\nTONE & STYLE (Blue Collar Professional): " +
    "Humble, hardworking, reliable, respectful. Simple US English. No corporate speak. " +
    "BANNED: 'I hope this email finds you well' and desperate pleas like 'I really need this job'. " +
    "\n\nFORMATTING & STRUCTURE: " +
    "Write 3 to 6 short paragraphs. CRITICAL: Separate each paragraph with TWO newlines (a blank line between paragraphs). " +
    "Do NOT use bullet points, hyphens as lists, or numbered lists. " +
    "Max 230 words. " +
    "Paragraph guidance: " +
    "1) Greeting line (can vary: 'Hello,' or 'Dear Hiring Manager,'). " +
    "2) One sentence: applying for the specific job_title at the company. " +
    "3) Requirements match: This is the KEY paragraph. Address JOB REQUIREMENTS directly. Highlight matches with **bold**. " +
    "4) Availability & work attitude: highlight full availability (weekends/holidays/overtime). Mention reliability, safety, willingness to learn. " +
    "5) Closing: 'My resume is attached. Thank you.' then 'Best regards,'. " +
    "6) Signature block on separate lines: name, phone, email — ONLY if present in resume_data. " +
    "\n\nOUTPUT: Return JSON with {subject, body}. The body MUST contain multiple paragraphs separated by \\n\\n. No markdown fences.";

  const userPrompt =
    `Write a short job application email (cover letter) for this H-2A/H-2B job.\n` +
    `Visa type: ${visaType}\n` +
    `Company: ${job.company}\n` +
    `Job title: ${job.job_title}\n\n` +
    `Job description:\n${String(job.description ?? "").trim()}\n\n` +
    `Job duties (what the worker will do daily):\n${String((job as any).job_duties ?? "").trim() || "Not provided"}\n\n` +
    `⚠️ JOB REQUIREMENTS (CRITICAL - ADDRESS THESE DIRECTLY):\n${String(job.requirements ?? "").trim()}\n\n` +
    `Special requirements:\n${String((job as any).job_min_special_req ?? "").trim() || "Not provided"}\n\n` +
    `Additional wage info:\n${String((job as any).wage_additional ?? "").trim() || "Not provided"}\n\n` +
    `Pay deductions:\n${String((job as any).rec_pay_deductions ?? "").trim() || "Not provided"}\n\n` +
    `IMPORTANT: The requirements above are what the employer is looking for. Cross-reference with the candidate's resume and highlight matches.\n\n` +
    `Candidate resume_data (JSON):\n${JSON.stringify(resumeData)}\n\n` +
    `Address the job requirements and duties directly. Highlight matches. If there is no strong match, focus on physical effort and willingness to learn.`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!aiResp.ok) throw new Error(`AI error (${aiResp.status})`);
  const aiJson = await aiResp.json();
  const rawContent = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
  // Strip markdown fences if present (e.g., ```json ... ```)
  const cleanContent = stripMarkdownFences(rawContent);
  
  let parsed: { subject?: string; body?: string };
  try {
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${cleanContent.slice(0, 200)}`);
  }
  
  const subject = String(parsed?.subject ?? "").trim();
  let body = String(parsed?.body ?? "").trim();
  
  // Normalize paragraph breaks - ensure proper double newlines
  body = body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  
  if (!subject || !body) throw new Error("AI output missing subject or body");
  return { subject, body };
}

async function processOneUser(params: {
  serviceClient: any;
  userId: string;
  maxItems: number;
  queueIds?: string[];
}): Promise<{ processed: number; sent: number; failed: number }>
{
  const { serviceClient, userId, maxItems, queueIds } = params;

  const { data: profile, error: profileErr } = await serviceClient
    .from("profiles")
    .select("id,plan_tier,full_name,age,phone_e164,contact_email,resume_data,resume_url,credits_used_today,credits_reset_date,referral_bonus_limit,timezone,consecutive_errors")
    .eq("id", userId)
    .single();

  if (profileErr) throw profileErr;
  const p = profile as ProfileRow;
  if (p.plan_tier === "free") return { processed: 0, sent: 0, failed: 0 };

  // Daily limit enforcement (backend)
  const today = new Date().toISOString().slice(0, 10);
  let creditsUsed = Number(p.credits_used_today ?? 0);
  const resetDate = String(p.credits_reset_date ?? "");
  if (resetDate !== today) {
    creditsUsed = 0;
    await (serviceClient
      .from("profiles")
      .update({ credits_used_today: 0, credits_reset_date: today } as any)
      .eq("id", userId)) as any;
  }
  const dailyLimit = getDailyEmailLimit(p.plan_tier) + Number(p.referral_bonus_limit ?? 0);

  // Diamond: timezone awareness (send only during daytime)
  if (p.plan_tier === "diamond") {
    const tz = String(p.timezone ?? "UTC");
    const localHour = getLocalHour({ timeZone: tz });
    const withinWindow = localHour >= 8 && localHour < 19;
    if (!withinWindow) {
      return { processed: 0, sent: 0, failed: 0 };
    }
  }

  let consecutiveErrors = Number(p.consecutive_errors ?? 0);

  // No retry: if profile is incomplete, mark first pending as failed and stop
  if (!p.full_name || p.age == null || !p.phone_e164 || !p.contact_email) {
    const { data: one } = await serviceClient
      .from("my_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    const row = (one ?? [])[0] as { id: string } | undefined;
    if (row?.id) {
      await (serviceClient
        .from("my_queue")
        .update({
          status: "failed",
          last_error: "Perfil incompleto (nome/idade/telefone/email de contato)",
          last_attempt_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id)) as any;
      return { processed: 1, sent: 0, failed: 1 };
    }
    return { processed: 0, sent: 0, failed: 0 };
  }

  const { data: templates, error: tplErr } = await serviceClient
    .from("email_templates")
    .select("id,subject,body,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (tplErr) throw tplErr;
  const tpls = (templates ?? []) as EmailTemplateRow[];
  // Templates are required for Static plans (Free/Gold/Diamond). Black (Dynamic) can work without templates.
  const userSendingMethod = getSendingMethod(p.plan_tier);
  if (tpls.length === 0 && userSendingMethod === "static") {
    // Mark first pending as failed
    const { data: one } = await serviceClient
      .from("my_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    const row = (one ?? [])[0] as { id: string } | undefined;
    if (row?.id) {
      await (serviceClient
        .from("my_queue")
        .update({
          status: "failed",
          last_error: "Nenhum template encontrado",
          last_attempt_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id)) as any;
      return { processed: 1, sent: 0, failed: 1 };
    }
    return { processed: 0, sent: 0, failed: 0 };
  }

  const { data: creds, error: credsErr } = await serviceClient
    .from("smtp_credentials")
    .select("provider,email,has_password")
    .eq("user_id", userId)
    .maybeSingle();
  if (credsErr) throw credsErr;
  const c = creds as SmtpCredsRow | null;

  if (!c || !c.has_password) {
    const { data: one } = await serviceClient
      .from("my_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);
    const row = (one ?? [])[0] as { id: string } | undefined;
    if (row?.id) {
      await (serviceClient
        .from("my_queue")
        .update({
          status: "failed",
          last_error: "SMTP não configurado",
          last_attempt_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id)) as any;
      return { processed: 1, sent: 0, failed: 1 };
    }
    return { processed: 0, sent: 0, failed: 0 };
  }

  const { data: secret, error: secretErr } = await serviceClient
    .from("smtp_credentials_secrets")
    .select("password")
    .eq("user_id", userId)
    .single();
  if (secretErr) throw secretErr;
  const s = secret as SmtpSecretRow;

  const provider: EmailProvider = c.provider === "outlook" ? "outlook" : "gmail";
  const smtpEmail = c.email;
  const smtpPassword = s.password;
  const smtpConfig = SMTP_CONFIGS[provider];

  let q = serviceClient
    .from("my_queue")
    .select("id,user_id,status,job_id,manual_job_id,tracking_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (queueIds && Array.isArray(queueIds) && queueIds.length > 0) {
    q = q.in("id", queueIds);
  }

  const { data: pending, error: qErr } = await q.limit(maxItems);
  if (qErr) throw qErr;
  const rows = (pending ?? []) as QueueRow[];

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];

    // Circuit breaker: pause remaining queue if too many consecutive errors
    if (consecutiveErrors >= 3) {
      await (serviceClient
        .from("my_queue")
        .update({
          status: "paused",
          last_error: "Pausado por 3 erros consecutivos. Verifique SMTP e tente novamente.",
        } as any)
        .eq("user_id", userId)
        .eq("status", "pending")) as any;
      break;
    }

    if (creditsUsed >= dailyLimit) {
      // Mark the current row as failed and stop processing further rows
      await (serviceClient
        .from("my_queue")
        .update({
          status: "failed",
          processing_started_at: null,
          last_error: `Limite diário atingido (${dailyLimit}/dia)`,
          last_attempt_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id)) as any;
      processed += 1;
      failed += 1;
      break;
    }

    // lock row
    const { data: locked, error: lockErr } = await serviceClient
      .from("my_queue")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        last_error: null,
      } as any)
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (lockErr) throw lockErr;
    if (!locked) continue;

    processed += 1;
    
    // Generate unique tracking_id for this specific send (declared outside try for error handling scope)
    const historyTrackingId = crypto.randomUUID();

    try {
      let job:
        | (PublicJobRow & { eta_number?: string | null; phone?: string | null })
        | (ManualJobRow & { visa_type?: string | null })
        | null = null;

      if (row.job_id) {
        const { data: pj, error: pjErr } = await serviceClient
          .from("public_jobs")
          .select("id,company,job_title,email,visa_type,description,requirements")
          .eq("id", row.job_id)
          .maybeSingle();
        if (pjErr) throw pjErr;
        job = pj as PublicJobRow | null;
      } else if (row.manual_job_id) {
        const { data: mj, error: mjErr } = await serviceClient
          .from("manual_jobs")
          .select("id,company,job_title,email,eta_number,phone")
          .eq("id", row.manual_job_id)
          .maybeSingle();
        if (mjErr) throw mjErr;
        job = mj as ManualJobRow | null;
      }

      if (!job?.email) throw new Error("Destino (email) ausente");

      // Validate email domain before sending (prevent hard bounces)
      const emailValidation = await validateEmailDNS(job.email);
      if (!emailValidation.valid) {
        await (serviceClient
          .from("my_queue")
          .update({
            status: "skipped_invalid_domain",
            processing_started_at: null,
            last_error: emailValidation.reason ?? "Domínio de e-mail inválido",
            last_attempt_at: new Date().toISOString(),
          } as any)
          .eq("id", row.id)) as any;
        failed += 1;
        console.log(`[MX-SKIP] user=${userId} queue=${row.id} email=${job.email} reason=${emailValidation.reason}`);
        continue;
      }

      const visaType = ("visa_type" in job && job.visa_type === "H-2A") ? "H-2A" : "H-2B";
      const fallbackTpl =
        tpls.length > 0
          ? tpls[hashToIndex(String(row.tracking_id ?? row.id), tpls.length)] ?? tpls[0]
          : null;

      const vars: Record<string, string> = {
        name: p.full_name ?? "",
        age: String(p.age ?? ""),
        phone: p.phone_e164 ?? "",
        contact_email: p.contact_email ?? "",
        company: (job as any).company ?? "",
        position: (job as any).job_title ?? "",
        visa_type: visaType,
        eta_number: ("eta_number" in job ? (job.eta_number ?? "") : ""),
        company_phone: ("phone" in job ? (job.phone ?? "") : ""),
        job_phone: ("phone" in job ? (job.phone ?? "") : ""),
      };

      let finalSubject = fallbackTpl ? applyTemplate(fallbackTpl.subject, vars) : "";
      let htmlBody = fallbackTpl ? applyTemplate(fallbackTpl.body, vars).replace(/\n/g, "<br>") : "";

      // Black (Dynamic method): AI generates unique email per job. Fallback to templates if AI fails or resume_data missing.
      const sendingMethod = getSendingMethod(p.plan_tier);
      if (sendingMethod === "dynamic" && row.job_id) {
        try {
          if (!p.resume_data) throw new Error("resume_data_missing");
          const pj = job as PublicJobRow;
          const ai = await generateDiamondEmail({ resumeData: p.resume_data, job: pj, visaType });
          finalSubject = ai.subject;
          htmlBody = ai.body.replace(/\n/g, "<br>");
        } catch (e) {
          // If there's no template fallback, Black must fail explicitly.
          if (!fallbackTpl) throw e;
          // otherwise keep fallback
        }
      }

      if (!finalSubject.trim() || !htmlBody.trim()) {
        throw new Error("no_email_content");
      }


      // Open tracking pixel - uses history-specific tracking_id for per-send tracking
      const pixelUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/track-email-open?id=${encodeURIComponent(historyTrackingId)}`;
      htmlBody += `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;

      const sendProfile = pickSendProfile(p.plan_tier);
      const extraHeaders: string[] = [];
      if (sendProfile.xMailer) extraHeaders.push(`X-Mailer: ${sendProfile.xMailer}`);
      if (sendProfile.userAgent) extraHeaders.push(`User-Agent: ${sendProfile.userAgent}`);
      if (sendProfile.dedupeId) {
        htmlBody +=
          `<div style="display:none; opacity:0; height:0; width:0; overflow:hidden;">` +
          `${sendProfile.dedupeId}` +
          `</div>`;
      }

      // Fetch resume PDF attachment if available
      let attachment: { name: string; content: Uint8Array; mimeType: string } | undefined;
      if (p.resume_url) {
        try {
          const resumeResp = await withTimeout(fetch(p.resume_url), 15000, "fetch resume");
          if (resumeResp.ok) {
            const arrayBuffer = await withTimeout(resumeResp.arrayBuffer(), 20000, "read resume");
            // Extract filename from URL or use default
            const urlParts = p.resume_url.split("/");
            const fileName = urlParts[urlParts.length - 1]?.split("?")[0] || "resume.pdf";
            attachment = {
              name: fileName,
              content: new Uint8Array(arrayBuffer),
              mimeType: "application/pdf",
            };
          }
        } catch (_e) {
          // Non-fatal: continue without attachment
          console.warn(`[RESUME-ATTACH] Failed to fetch resume for user ${userId}: ${_e}`);
        }
      }

      const rawMessage = createMimeMessage({
        from: smtpEmail,
        to: job.email,
        subject: finalSubject,
        htmlBody,
        extraHeaders,
        attachment,
      });

      if (smtpConfig.useStartTls) {
        await sendEmailSMTPStartTls({
          host: smtpConfig.host,
          port: smtpConfig.port,
          user: smtpEmail,
          password: smtpPassword,
          to: job.email,
          rawMessage,
        });
      } else {
        await sendEmailSMTPTls({
          host: smtpConfig.host,
          port: smtpConfig.port,
          user: smtpEmail,
          password: smtpPassword,
          to: job.email,
          rawMessage,
        });
      }

      await (serviceClient
        .from("my_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          processing_started_at: null,
          last_error: null,
        } as any)
        .eq("id", row.id)) as any;

      // Log send history with unique tracking_id for this specific send
      await (serviceClient
        .from("queue_send_history")
        .insert({
          queue_id: row.id,
          user_id: userId,
          sent_at: new Date().toISOString(),
          status: "success",
          tracking_id: historyTrackingId,
        } as any)) as any;

      sent += 1;
      creditsUsed += 1;
      await (serviceClient
        .from("profiles")
        .update({ credits_used_today: creditsUsed, credits_reset_date: today, consecutive_errors: 0 } as any)
        .eq("id", userId)) as any;

      consecutiveErrors = 0;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao enviar";
      await (serviceClient
        .from("my_queue")
        .update({
          status: "failed",
          processing_started_at: null,
          last_error: message,
          last_attempt_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id)) as any;

      // Log failed send history with tracking_id for consistency
      await (serviceClient
        .from("queue_send_history")
        .insert({
          queue_id: row.id,
          user_id: userId,
          sent_at: new Date().toISOString(),
          status: "failed",
          error_message: message,
          tracking_id: historyTrackingId,
        } as any)) as any;

      failed += 1;

      if (isCircuitBreakerError(message)) {
        consecutiveErrors += 1;
        await (serviceClient
          .from("profiles")
          .update({ consecutive_errors: consecutiveErrors } as any)
          .eq("id", userId)) as any;
      }
    }

    if (idx < rows.length - 1) {
      const ms = getDelayMs(p.plan_tier);
      if (ms > 0) await sleep(ms);
    }
  }

  return { processed, sent, failed };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceClient: any = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cronToken = req.headers.get("x-cron-token");

    // Mode A: cron calls without user session -> process multiple premium users
    if (cronToken) {
      const { data: settings, error: settingsErr } = await serviceClient
        .from("app_settings")
        .select("cron_token")
        .eq("id", 1)
        .single();
      if (settingsErr) throw settingsErr;

      const expected = String((settings as { cron_token: string }).cron_token);
      if (String(cronToken) !== expected) {
        return json(401, { ok: false, error: "Unauthorized" });
      }

      const { data: users, error: uErr } = await serviceClient
        .from("profiles")
        .select("id,plan_tier")
        .in("plan_tier", ["gold", "diamond"])
        .limit(200);
      if (uErr) throw uErr;

      let usersTouched = 0;
      let processed = 0;
      let sent = 0;
      let failed = 0;

      for (const u of (users ?? []) as Array<{ id: string }>) {
        const r = await processOneUser({ serviceClient, userId: u.id, maxItems: 2 });
        if (r.processed > 0) usersTouched += 1;
        processed += r.processed;
        sent += r.sent;
        failed += r.failed;
      }

      return json(200, { ok: true, mode: "cron", usersTouched, processed, sent, failed });
    }

    // Mode B: authenticated user request -> process only their own queue (premium only)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json(401, { ok: false, error: "Unauthorized" });
    }
    const userId = claimsData.claims.sub;

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("plan_tier")
      .eq("id", userId)
      .maybeSingle();
    const tier = (profile as { plan_tier?: PlanTier } | null)?.plan_tier ?? "free";
    if (tier === "free") {
      return json(403, { ok: false, error: "Free plan must keep the browser open" });
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const ids = Array.isArray(body?.ids)
      ? (body.ids as unknown[]).filter((x) => typeof x === "string")
      : null;
    const safeIds = ids ? (ids as string[]).slice(0, 50) : undefined;
    const maxItems = safeIds ? safeIds.length : 5;

    const r = await processOneUser({ serviceClient, userId, maxItems, queueIds: safeIds });
    return json(200, { ok: true, mode: "user", ...r });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return json(500, { ok: false, error: errorMessage });
  }
};

serve(handler);

