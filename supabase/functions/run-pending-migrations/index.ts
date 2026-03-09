import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const step = body?.step ?? 0;

  // Log environment variables available (names only, not values)
  const envKeys = [...Deno.env.toObject()].map(([k]) => k).sort();
  console.log(`[run-migrations] Available env vars: ${JSON.stringify(envKeys)}`);
  console.log(`[run-migrations] Step requested: ${step}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  
  console.log(`[run-migrations] SUPABASE_URL: ${supabaseUrl ? 'set' : 'NOT SET'}`);
  console.log(`[run-migrations] SERVICE_ROLE_KEY: ${serviceRoleKey ? 'set' : 'NOT SET'}`);
  console.log(`[run-migrations] DB_URL: ${dbUrl ? 'set' : 'NOT SET'}`);

  return new Response(JSON.stringify({
    step,
    env_keys: envKeys,
    has_db_url: !!dbUrl,
    has_supabase_url: !!supabaseUrl,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
