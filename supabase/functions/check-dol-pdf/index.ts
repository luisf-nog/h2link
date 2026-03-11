import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, etaNumber } = await req.json();

    if (!jobId || !etaNumber) {
      return new Response(JSON.stringify({ available: false, error: "Missing jobId or etaNumber" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const url = `https://seasonaljobs.dol.gov/api/job-order/${etaNumber}`;
    console.log(`[check-dol-pdf] GET ${url}`);

    // Use GET instead of HEAD — the DOL site doesn't respond properly to HEAD requests
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; H2Link/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    console.log(`[check-dol-pdf] Status: ${res.status}, Content-Length: ${res.headers.get("content-length")}`);

    // Consume body to check content (required by Deno to avoid resource leaks)
    const body = await res.text();
    
    // The page is available if we get 200 AND the body contains meaningful job content
    // (not just an error page or empty shell)
    const isAvailable = res.status === 200 && body.length > 500 && !body.includes("Job order not found");
    console.log(`[check-dol-pdf] Available: ${isAvailable}, Body length: ${body.length}`);

    if (isAvailable) {
      // Cache positive result in DB
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      await supabase
        .from("public_jobs")
        .update({ dol_pdf_available: true })
        .eq("id", jobId);

      return new Response(JSON.stringify({ available: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ available: false }), { headers: corsHeaders });
  } catch (e: any) {
    console.error("[check-dol-pdf] Error:", e.message);
    return new Response(JSON.stringify({ available: false, error: e.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
