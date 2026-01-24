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
    if ((profile as any)?.plan_tier !== "diamond") {
      return json(403, { success: false, error: "Diamond only" });
    }

    const resumeData = (profile as any)?.resume_data;
    if (!resumeData) {
      return json(400, { success: false, error: "resume_data_missing" });
    }

    const { data: queueRow, error: qErr } = await serviceClient
      .from("my_queue")
      .select(
        `id, user_id, job_id, manual_job_id,
         public_jobs (company, job_title, visa_type, description, requirements),
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    const systemPrompt =
      "You are an AI assistant helping a Brazilian worker apply for H-2A (Agricultural) and H-2B (Non-Agricultural) jobs in the USA. " +
      "Write a short, professional, and convincing email (cover letter) using ONLY the user's resume_data as the source of truth. " +
      "\n\nSTRICT ANTI-HALLUCINATION RULES: " +
      "Use ONLY resume_data. Never invent skills, certifications, licenses, tools, years of experience, employers, or locations. " +
      "If the job requires something not present in resume_data, do NOT claim it—emphasize physical stamina, reliability, fast learning, hard work, and willingness to learn. " +
      "\n\nTONE & STYLE (Blue Collar Professional): " +
      "Humble, hardworking, reliable, respectful. Simple US English. No corporate speak. " +
      "BANNED: 'I hope this email finds you well' and desperate pleas like 'I really need this job'. " +
      "\n\nFORMATTING & STRUCTURE: " +
      "Write 3 to 6 short paragraphs, separated by a blank line (double newline). " +
      "Do NOT use bullet points, hyphens as lists, or numbered lists. " +
      "Max 230 words. " +
      "Paragraph guidance: " +
      "1) Greeting line (can vary: 'Hello,' or 'Dear Hiring Manager,'). " +
      "2) One sentence: applying for the specific job_title at the company. " +
      "3) Experience hook: connect ONLY real experience from resume_data to the job. Use **bold** sparingly for key availability/traits or a skill ONLY if explicitly present. " +
      "4) Availability & work attitude: highlight **full availability** (weekends/holidays/overtime) ONLY if explicitly supported by resume_data; otherwise say you are available for the full season and can start immediately. Mention reliability, sobriety, safety, willingness to learn. " +
      "5) Closing: 'My resume is attached. Thank you.' then 'Best regards,'. " +
      "6) Signature block on separate lines: name, phone, email — ONLY if present in resume_data (do not invent). " +
      "\n\nOUTPUT REQUIREMENT: Return ONLY the email body text (with paragraph breaks). No JSON. No code fences.";

    const userPrompt =
      `Job context:\n` +
      `Visa type: ${visaType}\n` +
      `Company: ${company}\n` +
      `Job title: ${jobTitle}\n\n` +
      `Job description:\n${jobDescription}\n\n` +
      `Job requirements:\n${jobRequirements}\n\n` +
      `resume_data (JSON, source of truth):\n${JSON.stringify(resumeData)}\n`;

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

    // Force the 230-word cap even if the model overshoots.
    const body = limitWords(normalized, 230);
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
