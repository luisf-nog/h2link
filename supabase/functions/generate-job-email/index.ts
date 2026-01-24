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
      "Write a short, professional, and convincing email cover letter based strictly on the user's data. " +
      "\n\nSTRICT ANTI-HALLUCINATION RULES: " +
      "Use ONLY the information in resume_data. Never invent skills, certifications, tools, years, or employers. " +
      "If the job asks for something not present in resume_data, do NOT lie—focus on physical stamina, fast learning, hard work, reliability, and willingness to learn. " +
      "\n\nTONE & STYLE: " +
      "Humble, hardworking, reliable, respectful. Simple US English. No corporate speak. " +
      "Never use: 'I hope this email finds you well' or desperate pleas like 'I really need this job'. " +
      "\n\nFORMATTING: " +
      "NO bullet points, hyphens, or numbered lists. Use clean short paragraphs. " +
      "Max 150 words. " +
      "Structure: " +
      "Salutation 'Dear Hiring Manager,'; " +
      "Opening: one sentence applying for the specific job_title; " +
      "Experience hook: connect ONLY real experience from resume_data to the job; use **bold** for key skills or years ONLY if explicitly present; " +
      "Attitude paragraph: physical strength, reliability, sobriety, willingness to learn; " +
      "Logistics: available for full season and immediate start; " +
      "Closing: 'My resume is attached. Thank you.' then 'Best regards,' and the user's name (only if present in resume_data). " +
      "\n\nOUTPUT: Return ONLY the email body. No JSON. No code fences.";

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

    // Force the 150-word cap even if the model overshoots.
    const body = limitWords(unfenced, 150);
    if (!body) {
      return json(500, {
        success: false,
        error: "AI returned empty body",
        details: unfenced.slice(0, 800),
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
