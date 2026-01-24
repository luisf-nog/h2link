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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    // "1ª grátis" = se o usuário ainda não tem nenhum template.
    const { count: templatesCount } = await serviceClient
      .from("email_templates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const isFreebie = (templatesCount ?? 0) === 0;

    // Get usage
    const { data: usageRow, error: usageErr } = await serviceClient
      .from("ai_daily_usage")
      .select("user_id,usage_date,template_generations")
      .eq("user_id", userId)
      .maybeSingle();
    if (usageErr) throw usageErr;

    const currentDate = String((usageRow as any)?.usage_date ?? today);
    let used = Number((usageRow as any)?.template_generations ?? 0);

    // Reset if date changed
    if (currentDate !== today) {
      used = 0;
      await serviceClient
        .from("ai_daily_usage")
        .upsert({ user_id: userId, usage_date: today, template_generations: 0, updated_at: new Date().toISOString() } as any);
    }

    const LIMIT = 3;
    if (!isFreebie && used >= LIMIT) {
      return json(429, {
        success: false,
        error: "Limite diário de IA atingido. Tente amanhã ou faça upgrade.",
        used_today: used,
        limit: LIMIT,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    const systemPrompt =
      "Return ONLY valid JSON with keys {subject, body}. " +
      "Write in English. Keep it short, persuasive, respectful and direct. " +
      "Context: user is applying to H-2A/H-2B seasonal visa jobs.";

    const userPrompt =
      "Create a short, persuasive email template for H-2A/H-2B job applications. " +
      "Focus on availability and hard work. Avoid corporate jargon. " +
      "Include placeholders: {{company}} and {{position}}. ";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.5,
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

    const validated = responseSchema.safeParse(parsed);
    if (!validated.success) {
      return json(500, { success: false, error: "AI output validation failed" });
    }

    // Increment usage (unless freebie)
    let nextUsed = used;
    if (!isFreebie) {
      nextUsed = used + 1;
      await serviceClient
        .from("ai_daily_usage")
        .upsert({
          user_id: userId,
          usage_date: today,
          template_generations: nextUsed,
          updated_at: new Date().toISOString(),
        } as any);
    }

    return json(200, {
      success: true,
      ...validated.data,
      used_today: nextUsed,
      limit: LIMIT,
      remaining_today: Math.max(0, LIMIT - nextUsed),
      freebie: isFreebie,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json(500, { success: false, error: message });
  }
});
