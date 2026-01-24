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
      .select("plan_tier,resume_data")
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

    const { data: queueRow, error: qErr } = await serviceClient
      .from("my_queue")
      .select(
        `id, user_id, job_id, manual_job_id,
         public_jobs (company, job_title, visa_type, description, requirements, weekly_hours, salary, start_date, end_date, housing_info),
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    // Enhanced prompt following the exact example structure
    const systemPrompt = `You are an AI assistant helping a Brazilian worker apply for H-2A (Agricultural) and H-2B (Non-Agricultural) seasonal jobs in the USA.

Write a professional, convincing cover letter email. You MUST cross-reference the job description/requirements with the user's resume_data to create a personalized email.

=== STRICT ANTI-HALLUCINATION RULES ===
- Use ONLY information from resume_data. NEVER invent skills, certifications, licenses, tools, years of experience, employers, or locations.
- If the job requires something NOT in resume_data, do NOT claim it. Instead, emphasize: physical stamina, reliability, trustworthiness, fast learning, hard work, dedication, and willingness to learn.
- Focus on transferable qualities: punctuality, discipline, availability, team player, follows instructions precisely.

=== TONE & STYLE (Blue Collar Professional) ===
- Humble, hardworking, reliable, respectful, direct.
- Simple US English. No corporate jargon.
- BANNED phrases: "I hope this email finds you well", "I really need this job", desperate pleas, overly formal language.

=== BOLD TEXT USAGE ===
Use **bold** to highlight KEY information that makes the candidate stand out:
- **job_title** and **company name** in opening
- **age** (e.g., "At **25 years old**")
- **full availability** (e.g., "**weekends (Saturdays and Sundays), holidays, and overtime**")
- Key traits like **physically fit**, **quick learner**, **reliable**
- Languages if relevant (e.g., "**intermediate English**")

=== EMAIL STRUCTURE (4-7 paragraphs, vary each email) ===

1) GREETING: Start with "Hello," or "Dear Hiring Manager," (vary between emails)

2) OPENING PARAGRAPH: State you're applying for the **[job_title]** at **[company]** under the [visa_type] program. Mention age and 2-3 key qualities that match what the job is looking for.

3) AVAILABILITY PARAGRAPH: Emphasize **full availability** - ready to work **weekends (Saturdays and Sundays), holidays, and overtime** whenever necessary. State that the job is your priority and you're fully committed to meeting schedule demands.

4) SKILLS/EXPERIENCE PARAGRAPH: As a hardworking laborer, eager to join and contribute immediately. Mention physical fitness, capability to lift heavy materials (50lb+), accustomed to fast-paced environments. Emphasize punctuality and readiness to work every day.

5) ADDITIONAL QUALITIES PARAGRAPH: Quick learner who follows instructions precisely to ensure safety and quality. Mention languages from resume_data (e.g., native Portuguese speaker with intermediate English and basic Spanish).

6) CLOSING PARAGRAPH: Ready to start immediately and would appreciate the opportunity to discuss how to contribute to the team.

7) SIGN-OFF: "Best regards," followed by signature block on separate lines.

=== SIGNATURE BLOCK ===
After "Best regards," add on separate lines:
- Full name (from resume_data)
- Phone number (from resume_data, if available)
- Email address (from resume_data, if available)

=== OUTPUT REQUIREMENTS ===
- Return ONLY the email body text with paragraph breaks (double newlines between paragraphs).
- NO JSON. NO code fences. NO markdown headers.
- Maximum 280 words (can be shorter if natural).
- Each email should feel unique - vary paragraph order, word choices, and structure within the guidelines.`;

    const jobContext = [
      `Visa type: ${visaType}`,
      `Company: ${company}`,
      `Job title: ${jobTitle}`,
      weeklyHours ? `Weekly hours: ${weeklyHours}` : null,
      salary ? `Salary: $${salary}/hour` : null,
      startDate ? `Start date: ${startDate}` : null,
      endDate ? `End date: ${endDate}` : null,
      housingInfo ? `Housing: ${housingInfo}` : null,
    ].filter(Boolean).join("\n");

    const userPrompt =
      `=== JOB INFORMATION ===\n${jobContext}\n\n` +
      `=== JOB DESCRIPTION ===\n${jobDescription || "Not provided"}\n\n` +
      `=== JOB REQUIREMENTS ===\n${jobRequirements || "Not provided"}\n\n` +
      `=== CANDIDATE RESUME DATA (Source of Truth - JSON) ===\n${JSON.stringify(resumeData, null, 2)}\n\n` +
      `Write a personalized cover letter email matching the candidate's resume to this specific job.`;


    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.2,
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

    // Force the 280-word cap even if the model overshoots (4-7 paragraphs).
    const body = limitWords(normalized, 280);
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
