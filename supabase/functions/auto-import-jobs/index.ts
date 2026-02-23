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

// ─── HELPER: Limpeza de memória ───
function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// ─── PROCESSO PRINCIPAL ───
async function processSource(source: (typeof DOL_SOURCES)[0], supabase: any, jobId: string) {
  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;

    console.log(`[IMPORT] Iniciando ${source.key} em background...`);

    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`DOL Offline (${response.status})`);

    // 1. Download e Unzip (Mínimo de RAM)
    const zipBytes = new Uint8Array(await response.arrayBuffer());
    const unzipped = unzipSync(zipBytes);
    // @ts-ignore: Liberar referência
    zipBytes = null;

    const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
    if (!jsonFileName) throw new Error("ZIP sem JSON");

    // 2. Parse Direto (V8 é otimizado para isso)
    const jsonStr = new TextDecoder().decode(unzipped[jsonFileName]);
    // @ts-ignore: Liberar referência
    unzipped = null;

    let allItems = JSON.parse(jsonStr);
    // @ts-ignore: Liberar string gigante
    jsonStr = null;

    const totalRows = allItems.length;
    await supabase.from("import_jobs").update({ total_rows: totalRows }).eq("id", jobId);
    console.log(`[IMPORT] ${source.key}: ${totalRows} itens carregados.`);

    // 3. Batching com Splice (Tira da memória conforme envia)
    const BATCH_SIZE = 100;
    let processed = 0;

    while (allItems.length > 0) {
      const batch = allItems.splice(0, BATCH_SIZE);
      const { error } = await supabase.rpc("process_dol_raw_batch", {
        p_raw_items: batch,
        p_visa_type: source.visaType,
      });

      if (!error) {
        processed += batch.length;
        if (processed % 500 === 0 || allItems.length === 0) {
          await supabase.from("import_jobs").update({ processed_rows: processed }).eq("id", jobId);
        }
      } else {
        console.error(`[BATCH ERROR]`, error.message);
      }
    }

    // 4. Finalização
    await supabase.from("import_jobs").update({ status: "completed", processed_rows: processed }).eq("id", jobId);
    console.log(`[IMPORT] ${source.key} concluído com sucesso.`);
  } catch (err) {
    console.error(`[FATAL ERROR] ${source.key}:`, err.message);
    await supabase.from("import_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
  }
}

// ─── SERVIDOR ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { source: sourceKey } = await req.json().catch(() => ({}));

    // BLINDAGEM: Não permitimos mais o "all" via HTTP para não explodir a RAM.
    // O Cron deve chamar uma por uma.
    const source = DOL_SOURCES.find((s) => s.key === (sourceKey || "jo"));

    if (!source) return new Response("Source Inválida", { status: 400 });

    const { data: job } = await supabase
      .from("import_jobs")
      .insert({ source: source.key, status: "processing" })
      .select("id")
      .single();

    // Dispara e responde na hora (WaitUntil garante a execução no fundo)
    EdgeRuntime.waitUntil(processSource(source, supabase, job.id));

    return new Response(JSON.stringify({ success: true, job_id: job.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
});
