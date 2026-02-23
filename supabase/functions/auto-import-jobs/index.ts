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

// ─── PROCESSO EM BACKGROUND (MODO TURBO) ──────────────────────────────────
async function processSourceTurbo(source: (typeof DOL_SOURCES)[0], supabase: any, jobId: string) {
  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;

    console.log(`[TURBO] Iniciando download: ${source.key}`);
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`DOL Offline: ${response.status}`);

    // 1. Extração eficiente (fflate é muito mais leve que jszip)
    let zipBytes: any = new Uint8Array(await response.arrayBuffer());
    const unzipped = unzipSync(zipBytes);
    zipBytes = null; // LIBERA MEMÓRIA

    const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
    if (!jsonFileName) throw new Error("Arquivo JSON não encontrado no ZIP");

    let allItems: any[] = JSON.parse(new TextDecoder().decode(unzipped[jsonFileName]));
    // @ts-ignore: Limpa o objeto unzipped
    delete unzipped[jsonFileName];

    const totalRows = allItems.length;
    await supabase.from("import_jobs").update({ total_rows: totalRows, status: "processing" }).eq("id", jobId);
    console.log(`[TURBO] ${source.key}: ${totalRows} itens carregados.`);

    // 2. Configuração de Concorrência
    const BATCH_SIZE = 150; // Equilíbrio entre velocidade e tamanho de payload
    const CONCURRENCY = 4; // Processa 4 lotes ao mesmo tempo
    let processed = 0;

    // 3. Loop de Processamento Paralelo com Mutação (Splice)
    while (allItems.length > 0) {
      const tasks = [];

      for (let i = 0; i < CONCURRENCY && allItems.length > 0; i++) {
        const batch = allItems.splice(0, BATCH_SIZE); // REMOVE do array original p/ liberar RAM
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

      // Aguarda o grupo de lotes terminar
      await Promise.all(tasks);

      // Atualiza progresso no banco a cada ciclo
      await supabase.from("import_jobs").update({ processed_rows: processed }).eq("id", jobId);
      console.log(`[TURBO] ${source.key}: ${processed}/${totalRows}`);
    }

    // 4. Finalização
    await supabase.rpc("deactivate_expired_jobs");
    await supabase.from("import_jobs").update({ status: "completed", processed_rows: processed }).eq("id", jobId);
    console.log(`[SUCCESS] ${source.key} finalizado.`);
  } catch (err: any) {
    console.error(`[FATAL] ${source.key}:`, err.message);
    await supabase.from("import_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
  }
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // 1. Preflight CORS
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Tenta ler o corpo da requisição de forma segura
    const body = await req.json().catch(() => ({}));
    const sourceKey = body.source || "jo";

    const source = DOL_SOURCES.find((s) => s.key === sourceKey);
    if (!source)
      return new Response(JSON.stringify({ error: "Source inválida" }), { status: 400, headers: corsHeaders });

    // 2. Registra o início do trabalho no banco
    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .insert({ source: source.key, status: "processing", processed_rows: 0 })
      .select("id")
      .single();

    if (jobErr || !job) throw new Error("Falha ao registrar job no banco");

    // 3. RESPOSTA IMEDIATA (Resolve o erro de Message Channel Closed)
    // Usamos o waitUntil para o Deno continuar trabalhando após o return
    EdgeRuntime.waitUntil(processSourceTurbo(source, supabase, job.id));

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
