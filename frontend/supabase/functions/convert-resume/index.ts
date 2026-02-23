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

// Sector category mapping (mirrors frontend SECTOR_CATEGORIES)
const SECTOR_FOCUS: Record<string, { name: string; focus: string; keywords: string[] }> = {
  agricultura_colheita: {
    name: "Agriculture & Harvesting",
    focus: "Crop harvesting, planting, livestock care, greenhouse/nursery, forestry, irrigation, soil management, farm equipment support",
    keywords: ["farming", "harvesting", "livestock", "agriculture", "crop", "nursery", "greenhouse"],
  },
  equipamentos_agricolas: {
    name: "Farm Equipment",
    focus: "Tractor operation support, agricultural machinery handling, preventive checks, field equipment readiness",
    keywords: ["tractor", "equipment", "farm machinery", "ag equipment", "maintenance"],
  },
  construcao_geral: {
    name: "General Construction",
    focus: "Building construction, heavy labor, masonry, concrete, framing, site prep, general maintenance",
    keywords: ["construction", "building", "masonry", "concrete", "labor", "site"],
  },
  carpintaria_telhados: {
    name: "Carpentry & Roofing",
    focus: "Wood framing, roof installation/repair, finishing carpentry, measuring/cutting, structure assembly",
    keywords: ["carpentry", "roofer", "roofing", "wood", "framing", "cabinet"],
  },
  instalacao_eletrica: {
    name: "Installation & Electrical",
    focus: "Electrical/plumbing installation support, piping, system setup, troubleshooting assistance, safe tool usage",
    keywords: ["electric", "electrical", "plumbing", "installation", "pipe", "wiring"],
  },
  mecanica_reparo: {
    name: "Mechanics & Repair",
    focus: "Vehicle and equipment maintenance, diagnostics support, parts replacement, repair workflows",
    keywords: ["mechanic", "repair", "automotive", "diesel", "technician", "maintenance"],
  },
  limpeza_zeladoria: {
    name: "Cleaning & Janitorial",
    focus: "Commercial/residential cleaning, sanitization, housekeeping standards, janitorial routines",
    keywords: ["cleaning", "janitorial", "housekeeping", "sanitation", "maid", "cleaner"],
  },
  cozinha_preparacao: {
    name: "Kitchen & Food Prep",
    focus: "Food preparation, cooking support, kitchen organization, food safety, prep-line efficiency",
    keywords: ["kitchen", "cook", "food prep", "chef", "baker", "prep"],
  },
  servico_mesa: {
    name: "Dining & Table Service",
    focus: "Guest service, table setup, order support, dining room workflow, fast and attentive service",
    keywords: ["waiter", "waitress", "server", "dining", "host", "dishwasher"],
  },
  hotelaria_recepcao: {
    name: "Hospitality & Front Desk",
    focus: "Front desk operations, guest assistance, check-in/out support, hotel workflow and service quality",
    keywords: ["hotel", "hospitality", "front desk", "concierge", "lodging", "reception"],
  },
  bar_bebidas: {
    name: "Bar & Beverages",
    focus: "Beverage prep, bar support, station organization, customer service, cleanliness and safety",
    keywords: ["bar", "barista", "bartender", "beverages", "drink"],
  },
  logistica_estoque: {
    name: "Logistics & Warehousing",
    focus: "Inventory movement, loading/unloading, stock control, warehouse organization, shipping/receiving",
    keywords: ["logistics", "warehouse", "inventory", "freight", "loading", "stock"],
  },
  transporte_motorista: {
    name: "Transport & Driving",
    focus: "Commercial driving support, route discipline, safe transport, delivery operations, fleet routines",
    keywords: ["driver", "transport", "delivery", "truck", "shuttle", "driving"],
  },
  manufatura_montagem: {
    name: "Manufacturing & Assembly",
    focus: "Assembly line production, machine support, process discipline, quality-oriented repetitive tasks",
    keywords: ["manufacturing", "assembly", "production", "operator", "fabrication", "factory"],
  },
  soldagem_corte: {
    name: "Welding & Cutting",
    focus: "Welding/cutting support, metal preparation, torch/tool handling, safety-first execution",
    keywords: ["welding", "welder", "cutting", "metal", "brazer", "solder"],
  },
  marcenaria_madeira: {
    name: "Woodworking",
    focus: "Wood processing, finishing, machine-assisted cutting, precision in wood fabrication tasks",
    keywords: ["woodworking", "sawmill", "wood", "carpentry", "wood machine"],
  },
  carnes_frigorifico: {
    name: "Meat Processing",
    focus: "Meat/poultry processing workflows, sanitation discipline, cutting/packing support, cold-chain readiness",
    keywords: ["meat", "poultry", "processing", "butcher", "slaughter", "packing"],
  },
  textil_lavanderia: {
    name: "Textile & Laundry",
    focus: "Laundry operations, textile handling, garment processing, pressing/folding workflow quality",
    keywords: ["textile", "laundry", "garment", "sewing", "pressing"],
  },
  paisagismo_jardinagem: {
    name: "Landscaping & Gardening",
    focus: "Grounds maintenance, mowing, pruning, irrigation support, outdoor service quality",
    keywords: ["landscaping", "gardening", "groundskeeping", "tree", "mowing", "irrigation"],
  },
  vendas_atendimento: {
    name: "Sales & Customer Service",
    focus: "Customer-facing service, retail operations, cashier support, communication and attention to detail",
    keywords: ["sales", "retail", "cashier", "customer service", "reception"],
  },

  // Legacy aliases (backward compatibility)
  campo_colheita: {
    name: "Agriculture & Harvesting",
    focus: "Crop harvesting, planting, livestock care, greenhouse/nursery, forestry, irrigation, soil management, farm equipment support",
    keywords: ["farming", "harvesting", "livestock", "agriculture", "crop", "nursery", "greenhouse"],
  },
  construcao_manutencao: {
    name: "General Construction",
    focus: "Building construction, heavy labor, masonry, concrete, framing, site prep, general maintenance",
    keywords: ["construction", "building", "masonry", "concrete", "labor", "site"],
  },
  hotelaria_limpeza: {
    name: "Cleaning & Janitorial",
    focus: "Commercial/residential cleaning, sanitization, housekeeping standards, janitorial routines",
    keywords: ["cleaning", "janitorial", "housekeeping", "sanitation", "maid", "cleaner"],
  },
  cozinha_restaurante: {
    name: "Kitchen & Food Prep",
    focus: "Food preparation, cooking support, kitchen organization, food safety, prep-line efficiency",
    keywords: ["kitchen", "cook", "food prep", "chef", "baker", "prep"],
  },
  logistica_transporte: {
    name: "Logistics & Warehousing",
    focus: "Inventory movement, loading/unloading, stock control, warehouse organization, shipping/receiving",
    keywords: ["logistics", "warehouse", "inventory", "freight", "loading", "stock"],
  },
  industria_producao: {
    name: "Manufacturing & Assembly",
    focus: "Assembly line production, machine support, process discipline, quality-oriented repetitive tasks",
    keywords: ["manufacturing", "assembly", "production", "operator", "fabrication", "factory"],
  },
  vendas_escritorio: {
    name: "Sales & Customer Service",
    focus: "Customer-facing service, retail operations, cashier support, communication and attention to detail",
    keywords: ["sales", "retail", "cashier", "customer service", "reception"],
  },
  lazer_servicos: {
    name: "Leisure & Services",
    focus: "Amusement/recreation routines, service consistency, client interaction, adaptable operational support",
    keywords: ["recreation", "amusement", "tour", "lifeguard", "fitness", "service"],
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

function buildSectorPrompt(rawText: string, sectorId: string, context: any): string {
  const sector = SECTOR_FOCUS[sectorId];
  if (!sector) throw new Error(`Unknown sector: ${sectorId}`);

  const { practical_experience, physical_skills, migration_status, availability, extra_notes, languages } = context || {};

  const practicalLines = practical_experience?.length
    ? `\nCANDIDATE'S PRACTICAL EXPERIENCE:\n${practical_experience.map((e: any) => typeof e === 'string' ? `- ${e}` : `- ${e.area} (${e.duration})`).join("\n")}`
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

  return `You are an expert US Recruiter specializing in H-2 visa worker placement for the ${sector.name} sector. You write resumes that GET INTERVIEWS — direct, assertive, American-style.

TARGET SECTOR: ${sector.name}
SECTOR FOCUS AREAS: ${sector.focus}

This resume covers BOTH H-2A and H-2B visa positions within ${sector.name}. The candidate may work on either visa type depending on the employer.

CRITICAL INSTRUCTIONS:
- The Professional Summary MUST specifically reference ${sector.name} competencies
- Skills section MUST prioritize skills relevant to: ${sector.keywords.join(", ")}
- Experience bullets MUST be reframed to highlight ${sector.name}-relevant achievements
- If the candidate has NO direct experience in this sector, emphasize transferable skills and willingness to learn
- For equipment/machinery skills without hands-on experience, use "Familiar with [equipment] (training-based knowledge)"
- Summary MUST include availability signal and visa readiness

RULES:
1. Translate everything to English
2. REMOVE: Age, Photo, Marital Status, National IDs (CPF/RG/CURP), date of birth
3. Use strong Action Verbs (Managed, Operated, Maintained, Supervised, etc.)
4. Summary: 2-3 sentences MAX. Mention sector focus, top skills, availability.
5. ENHANCE with questionnaire data below. REFRAME non-sector experience.
6. Keep it professional, 1-2 pages maximum
7. NEVER list more than 3 focus areas in Summary
8. Skills learned via training → "Familiar with X (training-based)"
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

async function generateResume(apiKey: string, prompt: string): Promise<any> {
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
  return parseToolResponse(data);
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
      const resume = await generateResume(LOVABLE_API_KEY, prompt);

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
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2A", context)),
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2B", context)),
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
              const resume = await generateResume(LOVABLE_API_KEY, prompt);
              return { category: sectorId, resume_data: resume, success: true };
            } catch (err) {
              console.error(`Failed to generate sector resume for ${sectorId}:`, err);
              return { category: sectorId, resume_data: null, success: false };
            }
          })
        ),
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2A", context)).catch((err) => {
          console.error("Failed to generate H-2A fallback:", err);
          return null;
        }),
        generateResume(LOVABLE_API_KEY, buildPrompt(raw_text, "H-2B", context)).catch((err) => {
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
