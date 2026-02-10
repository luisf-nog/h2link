import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

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

serve(async (req) => {
  // 1. Handle CORS
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    // 2. Validate Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    // 3. Get Request Body
    const { raw_text } = await req.json().catch(() => ({}));

    if (!raw_text || typeof raw_text !== "string" || raw_text.length < 10) {
      return json(400, { success: false, error: "Invalid or empty resume text provided." });
    }

    // 4. Check API Key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is missing in Edge Function secrets.");
      return json(500, { success: false, error: "Server configuration error (AI Key missing)." });
    }

    // 5. System Prompt (The "Expert Recruiter")
    const systemPrompt = `You are an expert US Recruiter specializing in H-2A (Agricultural) and H-2B (Non-Agricultural) visas.
    Your task is to analyze a raw resume text (which may be in Portuguese, Spanish, or English) and convert it into a structured US-Style Resume JSON.

    ### CRITICAL RULES:
    1. **Translation:** Detect the source language and translate ALL content to professional US English.
    2. **Sanitization:** REMOVE sensitive personal data prohibited in US resumes:
       - Age, Date of Birth
       - Marital Status, Religion, Gender
       - Photos (do not mention them)
       - ID Numbers (CPF, RG, Passport numbers)
       - Full Street Address (Keep only City, State, Country)
    3. **Optimization:**
       - Use strong ACTION VERBS for experience (e.g., "Operated", "Harvested", "Managed").
       - Highlight physical stamina, machinery skills, and reliability.
    4. **Output Format:** Return ONLY valid JSON matching the schema below. No markdown, no code blocks.`;

    // 6. User Prompt with Data
    const userPrompt = `Here is the raw resume text:\n\n"${raw_text.substring(0, 25000)}"\n\nConvert this to the required US JSON format.`;

    // 7. Call Lovable AI Gateway (Gemini)
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", // Fast, cheap, large context
        temperature: 0.1, // Low temp for strict JSON adherence
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // 8. Force Structured Output via Tool Calling (Best practice for JSON)
        tools: [
          {
            type: "function",
            function: {
              name: "format_resume",
              description: "Format the resume into structured JSON",
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
                  summary: { type: "string", description: "2-3 sentences focusing on physical stamina and experience" },
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
                required: ["personal_info", "summary", "experience"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "format_resume" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI API Error:", aiResp.status, errText);
      return json(500, { success: false, error: "Failed to process resume with AI." });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "format_resume") {
      throw new Error("AI did not return structured data.");
    }

    // 9. Parse and Return
    const resumeJson = JSON.parse(toolCall.function.arguments);

    return json(200, resumeJson);
  } catch (error: any) {
    console.error("Function Error:", error);
    return json(500, { success: false, error: error.message || "Internal Server Error" });
  }
});
