import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOL_SOURCES = [
  {
    key: "jo",
    url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo",
    visaType: "H-2A (Early Access)",
  },
  { key: "h2a", url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2a", visaType: "H-2A" },
  { key: "h2b", url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2b", visaType: "H-2B" },
];

// ─── Work window: process for up to WORK_WINDOW_MS then self-chain ──────────
const WORK_WINDOW_MS = 80_000; // 80s (well under the ~120s Edge Function limit)
const CHUNK_SIZE = 10;
const RETRY_CHUNK = 5;

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/**
 * Parses a large JSON array string in chunks to avoid OOM.
 * Yields arrays of `chunkSize` items at a time.
 */
function* parseJsonArrayChunked(jsonText: string, chunkSize: number): Generator<any[]> {
  let i = jsonText.indexOf('[');
  if (i === -1) return;
  i++;

  let depth = 0;
  let objStart = -1;
  let batch: any[] = [];

  for (; i < jsonText.length; i++) {
    const ch = jsonText[i];

    if (ch === '"') {
      i++;
      while (i < jsonText.length) {
        if (jsonText[i] === '\\') { i++; }
        else if (jsonText[i] === '"') break;
        i++;
      }
      continue;
    }

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const objStr = jsonText.substring(objStart, i + 1);
        try {
          batch.push(JSON.parse(objStr));
        } catch {
          // skip malformed
        }
        objStart = -1;

        if (batch.length >= chunkSize) {
          yield batch;
          batch = [];
        }
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/** Count approximate items in JSON text (cheap scan) */
function countItems(jsonText: string): number {
  let count = 0;
  for (let j = 0; j < jsonText.length; j++) {
    if (jsonText[j] === '"' && jsonText.substring(j, j + 12) === '"caseNumber"') count++;
    else if (jsonText[j] === '"' && jsonText.substring(j, j + 15) === '"jobOrderNumber"') count++;
  }
  if (count === 0) {
    count = (jsonText.match(/\{/g) || []).length - 1;
  }
  return Math.max(count, 0);
}

/** Download and extract JSON text from DOL ZIP */
async function downloadAndExtract(apiUrl: string, sourceKey: string): Promise<string> {
  console.log(`[DL] Downloading: ${sourceKey} from ${apiUrl}`);
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`DOL Offline: ${response.status}`);

  const zipBuffer = await response.arrayBuffer();
  console.log(`[DL] ${sourceKey}: ZIP ${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const unzipped = unzipSync(new Uint8Array(zipBuffer));

  const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
  if (!jsonFileName) throw new Error("JSON not found in ZIP");

  const jsonText = new TextDecoder().decode(unzipped[jsonFileName]);

  // Free ZIP memory
  for (const key of Object.keys(unzipped)) {
    delete (unzipped as any)[key];
  }

  return jsonText;
}

/** Process a slice of items starting from cursor, returns new cursor */
async function processSlice(
  jsonText: string,
  cursor: number,
  source: (typeof DOL_SOURCES)[0],
  supabase: any,
  jobId: string,
  deadline: number,
): Promise<{ newCursor: number; done: boolean; error?: string }> {
  let processed = cursor;
  let consecutiveErrors = 0;
  let itemIndex = 0;

  for (const batch of parseJsonArrayChunked(jsonText, CHUNK_SIZE)) {
    // Skip already-processed items
    if (itemIndex + batch.length <= cursor) {
      itemIndex += batch.length;
      continue;
    }

    // If we partially overlap, trim batch
    let effectiveBatch = batch;
    if (itemIndex < cursor) {
      const skip = cursor - itemIndex;
      effectiveBatch = batch.slice(skip);
      itemIndex = cursor;
    }

    // Check time budget
    if (Date.now() > deadline) {
      console.log(`[WINDOW] ${source.key}: time budget reached at cursor=${processed}`);
      // Save checkpoint
      await supabase.from("import_jobs").update({
        cursor_pos: processed,
        processed_rows: processed,
        last_heartbeat_at: new Date().toISOString(),
        phase: "processing",
      }).eq("id", jobId);
      return { newCursor: processed, done: false };
    }

    // Process batch
    const { error } = await supabase.rpc("process_dol_raw_batch", {
      p_raw_items: effectiveBatch,
      p_visa_type: source.visaType,
    });

    if (error) {
      const isTimeout = error.message?.includes("timeout") || error.message?.includes("520");
      console.error(`[BATCH ERR] ${source.key}: ${error.message?.substring(0, 100)}`);

      if (isTimeout && effectiveBatch.length > RETRY_CHUNK) {
        // Retry in sub-batches
        for (let i = 0; i < effectiveBatch.length; i += RETRY_CHUNK) {
          if (Date.now() > deadline) {
            await supabase.from("import_jobs").update({
              cursor_pos: processed,
              processed_rows: processed,
              last_heartbeat_at: new Date().toISOString(),
              phase: "processing",
            }).eq("id", jobId);
            return { newCursor: processed, done: false };
          }

          const subBatch = effectiveBatch.slice(i, i + RETRY_CHUNK);
          await new Promise(r => setTimeout(r, 200));
          const { error: retryErr } = await supabase.rpc("process_dol_raw_batch", {
            p_raw_items: subBatch,
            p_visa_type: source.visaType,
          });
          if (retryErr) {
            console.error(`[RETRY ERR] ${source.key}: ${retryErr.message?.substring(0, 80)}`);
            consecutiveErrors++;
          } else {
            processed += subBatch.length;
            consecutiveErrors = 0;
          }
        }
      } else {
        consecutiveErrors++;
      }

      if (consecutiveErrors >= 20) {
        const msg = `${consecutiveErrors} consecutive batch errors`;
        console.error(`[ABORT] ${source.key}: ${msg}`);
        return { newCursor: processed, done: true, error: msg };
      }
    } else {
      processed += effectiveBatch.length;
      consecutiveErrors = 0;
    }

    itemIndex += batch.length;

    // Heartbeat every ~50 items
    if (processed % 50 < CHUNK_SIZE) {
      await supabase.from("import_jobs").update({
        cursor_pos: processed,
        processed_rows: processed,
        last_heartbeat_at: new Date().toISOString(),
      }).eq("id", jobId);
      console.log(`[PROG] ${source.key}: ${processed} items`);
    }
  }

  // Reached end of data
  return { newCursor: processed, done: true };
}

/** Self-chain: invoke this function again to continue processing */
async function selfChain(supabase: any, source: string, jobId: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const invokeUrl = `${url}/functions/v1/auto-import-jobs`;
  console.log(`[CHAIN] Scheduling continuation for ${source} job=${jobId}`);

  try {
    await fetch(invokeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ source, job_id: jobId, _chain: true }),
    });
  } catch (err: any) {
    console.error(`[CHAIN ERR] Failed to self-chain: ${err.message}`);
  }
}

// ─── SERVER ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── AUTH ──
    const body = await req.json().catch(() => ({}));
    const isChain = body?._chain === true;
    const cronToken = body?.cron_token || req.headers.get("x-cron-token");

    if (!isChain) {
      if (cronToken) {
        const { data: settings } = await supabase
          .from("app_settings")
          .select("cron_token")
          .eq("id", 1)
          .single();

        if (!settings || settings.cron_token !== cronToken) {
          return new Response(JSON.stringify({ error: "Invalid cron token" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // Validate JWT + admin role OR service_role key
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const token = authHeader.replace("Bearer ", "");

        // If it's the service_role key calling itself, allow
        if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
          const anonClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
          );

          const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
          if (claimsErr || !claims?.claims?.sub) {
            return new Response(JSON.stringify({ error: "Invalid token" }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const userId = claims.claims.sub as string;
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleData) {
            return new Response(JSON.stringify({ error: "Admin role required" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    const sourceKey = body.source || "jo";
    const source = DOL_SOURCES.find((s) => s.key === sourceKey);
    if (!source)
      return new Response(JSON.stringify({ error: "Source inválida" }), { status: 400, headers: corsHeaders });

    // ── Check for existing active job for this source ──
    const existingJobId = body.job_id;
    let jobId: string;
    let cursor = 0;

    if (existingJobId) {
      // Resuming an existing job
      const { data: existingJob } = await supabase
        .from("import_jobs")
        .select("id, cursor_pos, phase, status")
        .eq("id", existingJobId)
        .single();

      if (!existingJob || existingJob.status === "completed" || existingJob.status === "failed") {
        return new Response(JSON.stringify({ error: "Job already finished or not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      jobId = existingJob.id;
      cursor = existingJob.cursor_pos || 0;

      await supabase.from("import_jobs").update({
        attempt_count: (existingJob as any).attempt_count ? (existingJob as any).attempt_count + 1 : 1,
        last_heartbeat_at: new Date().toISOString(),
        phase: cursor === 0 ? "downloading" : "processing",
      }).eq("id", jobId);

      console.log(`[RESUME] ${source.key} job=${jobId} cursor=${cursor}`);
    } else {
      // Prevent duplicate active jobs for same source
      const { data: activeJobs } = await supabase
        .from("import_jobs")
        .select("id")
        .eq("source", source.key)
        .in("status", ["processing"])
        .in("phase", ["queued", "downloading", "processing"]);

      if (activeJobs && activeJobs.length > 0) {
        console.log(`[SKIP] ${source.key}: already has active job ${activeJobs[0].id}`);
        return new Response(JSON.stringify({
          success: true,
          message: `Job already running for ${source.key}`,
          job_id: activeJobs[0].id,
          skipped: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: job, error: jobErr } = await supabase
        .from("import_jobs")
        .insert({
          source: source.key,
          status: "processing",
          phase: "downloading",
          processed_rows: 0,
          cursor_pos: 0,
          attempt_count: 1,
          last_heartbeat_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (jobErr || !job) throw new Error("Failed to create job record");
      jobId = job.id;
      console.log(`[NEW] ${source.key} job=${jobId}`);
    }

    // ── Background processing with waitUntil ──
    EdgeRuntime.waitUntil((async () => {
      try {
        const deadline = Date.now() + WORK_WINDOW_MS;

        // Download (or re-download) the data
        const today = getTodayNY();
        const apiUrl = `${source.url}/${today}`;
        const jsonText = await downloadAndExtract(apiUrl, source.key);

        const totalRows = countItems(jsonText);
        await supabase.from("import_jobs").update({
          total_rows: totalRows,
          phase: "processing",
          last_heartbeat_at: new Date().toISOString(),
        }).eq("id", jobId);
        console.log(`[DATA] ${source.key}: ~${totalRows} items, resuming from cursor=${cursor}`);

        // Process slice within time budget
        const result = await processSlice(jsonText, cursor, source, supabase, jobId, deadline);

        if (result.error) {
          // Fatal error
          await supabase.from("import_jobs").update({
            status: "failed",
            phase: "failed",
            processed_rows: result.newCursor,
            cursor_pos: result.newCursor,
            error_message: result.error,
            last_heartbeat_at: new Date().toISOString(),
          }).eq("id", jobId);
          return;
        }

        if (result.done) {
          // All items processed — finalize
          await supabase.rpc("deactivate_expired_jobs");
          await supabase.from("import_jobs").update({
            status: "completed",
            phase: "completed",
            processed_rows: result.newCursor,
            cursor_pos: result.newCursor,
            last_heartbeat_at: new Date().toISOString(),
          }).eq("id", jobId);
          console.log(`[DONE] ${source.key}: ${result.newCursor} items processed.`);
        } else {
          // Time budget exhausted — chain to next invocation
          console.log(`[CHAIN] ${source.key}: will continue from cursor=${result.newCursor}`);
          await selfChain(supabase, source.key, jobId);
        }
      } catch (err: any) {
        console.error(`[FATAL] ${source.key}:`, err.message);
        await supabase.from("import_jobs").update({
          status: "failed",
          phase: "failed",
          error_message: err.message,
          last_heartbeat_at: new Date().toISOString(),
        }).eq("id", jobId);
      }
    })());

    return new Response(
      JSON.stringify({
        success: true,
        message: `Import ${source.key} started${cursor > 0 ? ` (resuming from ${cursor})` : ""}.`,
        job_id: jobId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("[SERVE ERROR]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
