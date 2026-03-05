import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Helper: chunk a large array into smaller arrays of size `n`.
// Used to avoid Supabase URL length limits when using .in() with many IDs.
// ---------------------------------------------------------------------------
function chunkArray<T>(arr: T[], n: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
  return chunks;
}

// ---------------------------------------------------------------------------
// Helper: fetch all job_ids from a table for a user across multiple chunks.
// Needed when jobIds > 500 (Supabase .in() limit).
// ---------------------------------------------------------------------------
async function fetchJobIdsInChunks(
  supabase: any,
  table: string,
  column: string,
  userId: string,
  jobIds: string[],
  extraFilter?: { col: string; val: any },
): Promise<Set<string>> {
  const result = new Set<string>();
  const chunks = chunkArray(jobIds, 400); // stay well under URL limit

  for (const chunk of chunks) {
    let q = supabase.from(table).select(column).eq("user_id", userId).in(column, chunk);

    if (extraFilter) q = q.eq(extraFilter.col, extraFilter.val);

    const { data, error } = await q;
    if (error) throw new Error(`[${table}] chunk query error: ${error.message}`);
    for (const row of data || []) result.add(row[column]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // -----------------------------------------------------------------------
    // FIX: single join query instead of N+1 per-user profile fetches.
    // Only returns radar profiles for active premium users.
    // -----------------------------------------------------------------------
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
        const profile = (radar as any).profiles;

        // Defensive check: should not pass the .in() filter above, but
        // deactivate if it somehow does to keep data consistent.
        if (!profile || !["diamond", "black"].includes(profile.plan_tier)) {
          console.warn(`[process-radar] Non-premium radar found for ${radar.user_id} — deactivating`);
          await supabase.from("radar_profiles").update({ is_active: false }).eq("user_id", radar.user_id);
          continue;
        }

        // -----------------------------------------------------------------------
        // Credit check
        // -----------------------------------------------------------------------
        const { data: limitData } = await supabase.rpc("get_effective_daily_limit", {
          p_user_id: radar.user_id,
        });
        const dailyLimit = limitData || 5;
        const creditsRemaining = dailyLimit - (profile.credits_used_today || 0);
        const canQueue = creditsRemaining > 0;

        // -----------------------------------------------------------------------
        // Build job query
        // -----------------------------------------------------------------------
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
        // FIX: skip .in() when categories is empty — an empty array would
        // return 0 results instead of returning all jobs.
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
          await supabase
            .from("radar_profiles")
            .update({ last_scan_at: new Date().toISOString() })
            .eq("user_id", radar.user_id);
          continue;
        }

        const jobIds = matchingJobs.map((j: any) => j.id);
        console.log(`[process-radar] ${radar.user_id}: ${jobIds.length} matching jobs`);

        // -----------------------------------------------------------------------
        // FIX: chunk .in() queries to avoid URL length limits (2000 IDs is safe
        // for inserts but risky for SELECT .in() — chunk at 400).
        // Also fetch dismissed matches separately so they are excluded from
        // newMatchJobs (no point re-recording a dismissed job).
        // -----------------------------------------------------------------------
        let matchedSet: Set<string>;
        let dismissedSet: Set<string>;
        let queuedSet: Set<string>;

        try {
          // All previously matched jobs (regardless of dismissed status)
          matchedSet = await fetchJobIdsInChunks(supabase, "radar_matched_jobs", "job_id", radar.user_id, jobIds);

          // FIX: dismissed jobs — must not re-appear as new matches.
          // Requires column: radar_matched_jobs.dismissed boolean DEFAULT false
          dismissedSet = await fetchJobIdsInChunks(supabase, "radar_matched_jobs", "job_id", radar.user_id, jobIds, {
            col: "dismissed",
            val: true,
          });

          // Already queued jobs
          queuedSet = await fetchJobIdsInChunks(supabase, "my_queue", "job_id", radar.user_id, jobIds);
        } catch (chunkErr) {
          console.error(`[process-radar] Chunk query error for ${radar.user_id}:`, chunkErr);
          continue;
        }

        // -----------------------------------------------------------------------
        // New matches: not yet matched AND not dismissed
        // FIX: previously, dismissed jobs were hard-deleted from radar_matched_jobs
        // so they were not in matchedSet and would be re-inserted every scan.
        // Now dismissed jobs remain in the table with dismissed=true, so they
        // appear in matchedSet → excluded from newMatchJobs → never re-surface.
        // -----------------------------------------------------------------------
        const newMatchJobs = jobIds.filter((id: string) => !matchedSet.has(id) && !dismissedSet.has(id));

        // Queue candidates: matching, not dismissed, not already queued
        const queueCandidates = jobIds.filter((id: string) => !queuedSet.has(id) && !dismissedSet.has(id));

        // -----------------------------------------------------------------------
        // Insert new match records
        // -----------------------------------------------------------------------
        if (newMatchJobs.length > 0) {
          const matchRecords = newMatchJobs.map((jobId: string) => ({
            user_id: radar.user_id,
            job_id: jobId,
            auto_queued: canQueue && radar.auto_send,
            dismissed: false,
          }));

          const { error: matchUpsertError } = await supabase
            .from("radar_matched_jobs")
            .upsert(matchRecords, { onConflict: "user_id,job_id" });

          if (matchUpsertError) {
            console.error(`[process-radar] Match upsert error for ${radar.user_id}:`, matchUpsertError);
            // Non-fatal: continue to queuing
          } else {
            totalMatches += newMatchJobs.length;
            console.log(`[process-radar] ${radar.user_id}: ${newMatchJobs.length} new matches recorded`);
          }
        } else {
          console.log(`[process-radar] ${radar.user_id}: no new matches`);
        }

        // -----------------------------------------------------------------------
        // FIX: update auto_queued=true for jobs that were previously matched
        // without being queued (e.g. auto_send was OFF) and are now being queued.
        // Without this, their auto_queued stays false even after queuing.
        // -----------------------------------------------------------------------
        if (canQueue && radar.auto_send && queueCandidates.length > 0) {
          const jobsToQueue = queueCandidates.slice(0, creditsRemaining);

          // Bulk update auto_queued for previously-matched jobs that are now
          // being queued (they already exist in radar_matched_jobs)
          const alreadyMatchedToUpdate = jobsToQueue.filter((id: string) => matchedSet.has(id));
          if (alreadyMatchedToUpdate.length > 0) {
            const updateChunks = chunkArray(alreadyMatchedToUpdate, 400);
            for (const chunk of updateChunks) {
              await supabase
                .from("radar_matched_jobs")
                .update({ auto_queued: true })
                .eq("user_id", radar.user_id)
                .in("job_id", chunk);
            }
          }

          // Insert into my_queue
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
              `[process-radar] ${radar.user_id}: queued ${actualQueued} jobs ` +
                `(attempted ${queueRecords.length}, candidates ${queueCandidates.length})`,
            );

            // FIX: only trigger process-queue if something was actually queued
            if (actualQueued > 0) {
              try {
                const res = await fetch(`${supabaseUrl}/functions/v1/process-queue`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceRoleKey}`,
                  },
                  body: JSON.stringify({ user_id: radar.user_id }),
                });
                if (!res.ok) {
                  const body = await res.text();
                  console.error(`[process-radar] process-queue ${res.status} for ${radar.user_id}: ${body}`);
                }
              } catch (e) {
                console.error(`[process-radar] Failed to trigger process-queue for ${radar.user_id}:`, e);
              }

              // FIX: increment credits atomically after queuing to prevent
              // over-queuing if this function runs again before process-queue
              // updates credits_used_today on its own.
              // ⚠ Requires RPC: increment_credits_used_today(p_user_id, p_amount)
              //   CREATE OR REPLACE FUNCTION increment_credits_used_today(p_user_id uuid, p_amount int)
              //   RETURNS void LANGUAGE sql AS $$
              //     UPDATE profiles
              //     SET credits_used_today = credits_used_today + p_amount
              //     WHERE id = p_user_id;
              //   $$;
              const { error: creditError } = await supabase.rpc("increment_credits_used_today", {
                p_user_id: radar.user_id,
                p_amount: actualQueued,
              });
              if (creditError) {
                // Non-fatal but log clearly — credits may drift over time
                console.error(`[process-radar] Credit increment failed for ${radar.user_id}:`, creditError);
              }
            }
          }
        } else if (!canQueue) {
          console.log(
            `[process-radar] ${radar.user_id}: no credits ` +
              `(used ${profile.credits_used_today}/${dailyLimit}), ` +
              `${queueCandidates.length} candidates waiting`,
          );
        } else {
          // canQueue=true but auto_send=false
          console.log(
            `[process-radar] ${radar.user_id}: auto_send OFF — ` + `${queueCandidates.length} matches waiting in feed`,
          );
        }

        // Always update last_scan_at
        await supabase
          .from("radar_profiles")
          .update({ last_scan_at: new Date().toISOString() })
          .eq("user_id", radar.user_id);
      } catch (userError) {
        console.error(`[process-radar] Unhandled error for ${radar.user_id}:`, userError);
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
