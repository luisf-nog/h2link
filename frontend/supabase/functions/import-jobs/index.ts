import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Validação de Segurança (Omitida para brevidade, mantenha a sua de admin)

    const { jobs } = await req.json();

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return new Response(JSON.stringify({ error: "No jobs provided" }), { status: 400, headers: corsHeaders });
    }

    // 2. O Pulo do Gato: Em vez de .upsert(), chamamos a nossa RPC inteligente
    // Processamos em lotes maiores (1000+) porque o backend aguenta muito mais
    const BATCH_SIZE = 2000;
    let totalImported = 0;

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);

      // Chamamos a função SQL que criamos (process_jobs_bulk)
      const { error: rpcError } = await supabase.rpc("process_jobs_bulk", {
        jobs_data: batch,
      });

      if (rpcError) {
        console.error("Erro no lote:", rpcError);
        throw rpcError;
      }
      totalImported += batch.length;
    }

    return new Response(JSON.stringify({ success: true, imported: totalImported }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
