import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // FIX: Join radar_profiles with profiles in a single query to avoid N+1
    // and ensure only truly active premium users are scanned.
    // The .not("profiles.plan_tier", "is", null) alone is not enough —
    // we use a RPC or a manual filter below after the join.
    const { data: radarProfiles, error: rpError } = await supabase
      .from("radar_profiles")
      .select(
        `
        *,
        profiles!inner (
          plan_tier,
          credits_used_today
        )
      `,
      )
      .eq("is_active", true)
      .in("profiles.plan_tier", ["diamond", "black"]);

    if (rpError) throw rpError;
    if (!radarProfiles || radarProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No active radar profiles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-radar] Found ${radarProfiles.length} active premium profiles`);

    let totalMatches = 0;
    let totalQueued = 0;

    for (const radar of radarProfiles) {
      try {
        // FIX: Profile data comes from the join — no extra per-user query needed
        const profile = (radar as any).profiles;

        if (!profile || !["diamond", "black"].includes(profile.plan_tier)) {
          // Defensive: should not reach here due to .in() filter above,
          // but deactivate the radar_profile to keep data consistent
          console.warn(`[process-radar] Deactivating non-premium radar for ${radar.user_id}`);
          await supabase.from("radar_profiles").update({ is_active: false }).eq("user_id", radar.user_id);
          continue;
        }

        // Get effective daily limit
        const { data: limitData } = await supabase.rpc("get_effective_daily_limit", {
          p_user_id: radar.user_id,
        });
        const dailyLimit = limitData || 5;
        const creditsRemaining = dailyLimit - (profile.credits_used_today || 0);
        const canQueue = creditsRemaining > 0;

        // Build job query based on radar criteria
        let jobQuery = supabase
          .from("public_jobs")
          .select("id")
          .eq("is_banned", false)
          .eq("is_active", true)
          .order("posted_date", { ascending: false })
          .limit(2000);

        if (radar.visa_type && radar.visa_type !== "all") {
          jobQuery = jobQuery.eq("visa_type", radar.visa_type);
        }
        if (radar.state && radar.state !== "all") {
          jobQuery = jobQuery.ilike("state", radar.state);
        }
        if (radar.min_wage) {
          jobQuery = jobQuery.gte("salary", radar.min_wage);
        }
        // FIX: guard against empty array — skip the .in() filter if no categories
        // are selected, otherwise Supabase returns 0 results instead of all results
        if (radar.categories && radar.categories.length > 0) {
          jobQuery = jobQuery.in("category", radar.categories);
        }
        if (radar.max_experience != null) {
          jobQuery = jobQuery.or(`experience_months.is.null,experience_months.lte.${radar.max_experience}`);
        }
        if (radar.randomization_group && radar.randomization_group !== "all") {
          jobQuery = jobQuery.eq("randomization_group", radar.randomization_group);
        }

        const { data: matchingJobs, error: jobsError } = await jobQuery;
        if (jobsError) {
          console.error(`[process-radar] Job query error for ${radar.user_id}:`, jobsError);
          continue;
        }
        if (!matchingJobs || matchingJobs.length === 0) {
          console.log(`[process-radar] No matching jobs for ${radar.user_id}`);
          // Still update last_scan_at so we know the scan ran
          await supabase
            .from("radar_profiles")
            .update({ last_scan_at: new Date().toISOString() })
            .eq("user_id", radar.user_id);
          continue;
        }

        console.log(`[process-radar] ${radar.user_id}: ${matchingJobs.length} matching jobs found`);

        const jobIds = matchingJobs.map((j: any) => j.id);

        // FIX: handle errors from both parallel queries explicitly
        const [alreadyMatchedRes, queuedJobsRes] = await Promise.all([
          supabase.from("radar_matched_jobs").select("job_id").eq("user_id", radar.user_id).in("job_id", jobIds),
          supabase.from("my_queue").select("job_id").eq("user_id", radar.user_id).in("job_id", jobIds),
        ]);

        if (alreadyMatchedRes.error) {
          console.error(
            `[process-radar] Failed to fetch existing matches for ${radar.user_id}:`,
            alreadyMatchedRes.error,
          );
          continue;
        }
        if (queuedJobsRes.error) {
          console.error(`[process-radar] Failed to fetch queued jobs for ${radar.user_id}:`, queuedJobsRes.error);
          continue;
        }

        const matchedSet = new Set((alreadyMatchedRes.data || []).map((m: any) => m.job_id));
        const queuedSet = new Set((queuedJobsRes.data || []).map((q: any) => q.job_id));

        // New matches: jobs not yet in radar_matched_jobs
        const newMatchJobs = jobIds.filter((id: string) => !matchedSet.has(id));

        // Queue candidates: matching jobs not already in my_queue
        const queueCandidates = jobIds.filter((id: string) => !queuedSet.has(id));

        if (newMatchJobs.length > 0) {
          const allMatchRecords = newMatchJobs.map((jobId: string) => ({
            user_id: radar.user_id,
            job_id: jobId,
            auto_queued: canQueue && radar.auto_send,
          }));

          const { error: matchUpsertError } = await supabase.from("radar_matched_jobs").upsert(allMatchRecords, {
            onConflict: "user_id,job_id",
          });

          if (matchUpsertError) {
            console.error(`[process-radar] Match upsert error for ${radar.user_id}:`, matchUpsertError);
            // Non-fatal: continue to queuing step
          } else {
            totalMatches += newMatchJobs.length;
            console.log(`[process-radar] ${radar.user_id}: recorded ${newMatchJobs.length} new matches`);
          }
        } else {
          console.log(`[process-radar] ${radar.user_id}: no new matches (already tracked)`);
        }

        if (queueCandidates.length === 0) {
          console.log(`[process-radar] ${radar.user_id}: all matching jobs already in queue`);
        } else if (canQueue && radar.auto_send) {
          const jobsToQueue = queueCandidates.slice(0, creditsRemaining);
          const queueRecords = jobsToQueue.map((jobId: string) => ({
            user_id: radar.user_id,
            job_id: jobId,
            status: "pending",
          }));

          const { data: queueResult, error: queueError } = await supabase
            .from("my_queue")
            .upsert(queueRecords, {
              onConflict: "user_id,job_id",
              ignoreDuplicates: true,
            })
            .select("id");

          if (queueError) {
            console.error(`[process-radar] Queue insert error for ${radar.user_id}:`, queueError);
          } else {
            const actualQueued = queueResult?.length || 0;
            totalQueued += actualQueued;
            console.log(
              `[process-radar] ${radar.user_id}: queued ${actualQueued} jobs (attempted ${queueRecords.length}, candidates ${queueCandidates.length})`,
            );

            // FIX: only trigger process-queue if we actually queued something
            if (actualQueued > 0) {
              try {
                const processQueueRes = await fetch(`${supabaseUrl}/functions/v1/process-queue`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceRoleKey}`,
                  },
                  body: JSON.stringify({ user_id: radar.user_id }),
                });

                if (!processQueueRes.ok) {
                  const errText = await processQueueRes.text();
                  console.error(
                    `[process-radar] process-queue returned ${processQueueRes.status} for ${radar.user_id}: ${errText}`,
                  );
                }
              } catch (e) {
                console.error(`[process-radar] Failed to trigger process-queue for ${radar.user_id}:`, e);
              }
            }

            // FIX: increment credits_used_today atomically to prevent over-queuing
            // if the radar function runs again before the queue processor updates it
            if (actualQueued > 0) {
              const { error: creditError } = await supabase.rpc("increment_credits_used_today", {
                p_user_id: radar.user_id,
                p_amount: actualQueued,
              });
              if (creditError) {
                // Non-fatal but important to log — credits may drift
                console.error(`[process-radar] Failed to increment credits for ${radar.user_id}:`, creditError);
              }
            }
          }
        } else if (!canQueue) {
          console.log(
            `[process-radar] ${radar.user_id}: no credits remaining (used ${profile.credits_used_today}/${dailyLimit}), ` +
              `${queueCandidates.length} candidates waiting`,
          );
        } else {
          // canQueue is true but auto_send is OFF
          console.log(
            `[process-radar] ${radar.user_id}: auto_send OFF — ${queueCandidates.length} jobs detected but not queued`,
          );
        }

        // Update last_scan_at regardless of outcome
        await supabase
          .from("radar_profiles")
          .update({ last_scan_at: new Date().toISOString() })
          .eq("user_id", radar.user_id);
      } catch (userError) {
        console.error(`[process-radar] Unhandled error processing user ${radar.user_id}:`, userError);
        continue;
      }
    }

    const result = {
      message: "Radar scan complete",
      profiles_scanned: radarProfiles.length,
      total_matches: totalMatches,
      total_queued: totalQueued,
    };
    console.log(`[process-radar] Done:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[process-radar] Fatal error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
