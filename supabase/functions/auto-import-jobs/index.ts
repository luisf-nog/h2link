import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

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

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// ─── ZERO-PARSE JSON CHUNKING ──────────────────────────────────────────────
// Splits a JSON array string into smaller JSON array strings WITHOUT calling JSON.parse
// This avoids the ~2s CPU spike from parsing 25MB of JSON
function splitJsonArrayString(jsonStr: string, chunkSize: number): { chunks: string[]; totalItems: number } {
  const trimmed = jsonStr.trim();
  // Remove outer [ and ]
  const inner = trimmed.slice(1, trimmed.length - 1);

  const chunks: string[] = [];
  let depth = 0;
  let itemCount = 0;
  let chunkStartIdx = 0;
  let lastItemEndIdx = 0;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') {
      // Skip strings (handle escaped quotes)
      i++;
      while (i < inner.length) {
        if (inner[i] === '\\') { i++; } // skip escaped char
        else if (inner[i] === '"') { break; }
        i++;
      }
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        itemCount++;
        lastItemEndIdx = i + 1;
        if (itemCount % chunkSize === 0) {
          chunks.push('[' + inner.slice(chunkStartIdx, lastItemEndIdx) + ']');
          // Find start of next item (skip comma and whitespace)
          let nextStart = lastItemEndIdx;
          while (nextStart < inner.length && (inner[nextStart] === ',' || inner[nextStart] === ' ' || inner[nextStart] === '\n' || inner[nextStart] === '\r')) {
            nextStart++;
          }
          chunkStartIdx = nextStart;
        }
      }
    }
  }

  // Remaining items
  if (chunkStartIdx < inner.length) {
    const remaining = inner.slice(chunkStartIdx, lastItemEndIdx).trim();
    if (remaining) {
      chunks.push('[' + remaining + ']');
    }
  }

  return { chunks, totalItems: itemCount };
}

// ─── LIGHTWEIGHT ZIP EXTRACTION ────────────────────────────────────────────
function extractJsonStringFromZip(zipBytes: Uint8Array): string | null {
  const unzipped = unzipSync(zipBytes);
  const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
  if (!jsonFileName) return null;
  return new TextDecoder().decode(unzipped[jsonFileName]);
}

// ─── SEND RAW JSON CHUNK TO POSTGRESQL (no JSON.parse/stringify overhead) ──
async function sendRawChunkToPostgres(
  chunkJsonStr: string,
  visaType: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<number> {
  // Build the RPC body as a raw string to avoid JSON.parse + JSON.stringify
  const body = `{"p_raw_items":${chunkJsonStr},"p_visa_type":"${visaType}"}`;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/process_dol_raw_batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RPC failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const result = await res.json();
  return typeof result === "number" ? result : 0;
}

// ─── MEMORY + CPU SAFE PROCESSING ──────────────────────────────────────────
async function processSourceWithTracking(source: (typeof DOL_SOURCES)[0], supabase: any, jobId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;

    console.log(`[AUTO-IMPORT] Baixando: ${apiUrl}`);
    const response = await fetch(apiUrl);
    if (!response.ok) {
      await supabase
        .from("import_jobs")
        .update({ status: "failed", error_message: `HTTP ${response.status} em ${apiUrl}` })
        .eq("id", jobId);
      return 0;
    }

    // Step 1: Download ZIP into Uint8Array
    let zipBytes: Uint8Array | null = new Uint8Array(await response.arrayBuffer());
    console.log(`[AUTO-IMPORT] ${source.visaType}: ZIP ${zipBytes.byteLength} bytes`);

    // Step 2: Extract JSON string using fflate (lightweight)
    let jsonStr: string | null = extractJsonStringFromZip(zipBytes);
    zipBytes = null; // FREE ZIP

    if (!jsonStr) {
      await supabase.from("import_jobs").update({ status: "failed", error_message: "No JSON in ZIP" }).eq("id", jobId);
      return 0;
    }

    console.log(`[AUTO-IMPORT] ${source.visaType}: JSON string ${jsonStr.length} chars`);

    // Step 3: Split JSON string into chunks WITHOUT parsing (zero CPU for JSON.parse)
    const CHUNK_SIZE = 200;
    const { chunks, totalItems } = splitJsonArrayString(jsonStr, CHUNK_SIZE);
    jsonStr = null; // FREE the full JSON string

    console.log(`[AUTO-IMPORT] ${source.visaType}: ${totalItems} itens em ${chunks.length} chunks`);

    // Set total_rows immediately
    await supabase.from("import_jobs").update({ total_rows: totalItems }).eq("id", jobId);

    // Step 4: Send each chunk directly to PostgreSQL via raw fetch (no JSON.parse ever!)
    let totalProcessed = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const processed = await sendRawChunkToPostgres(chunks[i], source.visaType, supabaseUrl, serviceRoleKey);
        totalProcessed += processed;
        // Free the chunk string after sending
        chunks[i] = "";
        await supabase.from("import_jobs").update({ processed_rows: totalProcessed }).eq("id", jobId);
        console.log(`[AUTO-IMPORT] ${source.visaType}: chunk ${i + 1}/${chunks.length} → ${totalProcessed} processados`);
      } catch (err: any) {
        console.error(`[CHUNK ERROR] ${source.key} chunk ${i}:`, err.message);
      }
    }

    await supabase
      .from("import_jobs")
      .update({ status: "completed", processed_rows: totalProcessed })
      .eq("id", jobId);
    return totalProcessed;
  } catch (err: any) {
    console.error(`[FATAL ERROR] ${source.key}:`, err.message);
    await supabase
      .from("import_jobs")
      .update({ status: "failed", error_message: err.message?.slice(0, 500) || "Unknown error" })
      .eq("id", jobId);
    return 0;
  }
}

// ─── RADAR LOGIC ────────────────────────────────────────────────────────────
async function runRadarMatching(supabase: any) {
  console.log(`[RADAR] Iniciando cruzamento de perfis ativos...`);
  const { data: activeRadars } = await supabase
    .from("radar_profiles")
    .select("user_id, auto_send")
    .eq("is_active", true);

  for (const radar of activeRadars || []) {
    try {
      const { data: matchCount } = await supabase.rpc("trigger_immediate_radar", { target_user_id: radar.user_id });
      const matched = matchCount ?? 0;

      if (radar.auto_send && matched > 0) {
        const { data: dailyLimit } = await supabase.rpc("get_effective_daily_limit", { p_user_id: radar.user_id });
        const limit = dailyLimit ?? 5;
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const { count: usedToday } = await supabase
          .from("my_queue")
          .select("id", { count: "exact", head: true })
          .eq("user_id", radar.user_id)
          .gte("created_at", todayStart.toISOString());
        const remaining = Math.max(0, limit - (usedToday ?? 0));
        if (remaining > 0) {
          const { data: newMatches } = await supabase
            .from("radar_matched_jobs")
            .select("job_id")
            .eq("user_id", radar.user_id)
            .eq("auto_queued", false)
            .limit(remaining);
          const jobIds = (newMatches || []).map((m: any) => m.job_id);
          if (jobIds.length > 0) {
            const { error: qErr } = await supabase
              .from("my_queue")
              .insert(jobIds.map((id: string) => ({ user_id: radar.user_id, job_id: id, status: "pending" })));
            if (!qErr) {
              await supabase
                .from("radar_matched_jobs")
                .update({ auto_queued: true })
                .eq("user_id", radar.user_id)
                .in("job_id", jobIds);
              fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-queue`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ user_id: radar.user_id }),
              }).catch(() => {});
            }
          }
        }
      }
      await supabase
        .from("radar_profiles")
        .update({ last_scan_at: new Date().toISOString() })
        .eq("user_id", radar.user_id);
    } catch (e) {
      console.error(`[RADAR ERROR] User ${radar.user_id}:`, e);
    }
  }
}

// ─── MAIN SERVE ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let { source: sourceKey = "all", skip_radar = false } = await req.json().catch(() => ({}));

    console.log(`[AUTO-IMPORT] Início - source=${sourceKey} date=${getTodayNY()} skipRadar=${skip_radar}`);

    if (sourceKey !== "all") {
      const source = DOL_SOURCES.find((s) => s.key === sourceKey);
      if (!source) {
        return new Response(JSON.stringify({ error: `Source "${sourceKey}" not found` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: job } = await supabase
        .from("import_jobs")
        .insert({ source: sourceKey, status: "processing" })
        .select("id")
        .single();

      if (!job) {
        return new Response(JSON.stringify({ error: "Failed to create import_job" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      EdgeRuntime.waitUntil(
        (async () => {
          const total = await processSourceWithTracking(source, supabase, job.id);
          if (total > 0 && !skip_radar) {
            await supabase.rpc("deactivate_expired_jobs");
            await runRadarMatching(supabase);
          }
          console.log(`[AUTO-IMPORT] ${sourceKey} finished. Total: ${total} rows.`);
        })(),
      );

      return new Response(JSON.stringify({ success: true, job_id: job.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // "all" mode
    EdgeRuntime.waitUntil(
      (async () => {
        let grandTotal = 0;
        for (const source of DOL_SOURCES) {
          const { data: job } = await supabase
            .from("import_jobs")
            .insert({ source: source.key, status: "processing" })
            .select("id")
            .single();
          if (job) grandTotal += await processSourceWithTracking(source, supabase, job.id);
        }
        if (grandTotal > 0) {
          await supabase.rpc("deactivate_expired_jobs");
          if (!skip_radar) await runRadarMatching(supabase);
        }
        console.log(`[AUTO-IMPORT] Global Sync Finished. Total: ${grandTotal} rows.`);
      })(),
    );

    return new Response(JSON.stringify({ success: true, message: "Importação processando em background." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
