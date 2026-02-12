import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Lidar com CORS (Essencial para o navegador não bloquear)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 2. Validação de Token (Mantenha sua lógica de segurança)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // 3. Receber os dados do Frontend
    const { jobs } = await req.json();

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum job enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Edge Function] Processando ${jobs.length} vagas...`);

    // 4. DISPARO TURBO (Batching)
    // No Backend, podemos processar lotes muito maiores (1000+)
    const BATCH_SIZE = 1000;
    let totalProcessed = 0;

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);

      // Chamamos a RPC inteligente que criamos no SQL Editor
      // Ela cuida do Fingerprint, was_early_access e do conflito de ID
      const { error: rpcError } = await supabase.rpc("process_jobs_bulk", {
        jobs_data: batch,
      });

      if (rpcError) {
        console.error(`Erro no lote ${i}:`, rpcError);
        throw rpcError;
      }
      totalProcessed += batch.length;
    }

    return new Response(JSON.stringify({ success: true, imported: totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[ERRO FATAL]:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
