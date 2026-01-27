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

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Strip common Markdown fences.
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // If it's already a JSON object, return as-is.
  if (unfenced.startsWith("{") && unfenced.endsWith("}")) return unfenced;

  // Otherwise, try to extract the first JSON object in the text.
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return unfenced.slice(start, end + 1);
}

const resumeSchema = z.object({
  name: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience_years: z.number().int().nonnegative().default(0),
  previous_jobs: z.array(z.string()).default([]),
  bio: z.string().default(""),
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

    // The frontend extracts text from the PDF (client-side parsing) and sends it here.
    const body = await req.json().catch(() => ({} as any));
    const resumeText = typeof body?.resumeText === "string" ? body.resumeText : "";
    if (!resumeText.trim()) {
      return json(400, { success: false, error: "Missing resumeText" });
    }

    // Safety: prevent massive prompts / accidental binary-to-string payloads.
    if (resumeText.length > 200_000) {
      return json(413, { success: false, error: "resumeText too large" });
    }

    console.info("parse-resume: received text", {
      length: resumeText.length,
      preview: resumeText.slice(0, 200),
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    const systemPrompt =
      "Extract resume data and return ONLY valid JSON with keys: " +
      "{name, skills, experience_years, previous_jobs, bio}. " +
      "skills and previous_jobs must be arrays of strings. experience_years must be an integer.";

    const userPrompt =
      "Resume text:\n\n" +
      resumeText.slice(0, 20_000);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
    const content = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    let parsed: unknown;
    try {
      const extracted = extractJsonObject(content);
      if (!extracted) throw new Error("no_json_object");
      parsed = JSON.parse(extracted);
    } catch {
      return json(500, {
        success: false,
        error: "AI returned invalid JSON",
        details: content.slice(0, 800),
      });
    }

    const validated = resumeSchema.safeParse(parsed);
    if (!validated.success) {
      return json(500, { success: false, error: "AI output validation failed" });
    }

    return json(200, { success: true, resume_data: validated.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("parse-resume: unhandled error", e);
    return json(500, { success: false, error: message });
  }
});
