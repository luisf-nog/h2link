import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";
import { z } from "https://esm.sh/zod@3.25.76";
import pdfParse from "https://esm.sh/pdf-parse@1.1.1";

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

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json(400, { success: false, error: "Missing PDF file (field: file)" });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const parsedPdf = await pdfParse(buf);
    const text = String(parsedPdf?.text ?? "").trim();
    if (!text) return json(400, { success: false, error: "Could not extract text from PDF" });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    const systemPrompt =
      "Extract resume data and return ONLY valid JSON with keys: " +
      "{name, skills, experience_years, previous_jobs, bio}. " +
      "skills and previous_jobs must be arrays of strings. experience_years must be an integer.";

    const userPrompt =
      "Resume text:\n\n" +
      text.slice(0, 20_000);

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
    const content = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json(500, { success: false, error: "AI returned invalid JSON" });
    }

    const validated = resumeSchema.safeParse(parsed);
    if (!validated.success) {
      return json(500, { success: false, error: "AI output validation failed" });
    }

    return json(200, { success: true, resume_data: validated.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(500, { success: false, error: message });
  }
});
