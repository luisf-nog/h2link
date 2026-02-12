import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("MOTOR DA FUNÇÃO INICIALIZADO EXTERNAMENTE");

serve(async (req) => {
  // LOG 0: Entrada bruta
  console.log(`Recebendo requisição: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    console.log("[DADOS] Corpo da requisição lido com sucesso.");

    const jobs = body.jobs;
    console.log(`[DADOS] Total de jobs para processar: ${jobs?.length || 0}`);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de jobs vazia" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data, error: rpcError } = await supabase.rpc("process_jobs_bulk", {
      jobs_data: jobs,
    });

    if (rpcError) {
      console.error("[ERRO SQL]", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("[SUCESSO] Lote processado com êxito.");
    return new Response(JSON.stringify({ success: true, imported: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ERRO DE SISTEMA]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
