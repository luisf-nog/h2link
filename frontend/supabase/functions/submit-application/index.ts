import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const {
      job_id, full_name, email, phone,
      has_english, has_experience, has_license, is_in_us,
      citizenship_status, honeypot,
    } = body;

    // Anti-spam: honeypot check
    if (honeypot) {
      console.log("[submit-application] Honeypot triggered");
      // Return success to not reveal detection
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!job_id || !full_name || !email) {
      throw new Error("Missing required fields: job_id, full_name, email");
    }

    // Rate limit by IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: blocked } = await supabase
      .from("ip_blacklist")
      .select("id")
      .eq("ip", clientIp)
      .gt("blocked_until", new Date().toISOString())
      .limit(1);

    if (blocked && blocked.length > 0) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Get job screening toggles for scoring
    const { data: job, error: jobError } = await supabase
      .from("sponsored_jobs")
      .select("req_english, req_experience, req_drivers_license, consular_only, is_active")
      .eq("id", job_id)
      .single();

    if (jobError || !job) throw new Error("Job not found");
    if (!job.is_active) throw new Error("Job is no longer active");

    // Compute score server-side
    const { data: scoreResult } = await supabase.rpc("compute_application_score", {
      p_has_english: has_english ?? false,
      p_has_experience: has_experience ?? false,
      p_has_license: has_license ?? false,
      p_is_in_us: is_in_us ?? false,
      p_req_english: job.req_english,
      p_req_experience: job.req_experience,
      p_req_drivers_license: job.req_drivers_license,
      p_consular_only: job.consular_only,
    });

    const score_color = scoreResult || "yellow";

    // Insert application
    const { error: insertError } = await supabase
      .from("job_applications")
      .insert({
        job_id,
        full_name: full_name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        has_english: has_english ?? false,
        has_experience: has_experience ?? false,
        has_license: has_license ?? false,
        is_in_us: is_in_us ?? false,
        citizenship_status: citizenship_status || "other",
        score_color,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ error: "You have already applied to this job" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
      throw insertError;
    }

    console.log(`[submit-application] Application submitted for job ${job_id} by ${normalizedEmail}, score: ${score_color}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[submit-application] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
