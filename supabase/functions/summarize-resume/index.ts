import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) throw new Error("Token is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get profile with resume_data
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, resume_data, resume_url")
      .eq("public_token", token)
      .single();

    if (error || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we already have a cached summary
    const { data: profileWithSummary } = await supabase
      .from("profiles")
      .select("ai_summary")
      .eq("public_token", token)
      .single();

    if (profileWithSummary?.ai_summary) {
      return new Response(JSON.stringify(profileWithSummary.ai_summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumeData = profile.resume_data as any;
    if (!resumeData) {
      return new Response(JSON.stringify({ error: "No resume data available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt from resume_data
    const resumeText = buildResumeText(resumeData, profile.full_name);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a recruiter assistant that creates concise candidate summaries for US employers hiring H-2A/H-2B visa workers.

Output a JSON object with these fields:
- "headline": One-liner about the candidate (max 15 words)
- "strengths": Array of 3-5 key strengths (each max 8 words)  
- "experience_years": Estimated total years of experience (number)
- "experience_domain": Primary field of experience (e.g. "agriculture", "construction", "landscaping", "hospitality", "logistics", "food processing", "manufacturing"). Be specific based on the resume.
- "summary": 3-4 sentence executive summary for a hiring manager. Always mention the specific industry/field of experience, not just years.
- "languages": Array of languages spoken
- "availability": Any availability info found, or "Immediately available"

Write in English. Be professional and direct. Focus on what matters to a US employer.`,
          },
          { role: "user", content: resumeText },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "candidate_summary",
              description: "Return a structured candidate summary",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  experience_years: { type: "number" },
                  experience_domain: { type: "string", description: "Primary field/industry of experience" },
                  summary: { type: "string" },
                  languages: { type: "array", items: { type: "string" } },
                  availability: { type: "string" },
                },
                required: ["headline", "strengths", "experience_years", "experience_domain", "summary", "languages", "availability"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "candidate_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const candidateSummary = JSON.parse(toolCall.function.arguments);

    // Cache the summary in profiles table
    await supabase
      .from("profiles")
      .update({ ai_summary: candidateSummary })
      .eq("public_token", token);

    return new Response(JSON.stringify(candidateSummary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-resume error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildResumeText(data: any, name: string | null): string {
  const parts: string[] = [];
  parts.push(`Candidate: ${name || "Unknown"}`);

  if (data.personal_info) {
    const pi = data.personal_info;
    if (pi.city_state_country) parts.push(`Location: ${pi.city_state_country}`);
    if (pi.phone) parts.push(`Phone: ${pi.phone}`);
  }

  if (data.summary) parts.push(`\nProfessional Summary:\n${data.summary}`);

  if (data.skills?.length) parts.push(`\nSkills: ${data.skills.join(", ")}`);

  if (data.experience?.length) {
    parts.push("\nExperience:");
    for (const exp of data.experience) {
      parts.push(`- ${exp.title} at ${exp.company} (${exp.dates})`);
      if (exp.points?.length) {
        for (const pt of exp.points) parts.push(`  • ${pt}`);
      }
    }
  }

  if (data.education?.length) {
    parts.push("\nEducation:");
    for (const edu of data.education) {
      parts.push(`- ${edu.degree} — ${edu.school} (${edu.year})`);
    }
  }

  if (data.languages?.length) parts.push(`\nLanguages: ${data.languages.join(", ")}`);

  return parts.join("\n");
}
