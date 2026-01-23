import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  // Empty schema - no parameters needed for generic template generation
});

const responseSchema = z.object({
  subject: z.string().min(1).max(180),
  body: z.string().min(1).max(8000),
});

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function languageName(code: "pt" | "en" | "es") {
  switch (code) {
    case "pt":
      return "Português (Brasil)";
    case "es":
      return "Español";
    default:
      return "English";
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    // Validate JWT and get user id
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const parsedReq = requestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedReq.success) {
      return json(400, { success: false, error: "Invalid request", issues: parsedReq.error.issues });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Enforce daily limit (3 generations/day)
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: usage } = await serviceClient
      .from("ai_daily_usage")
      .select("template_generations")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();

    const current = usage?.template_generations ?? 0;
    if (current >= 3) {
      return json(429, { success: false, error: "Daily limit reached (3 generations/day). Try again tomorrow." });
    }

    // Load profile fields needed for the template placeholders
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("full_name,age,phone_e164,contact_email")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;

    const missing: string[] = [];
    if (!profile?.full_name) missing.push("full_name");
    if (profile?.age == null) missing.push("age");
    if (!profile?.phone_e164) missing.push("phone_e164");
    if (!profile?.contact_email) missing.push("contact_email");
    if (missing.length) {
      return json(400, {
        success: false,
        error: "Please complete your Profile before generating a template.",
        missing,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json(500, { success: false, error: "AI is not configured" });
    }

    const placeholders = [
      "{{name}}",
      "{{age}}",
      "{{phone}}",
      "{{contact_email}}",
      "{{company}}",
      "{{position}}",
      "{{visa_type}}",
    ];

    const system = [
      `You generate email application templates for US seasonal visa jobs (H-2A/H-2B).`,
      `Output must be valid JSON ONLY with keys: subject, body.`,
      `Write in English.`,
      `The template MUST contain MUSTACHE placeholders (do not replace values): ${placeholders.join(", ")}.`,
      `Use a professional but friendly tone suitable for contacting employers about H-2A/H-2B positions.`,
      `Subject should include {{visa_type}} and {{position}} when reasonable.`,
      `Body should be plain text (no HTML) and include a signature block with {{name}}, {{phone}}, {{contact_email}}.`,
      `Do not include any other keys, markdown, code fences, or commentary.`,
    ].join("\n");

    const p = profile!;

    const userPrompt = [
      "Generate a reusable email template.",
      "Candidate profile (for context only; do NOT inline these values, keep placeholders):",
      `- name: ${p.full_name}`,
      `- age: ${p.age}`,
      `- phone: ${p.phone_e164}`,
      `- contact_email: ${p.contact_email}`,
      "Remember: output JSON only.",
    ].join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      if (aiResp.status === 429) return json(429, { success: false, error: "AI rate limited. Please try again." });
      if (aiResp.status === 402) return json(402, { success: false, error: "AI usage limit reached. Please try later." });
      console.error("AI gateway error", aiResp.status, text);
      return json(500, { success: false, error: "AI gateway error" });
    }

    const aiData = await aiResp.json();
    const content = String(aiData?.choices?.[0]?.message?.content ?? "").trim();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      return json(500, { success: false, error: "AI returned invalid JSON. Please try again." });
    }

    const parsedOut = responseSchema.safeParse(parsedJson);
    if (!parsedOut.success) {
      return json(500, { success: false, error: "AI returned an unexpected output. Please try again." });
    }

    // Increment usage after successful generation
    const next = current + 1;
    const { error: usageUpsertError } = await serviceClient
      .from("ai_daily_usage")
      .upsert(
        { user_id: userId, usage_date: today, template_generations: next },
        { onConflict: "user_id,usage_date" },
      );
    if (usageUpsertError) {
      // Non-fatal (still return the template) but log for debugging.
      console.error("Failed to upsert ai_daily_usage", usageUpsertError);
    }

    return json(200, {
      success: true,
      ...parsedOut.data,
      remaining_today: Math.max(0, 3 - next),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate template";
    return json(500, { success: false, error: errorMessage });
  }
};

serve(handler);
