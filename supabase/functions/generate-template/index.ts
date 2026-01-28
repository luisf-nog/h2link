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

const responseSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

function stripMarkdownFences(text: string): string {
  return String(text ?? "")
    .trim()
    .replace(/^```[a-zA-Z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJsonObject(text: string): string {
  const t = stripMarkdownFences(text);

  // Try to grab the first JSON object even if the model added prose around it.
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return t.slice(start, end + 1).trim();
  }

  return t;
}

const requestSchema = z.object({
  length: z.enum(["short", "medium", "long"]).optional().default("medium"),
  tone: z.enum(["professional", "friendly", "direct"]).optional().default("direct"),
  lines_per_paragraph: z.number().min(1).max(5).optional(),
}).optional();

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

    // Parse request body for options
    const rawBody = await req.json().catch(() => ({}));
    const optionsParsed = requestSchema.safeParse(rawBody);
    const options = optionsParsed.success ? optionsParsed.data : { length: "medium", tone: "direct", lines_per_paragraph: undefined };
    const length = options?.length ?? "medium";
    const tone = options?.tone ?? "direct";
    const linesPerParagraph = options?.lines_per_paragraph;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    // Get usage
    const { data: usageRow, error: usageErr } = await serviceClient
      .from("ai_daily_usage")
      .select("user_id,usage_date,template_generations")
      .eq("user_id", userId)
      .maybeSingle();
    if (usageErr) throw usageErr;

    const currentDate = String((usageRow as any)?.usage_date ?? "");
    let used = currentDate === today ? Number((usageRow as any)?.template_generations ?? 0) : 0;

    // Reset if date changed
    if (currentDate !== today) {
      await serviceClient
        .from("ai_daily_usage")
        .upsert({ user_id: userId, usage_date: today, template_generations: 0, updated_at: new Date().toISOString() } as any);
    }

    const LIMIT = 3;
    if (used >= LIMIT) {
      return json(429, {
        success: false,
        error: "Limite diário de IA atingido. Tente amanhã.",
        used_today: used,
        limit: LIMIT,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    // Dynamic prompt based on options
    const lengthGuide = {
      short: "Keep it very short (3-4 sentences max, under 80 words).",
      medium: "Keep it concise (5-7 sentences, around 120 words).",
      long: "Write a complete letter (8-10 sentences, around 180 words).",
    }[length];

    const toneGuide = {
      professional: "Use a formal, professional tone.",
      friendly: "Use a warm, friendly tone while remaining respectful.",
      direct: "Use a humble, direct, no-nonsense tone focused on hard work.",
    }[tone];

    // Lines per paragraph instruction
    const linesGuide = linesPerParagraph
      ? `Each paragraph should have exactly ${linesPerParagraph} sentence${linesPerParagraph > 1 ? "s" : ""}.`
      : "";

    const systemPrompt =
      "Return ONLY valid JSON with keys {subject, body}. " +
      "Write in English. " + toneGuide + " " + lengthGuide + " " +
      (linesGuide ? linesGuide + " " : "") +
      "Context: user is applying to H-2A/H-2B seasonal visa jobs in the USA.";

    const userPrompt =
      "Create a persuasive email template for H-2A/H-2B job applications. " +
      "Focus on availability (weekends, holidays, overtime) and hard work ethic. " +
      "Avoid corporate jargon. Use simple English. " +
      "Include placeholders: {{company}}, {{position}}, {{name}}, {{phone}}, {{contact_email}}. " +
      "The email should feel genuine and personalized.";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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
    const content = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    let parsed: unknown;
    try {
      const jsonCandidate = extractFirstJsonObject(content);
      parsed = JSON.parse(jsonCandidate);
    } catch {
      const snippet = content.slice(0, 500);
      return json(500, { success: false, error: "AI returned invalid JSON", snippet });
    }

    const validated = responseSchema.safeParse(parsed);
    if (!validated.success) {
      return json(500, { success: false, error: "AI output validation failed" });
    }

    // Increment usage using RPC function (handles both template_generations and tracking)
    await serviceClient.rpc("increment_ai_usage", { p_user_id: userId, p_function_type: "template" });
    const nextUsed = used + 1;

    return json(200, {
      success: true,
      ...validated.data,
      used_today: nextUsed,
      limit: LIMIT,
      remaining_today: Math.max(0, LIMIT - nextUsed),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(500, { success: false, error: message });
  }
});
