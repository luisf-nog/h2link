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
        work_authorization: {
          type: "object",
          description: "Work authorization and availability details for recruiter reference. ALWAYS include this section.",
          properties: {
            visa_type: { type: "string" },
            current_location: { type: "string" },
            passport_status: { type: "string" },
            previous_h2_experience: { type: "string" },
            availability: { type: "string" },
            visa_denial_history: { type: "string" },
          },
        },
      },
      required: ["personal_info", "summary", "skills", "experience", "work_authorization"],
    },
  },
};

// Sector category mapping (mirrors frontend SECTOR_CATEGORIES)
const SECTOR_FOCUS: Record<string, { name: string; focus: string; keywords: string[] }> = {
  campo_colheita: {
    name: "Agriculture & Harvesting",
    focus: "Crop harvesting, planting, livestock care, greenhouse/nursery, forestry, irrigation, soil management, farm equipment operation",
    keywords: ["farming", "harvesting", "livestock", "agriculture", "crop", "nursery", "greenhouse"],
  },
  construcao_manutencao: {
    name: "Construction & Maintenance",
    focus: "Building construction, heavy labor, masonry, concrete, roofing, framing, general maintenance, equipment operation",
    keywords: ["construction", "building", "masonry", "concrete", "roofing", "carpentry", "maintenance"],
  },
  paisagismo_jardinagem: {
    name: "Landscaping & Gardening",
    focus: "Grounds maintenance, mowing, tree trimming, irrigation systems, hardscaping, pesticide application",
    keywords: ["landscaping", "gardening", "groundskeeping", "tree", "mowing", "irrigation"],
  },
  hotelaria_limpeza: {
    name: "Hospitality & Cleaning",
    focus: "Hotel housekeeping, janitorial, deep cleaning, laundry, guest services, room attendant duties",
    keywords: ["hotel", "housekeeping", "cleaning", "janitorial", "hospitality"],
  },
  cozinha_restaurante: {
    name: "Kitchen & Restaurant",
    focus: "Food preparation, cooking, dishwashing, kitchen sanitation, line cooking, baking, food safety compliance",
    keywords: ["cooking", "kitchen", "restaurant", "food prep", "chef", "baker", "dishwasher"],
  },
  logistica_transporte: {
    name: "Logistics & Transport",
    focus: "Driving, delivery, warehousing, forklift operation, inventory management, loading/unloading",
    keywords: ["driving", "transport", "warehouse", "logistics", "forklift", "delivery"],
  },
  industria_producao: {
    name: "Manufacturing & Production",
    focus: "Assembly line, quality control, machine operation, packaging, meat/seafood processing, production line work",
    keywords: ["factory", "manufacturing", "production", "assembly", "processing", "packaging"],
  },
  mecanica_reparo: {
    name: "Mechanics & Repair",
    focus: "Vehicle maintenance, engine repair, equipment troubleshooting, welding, electrical systems",
    keywords: ["mechanic", "repair", "automotive", "welding", "technician"],
  },
  vendas_escritorio: {
    name: "Sales & Office",
    focus: "Retail, cashier, customer service, inventory tracking, reception, administrative support",
    keywords: ["sales", "retail", "cashier", "customer service", "office", "reception"],
  },
  lazer_servicos: {
    name: "Leisure & Services",
    focus: "Amusement parks, recreation, tour operations, childcare, fitness, lifeguarding, personal services",
    keywords: ["recreation", "amusement", "tour", "lifeguard", "fitness", "childcare"],
  },
};

function buildPrompt(rawText: string, visaType: "H-2A" | "H-2B", context: any): string {
  const { practical_experience, physical_skills, migration_status, availability, extra_notes, languages } = context || {};

  let industryFocus = "";
  if (visaType === "H-2A") {
    industryFocus = `This resume is for H-2A (AGRICULTURAL) visa positions.

FOCUS AREAS (pick the 2-3 most relevant to the candidate's ACTUAL background):
- Crop harvesting & planting
- Livestock care & feeding
- Greenhouse & nursery operations
- Forestry & logging
- Irrigation & soil management
- Farm equipment support

TONE GUIDELINES:
- Be SPECIFIC to the candidate's REAL experience. Do NOT list focus areas the candidate has never done.
- MUST include a strong Availability Signal in the Summary.
- Emphasize outdoor endurance, extreme weather tolerance, and physical stamina.`;
  } else {
    industryFocus = `This resume is for H-2B (NON-AGRICULTURAL TEMPORARY) visa positions.

FOCUS AREAS (pick the 2-3 most relevant to the candidate's ACTUAL background):
- Construction & heavy labor
- Landscaping & groundskeeping
- Hospitality & housekeeping
- Food service & kitchen operations
- Warehouse & logistics
- Manufacturing & production

TONE GUIDELINES:
- The Professional Summary MUST be direct and assertive, American-style.
- Be SPECIFIC about the candidate's REAL strongest 2-3 sectors.
- MUST include availability signal.
- Emphasize safety compliance, teamwork, and reliability.`;
  }

  const practicalLines = practical_experience?.length
    ? `\nCANDIDATE'S PRACTICAL EXPERIENCE (from questionnaire):\n${practical_experience.map((e: any) => typeof e === "string" ? `- ${e}` : `- ${e.area} (${e.duration})`).join("\n")}`
    : "";

  const physicalLines = physical_skills?.length
    ? `\nPHYSICAL CAPABILITIES:\n${physical_skills.map((s: any) => typeof s === "string" ? `- ${s}` : `- ${s.skill}${s.detail ? ` (${s.detail})` : ""}`).join("\n")}`
    : "";

  const langLines = languages
    ? `\nLANGUAGE PROFICIENCY:\n- English: ${languages.english || "not specified"}\n- Spanish: ${languages.spanish || "not specified"}`
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
5. ENHANCE the resume by incorporating the practical experience and physical skills from the questionnaire below.
6. Preserve original job titles semantically and clean grammar only. NEVER add annotations such as "reframed".
7. Keep it professional, 1-2 pages maximum.
8. NEVER list more than 3 focus areas in the Summary — specificity beats breadth.
9. MUST populate the work_authorization field using the MIGRATION/VISA CONTEXT and AVAILABILITY data below. This is MANDATORY.

ANTI-HALLUCINATION RULES (CRITICAL — VIOLATION IS UNACCEPTABLE):
- NEVER invent skills the candidate did not mention.
- NEVER add "reframed" or "training-based" wording anywhere (summary, skills, titles, bullets, notes).
- NEVER add parenthetical context to job titles like "(Reframed for X Context)".
- The SKILLS section must ONLY contain skills that are explicitly listed in the candidate's original resume text OR explicitly selected in the questionnaire below.
- If the candidate lacks skills for the target visa type, focus on transferable qualities (physical stamina, reliability, fast learner) — do NOT fabricate technical skills.
- NEVER add certifications the candidate did not mention.
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

function buildSectorPrompt(rawText: string, sectorId: string, context: any): string {
  const sector = SECTOR_FOCUS[sectorId];
  if (!sector) throw new Error(`Unknown sector: ${sectorId}`);

  const { practical_experience, physical_skills, migration_status, availability, extra_notes, languages } = context || {};

  const practicalLines = practical_experience?.length
    ? `\nCANDIDATE'S PRACTICAL EXPERIENCE:\n${practical_experience.map((e: any) => typeof e === "string" ? `- ${e}` : `- ${e.area} (${e.duration})`).join("\n")}`
    : "";

  const physicalLines = physical_skills?.length
    ? `\nPHYSICAL CAPABILITIES:\n${physical_skills.map((s: any) => typeof s === "string" ? `- ${s}` : `- ${s.skill}${s.detail ? ` (${s.detail})` : ""}`).join("\n")}`
    : "";

  const langLines = languages
    ? `\nLANGUAGE PROFICIENCY:\n- English: ${languages.english || "not specified"}\n- Spanish: ${languages.spanish || "not specified"}`
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

  return `You are an expert US Recruiter specializing in H-2 visa worker placement for the ${sector.name} sector. You write resumes that GET INTERVIEWS — direct, assertive, American-style.

TARGET SECTOR: ${sector.name}
SECTOR FOCUS AREAS: ${sector.focus}

This resume covers BOTH H-2A and H-2B visa positions within ${sector.name}. The candidate may work on either visa type depending on the employer.

CRITICAL INSTRUCTIONS:
- The Professional Summary MUST specifically reference ${sector.name} competencies the candidate ACTUALLY has.
- Skills section MUST prioritize skills relevant to: ${sector.keywords.join(", ")} — but ONLY if the candidate actually has them.
- Experience bullets should highlight ${sector.name}-relevant achievements where they genuinely exist.
- If the candidate has NO direct experience in this sector, emphasize transferable qualities (reliability, physical stamina, fast learner) — do NOT invent sector-specific skills.

RULES:
1. Translate everything to English.
2. REMOVE: Age, Photo, Marital Status, National IDs (CPF/RG/CURP), date of birth.
3. Use strong Action Verbs (Managed, Operated, Maintained, Supervised, etc.).
4. Summary: 2-3 sentences MAX. Mention sector focus, top skills, availability.
5. ENHANCE with questionnaire data below.
6. Keep it professional, 1-2 pages maximum.
7. NEVER list more than 3 focus areas in Summary.
8. MUST populate the work_authorization field using the MIGRATION/VISA CONTEXT and AVAILABILITY data below. This is MANDATORY.

ANTI-HALLUCINATION RULES (CRITICAL — VIOLATION IS UNACCEPTABLE):
- NEVER invent skills the candidate did not mention in their resume or questionnaire.
- NEVER add "reframed" or "training-based" wording anywhere.
- NEVER add parenthetical context to job titles like "(Reframed for X Context)".
- The SKILLS section must ONLY contain skills from: (a) the candidate's original resume, OR (b) questionnaire selections below.
- If the candidate lacks sector skills, use transferable qualities — do NOT fabricate technical skills.
- NEVER add certifications the candidate did not mention.
${practicalLines}
${physicalLines}
${langLines}
${migrationLines}
${availLines}
${extraLines}

ORIGINAL RESUME TEXT:
"${rawText.substring(0, 20000)}"

Generate a complete, enhanced US-style resume JSON specifically optimized for ${sector.name} positions.`;
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

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\((?:[^)]*reframed[^)]*|[^)]*training[-\s]?based[^)]*)\)/gi, "")
    .replace(/\breframed for [^,.;)\n]+/gi, "")
    .replace(/\breframed\b/gi, "")
    .replace(/\btraining[-\s]?based knowledge\b/gi, "")
    .replace(/\btraining[-\s]?based\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanText).filter(Boolean))];
}

function extractContextSkillNames(context: any): string[] {
  const physical = Array.isArray(context?.physical_skills)
    ? context.physical_skills.map((item: any) => cleanText(typeof item === "string" ? item : item?.skill))
    : [];
  const practical = Array.isArray(context?.practical_experience)
    ? context.practical_experience.map((item: any) => cleanText(typeof item === "string" ? item : item?.area))
    : [];
  return [...new Set([...physical, ...practical].filter(Boolean))];
}

function buildWorkAuthorization(context: any) {
  const migration = context?.migration_status ?? {};
  const availability = context?.availability ?? {};
  const when = cleanText(availability.when || "Immediately available");
  const duration = cleanText(availability.duration || "Full season");

  return {
    visa_type: cleanText(migration.work_auth || "Requires H-2 Visa Sponsorship"),
    current_location: cleanText(migration.location || "Outside the U.S."),
    passport_status: cleanText(migration.passport || "Valid passport"),
    previous_h2_experience: cleanText(migration.h2_history || "None - first time applicant"),
    availability: cleanText(`${when}${duration ? ` — ${duration}` : ""}`),
    visa_denial_history: cleanText(migration.visa_denials || "No visa denials"),
  };
}

function sanitizeResumeOutput(resume: any, context: any, rawText: string): any {
  const sourceText = `${String(rawText || "")} ${JSON.stringify(context || {})}`.toLowerCase();
  const contextSkills = extractContextSkillNames(context).map((item) => item.toLowerCase());

  const sanitizedSkills = cleanArray(resume?.skills).filter((skill) => {
    const normalized = skill.toLowerCase();
    if (!normalized) return false;
    if (/\breframed\b|training[-\s]?based/.test(normalized)) return false;
    if (contextSkills.some((ctxSkill) => ctxSkill && (normalized.includes(ctxSkill) || ctxSkill.includes(normalized)))) return true;
    if (sourceText.includes(normalized)) return true;
    const tokens = normalized.split(/\s+/).filter((token) => token.length >= 4);
    return tokens.length > 0 && tokens.every((token) => sourceText.includes(token));
  });

  const waFromModel = resume?.work_authorization ?? {};
  const waFallback = buildWorkAuthorization(context);

  return {
    ...resume,
    summary: cleanText(resume?.summary),
    skills: sanitizedSkills.length > 0 ? sanitizedSkills : extractContextSkillNames(context),
    experience: Array.isArray(resume?.experience)
      ? resume.experience.map((exp: any) => ({
          title: cleanText(exp?.title),
          company: cleanText(exp?.company),
          location: cleanText(exp?.location),
          dates: cleanText(exp?.dates),
          points: cleanArray(exp?.points),
        }))
      : [],
    education: Array.isArray(resume?.education)
      ? resume.education.map((edu: any) => ({
          degree: cleanText(edu?.degree),
          school: cleanText(edu?.school),
          year: cleanText(edu?.year),
        }))
      : [],
    languages: cleanArray(resume?.languages),
    certifications: cleanArray(resume?.certifications),
    work_authorization: {
      visa_type: cleanText(waFromModel?.visa_type) || waFallback.visa_type,
      current_location: cleanText(waFromModel?.current_location) || waFallback.current_location,
      passport_status: cleanText(waFromModel?.passport_status) || waFallback.passport_status,
      previous_h2_experience: cleanText(waFromModel?.previous_h2_experience) || waFallback.previous_h2_experience,
      availability: cleanText(waFromModel?.availability) || waFallback.availability,
      visa_denial_history: cleanText(waFromModel?.visa_denial_history) || waFallback.visa_denial_history,
    },
  };
}

async function generateResume(apiKey: string, prompt: string, context: any, rawText: string): Promise<any> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.15,
      messages: [{ role: "user", content: prompt }],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "format_resume" } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("AI error:", resp.status, errText);
    throw new Error(`AI failed: ${resp.status}`);
  }

  const data = await resp.json();
  const parsed = parseToolResponse(data);
  return sanitizeResumeOutput(parsed, context, rawText);
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

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get user's plan tier
    const { data: profileData } = await serviceClient
      .from("profiles")
      .select("plan_tier")
      .eq("id", user.id)
      .single();

    const planTier = profileData?.plan_tier || "free";

    if (planTier === "free") {
      return json(403, { error: "Resume Builder requires a paid plan." });
    }

    console.log(`Starting resume generation for user: ${user.id}, plan: ${planTier}`);

    let result: any = {};

    if (planTier === "gold") {
      // Gold: generate 1 resume (H-2A or H-2B based on choice)
      const visaChoice = context?.gold_visa_choice === "h2a" ? "H-2A" : "H-2B";
      console.log(`Gold tier: generating ${visaChoice} resume`);
      const prompt = buildPrompt(raw_text, visaChoice as "H-2A" | "H-2B", context);
      const resume = await generateResume(LOVABLE_API_KEY, prompt, context, raw_text);

      if (visaChoice === "H-2A") {
        result.h2a = resume;
        await serviceClient.from("profiles").update({
          resume_data_h2a: resume,
          resume_data_h2b: null,
          resume_data: resume, // Also set as default resume_data for email generation
          resume_extra_context: context || null,
        }).eq("id", user.id);
      } else {
        result.h2b = resume;
        await serviceClient.from("profiles").update({
          resume_data_h2b: resume,
          resume_data_h2a: null,
          resume_data: resume,
          resume_extra_context: context || null,
        }).eq("id", user.id);
      }

    } else if (planTier === "diamond") {
      // Diamond: generate both H-2A and H-2B
      console.log("Diamond tier: generating H-2A and H-2B resumes");
      const [h2aResume, h2bResume] = await Promise.all([
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2A", context), context, raw_text),
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2B", context), context, raw_text),
      ]);

      result.h2a = h2aResume;
      result.h2b = h2bResume;

      await serviceClient.from("profiles").update({
        resume_data_h2a: h2aResume,
        resume_data_h2b: h2bResume,
        resume_data: h2bResume, // Default to H-2B for email generation
        resume_extra_context: context || null,
      }).eq("id", user.id);

    } else if (planTier === "black") {
      // Black: generate up to 5 sector-specific resumes + 1 H-2A + 1 H-2B fallback
      const selectedSectors: string[] = context?.selected_sectors || [];
      if (selectedSectors.length === 0) {
        return json(400, { error: "Black plan requires at least 1 sector selection." });
      }
      if (selectedSectors.length > 5) {
        return json(400, { error: "Maximum 5 sectors allowed." });
      }

      console.log(`Black tier: generating ${selectedSectors.length} sector resumes + H-2A/H-2B fallbacks`);

      // Generate sector resumes + H-2A + H-2B fallbacks in parallel
      const [sectorResults, h2aFallback, h2bFallback] = await Promise.all([
        Promise.all(
          selectedSectors.map(async (sectorId) => {
            try {
              const prompt = buildSectorPrompt(raw_text, sectorId, context);
              const resume = await generateResume(LOVABLE_API_KEY, prompt, context, raw_text);
              return { category: sectorId, resume_data: resume, success: true };
            } catch (err) {
              console.error(`Failed to generate sector resume for ${sectorId}:`, err);
              return { category: sectorId, resume_data: null, success: false };
            }
          })
        ),
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2A", context), context, raw_text).catch((err) => {
          console.error("Failed to generate H-2A fallback:", err);
          return null;
        }),
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2B", context), context, raw_text).catch((err) => {
          console.error("Failed to generate H-2B fallback:", err);
          return null;
        }),
      ]);

      const successfulResumes = sectorResults.filter(r => r.success && r.resume_data);

      // Save sector resumes to sector_resumes table (upsert)
      for (const sr of successfulResumes) {
        await serviceClient.from("sector_resumes").upsert({
          user_id: user.id,
          category: sr.category,
          resume_data: sr.resume_data,
          visa_type: "H-2B", // Default; sector resumes cover both
        }, { onConflict: "user_id,category" });
      }

      // Save H-2A/H-2B fallbacks to profiles
      await serviceClient.from("profiles").update({
        resume_data_h2a: h2aFallback || null,
        resume_data_h2b: h2bFallback || null,
        resume_data: h2bFallback || h2aFallback || (successfulResumes[0]?.resume_data ?? null),
        resume_extra_context: context || null,
      }).eq("id", user.id);

      result.h2a = h2aFallback;
      result.h2b = h2bFallback;
      result.sector_resumes = successfulResumes.map(r => ({
        category: r.category,
        resume_data: r.resume_data,
      }));
    }

    // Track AI usage
    await serviceClient.rpc("increment_ai_usage", { p_user_id: user.id, p_function_type: "resume" });

    return json(200, result);
  } catch (error: any) {
    console.error("convert-resume error:", error);
    return json(500, { error: error.message || "Unknown error" });
  }
});
