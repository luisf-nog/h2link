

# Fix: Memory-Safe Import + Robust Error Handling

## Problem Analysis

The Edge Function crashes on the JO source (2081 items) due to **memory limit exceeded** (150MB cap). The memory profile at peak:

```text
ZIP ArrayBuffer:     ~5 MB
JSZip object:        ~10 MB
JSON string:         ~25 MB
Parsed JS array:     ~30 MB
Supabase SDK:        ~10 MB
Deno runtime:        ~30 MB
---------------------------------
Total peak:          ~110-130 MB  (hits 150MB with GC pressure)
```

Additional issues: no timeout on frontend polling, no cleanup of stale jobs, and `processed_rows` stays at 0 because the crash happens before any RPC completes.

## Solution: 5 Targeted Fixes

### 1. Aggressive Memory Management in Edge Function

Free each resource BEFORE allocating the next:

```text
Step 1: fetch ZIP -> arrayBuffer (5MB)
Step 2: JSZip.loadAsync(buffer)
Step 3: NULL the arrayBuffer
Step 4: Extract JSON string from zip
Step 5: NULL the zip object entirely  <-- KEY FIX
Step 6: JSON.parse the string
Step 7: NULL the string
Step 8: Process array in batches using splice (mutates/frees)
```

This reduces peak memory from ~130MB to ~65MB.

### 2. Use Array Mutation (splice) Instead of Copying (slice)

Current code: `list.slice(i, i + BATCH_SIZE)` keeps the full array alive.
Fix: `list.splice(0, BATCH_SIZE)` removes processed items from memory immediately.

### 3. Frontend Timeout on waitForJob

Add a 5-minute max timeout to `waitForJob`. If the job hasn't reached `completed` or `failed` within 5 minutes, treat it as failed and move to the next source. This prevents the sequential chain from hanging forever.

### 4. Stale Job Cleanup on Page Load

When AdminImport mounts, run a query to mark any job stuck in `processing` for over 5 minutes as `failed`. This clears the UI of ghost jobs from previous crashed runs.

### 5. Set total_rows Before Processing and Write Status on Crash

- Write `total_rows` to the `import_jobs` row immediately after parsing the JSON array (before RPC batches start).
- Wrap the entire processing in try/catch that guarantees a status update to `failed` even on unexpected crashes.

## Files to Change

### `supabase/functions/auto-import-jobs/index.ts`
- Restructure `processSourceWithTracking` memory flow: null zip and buffer before JSON.parse, use splice instead of slice
- Reduce BATCH_SIZE from 100 to 50 for additional safety margin
- Set `total_rows` immediately after JSON.parse
- Redeploy the function

### `frontend/src/pages/AdminImport.tsx`
- Add 5-minute timeout to `waitForJob`
- Add `useEffect` on mount to clean up stale "processing" jobs older than 5 minutes
- Show a more informative message when a job times out

## Expected Outcome

- JO (2081 items): peak ~65MB, completes in ~30-60s
- H2A: similar or smaller, completes in ~20-40s  
- H2B (1414 items): already works, ~20s
- Total "Import All": ~2-3 minutes sequential
- No more hung UI or ghost "processing" jobs

