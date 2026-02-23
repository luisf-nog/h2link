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

const TOOL_SCHEMA = {
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
        summary: { type: "string", description: "Professional summary tailored to the visa type and industry" },
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
        certifications: { type: "array", items: { type: "string" } },
      },
      required: ["personal_info", "summary", "skills", "experience"],
    },
  },
};

function buildPrompt(rawText: string, visaType: "H-2A" | "H-2B", context: any): string {
  const { practical_experience, physical_skills, migration_status, availability, extra_notes, languages } = context || {};

  let industryFocus = "";
  if (visaType === "H-2A") {
    industryFocus = `This resume is for H-2A (AGRICULTURAL) visa positions.

FOCUS AREAS (pick the 2-3 most relevant to the candidate's background):
- Crop harvesting & planting
- Livestock care & feeding
- Greenhouse & nursery operations
- Forestry & logging
- Irrigation & soil management
- Farm equipment operation

CRITICAL TONE GUIDELINES:
- Be SPECIFIC, not generic. Instead of "eager to contribute to farm work, crop harvesting, livestock, nursery, greenhouse, or forestry" → pick the 2-3 areas that best match the candidate's experience.
- For equipment/machinery skills: if the candidate has NO direct experience, write "Familiar with [equipment] (training-based knowledge)" instead of implying hands-on operation.
- MUST include a strong Availability Signal in the Summary:
  ✔ "Fully available for the entire contract season"
  ✔ "Open to relocation within the U.S."
  ✔ "Willing to work overtime, weekends, and holidays"
- Emphasize outdoor endurance, extreme weather tolerance, and physical stamina.`;
  } else {
    industryFocus = `This resume is for H-2B (NON-AGRICULTURAL TEMPORARY) visa positions.

FOCUS AREAS (pick the 2-3 most relevant to the candidate's background):
- Construction & heavy labor
- Landscaping & groundskeeping
- Hospitality & housekeeping
- Food service & kitchen operations
- Warehouse & logistics
- Manufacturing & production
- Seafood processing

CRITICAL TONE GUIDELINES:
- The Professional Summary MUST be direct and assertive, American-style. 
  BAD: "H-2B Visa Candidate with a strong background in various industries..."
  GOOD: "Reliable H-2B visa candidate with hands-on experience in [specific areas]. Physically capable, safety-focused, and ready for immediate seasonal employment."
- Be SPECIFIC about the candidate's strongest 2-3 sectors, don't list everything.
- For equipment/machinery skills: if the candidate has NO direct experience, write "Familiar with [equipment] (training-based knowledge)" instead of implying hands-on operation.
- MUST include availability signal: "Ready for immediate deployment" or "Available for full seasonal contract".
- Emphasize safety compliance, teamwork, and reliability.`;
  }

  const practicalLines = practical_experience?.length
    ? `\nCANDIDATE'S PRACTICAL EXPERIENCE (from questionnaire):\n${practical_experience.map((e: any) => typeof e === 'string' ? `- ${e}` : `- ${e.area} (${e.duration})`).join("\n")}`
    : "";

  const physicalLines = physical_skills?.length
    ? `\nPHYSICAL CAPABILITIES:\n${physical_skills.map((s: any) => typeof s === 'string' ? `- ${s}` : `- ${s.skill}${s.detail ? ` (${s.detail})` : ''}`).join("\n")}`
    : "";

  const langLines = languages
    ? `\nLANGUAGE PROFICIENCY:\n- English: ${languages.english || 'not specified'}\n- Spanish: ${languages.spanish || 'not specified'}`
    : "";

  const migrationLines = migration_status
    ? `\nMIGRATION/VISA CONTEXT:
- Current location: ${migration_status.location || "Not specified"}
- Work authorization: ${migration_status.work_auth || "Needs H-2 sponsorship"}
- Previous H-2 experience: ${migration_status.h2_history || "None"}
- Visa denials: ${migration_status.visa_denials || "None"}
- Passport status: ${migration_status.passport || "Valid"}`
    : "";

  const availLines = availability
    ? `\nAVAILABILITY: ${availability.when || "Immediately"}, Duration preference: ${availability.duration || "Full season"}`
    : "";

  const extraLines = extra_notes ? `\nADDITIONAL NOTES FROM CANDIDATE: ${extra_notes}` : "";

  return `You are an expert US Recruiter specializing in ${visaType} visa worker placement. You write resumes that GET INTERVIEWS — direct, assertive, American-style.

${industryFocus}

RULES:
1. Translate everything to English
2. REMOVE: Age, Photo, Marital Status, National IDs (CPF/RG/CURP), date of birth
3. Use strong Action Verbs (Managed, Operated, Maintained, Supervised, etc.)
4. The Summary MUST be 2-3 sentences MAX. Mention: visa type, top 2-3 relevant skills, and availability. No fluff.
5. ENHANCE the resume by incorporating the practical experience and physical skills from the questionnaire below
6. If the candidate has office/desk experience but is applying for manual labor, REFRAME their skills (e.g., "project management" → "team coordination", "data entry" → "attention to detail and precision")
7. Add relevant certifications section if applicable (safety training, equipment operation, food handling, etc.)
8. Keep it professional, 1-2 pages maximum
9. NEVER list more than 3 focus areas in the Summary — specificity beats breadth
10. For skills the candidate learned via training (not hands-on), use "Familiar with X (training-based)" wording
11. Include an Availability section or integrate availability signals into the Summary
${practicalLines}
${physicalLines}
${langLines}
${migrationLines}
${availLines}
${extraLines}

ORIGINAL RESUME TEXT:
"${rawText.substring(0, 20000)}"

Generate a complete, enhanced US-style resume JSON optimized for ${visaType} positions.`;
}

function parseToolResponse(aiData: any): any {
  const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.name === "format_resume") {
    return JSON.parse(toolCall.function.arguments);
  }
  const content = aiData?.choices?.[0]?.message?.content || "";
  const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(clean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing Authorization Header" });
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json();
    const { raw_text, context } = body;

    if (!raw_text || raw_text.length < 10) {
      return json(400, { error: "Resume text is empty or too short." });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { error: "AI Key not configured." });

    console.log("Starting dual resume generation for user:", user.id);

    // Generate H-2A resume
    console.log("Generating H-2A resume...");
    const h2aPrompt = buildPrompt(raw_text, "H-2A", context);
    const h2aResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.15,
        messages: [{ role: "user", content: h2aPrompt }],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "format_resume" } },
      }),
    });

    if (!h2aResp.ok) {
      const errText = await h2aResp.text();
      console.error("H-2A AI error:", h2aResp.status, errText);
      return json(500, { error: `AI failed for H-2A resume: ${h2aResp.status}` });
    }

    const h2aData = await h2aResp.json();
    const h2aResume = parseToolResponse(h2aData);
    console.log("H-2A resume generated successfully");

    // Generate H-2B resume
    console.log("Generating H-2B resume...");
    const h2bPrompt = buildPrompt(raw_text, "H-2B", context);
    const h2bResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.15,
        messages: [{ role: "user", content: h2bPrompt }],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "format_resume" } },
      }),
    });

    if (!h2bResp.ok) {
      const errText = await h2bResp.text();
      console.error("H-2B AI error:", h2bResp.status, errText);
      return json(500, { error: `AI failed for H-2B resume: ${h2bResp.status}` });
    }

    const h2bData = await h2bResp.json();
    const h2bResume = parseToolResponse(h2bData);
    console.log("H-2B resume generated successfully");

    // Save both resumes + context to profile
    console.log("Saving to profile...");
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const { error: updateError } = await serviceClient.from("profiles").update({
      resume_data_h2a: h2aResume,
      resume_data_h2b: h2bResume,
      resume_extra_context: context || null,
    }).eq("id", user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
    } else {
      console.log("Profile updated successfully");
    }

    // Track AI usage
    await serviceClient.rpc("increment_ai_usage", { p_user_id: user.id, p_function_type: "resume" });

    return json(200, { h2a: h2aResume, h2b: h2bResume });
  } catch (error: any) {
    console.error("convert-resume error:", error);
    return json(500, { error: error.message || "Unknown error" });
  }
});
