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

// ─── PULL-BASED ARCHITECTURE ────────────────────────────────────────────
// Instead of self-chaining (function calling itself via HTTP), we use short
// work windows. A frequent cron tick calls this function; it picks up an
// active job, processes a slice, saves checkpoint, and exits. Next tick
// continues from the checkpoint. NO internal HTTP calls.
const WORK_WINDOW_MS = 50_000; // 50s — conservative, well under Edge limit
const BATCH_SIZE = 10; // items per RPC call (H-2A safe)
const RETRY_CHUNK = 5;
const RPC_TIMEOUT_MS = 20_000; // abort RPC if >20s
const LEASE_TTL_MS = 90_000; // lease expires after 90s (> WORK_WINDOW_MS)

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

/** Append error to meta.errors[] without losing previous errors */
function appendMetaError(currentMeta: any, error: string, stage: string): any {
  const meta = currentMeta || {};
  const errors = Array.isArray(meta.errors) ? meta.errors : [];
  errors.push({
    ts: new Date().toISOString(),
    stage,
    msg: error.substring(0, 500),
  });
  return { ...meta, errors, last_stage: stage, last_exception: error.substring(0, 300) };
}

/** Process a slice of items starting from cursor with AbortController timeout on RPC */
async function processSlice(
  jsonText: string,
  cursor: number,
  source: (typeof DOL_SOURCES)[0],
  supabase: any,
  jobId: string,
  deadline: number,
  currentMeta: any,
): Promise<{ newCursor: number; done: boolean; error?: string; meta: any }> {
  let processed = cursor;
  let consecutiveErrors = 0;
  let itemIndex = 0;
  let meta = currentMeta || {};

  for (const batch of parseJsonArrayChunked(jsonText, BATCH_SIZE)) {
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

    // Check time budget BEFORE processing
    if (Date.now() > deadline) {
      console.log(`[WINDOW] ${source.key}: time budget reached at cursor=${processed}`);
      meta.last_stage = "window_exhausted";
      await supabase.from("import_jobs").update({
        cursor_pos: processed,
        processed_rows: processed,
        last_heartbeat_at: new Date().toISOString(),
        phase: "processing",
        meta,
      }).eq("id", jobId);
      return { newCursor: processed, done: false, meta };
    }

    // Process batch with AbortController timeout
    let rpcError: any = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

      const { error } = await supabase.rpc("process_dol_raw_batch", {
        p_raw_items: effectiveBatch,
        p_visa_type: source.visaType,
      }, { signal: controller.signal });

      clearTimeout(timeout);
      rpcError = error;
    } catch (abortErr: any) {
      // AbortController fired or network error
      rpcError = { message: `RPC timeout/abort: ${abortErr.message}` };
      console.error(`[RPC TIMEOUT] ${source.key} at cursor=${processed}: ${abortErr.message}`);
      meta = appendMetaError(meta, abortErr.message, `rpc_timeout_at_${processed}`);
    }

    if (rpcError) {
      const isTimeout = rpcError.message?.includes("timeout") || rpcError.message?.includes("520") || rpcError.message?.includes("abort");
      console.error(`[BATCH ERR] ${source.key}: ${rpcError.message?.substring(0, 100)}`);

      if (isTimeout && effectiveBatch.length > RETRY_CHUNK) {
        // Retry in sub-batches
        for (let i = 0; i < effectiveBatch.length; i += RETRY_CHUNK) {
          if (Date.now() > deadline) {
            meta.last_stage = "window_exhausted_in_retry";
            await supabase.from("import_jobs").update({
              cursor_pos: processed,
              processed_rows: processed,
              last_heartbeat_at: new Date().toISOString(),
              phase: "processing",
              meta,
            }).eq("id", jobId);
            return { newCursor: processed, done: false, meta };
          }

          const subBatch = effectiveBatch.slice(i, i + RETRY_CHUNK);
          await new Promise(r => setTimeout(r, 300));

          try {
            const subController = new AbortController();
            const subTimeout = setTimeout(() => subController.abort(), RPC_TIMEOUT_MS);

            const { error: retryErr } = await supabase.rpc("process_dol_raw_batch", {
              p_raw_items: subBatch,
              p_visa_type: source.visaType,
            }, { signal: subController.signal });

            clearTimeout(subTimeout);

            if (retryErr) {
              console.error(`[RETRY ERR] ${source.key}: ${retryErr.message?.substring(0, 80)}`);
              consecutiveErrors++;
              meta = appendMetaError(meta, retryErr.message, `retry_err_at_${processed}`);
            } else {
              processed += subBatch.length;
              consecutiveErrors = 0;
            }
          } catch (subAbortErr: any) {
            console.error(`[SUB TIMEOUT] ${source.key}: ${subAbortErr.message}`);
            consecutiveErrors++;
            meta = appendMetaError(meta, subAbortErr.message, `sub_timeout_at_${processed}`);
          }
        }
      } else {
        consecutiveErrors++;
        meta = appendMetaError(meta, rpcError.message, `batch_err_at_${processed}`);
      }

      if (consecutiveErrors >= 20) {
        const msg = `${consecutiveErrors} consecutive batch errors`;
        console.error(`[ABORT] ${source.key}: ${msg}`);
        meta.last_stage = "abort_consecutive_errors";
        return { newCursor: processed, done: true, error: msg, meta };
      }
    } else {
      processed += effectiveBatch.length;
      consecutiveErrors = 0;
    }

    itemIndex += batch.length;

    // Heartbeat every ~50 items
    if (processed % 50 < BATCH_SIZE) {
      meta.last_stage = "processing";
      meta.last_batch_cursor = processed;
      await supabase.from("import_jobs").update({
        cursor_pos: processed,
        processed_rows: processed,
        last_heartbeat_at: new Date().toISOString(),
        meta,
      }).eq("id", jobId);
      console.log(`[PROG] ${source.key}: ${processed} items`);
    }
  }

  // Reached end of data
  meta.last_stage = "completed";
  return { newCursor: processed, done: true, meta };
}

/** 
 * Try to acquire a lease on the job. Returns true if acquired.
 * Uses atomic update with heartbeat check to prevent concurrent workers.
 */
async function tryAcquireLease(supabase: any, jobId: string): Promise<boolean> {
  const leaseExpiry = new Date(Date.now() - LEASE_TTL_MS).toISOString();

  // Only acquire if heartbeat is old enough (lease expired) or matches our attempt
  const { data, error } = await supabase
    .from("import_jobs")
    .update({
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing")
    .lt("last_heartbeat_at", leaseExpiry)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[LEASE ERR] ${error.message}`);
    return false;
  }

  return !!data;
}

// ─── SERVER ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── AUTH ──
    const body = await req.json().catch(() => ({}));
    const cronToken = body?.cron_token || req.headers.get("x-cron-token");

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

      // If it's the service_role key, allow
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

    const sourceKey = body.source || "jo";
    const source = DOL_SOURCES.find((s) => s.key === sourceKey);
    if (!source)
      return new Response(JSON.stringify({ error: "Source inválida" }), { status: 400, headers: corsHeaders });

    // ── PULL-BASED: Check for existing active job ──
    const { data: activeJob } = await supabase
      .from("import_jobs")
      .select("id, cursor_pos, phase, status, attempt_count, meta, last_heartbeat_at")
      .eq("source", source.key)
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let jobId: string;
    let cursor = 0;
    let currentMeta: any = {};
    let isResume = false;

    if (activeJob) {
      // There's an active job — try to acquire lease
      const heartbeatAge = activeJob.last_heartbeat_at
        ? Date.now() - new Date(activeJob.last_heartbeat_at).getTime()
        : Infinity;

      if (heartbeatAge < LEASE_TTL_MS) {
        // Another worker is still active — skip
        console.log(`[SKIP] ${source.key}: job ${activeJob.id} still active (heartbeat ${Math.round(heartbeatAge/1000)}s ago)`);
        return new Response(JSON.stringify({
          success: true,
          message: `Job still running for ${source.key}`,
          job_id: activeJob.id,
          skipped: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Lease expired — we can take over
      jobId = activeJob.id;
      cursor = activeJob.cursor_pos || 0;
      currentMeta = activeJob.meta || {};
      isResume = true;

      const newAttempt = (activeJob.attempt_count || 0) + 1;
      currentMeta.last_stage = "resumed_by_cron";
      currentMeta.resumed_at = new Date().toISOString();

      await supabase.from("import_jobs").update({
        attempt_count: newAttempt,
        last_heartbeat_at: new Date().toISOString(),
        phase: cursor === 0 ? "downloading" : "processing",
        meta: currentMeta,
      }).eq("id", jobId);

      console.log(`[RESUME] ${source.key} job=${jobId} cursor=${cursor} attempt=${newAttempt}`);
    } else {
      // No active job — create new one
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
          meta: { last_stage: "created", created_at: new Date().toISOString() },
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

        // Download the data
        const today = getTodayNY();
        const apiUrl = `${source.url}/${today}`;
        const jsonText = await downloadAndExtract(apiUrl, source.key);

        const totalRows = countItems(jsonText);
        currentMeta.last_stage = "downloaded";
        currentMeta.total_rows = totalRows;

        await supabase.from("import_jobs").update({
          total_rows: totalRows,
          phase: "processing",
          last_heartbeat_at: new Date().toISOString(),
          meta: currentMeta,
        }).eq("id", jobId);
        console.log(`[DATA] ${source.key}: ~${totalRows} items, resuming from cursor=${cursor}`);

        // Process slice within time budget
        const result = await processSlice(jsonText, cursor, source, supabase, jobId, deadline, currentMeta);

        if (result.error) {
          // Fatal error
          await supabase.from("import_jobs").update({
            status: "failed",
            phase: "failed",
            processed_rows: result.newCursor,
            cursor_pos: result.newCursor,
            error_message: result.error,
            last_heartbeat_at: new Date().toISOString(),
            meta: result.meta,
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
            meta: { ...result.meta, last_stage: "completed", completed_at: new Date().toISOString() },
          }).eq("id", jobId);
          console.log(`[DONE] ${source.key}: ${result.newCursor} items processed.`);
        } else {
          // Time budget exhausted — just save and EXIT.
          // Next cron tick will pick this job up and continue.
          console.log(`[PAUSE] ${source.key}: pausing at cursor=${result.newCursor}. Next cron tick will resume.`);
          // Checkpoint already saved in processSlice
        }
      } catch (err: any) {
        console.error(`[FATAL] ${source.key}:`, err.message);
        const errorMeta = appendMetaError(currentMeta, err.message, "fatal");
        await supabase.from("import_jobs").update({
          status: "failed",
          phase: "failed",
          error_message: err.message,
          last_heartbeat_at: new Date().toISOString(),
          meta: errorMeta,
        }).eq("id", jobId);
      }
    })());

    return new Response(
      JSON.stringify({
        success: true,
        message: `Import ${source.key} ${isResume ? "resumed" : "started"} (cursor=${cursor}).`,
        job_id: jobId,
        resumed: isResume,
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
