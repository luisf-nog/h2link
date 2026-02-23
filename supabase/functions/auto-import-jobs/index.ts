import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

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

// ─── BACKGROUND PROCESSING ──────────────────────────────────────────────────
async function processSourceWithTracking(source: (typeof DOL_SOURCES)[0], supabase: any, jobId: string) {
  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      await supabase
        .from("import_jobs")
        .update({ status: "failed", error_message: `HTTP ${response.status} em ${apiUrl}` })
        .eq("id", jobId);
      return 0;
    }

    let zipBuffer: any = await response.arrayBuffer();
    const zip = new JSZip();
    await zip.loadAsync(zipBuffer);
    zipBuffer = null; // Libera o buffer original imediatamente

    const jsonFiles = Object.keys(zip.files).filter((f) => f.endsWith(".json"));
    let totalProcessedInSource = 0;

    for (const fileName of jsonFiles) {
      let content: any = await zip.files[fileName].async("string");
      let list: any = JSON.parse(content);
      content = null; // Libera a string pesada

      if (Array.isArray(list)) {
        const BATCH_SIZE = 100; // Lote menor para segurança de memória
        for (let i = 0; i < list.length; i += BATCH_SIZE) {
          const batch = list.slice(i, i + BATCH_SIZE);
          const { data, error } = await supabase.rpc("process_dol_raw_batch", {
            p_raw_items: batch,
            p_visa_type: source.visaType,
          });

          if (!error) {
            totalProcessedInSource += data ?? batch.length;
            // Atualiza progresso parcial para feedback no dashboard
            await supabase.from("import_jobs").update({ processed_rows: totalProcessedInSource }).eq("id", jobId);
          } else {
            console.error(`[BATCH ERROR] ${source.key}:`, error.message);
          }
        }
      }
      list = null; // Limpa a lista do arquivo atual antes de ir para o próximo
    }

    // Marca como completado
    await supabase
      .from("import_jobs")
      .update({ status: "completed", processed_rows: totalProcessedInSource })
      .eq("id", jobId);
    return totalProcessedInSource;
  } catch (err) {
    console.error(`[FATAL ERROR] ${source.key}:`, err.message);
    await supabase.from("import_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
    return 0;
  }
}

// ─── RADAR LOGIC (EXTRACTED) ────────────────────────────────────────────────
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
        // Lógica de enfileiramento automático (Auto-Queue)
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
              .insert(jobIds.map((id) => ({ user_id: radar.user_id, job_id: id, status: "pending" })));
            if (!qErr) {
              await supabase
                .from("radar_matched_jobs")
                .update({ auto_queued: true })
                .eq("user_id", radar.user_id)
                .in("job_id", jobIds);
              // Dispara processamento da fila
              fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-queue`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ user_id: radar.user_id }),
              }).catch(() => {}); // Silent catch para não travar o loop
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

    console.log(`[AUTO-IMPORT] Start: ${sourceKey} | SkipRadar: ${skip_radar}`);

    // Execução em background
    EdgeRuntime.waitUntil(
      (async () => {
        let grandTotal = 0;

        if (sourceKey === "all") {
          for (const source of DOL_SOURCES) {
            const { data: job } = await supabase
              .from("import_jobs")
              .insert({ source: source.key, status: "processing" })
              .select("id")
              .single();
            if (job) grandTotal += await processSourceWithTracking(source, supabase, job.id);
          }
        } else {
          const source = DOL_SOURCES.find((s) => s.key === sourceKey);
          if (source) {
            const { data: job } = await supabase
              .from("import_jobs")
              .insert({ source: sourceKey, status: "processing" })
              .select("id")
              .single();
            if (job) grandTotal += await processSourceWithTracking(source, supabase, job.id);
          }
        }

        // Finalização Global
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
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
