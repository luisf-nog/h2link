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

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// Background processing — now "lean": just downloads, unzips, and sends raw JSON to SQL
async function processSourceWithTracking(
  source: typeof DOL_SOURCES[0],
  supabase: any,
  jobId: string,
  skipRadar: boolean
) {
  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;
    console.log(`[AUTO-IMPORT] Baixando: ${apiUrl}`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error(`[AUTO-IMPORT] HTTP ${response.status} para ${source.visaType}`);
      await supabase.from("import_jobs").update({ status: "failed", error_message: `HTTP ${response.status}` }).eq("id", jobId);
      return;
    }

    const zipBuffer = await response.arrayBuffer();
    const zip = new JSZip();
    await zip.loadAsync(zipBuffer);

    const jsonFiles = Object.keys(zip.files).filter((f) => f.endsWith(".json"));
    console.log(`[AUTO-IMPORT] ${source.visaType}: ${jsonFiles.length} JSONs no ZIP`);

    // Collect all raw items from all JSON files
    let allRawItems: any[] = [];
    for (const fileName of jsonFiles) {
      const content = await zip.files[fileName].async("string");
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        allRawItems = allRawItems.concat(list);
      }
    }

    const totalRows = allRawItems.length;
    console.log(`[AUTO-IMPORT] ${source.visaType}: ${totalRows} itens brutos para processar via SQL`);
    await supabase.from("import_jobs").update({ total_rows: totalRows }).eq("id", jobId);

    // Send raw JSON in batches of 500 to the SQL function
    const BATCH_SIZE = 500;
    let totalProcessed = 0;

    for (let i = 0; i < allRawItems.length; i += BATCH_SIZE) {
      const batch = allRawItems.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.rpc("process_dol_raw_batch", {
        p_raw_items: batch,
        p_visa_type: source.visaType,
      });

      if (error) {
        console.error(`[AUTO-IMPORT] Erro batch ${i}:`, error.message);
      } else {
        totalProcessed += (data ?? batch.length);
      }

    // Update progress every batch
      await supabase.from("import_jobs").update({ processed_rows: totalProcessed }).eq("id", jobId);
    }

    console.log(`[AUTO-IMPORT] ${source.visaType}: ${totalProcessed} registros processados pelo SQL`);
    await supabase.rpc("deactivate_expired_jobs");

    // Radar (unchanged logic)
    if (!skipRadar && totalRows > 0) {
      console.log(`[AUTO-IMPORT] Disparando radar...`);
      const { data: activeRadars } = await supabase
        .from("radar_profiles")
        .select("user_id, auto_send")
        .eq("is_active", true);

      for (const radar of (activeRadars || [])) {
        try {
          const { data: matchCount } = await supabase.rpc("trigger_immediate_radar", { target_user_id: radar.user_id });
          const matched = matchCount ?? 0;

          if (radar.auto_send && matched > 0) {
            try {
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
                  const { error: queueError } = await supabase.from("my_queue").insert(
                    jobIds.map((jId: string) => ({ user_id: radar.user_id, job_id: jId, status: "pending" }))
                  );
                  if (!queueError) {
                    await supabase.from("radar_matched_jobs").update({ auto_queued: true }).eq("user_id", radar.user_id).in("job_id", jobIds);
                    console.log(`[AUTO-IMPORT] Enfileirou ${jobIds.length} vagas para ${radar.user_id}`);
                    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-queue`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                      body: JSON.stringify({ user_id: radar.user_id }),
                    });
                  }
                }
              }
            } catch (e) { console.error(`[AUTO-IMPORT] Erro auto-send para ${radar.user_id}:`, e); }
          }
          await supabase.from("radar_profiles").update({ last_scan_at: new Date().toISOString() }).eq("user_id", radar.user_id);
        } catch (e) { console.error(`[AUTO-IMPORT] Erro radar para ${radar.user_id}:`, e); }
      }
    }

    // Mark completed
    await supabase.from("import_jobs").update({ status: "completed", processed_rows: totalProcessed }).eq("id", jobId);
    console.log(`[AUTO-IMPORT] Concluído para ${source.visaType}: ${totalProcessed} processados`);
  } catch (err) {
    console.error(`[AUTO-IMPORT] Erro background ${source.visaType}:`, err.message);
    await supabase.from("import_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let sourceKey = "all";
    let skipRadar = false;
    try {
      const body = await req.json();
      if (body?.source) sourceKey = body.source;
      if (body?.skip_radar) skipRadar = true;
    } catch { /* no body */ }

    const today = getTodayNY();
    console.log(`[AUTO-IMPORT] Início - source=${sourceKey} date=${today} skipRadar=${skipRadar}`);

    if (sourceKey === "all") {
      const jobIds: string[] = [];
      for (const source of DOL_SOURCES) {
        const { data: job } = await supabase.from("import_jobs").insert({ source: source.key, status: "processing" }).select("id").single();
        if (job) {
          jobIds.push(job.id);
          EdgeRuntime.waitUntil(processSourceWithTracking(source, supabase, job.id, skipRadar));
        }
      }
      return new Response(JSON.stringify({ success: true, job_ids: jobIds, message: "Importação iniciada em background" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const source = DOL_SOURCES.find((s) => s.key === sourceKey);
      if (!source) {
        return new Response(JSON.stringify({ error: `Source inválida: ${sourceKey}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: job, error: jobError } = await supabase
        .from("import_jobs")
        .insert({ source: sourceKey, status: "processing" })
        .select("id")
        .single();

      if (jobError || !job) {
        return new Response(JSON.stringify({ error: "Failed to create job record" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      EdgeRuntime.waitUntil(processSourceWithTracking(source, supabase, job.id, skipRadar));

      return new Response(JSON.stringify({ success: true, job_id: job.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[AUTO-IMPORT] Erro fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
