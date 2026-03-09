import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const envObj = Object.fromEntries(
      Object.entries(Deno.env.toObject())
        .map(([k]) => [k, "SET"])
    );
    
    return new Response(JSON.stringify({ ok: true, env: envObj }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { headers, status: 500 });
  }
});
