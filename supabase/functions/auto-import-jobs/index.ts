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

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/**
 * Parses a large JSON array string in chunks to avoid OOM.
 * Yields arrays of `chunkSize` items at a time.
 */
function* parseJsonArrayChunked(jsonText: string, chunkSize: number): Generator<any[]> {
  // Find the opening bracket
  let i = jsonText.indexOf('[');
  if (i === -1) return;
  i++; // skip '['

  let depth = 0;
  let objStart = -1;
  let batch: any[] = [];

  for (; i < jsonText.length; i++) {
    const ch = jsonText[i];

    if (ch === '"') {
      // Skip string content
      i++;
      while (i < jsonText.length) {
        if (jsonText[i] === '\\') { i++; } // skip escaped char
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
      break; // end of array
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

async function processSourceStreamed(source: (typeof DOL_SOURCES)[0], supabase: any, jobId: string) {
  try {
    const today = getTodayNY();
    const apiUrl = `${source.url}/${today}`;

    console.log(`[STREAM] Iniciando download: ${source.key}`);
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`DOL Offline: ${response.status}`);

    // Download ZIP as ArrayBuffer
    const zipBuffer = await response.arrayBuffer();
    console.log(`[STREAM] ${source.key}: ZIP baixado (${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);

    // Use fflate for unzipping - import dynamically to control memory
    const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
    const unzipped = unzipSync(new Uint8Array(zipBuffer));

    const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
    if (!jsonFileName) throw new Error("JSON não encontrado no ZIP");

    // Decode to string - this is the big allocation
    const jsonText = new TextDecoder().decode(unzipped[jsonFileName]);
    
    // Free ZIP memory immediately
    for (const key of Object.keys(unzipped)) {
      delete (unzipped as any)[key];
    }

    // Count total items (cheap scan)
    let totalRows = 0;
    for (let j = 0; j < jsonText.length; j++) {
      if (jsonText[j] === '"' && jsonText.substring(j, j + 12) === '"caseNumber"') totalRows++;
      else if (jsonText[j] === '"' && jsonText.substring(j, j + 15) === '"jobOrderNumber"') totalRows++;
    }
    // Rough estimate if neither found
    if (totalRows === 0) {
      totalRows = (jsonText.match(/\{/g) || []).length - 1;
    }

    await supabase.from("import_jobs").update({ total_rows: totalRows, status: "processing" }).eq("id", jobId);
    console.log(`[STREAM] ${source.key}: ~${totalRows} itens estimados.`);

    // Process in chunks of 80 items (smaller to reduce peak memory)
    const CHUNK_SIZE = 80;
    let processed = 0;

    for (const batch of parseJsonArrayChunked(jsonText, CHUNK_SIZE)) {
      const { error } = await supabase.rpc("process_dol_raw_batch", {
        p_raw_items: batch,
        p_visa_type: source.visaType,
      });

      if (error) {
        console.error(`[BATCH ERROR] ${source.key}:`, error.message);
      } else {
        processed += batch.length;
      }

      // Update progress every ~240 items
      if (processed % 240 < CHUNK_SIZE) {
        await supabase.from("import_jobs").update({ processed_rows: processed }).eq("id", jobId);
        console.log(`[STREAM] ${source.key}: ${processed}/${totalRows}`);
      }
    }

    // Finalize
    await supabase.rpc("deactivate_expired_jobs");
    await supabase.from("import_jobs").update({ status: "completed", processed_rows: processed }).eq("id", jobId);
    console.log(`[SUCCESS] ${source.key} finalizado: ${processed} processados.`);
  } catch (err: any) {
    console.error(`[FATAL] ${source.key}:`, err.message);
    await supabase.from("import_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
  }
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── AUTH: Validate cron token or admin JWT ──
    const body = await req.json().catch(() => ({}));
    const cronToken = body?.cron_token || req.headers.get("x-cron-token");

    if (cronToken) {
      // Validate cron token against app_settings
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
      // Validate JWT + admin role
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
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

    const sourceKey = body.source || "jo";

    const source = DOL_SOURCES.find((s) => s.key === sourceKey);
    if (!source)
      return new Response(JSON.stringify({ error: "Source inválida" }), { status: 400, headers: corsHeaders });

    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .insert({ source: source.key, status: "processing", processed_rows: 0 })
      .select("id")
      .single();

    if (jobErr || !job) throw new Error("Falha ao registrar job no banco");

    EdgeRuntime.waitUntil(processSourceStreamed(source, supabase, job.id));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Importação de ${source.key} iniciada em background.`,
        job_id: job.id,
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
