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

function stripMarkdownFences(text: string): string {
  return String(text ?? "")
    .trim()
    .replace(/^```[a-zA-Z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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
  // Ensure clean paragraph breaks while keeping user-intended newlines.
  const t = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t;
}

// Force paragraph breaks if the AI returns a wall of text without proper breaks.
// ALWAYS split long text into 4-6 paragraphs for readability.
function forceParagraphBreaks(text: string): string {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return trimmed;

  // Flatten to single line for processing (remove all existing breaks)
  const flat = trimmed.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  
  // If short text (<300 chars), return as-is
  if (flat.length < 300) {
    return trimmed;
  }

  // Split into sentences using multiple end-of-sentence markers
  // Match: period/exclamation/question followed by space and capital letter OR end
  const sentences: string[] = [];
  let current = "";
  
  for (let i = 0; i < flat.length; i++) {
    current += flat[i];
    const char = flat[i];
    const nextChar = flat[i + 1] || "";
    const charAfter = flat[i + 2] || "";
    
    // End of sentence: . ! ? followed by space and capital letter
    if ((char === "." || char === "!" || char === "?") && nextChar === " " && /[A-Z]/.test(charAfter)) {
      sentences.push(current.trim());
      current = "";
      i++; // skip the space
    }
  }
  
  // Push remaining text
  if (current.trim()) {
    sentences.push(current.trim());
  }
  
  if (sentences.length < 3) {
    return trimmed; // Not enough sentences
  }

  // Calculate sentences per paragraph (aim for 4-6 paragraphs)
  const targetParagraphs = Math.min(6, Math.max(4, Math.floor(sentences.length / 2)));
  const sentencesPerParagraph = Math.max(2, Math.ceil(sentences.length / targetParagraphs));
  
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Check if this is a signature/closing line
    const isSignature = /^(Best regards|Thank you|Sincerely|Atenciosamente|Obrigado)/i.test(sentence);
    
    if (isSignature && currentParagraph.length > 0) {
      // Finish current paragraph, put signature in its own
      paragraphs.push(currentParagraph.join(" "));
      paragraphs.push(sentence);
      currentParagraph = [];
      continue;
    }
    
    currentParagraph.push(sentence);
    
    // Break paragraph when we have enough sentences
    if (currentParagraph.length >= sentencesPerParagraph) {
      paragraphs.push(currentParagraph.join(" "));
      currentParagraph = [];
    }
  }
  
  // Add remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(" "));
  }
  
  // Ensure we have at least 4 paragraphs for long content
  if (paragraphs.length < 4 && flat.length > 600) {
    // Re-split more aggressively (2 sentences per paragraph)
    const aggressive: string[] = [];
    let aggCurrent: string[] = [];
    for (const s of sentences) {
      aggCurrent.push(s);
      if (aggCurrent.length >= 2) {
        aggressive.push(aggCurrent.join(" "));
        aggCurrent = [];
      }
    }
    if (aggCurrent.length > 0) {
      aggressive.push(aggCurrent.join(" "));
    }
    return aggressive.join("\n\n");
  }
  
  return paragraphs.join("\n\n");
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

  // If the model didn't include the required signature details, enforce them deterministically.
  const hasBestRegards = /\bBest regards\b/i.test(trimmed);
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

  // Avoid duplicating sign-off: if it already has Best regards, just append missing lines.
  if (hasBestRegards) {
    return normalizeParagraphs(`${trimmed}\n${sigLines.slice(1).join("\n")}`);
  }

  return normalizeParagraphs(`${trimmed}\n\n${sigLines.join("\n")}`);
}

const requestSchema = z.object({
  queueId: z.string().uuid(),
});

const responseSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

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

    // Signature sources of truth (prefer profile fields; fall back to resume_data keys if present)
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

    // Enhanced prompt with strict visual layout rules
    const systemPrompt = `You are an expert assistant helping a Brazilian worker apply for H-2A/H-2B manual labor jobs.

Your goal is to write a high-converting, professional email based on resume_data, job_description, and ESPECIALLY the JOB REQUIREMENTS.

### 0. JOB REQUIREMENTS ARE CRITICAL ⚠️

* **REQUIREMENTS FIRST:** The job requirements section is the MOST IMPORTANT part. Read them carefully and address how the candidate meets each requirement.
* **Direct Match:** If the candidate's resume_data shows experience matching a requirement, highlight it with **bold**.
* **Honest Gaps:** If the candidate lacks a specific requirement, emphasize willingness to learn, physical strength, and reliability instead. NEVER invent skills.

### 1. DYNAMIC VARIATION RULES (CRITICAL) ⚠️

* **Avoid Repetition:** You must NOT generate the exact same text every time. Vary your vocabulary and sentence structure while keeping the meaning.

* **Tone:** Humble, hardworking, direct, and polite. Use simple English (A2/B1 level). Avoid complex corporate jargon.

### 2. STRICT VISUAL LAYOUT RULES

* **NO WALLS OF TEXT:** Break the email into short, distinct paragraphs.

* **SPACING:** You MUST insert a double line break (\\n\\n) between EVERY paragraph. This is CRITICAL.

* **NO BULLET POINTS:** Write in full sentences only.

### 3. CONTENT STRUCTURE (Follow this exact sequence with paragraph breaks)

**Block 1: Salutation & Opening**
- Start with "Hello," or "Dear Hiring Manager,"
- Vary the opening: "I am writing to apply...", "I am expressing my strong interest...", "I wish to submit my application..."
- Mention the specific **Job Title** and **Company Name** in bold.
- Mention age and years of experience (e.g., "At **25 years old**, I have 4 years of experience...").

[INSERT DOUBLE LINE BREAK HERE]

**Block 2: Requirements Match (MOST IMPORTANT)**
- This is the KEY paragraph. Address the JOB REQUIREMENTS directly.
- For each requirement the candidate meets, state it clearly with **bold**.
- Example: "I have **3 years of landscaping experience** as required, and I am **comfortable operating power tools**."
- If the job requires something not in resume, say "I am a **fast learner** and ready to be trained."

[INSERT DOUBLE LINE BREAK HERE]

**Block 3: The "Hook" (Availability)**
- CRUCIAL: State clearly that you are available for **Weekends, Holidays, and Overtime**.
- Variation: Sometimes say "fully available for weekends", other times "ready to work 7 days a week", or "willing to work long hours and holidays".

[INSERT DOUBLE LINE BREAK HERE]

**Block 4: Hard Skills & Reliability**
- Mention physical stamina (lifting 50lb+).
- Mention reliability ("I show up on time").
- Mention languages (Native Portuguese, Intermediate English).

[INSERT DOUBLE LINE BREAK HERE]

**Block 5: Closing**
- "I am ready to start immediately." or "I can join the team right away."
- "Thank you for your time."

[INSERT DOUBLE LINE BREAK HERE]

**Block 6: Sign-off**
- "Best regards," or "Sincerely,"
- [User Name]
- [Phone Number]
- [Email]

### 4. ANTI-HALLUCINATION

* If the resume lacks specific skills for the job, emphasize "Fast Learner", "Hardworking", and "Physical Strength" instead of inventing skills.
* NEVER invent certifications, licenses, employers, or skills not in resume_data.

### 5. BOLD TEXT USAGE

Use **bold** (double asterisks) to highlight:
- Job title and company name
- Age (e.g., "At **25 years old**")
- Requirements the candidate meets (e.g., "**3 years of landscaping experience**")
- Availability (e.g., "**weekends, holidays, and overtime**")
- Key traits like **physically fit**, **quick learner**, **reliable**

### 6. OUTPUT FORMAT

Return ONLY the email body text. Each paragraph MUST be separated by exactly two newlines (\\n\\n).
NO JSON. NO code fences. NO markdown headers. Maximum 280 words.`;

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
      `=== JOB INFORMATION ===\n${jobContext}\n\n` +
      `=== JOB DESCRIPTION ===\n${jobDescription || "Not provided"}\n\n` +
      `=== JOB DUTIES (What the worker will do daily) ===\n${jobDuties || "Not provided"}\n\n` +
      `=== ⚠️ JOB REQUIREMENTS (CRITICAL - ADDRESS THESE DIRECTLY) ===\n${jobRequirements || "Not provided"}\n\n` +
      `=== SPECIAL REQUIREMENTS ===\n${jobMinSpecialReq || "Not provided"}\n\n` +
      `IMPORTANT: The requirements above are what the employer is looking for. Cross-reference with the candidate's resume and highlight matches.\n\n` +
      `=== SIGNATURE CONTACT (Use these exact values in sign-off) ===\n` +
      `Full name: ${fullName || "(missing)"}\n` +
      `Phone: ${phone || "(missing)"}\n` +
      `Email: ${email || "(missing)"}\n\n` +
      `=== CANDIDATE RESUME DATA (Source of Truth - JSON) ===\n${JSON.stringify(resumeData, null, 2)}\n\n` +
      `Write a personalized cover letter email. Address the JOB REQUIREMENTS and JOB DUTIES directly. Each paragraph MUST be separated by double line breaks (\\n\\n).`;


    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      return json(aiResp.status, { success: false, error: `AI error (${aiResp.status})`, details: t.slice(0, 500) });
    }

    const aiJson = await aiResp.json();
    const raw = String(aiJson?.choices?.[0]?.message?.content ?? "");
    const unfenced = stripMarkdownFences(raw);
    const normalized = normalizeParagraphs(unfenced);
    
    // Force paragraph breaks if AI returned a wall of text
    const withParagraphs = forceParagraphBreaks(normalized);

    // Ensure required signature details (then enforce the 280-word cap).
    const withSignature = ensureSignature({ body: withParagraphs, fullName, phone, email });

    // Force the 280-word cap even if the model overshoots (4-7 paragraphs).
    const body = limitWords(withSignature, 280);
    if (!body) {
      return json(500, {
        success: false,
        error: "AI returned empty body",
        details: normalized.slice(0, 800),
      });
    }

    // Subject is deterministic to avoid JSON/formatting failures.
    const subjectBase = jobTitle ? `Application for ${jobTitle}` : "Job application";
    const subject = subjectBase.slice(0, 78);

    const validated = responseSchema.safeParse({ subject, body });
    if (!validated.success) {
      return json(500, { success: false, error: "AI output validation failed" });
    }

    return json(200, { success: true, ...validated.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(500, { success: false, error: message });
  }
});
