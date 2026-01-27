import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function limitWords(text: string, maxWords: number): string {
  const cleaned = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const words = cleaned.split(" ");
  if (words.length <= maxWords) return cleaned;
  return words.slice(0, maxWords).join(" ").trim();
}

function normalizeParagraphs(text: string): string {
  const t = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t;
}

function normalizePhone(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  return s;
}

function normalizeEmail(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  return s;
}

function ensureSignature(params: { body: string; fullName: string; phone: string; email: string }): string {
  const { body, fullName, phone, email } = params;
  const trimmed = String(body ?? "").trim();
  if (!trimmed) return trimmed;

  const hasBestRegards = /\b(Best regards|Sincerely|Thank you)\b/i.test(trimmed);
  const hasName = fullName ? new RegExp(fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(trimmed) : false;
  const hasEmail = email ? new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(trimmed) : false;
  const hasPhone = phone ? trimmed.includes(phone) : false;

  if (hasBestRegards && hasName && (email ? hasEmail : true) && (phone ? hasPhone : true)) {
    return trimmed;
  }

  const sigLines = [
    "Best regards,",
    fullName || "",
    phone || "",
    email || "",
  ].filter(Boolean);

  if (hasBestRegards) {
    return normalizeParagraphs(`${trimmed}\n${sigLines.slice(1).join("\n")}`);
  }

  return normalizeParagraphs(`${trimmed}\n\n${sigLines.join("\n")}`);
}

const requestSchema = z.object({
  queueId: z.string().uuid(),
});

// AI preferences type
interface AIPreferences {
  paragraph_style: "single" | "multiple";
  email_length: "short" | "medium" | "long";
  formality_level: "casual" | "professional" | "formal";
  greeting_style: "hello" | "dear_manager" | "dear_team" | "varied";
  closing_style: "best_regards" | "sincerely" | "thank_you" | "varied";
  emphasize_availability: boolean;
  emphasize_physical_strength: boolean;
  emphasize_languages: boolean;
  custom_instructions: string | null;
}

const defaultPreferences: AIPreferences = {
  paragraph_style: "multiple",
  email_length: "medium",
  formality_level: "professional",
  greeting_style: "varied",
  closing_style: "best_regards",
  emphasize_availability: true,
  emphasize_physical_strength: true,
  emphasize_languages: true,
  custom_instructions: null,
};

function buildDynamicPrompt(prefs: AIPreferences, fullName: string, phone: string, email: string): string {
  // Greeting variations based on preference
  const greetingInstructions = {
    hello: "Always start with 'Hello,' - simple and direct.",
    dear_manager: "Always start with 'Dear Hiring Manager,'",
    dear_team: "Always start with 'Dear [Company] Team,' using the company name.",
    varied: `CRITICAL: Vary the greeting EVERY time. Use one of these randomly:
    - "Hello,"
    - "Good day,"
    - "Dear [Company] Team,"
    - "Dear Hiring Team,"
    - "Greetings,"
    NEVER use "Dear Hiring Manager" - it's overused and generic.`,
  }[prefs.greeting_style];

  // Closing variations
  const closingInstructions = {
    best_regards: "End with 'Best regards,'",
    sincerely: "End with 'Sincerely,'",
    thank_you: "End with 'Thank you for your consideration,'",
    varied: `Vary the closing. Use one of: "Best regards,", "Sincerely,", "Thank you,", "Respectfully,"`,
  }[prefs.closing_style];

  // Length instructions
  const lengthInstructions = {
    short: "Keep the email SHORT: 3-4 paragraphs, under 150 words total.",
    medium: "Keep the email MEDIUM length: 4-5 paragraphs, around 180-220 words.",
    long: "Write a COMPLETE email: 5-7 paragraphs, around 250-300 words.",
  }[prefs.email_length];

  // Paragraph style
  const paragraphInstructions = prefs.paragraph_style === "single"
    ? "Write in a SINGLE flowing paragraph with minimal breaks."
    : "Use MULTIPLE short paragraphs. Each paragraph should be 2-3 sentences. Insert \\n\\n between paragraphs.";

  // Formality
  const formalityInstructions = {
    casual: "Use a casual, friendly tone. Be approachable but still respectful.",
    professional: "Use a professional but warm tone. Be direct and confident.",
    formal: "Use a formal, respectful tone. Be courteous and traditional.",
  }[prefs.formality_level];

  // Emphasis sections
  const emphasisParts: string[] = [];
  if (prefs.emphasize_availability) {
    emphasisParts.push("EMPHASIZE: Full availability for weekends, holidays, overtime. State this clearly.");
  }
  if (prefs.emphasize_physical_strength) {
    emphasisParts.push("EMPHASIZE: Physical stamina, ability to lift 50lb+, endurance for long work days.");
  }
  if (prefs.emphasize_languages) {
    emphasisParts.push("MENTION: Language skills - Native Portuguese, Intermediate/Basic English.");
  }

  const customNote = prefs.custom_instructions 
    ? `\n\nUSER'S CUSTOM INSTRUCTIONS (FOLLOW THESE):\n${prefs.custom_instructions}`
    : "";

  return `You are an expert assistant helping a Brazilian worker apply for H-2A/H-2B seasonal visa jobs in the USA.

### CRITICAL: UNIQUENESS REQUIREMENTS
Each email MUST be unique. Vary:
- Opening phrase structure
- Sentence order within paragraphs
- Word choices and synonyms
- How you present qualifications

### GREETING RULE
${greetingInstructions}

### LENGTH & STRUCTURE
${lengthInstructions}
${paragraphInstructions}

### TONE & FORMALITY
${formalityInstructions}
Use simple English (A2/B1 level). Avoid corporate jargon.

### CONTENT PRIORITIES
${emphasisParts.join("\n")}

### JOB REQUIREMENTS ARE CRITICAL
Read the job requirements section carefully. For each requirement the candidate meets, highlight it with **bold text**.
If the candidate lacks a requirement, emphasize willingness to learn and physical strength instead.

### ANTI-HALLUCINATION RULES
- ONLY use information from the provided resume_data
- NEVER invent skills, certifications, employers, or experiences
- If unsure, emphasize "Fast Learner", "Hardworking", "Reliable"

### SIGNATURE BLOCK
${closingInstructions}
Then on separate lines:
- ${fullName || "[Name]"}
- ${phone || "[Phone]"}
- ${email || "[Email]"}
${customNote}`;
}

// Tool definition for structured output
const emailToolDefinition = {
  type: "function" as const,
  function: {
    name: "generate_email",
    description: "Generate a job application email with subject and body",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Email subject line, max 78 characters",
        },
        body: {
          type: "string",
          description: "Email body with paragraphs separated by \\n\\n",
        },
      },
      required: ["subject", "body"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { success: false, error: "Unauthorized" });

    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return json(401, { success: false, error: "Unauthorized" });

    const payload = requestSchema.safeParse(await req.json().catch(() => null));
    if (!payload.success) return json(400, { success: false, error: "Invalid request" });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await serviceClient
      .from("profiles")
      .select("plan_tier,resume_data,full_name,phone_e164,contact_email,email")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if ((profile as any)?.plan_tier !== "black") {
      return json(403, { success: false, error: "Black plan only" });
    }

    const resumeData = (profile as any)?.resume_data;
    if (!resumeData) {
      return json(400, { success: false, error: "resume_data_missing" });
    }

    // Fetch user's AI preferences
    const { data: prefsRow } = await serviceClient
      .from("ai_generation_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    const prefs: AIPreferences = prefsRow ? { ...defaultPreferences, ...prefsRow } : defaultPreferences;

    // Signature sources of truth
    const fullName = String((profile as any)?.full_name ?? (resumeData as any)?.full_name ?? (resumeData as any)?.name ?? "").trim();
    const phone = normalizePhone((profile as any)?.phone_e164 ?? (resumeData as any)?.phone_e164 ?? (resumeData as any)?.phone ?? "");
    const email = normalizeEmail((profile as any)?.contact_email ?? (profile as any)?.email ?? (resumeData as any)?.email ?? "");

    const { data: queueRow, error: qErr } = await serviceClient
      .from("my_queue")
      .select(
        `id, user_id, job_id, manual_job_id,
         public_jobs (company, job_title, visa_type, description, requirements, weekly_hours, salary, start_date, end_date, housing_info, job_duties, job_min_special_req, wage_additional, rec_pay_deductions),
         manual_jobs (company, job_title)`
      )
      .eq("id", payload.data.queueId)
      .eq("user_id", userId)
      .maybeSingle();
    if (qErr) throw qErr;

    const job = (queueRow as any)?.public_jobs ?? (queueRow as any)?.manual_jobs;
    if (!job) return json(404, { success: false, error: "Queue item not found" });

    const jobDescription = String((job as any)?.description ?? "").trim();
    const jobRequirements = String((job as any)?.requirements ?? "").trim();
    const jobTitle = String((job as any)?.job_title ?? "").trim();
    const company = String((job as any)?.company ?? "").trim();
    const visaType = String((job as any)?.visa_type ?? "H-2B").trim();
    const weeklyHours = (job as any)?.weekly_hours ?? null;
    const salary = (job as any)?.salary ?? null;
    const startDate = (job as any)?.start_date ?? null;
    const endDate = (job as any)?.end_date ?? null;
    const housingInfo = String((job as any)?.housing_info ?? "").trim();
    const jobDuties = String((job as any)?.job_duties ?? "").trim();
    const jobMinSpecialReq = String((job as any)?.job_min_special_req ?? "").trim();
    const wageAdditional = String((job as any)?.wage_additional ?? "").trim();
    const recPayDeductions = String((job as any)?.rec_pay_deductions ?? "").trim();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    // Build dynamic system prompt based on user preferences
    const systemPrompt = buildDynamicPrompt(prefs, fullName, phone, email);

    const jobContext = [
      `Visa type: ${visaType}`,
      `Company: ${company}`,
      `Job title: ${jobTitle}`,
      weeklyHours ? `Weekly hours: ${weeklyHours}` : null,
      salary ? `Salary: $${salary}/hour` : null,
      startDate ? `Start date: ${startDate}` : null,
      endDate ? `End date: ${endDate}` : null,
      housingInfo ? `Housing: ${housingInfo}` : null,
      wageAdditional ? `Additional wage info: ${wageAdditional}` : null,
      recPayDeductions ? `Pay deductions: ${recPayDeductions}` : null,
    ].filter(Boolean).join("\n");

    const userPrompt =
      `Generate a job application email for this position.\n\n` +
      `=== JOB INFORMATION ===\n${jobContext}\n\n` +
      `=== JOB DESCRIPTION ===\n${jobDescription || "Not provided"}\n\n` +
      `=== JOB DUTIES ===\n${jobDuties || "Not provided"}\n\n` +
      `=== JOB REQUIREMENTS (ADDRESS THESE DIRECTLY) ===\n${jobRequirements || "Not provided"}\n\n` +
      `=== SPECIAL REQUIREMENTS ===\n${jobMinSpecialReq || "Not provided"}\n\n` +
      `=== CANDIDATE RESUME (Source of Truth) ===\n${JSON.stringify(resumeData, null, 2)}`;

    // Use tool calling for structured output - LOW TEMPERATURE for consistency
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.3, // LOW temperature for consistency
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [emailToolDefinition],
        tool_choice: { type: "function", function: { name: "generate_email" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      return json(aiResp.status, { success: false, error: `AI error (${aiResp.status})`, details: t.slice(0, 500) });
    }

    const aiJson = await aiResp.json();
    
    // Extract from tool call response
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "generate_email") {
      // Fallback: try to parse content as before
      const raw = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
      return json(500, { success: false, error: "AI did not use tool calling", details: raw.slice(0, 500) });
    }

    let parsed: { subject?: string; body?: string };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return json(500, { success: false, error: "AI returned invalid JSON in tool call" });
    }

    const subject = String(parsed?.subject ?? "").trim().slice(0, 78) || `Application for ${jobTitle}`;
    let body = String(parsed?.body ?? "").trim();
    
    // Normalize paragraphs
    body = normalizeParagraphs(body);
    
    // Ensure signature is present
    body = ensureSignature({ body, fullName, phone, email });

    // Apply word limit based on preference
    const wordLimits = { short: 180, medium: 250, long: 320 };
    body = limitWords(body, wordLimits[prefs.email_length]);

    if (!body) {
      return json(500, { success: false, error: "AI returned empty body" });
    }

    return json(200, { success: true, subject, body });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(500, { success: false, error: message });
  }
});
