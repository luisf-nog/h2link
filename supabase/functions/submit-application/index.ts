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
      work_authorization_status, is_us_worker, months_experience,
      english_level, drivers_license_type, h2b_visa_count,
      has_english, has_experience, has_license, is_in_us,
      citizenship_status, experiences, honeypot,
    } = body;

    // Anti-spam: honeypot check
    if (honeypot) {
      console.log("[submit-application] Honeypot triggered");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!job_id || !full_name || !email) {
      throw new Error("Missing required fields: job_id, full_name, email");
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const normalizedEmail = email.toLowerCase().trim();

    // Run IP check and job fetch in parallel
    const [blacklistRes, jobRes] = await Promise.all([
      supabase.from("ip_blacklist").select("id").eq("ip", clientIp).gt("blocked_until", new Date().toISOString()).limit(1),
      supabase.from("sponsored_jobs").select("english_proficiency, prior_experience_required, drivers_license, is_active").eq("id", job_id).single(),
    ]);

    if (blacklistRes.data && blacklistRes.data.length > 0) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    const job = jobRes.data;
    if (jobRes.error || !job) throw new Error("Job not found");
    if (!job.is_active) throw new Error("Job is no longer active");

    // Compute match score
    const reqEnglish = job.english_proficiency !== "none" && job.english_proficiency !== null;
    const reqExperience = job.prior_experience_required ?? false;
    const reqLicense = job.drivers_license !== "not_required" && job.drivers_license !== null;

    const { data: matchResult } = await supabase.rpc("compute_match_score", {
      p_months_experience: months_experience ?? 0,
      p_english_level: english_level ?? "none",
      p_drivers_license_type: drivers_license_type ?? "none",
      p_h2b_visa_count: h2b_visa_count ?? 0,
      p_work_authorization_status: work_authorization_status ?? "outside_us",
      p_is_us_worker: is_us_worker ?? false,
      p_req_english: reqEnglish,
      p_req_experience: reqExperience,
      p_req_drivers_license: reqLicense,
      p_consular_only: false,
    });

    const matchScore = matchResult?.score ?? 0;
    const matchStatus = matchResult?.status ?? "yellow";
    const score_color = matchStatus;

    // Insert application
    const { data: insertedApp, error: insertError } = await supabase
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
        work_authorization_status: work_authorization_status ?? "outside_us",
        is_us_worker: is_us_worker ?? false,
        months_experience: months_experience ?? 0,
        english_level: english_level ?? "none",
        drivers_license_type: drivers_license_type ?? "none",
        h2b_visa_count: h2b_visa_count ?? 0,
        application_match_score: matchScore,
        match_status: matchStatus,
        application_status: "received",
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

    // Insert work experiences
    if (insertedApp && experiences && Array.isArray(experiences) && experiences.length > 0) {
      const expRows = experiences
        .filter((e: { company_name?: string }) => e.company_name?.trim())
        .map((e: { company_name: string; job_title: string; duration_months?: number; tasks_description?: string }) => ({
          application_id: insertedApp.id,
          company_name: e.company_name.trim(),
          job_title: e.job_title?.trim() || "N/A",
          duration_months: e.duration_months ?? 0,
          tasks_description: e.tasks_description?.trim() || null,
        }));

      if (expRows.length > 0) {
        await supabase.from("candidate_experience").insert(expRows);
      }
    }

    console.log(`[submit-application] Application submitted for job ${job_id} by ${normalizedEmail}, score: ${matchScore}%, status: ${matchStatus}`);

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
