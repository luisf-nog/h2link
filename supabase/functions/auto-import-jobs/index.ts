import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOL_SOURCES = [
  {
    key: "jo",
    url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo",
    visaType: "H-2A (Early Access)",
  },
  { key: "h2a", url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2a", visaType: "H-2A" },
  { key: "h2b", url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2b", visaType: "H-2B" },
];

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// ─── LIGHTWEIGHT ZIP EXTRACTION (fflate instead of JSZip) ──────────────────
function extractJsonFromZip(zipBytes: Uint8Array): string | null {
  const unzipped = unzipSync(zipBytes);
  const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
  if (!jsonFileName) return null;
  const jsonBytes = unzipped[jsonFileName];
  return new TextDecoder().decode(jsonBytes);
}

// ─── MEMORY-SAFE PROCESSING ────────────────────────────────────────────────
async function processSourceWithTracking(source: (typeof DOL_SOURCES)[0], supabase: any, jobId: string) {
  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;

    console.log(`[AUTO-IMPORT] Baixando: ${apiUrl}`);
    const response = await fetch(apiUrl);
    if (!response.ok) {
      await supabase
        .from("import_jobs")
        .update({ status: "failed", error_message: `HTTP ${response.status} em ${apiUrl}` })
        .eq("id", jobId);
      return 0;
    }

    // Step 1: Download ZIP into Uint8Array
    let zipBytes: Uint8Array | null = new Uint8Array(await response.arrayBuffer());
    console.log(`[AUTO-IMPORT] ${source.visaType}: ZIP ${zipBytes.byteLength} bytes`);

    // Step 2: Extract JSON string using fflate (lightweight, ~2MB vs JSZip ~15MB)
    let content: string | null = extractJsonFromZip(zipBytes);

    // Step 3: FREE ZIP bytes immediately
    zipBytes = null;

    if (!content) {
      await supabase
        .from("import_jobs")
        .update({ status: "failed", error_message: "No JSON found in ZIP" })
        .eq("id", jobId);
      return 0;
    }

    // Step 4: Parse JSON
    let list: any[] | null = JSON.parse(content);

    // Step 5: FREE the raw JSON string
    content = null;

    if (!Array.isArray(list) || list.length === 0) {
      await supabase
        .from("import_jobs")
        .update({ status: "completed", processed_rows: 0 })
        .eq("id", jobId);
      return 0;
    }

    console.log(`[AUTO-IMPORT] ${source.visaType}: ${list.length} itens para processar`);

    // Set total_rows immediately so UI can show progress
    await supabase.from("import_jobs").update({ total_rows: list.length }).eq("id", jobId);

    // Step 6: Process using splice() with LARGE batches to reduce RPC calls
    // 2081 items / 200 = ~11 calls instead of 42 calls with batch=50
    const BATCH_SIZE = 200;
    let totalProcessedInSource = 0;

    while (list!.length > 0) {
      const batch = list!.splice(0, BATCH_SIZE);

      const { data, error } = await supabase.rpc("process_dol_raw_batch", {
        p_raw_items: batch,
        p_visa_type: source.visaType,
      });

      if (!error) {
        totalProcessedInSource += data ?? batch.length;
        await supabase.from("import_jobs").update({ processed_rows: totalProcessedInSource }).eq("id", jobId);
        console.log(`[AUTO-IMPORT] ${source.visaType}: ${totalProcessedInSource} processados`);
      } else {
        console.error(`[BATCH ERROR] ${source.key}:`, error.message);
      }
    }

    // Ensure list is freed
    list = null;

    // Mark completed
    await supabase
      .from("import_jobs")
      .update({ status: "completed", processed_rows: totalProcessedInSource })
      .eq("id", jobId);
    return totalProcessedInSource;
  } catch (err: any) {
    console.error(`[FATAL ERROR] ${source.key}:`, err.message);
    await supabase
      .from("import_jobs")
      .update({ status: "failed", error_message: err.message?.slice(0, 500) || "Unknown error" })
      .eq("id", jobId);
    return 0;
  }
}

// ─── RADAR LOGIC ────────────────────────────────────────────────────────────
async function runRadarMatching(supabase: any) {
  console.log(`[RADAR] Iniciando cruzamento de perfis ativos...`);
  const { data: activeRadars } = await supabase
    .from("radar_profiles")
    .select("user_id, auto_send")
    .eq("is_active", true);

  for (const radar of activeRadars || []) {
    try {
      const { data: matchCount } = await supabase.rpc("trigger_immediate_radar", { target_user_id: radar.user_id });
      const matched = matchCount ?? 0;

      if (radar.auto_send && matched > 0) {
        const { data: dailyLimit } = await supabase.rpc("get_effective_daily_limit", { p_user_id: radar.user_id });
        const limit = dailyLimit ?? 5;

        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const { count: usedToday } = await supabase
          .from("my_queue")
          .select("id", { count: "exact", head: true })
          .eq("user_id", radar.user_id)
          .gte("created_at", todayStart.toISOString());

        const remaining = Math.max(0, limit - (usedToday ?? 0));

        if (remaining > 0) {
          const { data: newMatches } = await supabase
            .from("radar_matched_jobs")
            .select("job_id")
            .eq("user_id", radar.user_id)
            .eq("auto_queued", false)
            .limit(remaining);

          const jobIds = (newMatches || []).map((m: any) => m.job_id);

          if (jobIds.length > 0) {
            const { error: qErr } = await supabase
              .from("my_queue")
              .insert(jobIds.map((id: string) => ({ user_id: radar.user_id, job_id: id, status: "pending" })));
            if (!qErr) {
              await supabase
                .from("radar_matched_jobs")
                .update({ auto_queued: true })
                .eq("user_id", radar.user_id)
                .in("job_id", jobIds);
              fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-queue`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ user_id: radar.user_id }),
              }).catch(() => {});
            }
          }
        }
      }
      await supabase
        .from("radar_profiles")
        .update({ last_scan_at: new Date().toISOString() })
        .eq("user_id", radar.user_id);
    } catch (e) {
      console.error(`[RADAR ERROR] User ${radar.user_id}:`, e);
    }
  }
}

// ─── MAIN SERVE ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let { source: sourceKey = "all", skip_radar = false } = await req.json().catch(() => ({}));

    console.log(`[AUTO-IMPORT] Início - source=${sourceKey} date=${getTodayNY()} skipRadar=${skip_radar}`);

    if (sourceKey !== "all") {
      const source = DOL_SOURCES.find((s) => s.key === sourceKey);
      if (!source) {
        return new Response(JSON.stringify({ error: `Source "${sourceKey}" not found` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: job } = await supabase
        .from("import_jobs")
        .insert({ source: sourceKey, status: "processing" })
        .select("id")
        .single();

      if (!job) {
        return new Response(JSON.stringify({ error: "Failed to create import_job" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      EdgeRuntime.waitUntil(
        (async () => {
          const total = await processSourceWithTracking(source, supabase, job.id);
          if (total > 0 && !skip_radar) {
            await supabase.rpc("deactivate_expired_jobs");
            await runRadarMatching(supabase);
          }
          console.log(`[AUTO-IMPORT] ${sourceKey} finished. Total: ${total} rows.`);
        })(),
      );

      return new Response(JSON.stringify({ success: true, job_id: job.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // "all" mode: sequential in background (used by cron)
    EdgeRuntime.waitUntil(
      (async () => {
        let grandTotal = 0;
        for (const source of DOL_SOURCES) {
          const { data: job } = await supabase
            .from("import_jobs")
            .insert({ source: source.key, status: "processing" })
            .select("id")
            .single();
          if (job) grandTotal += await processSourceWithTracking(source, supabase, job.id);
        }
        if (grandTotal > 0) {
          await supabase.rpc("deactivate_expired_jobs");
          if (!skip_radar) await runRadarMatching(supabase);
        }
        console.log(`[AUTO-IMPORT] Global Sync Finished. Total: ${grandTotal} rows.`);
      })(),
    );

    return new Response(JSON.stringify({ success: true, message: "Importação processando em background." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
