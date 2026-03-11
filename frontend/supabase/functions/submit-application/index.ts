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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[submit-application] Missing env vars:", { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      job_id, full_name, email, phone,
      has_english, has_experience, has_license, is_in_us,
      citizenship_status, work_authorization_status, is_us_worker,
      months_experience, english_level, drivers_license_type, h2b_visa_count,
      h2_visa_expiry, experiences, honeypot,
    } = body;

    // Anti-spam: honeypot check
    if (honeypot) {
      console.log("[submit-application] Honeypot triggered");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!job_id || !full_name || !email) {
      return new Response(JSON.stringify({ error: "Missing required fields: job_id, full_name, email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
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

    const normalizedEmail = email.toLowerCase().trim();

    // Get job screening toggles
    const { data: job, error: jobError } = await supabase
      .from("sponsored_jobs")
      .select("english_proficiency, prior_experience_required, drivers_license, is_active, consular_only, req_english, req_experience, req_drivers_license")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      console.error("[submit-application] Job lookup error:", jobError?.message ?? "not found");
      return new Response(JSON.stringify({ error: "Job not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }
    if (!job.is_active) {
      return new Response(JSON.stringify({ error: "Job is no longer active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 410,
      });
    }

    // Compute match score server-side
    const reqEnglish = job.req_english ?? (job.english_proficiency !== "none" && job.english_proficiency !== null);
    const reqExperience = job.req_experience ?? (job.prior_experience_required ?? false);
    const reqDriversLicense = job.req_drivers_license ?? (job.drivers_license !== "not_required" && job.drivers_license !== null);
    const consularOnly = job.consular_only ?? false;

    let score_color = "yellow";
    let application_match_score: number | null = null;

    const { data: scoreResult, error: scoreError } = await supabase.rpc("compute_match_score", {
      p_months_experience: months_experience ?? 0,
      p_english_level: english_level ?? "none",
      p_drivers_license_type: drivers_license_type ?? "none",
      p_h2b_visa_count: h2b_visa_count ?? 0,
      p_work_authorization_status: work_authorization_status ?? "outside_us",
      p_is_us_worker: is_us_worker ?? false,
      p_req_english: reqEnglish,
      p_req_experience: reqExperience,
      p_req_drivers_license: reqDriversLicense,
      p_consular_only: consularOnly,
    });

    if (scoreResult && !scoreError) {
      score_color = scoreResult.status ?? "yellow";
      application_match_score = scoreResult.score ?? null;
    } else {
      console.warn("[submit-application] Score RPC failed, using fallback:", scoreError?.message);
    }

    // Insert application
    const { data: appData, error: insertError } = await supabase
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
        is_us_worker: is_us_worker ?? false,
        citizenship_status: citizenship_status || "other",
        work_authorization_status: work_authorization_status || "outside_us",
        months_experience: months_experience ?? 0,
        english_level: english_level ?? "none",
        drivers_license_type: drivers_license_type ?? "none",
        h2b_visa_count: h2b_visa_count ?? 0,
        score_color,
        application_match_score,
        match_status: score_color,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ error: "You have already applied to this job" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
      console.error("[submit-application] Insert error:", insertError.message, insertError.code);
      return new Response(JSON.stringify({ error: insertError.message || "Failed to submit application" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Insert work experiences if provided
    if (appData?.id && Array.isArray(experiences) && experiences.length > 0) {
      const validExps = experiences.filter((e: any) => e.company_name?.trim() && e.job_title?.trim());
      if (validExps.length > 0) {
        const { error: expError } = await supabase
          .from("candidate_experience")
          .insert(
            validExps.map((e: any) => ({
              application_id: appData.id,
              company_name: e.company_name.trim(),
              job_title: e.job_title.trim(),
              duration_months: e.duration_months ?? 0,
              tasks_description: e.tasks_description?.trim() || null,
            }))
          );
        if (expError) {
          console.warn("[submit-application] Experience insert warning:", expError.message);
        }
      }
    }

    console.log(`[submit-application] Success: job=${job_id}, email=${normalizedEmail}, score=${score_color}(${application_match_score})`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("[submit-application] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
