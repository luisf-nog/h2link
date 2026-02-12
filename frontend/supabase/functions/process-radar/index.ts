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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get all active radar profiles (only premium users)
    const { data: radarProfiles, error: rpError } = await supabase
      .from("radar_profiles")
      .select("*")
      .eq("is_active", true);

    if (rpError) throw rpError;
    if (!radarProfiles || radarProfiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active radar profiles" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalMatches = 0;
    let totalQueued = 0;

    for (const radar of radarProfiles) {
      // Verify user is still premium
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_tier, credits_used_today")
        .eq("id", radar.user_id)
        .single();

      if (!profile || !["diamond", "black"].includes(profile.plan_tier)) {
        continue;
      }

      // Get effective daily limit
      const { data: limitData } = await supabase.rpc("get_effective_daily_limit", {
        p_user_id: radar.user_id,
      });
      const dailyLimit = limitData || 5;
      const creditsRemaining = dailyLimit - (profile.credits_used_today || 0);

      if (creditsRemaining <= 0) continue;

      // Build job query based on radar criteria
      let jobQuery = supabase
        .from("public_jobs")
        .select("id")
        .eq("is_banned", false)
        .order("posted_date", { ascending: false })
        .limit(50);

      if (radar.visa_type) {
        jobQuery = jobQuery.eq("visa_type", radar.visa_type);
      }
      if (radar.state) {
        jobQuery = jobQuery.ilike("state", radar.state);
      }
      if (radar.min_wage) {
        jobQuery = jobQuery.gte("wage_from", radar.min_wage);
      }
      if (radar.categories && radar.categories.length > 0) {
        jobQuery = jobQuery.in("category", radar.categories);
      }

      const { data: matchingJobs, error: jobsError } = await jobQuery;
      if (jobsError || !matchingJobs) continue;

      // Filter out already matched jobs
      const jobIds = matchingJobs.map((j: any) => j.id);
      if (jobIds.length === 0) continue;

      const { data: alreadyMatched } = await supabase
        .from("radar_matched_jobs")
        .select("job_id")
        .eq("user_id", radar.user_id)
        .in("job_id", jobIds);

      const matchedSet = new Set((alreadyMatched || []).map((m: any) => m.job_id));
      const newJobs = jobIds.filter((id: string) => !matchedSet.has(id));

      if (newJobs.length === 0) continue;

      // Also filter out jobs already in user's queue
      const { data: queuedJobs } = await supabase
        .from("my_queue")
        .select("job_id")
        .eq("user_id", radar.user_id)
        .in("job_id", newJobs);

      const queuedSet = new Set((queuedJobs || []).map((q: any) => q.job_id));
      const jobsToProcess = newJobs.filter((id: string) => !queuedSet.has(id));

      // Limit to remaining credits
      const jobsToQueue = jobsToProcess.slice(0, creditsRemaining);

      totalMatches += jobsToQueue.length;

      // Record matches
      if (jobsToQueue.length > 0) {
        const matchRecords = jobsToQueue.map((jobId: string) => ({
          user_id: radar.user_id,
          job_id: jobId,
          auto_queued: radar.auto_send,
        }));

        await supabase.from("radar_matched_jobs").upsert(matchRecords, {
          onConflict: "user_id,job_id",
        });

        // Add to queue
        const queueRecords = jobsToQueue.map((jobId: string) => ({
          user_id: radar.user_id,
          job_id: jobId,
          status: "pending",
        }));

        const { error: queueError } = await supabase
          .from("my_queue")
          .insert(queueRecords);

        if (!queueError) {
          totalQueued += queueRecords.length;
        }

        // If auto_send is on, trigger the process-queue function
        if (radar.auto_send && !queueError) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/process-queue`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ user_id: radar.user_id }),
            });
          } catch (e) {
            console.error("Failed to trigger process-queue for", radar.user_id, e);
          }
        }
      }

      // Update last_scan_at
      await supabase
        .from("radar_profiles")
        .update({ last_scan_at: new Date().toISOString() })
        .eq("user_id", radar.user_id);
    }

    return new Response(
      JSON.stringify({
        message: "Radar scan complete",
        profiles_scanned: radarProfiles.length,
        total_matches: totalMatches,
        total_queued: totalQueued,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Radar error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
