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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Missing Authorization Header" });
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      console.error("Auth Error:", authError);
      return json(401, { success: false, error: "Unauthorized User" });
    }

    const { raw_text } = await req.json().catch(() => ({}));
    if (!raw_text || raw_text.length < 10) {
      return json(400, { success: false, error: "Resume text is empty or too short." });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("CRITICAL: LOVABLE_API_KEY missing in Secrets.");
      return json(500, { success: false, error: "Server AI Key not configured." });
    }

    const systemPrompt = `You are an expert US Recruiter. Analyze this resume text (any language) and convert it to US-Style JSON.
    RULES:
    - Translate to English.
    - Remove: Age, Photo, Marital Status, IDs (CPF/RG).
    - Use Action Verbs.
    - Return strictly the JSON structure requested.`;

    const userPrompt = `Resume Content:\n"${raw_text.substring(0, 25000)}"\n\nConvert to JSON structure.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "format_resume",
              description: "Format resume to JSON",
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
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI Gateway Error:", aiResp.status, errText);
      return json(500, { success: false, error: `AI Gateway failed: ${aiResp.status}` });
    }

    const aiData = await aiResp.json();

    let resumeJson;
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function.name === "format_resume") {
      try {
        resumeJson = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("JSON Parse Error (Tool):", e);
        return json(500, { success: false, error: "AI returned invalid JSON in tool." });
      }
    } else {
      console.warn("AI didn't use tool, falling back to content parsing.");
      const content = aiData?.choices?.[0]?.message?.content || "";
      const cleanContent = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      try {
        resumeJson = JSON.parse(cleanContent);
      } catch (e) {
        console.error("JSON Parse Error (Content):", content);
        return json(500, { success: false, error: "AI response could not be parsed as JSON." });
      }
    }

    return json(200, resumeJson);
  } catch (error: any) {
    console.error("Unhandled Error:", error);
    return json(500, { success: false, error: error.message || "Unknown Server Error" });
  }
});
