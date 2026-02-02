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
    // 1. Auth validation
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      console.error("[generate-template] Missing or invalid Authorization header");
      return json(401, { success: false, error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    // 2. Parse body ONCE (before creating auth client)
    let rawBody: Record<string, unknown> = {};
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }
    console.log("[generate-template] Request body:", JSON.stringify(rawBody));

    // 3. Validate user
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const userId = userData?.user?.id;
    
    if (userError || !userId) {
      console.error("[generate-template] Auth failed:", userError?.message ?? "No user ID");
      return json(401, { success: false, error: "Unauthorized" });
    }
    console.log("[generate-template] Authenticated user:", userId);

    // 4. Parse options from already-parsed body
    const optionsParsed = requestSchema.safeParse(rawBody);
    const options = optionsParsed.success ? optionsParsed.data : { length: "medium", tone: "direct", lines_per_paragraph: undefined };
    const length = options?.length ?? "medium";
    const tone = options?.tone ?? "direct";
    const linesPerParagraph = options?.lines_per_paragraph;
    console.log("[generate-template] Options:", { length, tone, linesPerParagraph });

    // 5. Check daily usage
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    // Use limit(1) instead of maybeSingle() to avoid "multiple rows" error
    const { data: usageRows, error: usageErr } = await serviceClient
      .from("ai_daily_usage")
      .select("user_id,usage_date,template_generations")
      .eq("user_id", userId)
      .order("usage_date", { ascending: false })
      .limit(1);
    
    if (usageErr) {
      console.error("[generate-template] Usage query error:", usageErr.message);
      // Don't throw - continue with default values
    }
    
    const usageRow = usageRows?.[0] ?? null;

    const currentDate = String((usageRow as any)?.usage_date ?? "");
    let used = currentDate === today ? Number((usageRow as any)?.template_generations ?? 0) : 0;
    console.log("[generate-template] Current usage:", { currentDate, today, used });

    // Reset if date changed
    if (currentDate !== today) {
      const { error: upsertErr } = await serviceClient
        .from("ai_daily_usage")
        .upsert({ user_id: userId, usage_date: today, template_generations: 0, updated_at: new Date().toISOString() } as any);
      
      if (upsertErr) {
        console.error("[generate-template] Upsert error:", upsertErr.message);
      }
    }

    const LIMIT = 3;
    if (used >= LIMIT) {
      console.log("[generate-template] Daily limit reached:", used);
      return json(429, {
        success: false,
        error: "Limite diário de IA atingido. Tente amanhã.",
        used_today: used,
        limit: LIMIT,
      });
    }

    // 6. Check AI API key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[generate-template] LOVABLE_API_KEY not configured");
      return json(500, { success: false, error: "AI not configured" });
    }
    console.log("[generate-template] LOVABLE_API_KEY present:", LOVABLE_API_KEY.slice(0, 10) + "...");

    // 7. Build prompts
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

    // 8. Call AI Gateway
    console.log("[generate-template] Calling AI gateway...");
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

    console.log("[generate-template] AI response status:", aiResp.status);

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("[generate-template] AI error response:", errText.slice(0, 500));
      
      if (aiResp.status === 429) {
        return json(429, { success: false, error: "AI rate limit exceeded. Please try again later." });
      }
      if (aiResp.status === 402) {
        return json(402, { success: false, error: "AI credits exhausted. Please contact support." });
      }
      
      return json(aiResp.status, { success: false, error: `AI error (${aiResp.status})`, details: errText.slice(0, 500) });
    }

    // 9. Parse AI response
    const aiJson = await aiResp.json();
    const content = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    console.log("[generate-template] AI content length:", content.length);

    let parsed: unknown;
    try {
      const jsonCandidate = extractFirstJsonObject(content);
      parsed = JSON.parse(jsonCandidate);
    } catch (parseErr) {
      console.error("[generate-template] JSON parse error:", parseErr);
      console.error("[generate-template] Raw content:", content.slice(0, 500));
      return json(500, { success: false, error: "AI returned invalid JSON", snippet: content.slice(0, 300) });
    }

    const validated = responseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[generate-template] Validation error:", validated.error);
      return json(500, { success: false, error: "AI output validation failed" });
    }

    // 10. Increment usage
    const { error: rpcErr } = await serviceClient.rpc("increment_ai_usage", { p_user_id: userId, p_function_type: "template" });
    if (rpcErr) {
      console.error("[generate-template] RPC error (non-blocking):", rpcErr.message);
    }
    
    const nextUsed = used + 1;
    console.log("[generate-template] Success! New usage:", nextUsed);

    return json(200, {
      success: true,
      ...validated.data,
      used_today: nextUsed,
      limit: LIMIT,
      remaining_today: Math.max(0, LIMIT - nextUsed),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[generate-template] Unhandled error:", message);
    console.error("[generate-template] Stack:", stack);
    return json(500, { success: false, error: message });
  }
});
