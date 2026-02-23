import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOL_SOURCES = [
  { key: "jo", url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo", visaType: "H-2A (Early Access)" },
  { key: "h2a", url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2a", visaType: "H-2A" },
  { key: "h2b", url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2b", visaType: "H-2B" },
];

// --- Helpers ---
function calculateFinalWage(rawVal: any, hours: any): number | null {
  if (!rawVal) return null;
  let val = parseFloat(String(rawVal).replace(/[$,]/g, ""));
  if (isNaN(val) || val <= 0) return null;
  if (val > 100) {
    const h = hours && hours > 0 ? hours : 40;
    let calc = val / (h * 4.333);
    return calc >= 7.25 && calc <= 95 ? parseFloat(calc.toFixed(2)) : null;
  }
  return val;
}

function formatToStaticDate(dateStr: any): string | null {
  if (!dateStr || dateStr === "N/A") return null;
  try {
    if (typeof dateStr === "string" && dateStr.includes("T")) return dateStr.split("T")[0];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch { return null; }
}

function getCaseBody(id: string): string {
  if (!id) return id;
  const cleanId = id.split("-GHOST")[0].trim();
  const parts = cleanId.split("-");
  if (parts[0] === "JO" && parts[1] === "A") return parts.slice(2).join("-");
  if (parts[0] === "H") return parts.slice(1).join("-");
  return cleanId;
}

function getVal(obj: any, keys: string[]): string | null {
  if (!obj) return null;
  for (const key of keys) {
    const val = obj[key] ?? obj[key?.toLowerCase()];
    if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
  }
  return null;
}

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function processJobList(list: any[], visaType: string, jobsMap: Map<string, any>) {
  const nyToday = getTodayNY();
  const isEarly = visaType === "H-2A (Early Access)";

  for (const item of list) {
    const flat = {
      ...item,
      ...(item.clearanceOrder || {}),
      ...(item.jobRequirements?.qualification || {}),
      ...(item.employer || {}),
    };

    const rawId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
    if (!rawId) continue;
    const email = getVal(flat, ["recApplyEmail", "email"]);
    if (!email || email === "N/A") continue;

    const fingerprint = getCaseBody(rawId);
    const hours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");
    const postedDate = formatToStaticDate(getVal(flat, ["dateAcceptanceLtrIssued", "DECISION_DATE", "decisionDate"])) || nyToday;

    jobsMap.set(fingerprint, {
      job_id: rawId.split("-GHOST")[0].trim(),
      visa_type: visaType, fingerprint, is_active: true,
      job_title: getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]),
      company: getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]),
      email: email.toLowerCase(),
      phone: getVal(flat, ["recApplyPhone", "empPhone"]),
      city: getVal(flat, ["jobCity", "city"]),
      state: getVal(flat, ["jobState", "state"]),
      zip_code: getVal(flat, ["jobPostcode", "empPostalCode", "zip"]),
      salary: calculateFinalWage(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]), hours),
      start_date: formatToStaticDate(getVal(flat, ["tempneedStart", "jobBeginDate"])),
      posted_date: postedDate,
      end_date: formatToStaticDate(getVal(flat, ["tempneedEnd", "jobEndDate"])),
      job_duties: getVal(flat, ["tempneedDescription", "jobDuties"]),
      job_min_special_req: getVal(flat, ["jobMinspecialreq", "jobAddReqinfo", "specialRequirements"]),
      wage_additional: getVal(flat, ["wageAdditional", "jobSpecialPayInfo", "addSpecialPayInfo", "wageAddinfo"]),
      rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction", "deductionsInfo"]),
      weekly_hours: hours,
      category: getVal(flat, ["tempneedSocTitle", "jobSocTitle", "socTitle", "socCodeTitle", "SOC_TITLE"]) || "General Application",
      openings: parseInt(getVal(flat, ["tempneedWkrPos", "jobWrksNeeded", "totalWorkersNeeded"]) || "0"),
      experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experienceMonths"]) || "0"),
      education_required: getVal(flat, ["jobMinedu", "educationLevel"]),
      transport_provided: getVal(flat, ["transportation", "transportProvided", "recIsDailyTransport"])?.toLowerCase().includes("yes") || false,
      source_url: getVal(flat, ["sourceUrl", "url", "recApplyUrl"]),
      housing_info: getVal(flat, ["housingInfo", "housingDescription"]) || (visaType.includes("H-2A") ? "Housing Provided (H-2A Standard)" : null),
      was_early_access: isEarly,
    });
  }
}

// Process a single source independently
async function processSource(source: typeof DOL_SOURCES[0], supabase: any): Promise<number> {
  const today = getTodayNY();
  const apiUrl = `${source.url}/${today}`;
  console.log(`[AUTO-IMPORT] Baixando: ${apiUrl}`);

  const response = await fetch(apiUrl);
  if (!response.ok) {
    console.error(`[AUTO-IMPORT] HTTP ${response.status} para ${source.visaType}`);
    return 0;
  }

  const zipBuffer = await response.arrayBuffer();
  const zip = new JSZip();
  await zip.loadAsync(zipBuffer);

  const jsonFiles = Object.keys(zip.files).filter((f) => f.endsWith(".json"));
  console.log(`[AUTO-IMPORT] ${source.visaType}: ${jsonFiles.length} JSONs`);

  const jobsMap = new Map<string, any>();
  for (const fileName of jsonFiles) {
    const content = await zip.files[fileName].async("string");
    const list = JSON.parse(content);
    processJobList(list, source.visaType, jobsMap);
  }

  const allJobs = Array.from(jobsMap.values());
  const BATCH_SIZE = 100;
  for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
    const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: allJobs.slice(i, i + BATCH_SIZE) });
    if (error) console.error(`[AUTO-IMPORT] Erro lote:`, error.message);
  }

  console.log(`[AUTO-IMPORT] ${source.visaType}: ${allJobs.length} vagas processadas`);
  return allJobs.length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check which source to process (or "all" for sequential calls)
    let sourceKey = "all";
    let skipRadar = false;
    try {
      const body = await req.json();
      if (body?.source) sourceKey = body.source;
      if (body?.skip_radar) skipRadar = true;
    } catch { /* no body */ }

    const today = getTodayNY();
    console.log(`[AUTO-IMPORT] Início - source=${sourceKey} date=${today}`);

    let totalProcessed = 0;

    if (sourceKey === "all") {
      // Process each source one by one to stay within limits
      for (const source of DOL_SOURCES) {
        try {
          totalProcessed += await processSource(source, supabase);
        } catch (err) {
          console.error(`[AUTO-IMPORT] Erro ${source.visaType}:`, err.message);
        }
      }
    } else {
      const source = DOL_SOURCES.find((s) => s.key === sourceKey);
      if (!source) {
        return new Response(JSON.stringify({ error: `Source inválida: ${sourceKey}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      totalProcessed = await processSource(source, supabase);
    }

    // Deactivate expired jobs
    const { data: deactivated } = await supabase.rpc("deactivate_expired_jobs");

    // Trigger radar matching for all active profiles after import
    if (totalProcessed > 0 && !skipRadar) {
      console.log(`[AUTO-IMPORT] Disparando radar para perfis ativos...`);
      const { data: activeRadars } = await supabase
        .from("radar_profiles")
        .select("user_id, auto_send")
        .eq("is_active", true);

      let radarMatches = 0;
      for (const radar of (activeRadars || [])) {
        try {
          const { data: matchCount } = await supabase.rpc("trigger_immediate_radar", {
            target_user_id: radar.user_id,
          });
          const matched = matchCount ?? 0;
          radarMatches += matched;

          // NEW: Move matches from radar_matched_jobs → my_queue
          if (radar.auto_send && matched > 0) {
            try {
              // 1. Get daily limit
              const { data: dailyLimit } = await supabase.rpc("get_effective_daily_limit", {
                p_user_id: radar.user_id,
              });
              const limit = dailyLimit ?? 5;

              // 2. Check how many already used today
              const todayStart = new Date();
              todayStart.setUTCHours(0, 0, 0, 0);
              const { count: usedToday } = await supabase
                .from("my_queue")
                .select("id", { count: "exact", head: true })
                .eq("user_id", radar.user_id)
                .gte("created_at", todayStart.toISOString());

              const remaining = Math.max(0, limit - (usedToday ?? 0));

              if (remaining > 0) {
                // 3. Fetch new matches NOT yet in my_queue
                const { data: newMatches } = await supabase
                  .from("radar_matched_jobs")
                  .select("job_id")
                  .eq("user_id", radar.user_id)
                  .eq("auto_queued", false)
                  .limit(remaining);

                const jobIds = (newMatches || []).map((m: any) => m.job_id);

                if (jobIds.length > 0) {
                  // 4. Insert into my_queue
                  const { error: queueError } = await supabase.from("my_queue").insert(
                    jobIds.map((jobId: string) => ({
                      user_id: radar.user_id,
                      job_id: jobId,
                      status: "pending",
                    }))
                  );

                  if (!queueError) {
                    // 5. Mark as auto_queued
                    await supabase
                      .from("radar_matched_jobs")
                      .update({ auto_queued: true })
                      .eq("user_id", radar.user_id)
                      .in("job_id", jobIds);

                    console.log(`[AUTO-IMPORT] Enfileirou ${jobIds.length} vagas para ${radar.user_id}`);

                    // 6. Trigger process-queue
                    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-queue`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({ user_id: radar.user_id }),
                    });
                  } else {
                    console.error(`[AUTO-IMPORT] Erro ao enfileirar para ${radar.user_id}:`, queueError.message);
                  }
                }
              } else {
                console.log(`[AUTO-IMPORT] Limite diário atingido para ${radar.user_id}`);
              }
            } catch (e) {
              console.error(`[AUTO-IMPORT] Erro auto-send para ${radar.user_id}:`, e);
            }
          }

          // Update last_scan_at
          await supabase
            .from("radar_profiles")
            .update({ last_scan_at: new Date().toISOString() })
            .eq("user_id", radar.user_id);
        } catch (e) {
          console.error(`[AUTO-IMPORT] Erro radar para ${radar.user_id}:`, e);
        }
      }
      console.log(`[AUTO-IMPORT] Radar: ${radarMatches} matches em ${(activeRadars || []).length} perfis`);
    }

    const summary = { success: true, date: today, total_processed: totalProcessed, expired_deactivated: deactivated ?? 0 };
    console.log(`[AUTO-IMPORT] Concluído:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AUTO-IMPORT] Erro fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
