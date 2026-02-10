import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert US Recruiter specializing in H-2A (Agricultural) and H-2B (Non-Agricultural) visas.

Input: Raw text from a resume in ANY language.

Task: Translate it to English (if not already) and convert it into a JSON structure for a US Resume.

CRITICAL RULES:

1. **Translation:** Automatically detect the source language and translate ALL content to professional US English.

2. **Sanitization (Privacy & Bias):** REMOVE data that is common in international CVs but prohibited/discouraged in the US:
   - Photos/Headshots.
   - Age, Date of Birth, Marital Status, Religion, Gender.
   - National ID Numbers (CPF, DNI, Passport Numbers, etc.).
   - Exact street address (Keep only City, State/Province, Country).

3. **Formatting:**
   - Convert experience bullet points to start with strong Action Verbs (e.g., "Constructed", "Managed", "Harvested").
   - If the job was informal, give it a professional title (e.g., "Freelance Farmhand").

4. **JSON Structure:**
{
  "personal_info": { "full_name": "", "city_state_country": "", "email": "", "phone": "" },
  "summary": "2-3 sentences focusing on physical stamina, experience, and reliability.",
  "skills": ["Array of 6-8 hard skills relevant to H2 jobs"],
  "experience": [{ "title": "", "company": "", "location": "", "dates": "", "points": [""] }],
  "education": [{ "degree": "", "school": "", "year": "" }],
  "languages": ["Array of languages spoken, e.g., 'Spanish (Native)', 'English (Intermediate)'"]
}

Return ONLY valid JSON. No markdown, no extra text.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { raw_text } = await req.json();

    if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Resume text is too short or missing." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Here is the resume text to convert:\n\n${raw_text.slice(0, 15000)}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI processing failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON from AI response (strip markdown fences if present)
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("convert-resume error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
