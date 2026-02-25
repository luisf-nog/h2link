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

// ─── PROCESSO EM BACKGROUND (MODO LEAN) ──────────────────────────────────
async function processSourceLean(source: (typeof DOL_SOURCES)[0], supabase: any, jobId: string) {
  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;

    console.log(`[LEAN] Iniciando download: ${source.key}`);
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`DOL Offline: ${response.status}`);

    // 1. Download em chunks para controlar memória
    const chunks: Uint8Array[] = [];
    const reader = response.body!.getReader();
    let totalBytes = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
    }
    
    // Concatenar chunks
    const zipBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      zipBytes.set(chunk, offset);
      offset += chunk.length;
    }
    // Liberar chunks
    chunks.length = 0;

    console.log(`[LEAN] ${source.key}: ZIP baixado (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
    
    // 2. Extrair JSON do ZIP
    const unzipped = unzipSync(zipBytes);

    const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
    if (!jsonFileName) throw new Error("Arquivo JSON não encontrado no ZIP");

    const jsonText = new TextDecoder().decode(unzipped[jsonFileName]);
    // Liberar memória do ZIP
    for (const key of Object.keys(unzipped)) {
      delete (unzipped as any)[key];
    }

    let allItems: any[] = JSON.parse(jsonText);
    
    const totalRows = allItems.length;
    await supabase.from("import_jobs").update({ total_rows: totalRows, status: "processing" }).eq("id", jobId);
    console.log(`[LEAN] ${source.key}: ${totalRows} itens carregados.`);

    // 3. Processamento com batches menores e concorrência reduzida para economizar RAM
    const BATCH_SIZE = 100;
    const CONCURRENCY = 2; // Menos concorrência = menos RAM
    let processed = 0;

    while (allItems.length > 0) {
      const tasks = [];

      for (let i = 0; i < CONCURRENCY && allItems.length > 0; i++) {
        const batch = allItems.splice(0, BATCH_SIZE);
        tasks.push(
          supabase
            .rpc("process_dol_raw_batch", {
              p_raw_items: batch,
              p_visa_type: source.visaType,
            })
            .then(({ error }: any) => {
              if (!error) {
                processed += batch.length;
              } else {
                console.error(`[BATCH ERROR] ${source.key}:`, error.message);
              }
            }),
        );
      }

      await Promise.all(tasks);

      // Atualiza progresso
      await supabase.from("import_jobs").update({ processed_rows: processed }).eq("id", jobId);
      
      // Log a cada 500
      if (processed % 500 < BATCH_SIZE * CONCURRENCY) {
        console.log(`[LEAN] ${source.key}: ${processed}/${totalRows}`);
      }
    }

    // 4. Finalização
    await supabase.rpc("deactivate_expired_jobs");
    await supabase.from("import_jobs").update({ status: "completed", processed_rows: processed }).eq("id", jobId);
    console.log(`[SUCCESS] ${source.key} finalizado: ${processed} processados.`);
  } catch (err: any) {
    console.error(`[FATAL] ${source.key}:`, err.message);
    await supabase.from("import_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
  }
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const sourceKey = body.source || "jo";

    const source = DOL_SOURCES.find((s) => s.key === sourceKey);
    if (!source)
      return new Response(JSON.stringify({ error: "Source inválida" }), { status: 400, headers: corsHeaders });

    // Registra o início
    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .insert({ source: source.key, status: "processing", processed_rows: 0 })
      .select("id")
      .single();

    if (jobErr || !job) throw new Error("Falha ao registrar job no banco");

    // Resposta imediata + background processing
    EdgeRuntime.waitUntil(processSourceLean(source, supabase, job.id));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Importação de ${source.key} iniciada em background.`,
        job_id: job.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("[SERVE ERROR]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
