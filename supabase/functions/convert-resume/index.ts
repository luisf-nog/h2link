import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const RESUME_TOOL = {
  type: "function" as const,
  function: {
    name: "format_resume",
    description: "Format resume to US-style JSON",
    parameters: {
      type: "object",
      properties: {
        personal_info: {
          type: "object",
          properties: {
            full_name: { type: "string" },
            city_state_country: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
          required: ["full_name"],
        },
        summary: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              location: { type: "string" },
              dates: { type: "string" },
              points: { type: "array", items: { type: "string" } },
            },
          },
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              degree: { type: "string" },
              school: { type: "string" },
              year: { type: "string" },
            },
          },
        },
        languages: { type: "array", items: { type: "string" } },
      },
      required: ["personal_info", "experience"],
    },
  },
};

function parseAiResponse(aiData: any) {
  const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall && toolCall.function.name === "format_resume") {
    return JSON.parse(toolCall.function.arguments);
  }
  const content = aiData?.choices?.[0]?.message?.content || "";
  const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(clean);
}

async function generateResume(
  apiKey: string,
  rawText: string,
  visaType: "H-2A" | "H-2B",
  context: any
) {
  const industryFocus =
    visaType === "H-2A"
      ? "Agriculture, livestock, crop harvesting, greenhouse, nursery, outdoor farm work, equipment operation, physical endurance in heat/cold."
      : "Construction, hospitality, hotels, restaurants, landscaping, warehouse, manufacturing, cleaning, painting, plumbing, trades.";

  const contextBlock = context
    ? `\n\nCANDIDATE PROFILE:\n${JSON.stringify(context, null, 2)}`
    : "";

  const systemPrompt = `You are an expert US Recruiter specializing in ${visaType} visa positions.
Analyze the resume and candidate profile, then generate a US-style resume JSON optimized for ${visaType} positions.

INDUSTRY FOCUS: ${industryFocus}

RULES:
- Translate everything to English.
- Remove: Age, Photo, Marital Status, IDs (CPF/RG).
- Use Action Verbs relevant to ${visaType} work.
- Reframe non-vocational experience (e.g. "Project Management" → "Team Coordination", "IT Support" → "Equipment Troubleshooting").
- Emphasize physical capabilities, outdoor endurance, and hands-on skills.
- Include language proficiency levels in the languages array.
- The summary should highlight fitness for ${visaType} positions specifically.
- Return strictly the JSON structure via the tool.`;

  const userPrompt = `Resume Content:\n"${rawText.substring(0, 20000)}"${contextBlock}\n\nGenerate an optimized ${visaType} resume JSON.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.15,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [RESUME_TOOL],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`AI Gateway Error (${visaType}):`, resp.status, errText);
    throw new Error(`AI Gateway failed for ${visaType}: ${resp.status}`);
  }

  const aiData = await resp.json();
  return parseAiResponse(aiData);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Missing Authorization Header" });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      console.error("Auth Error:", authError);
      return json(401, { success: false, error: "Unauthorized User" });
    }

    const { raw_text, context } = await req.json().catch(() => ({}));
    if (!raw_text || raw_text.length < 10) {
      return json(400, { success: false, error: "Resume text is empty or too short." });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("CRITICAL: LOVABLE_API_KEY missing.");
      return json(500, { success: false, error: "Server AI Key not configured." });
    }

    // Generate both resumes in parallel
    const [h2aResume, h2bResume] = await Promise.all([
      generateResume(LOVABLE_API_KEY, raw_text, "H-2A", context),
      generateResume(LOVABLE_API_KEY, raw_text, "H-2B", context),
    ]);

    // Save to profile using service role for reliability
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient
      .from("profiles")
      .update({
        resume_data_h2a: h2aResume,
        resume_data_h2b: h2bResume,
        resume_extra_context: context || null,
      })
      .eq("id", user.id);

    return json(200, { h2a: h2aResume, h2b: h2bResume });
  } catch (error: any) {
    console.error("Unhandled Error:", error);
    return json(500, { success: false, error: error.message || "Unknown Server Error" });
  }
});
