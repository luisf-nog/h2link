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

// ─── PULL-BASED ARCHITECTURE BLINDADA (V8 NATIVE) ───────────────────────
const WORK_WINDOW_MS = 40_000; // 40s — margem segura para Edge
const BATCH_SIZE = 50; // Processa de 50 em 50 para poupar a rede
const RETRY_CHUNK = 10;
const RPC_TIMEOUT_MS = 20_000; // 20s limite para o banco responder
const LEASE_TTL_MS = 120_000; // 2 minutos de carência no lock
const STORAGE_BUCKET = "imports"; // BUCKET DO SUPABASE PARA CACHE

function getTodayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function appendMetaError(currentMeta: any, error: string, stage: string): any {
  const meta = currentMeta || {};
  const errors = Array.isArray(meta.errors) ? meta.errors : [];
  errors.push({
    ts: new Date().toISOString(),
    stage,
    msg: error?.substring ? error.substring(0, 500) : "Erro desconhecido",
  });
  return { ...meta, errors, last_stage: stage, last_exception: error?.substring ? error.substring(0, 300) : "" };
}

/** * Lê do Storage se existir, senão baixa, descompacta, salva no Storage e retorna o Array nativo.
 * Isso mata o gargalo de CPU e memória nos crons subsequentes.
 */
async function getOrDownloadJsonArray(apiUrl: string, sourceKey: string, supabase: any): Promise<any[]> {
  const today = getTodayNY();
  const fileName = `${sourceKey}_${today}.json`;

  // 1. Tenta pegar do Storage
  const { data: cachedFile, error: cacheErr } = await supabase.storage.from(STORAGE_BUCKET).download(fileName);

  if (!cacheErr && cachedFile) {
    console.log(`[CACHE HIT] ${sourceKey} recuperado do Storage interno.`);
    const jsonText = await cachedFile.text();
    return JSON.parse(jsonText); // Muito mais rápido, processado em C++ pelo V8
  }

  // 2. Se não existir, baixa do DOL
  console.log(`[CACHE MISS] Baixando ${sourceKey} do DOL...`);
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`DOL Offline ou erro: ${response.status}`);

  const zipBuffer = await response.arrayBuffer();
  console.log(`[DL] ${sourceKey}: ZIP baixado (${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);

  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const unzipped = unzipSync(new Uint8Array(zipBuffer));

  const jsonFileName = Object.keys(unzipped).find((f) => f.endsWith(".json"));
  if (!jsonFileName) throw new Error("JSON não encontrado dentro do ZIP");

  const jsonBytes = unzipped[jsonFileName];

  // 3. Salva no Storage para a próxima rodada ANTES de parsear
  console.log(`[STORAGE] Salvando ${sourceKey} no bucket para os próximos ticks...`);
  await supabase.storage.from(STORAGE_BUCKET).upload(fileName, jsonBytes, {
    contentType: "application/json",
    upsert: true,
  });

  // 4. Parseia o JSON
  const jsonText = new TextDecoder().decode(jsonBytes);
  const itemsArray = JSON.parse(jsonText);

  // 5. Limpeza de RAM agressiva (Garbage Collection)
  for (const key of Object.keys(unzipped)) {
    delete (unzipped as any)[key];
  }

  return itemsArray;
}

/**
 * Processa o Array nativo fatiando de 50 em 50 usando slice (super rápido)
 */
async function processSlice(
  allItems: any[],
  cursor: number,
  source: (typeof DOL_SOURCES)[0],
  supabase: any,
  jobId: string,
  deadline: number,
  currentMeta: any,
): Promise<{ newCursor: number; done: boolean; error?: string; meta: any }> {
  let processed = cursor;
  let consecutiveErrors = 0;
  let meta = currentMeta || {};

  while (processed < allItems.length) {
    // Checa o tempo de vida da função Edge
    if (Date.now() > deadline) {
      console.log(`[WINDOW] ${source.key}: Pausando na linha ${processed} por limite de tempo.`);
      meta.last_stage = "window_exhausted";
      await supabase
        .from("import_jobs")
        .update({
          cursor_pos: processed,
          processed_rows: processed,
          last_heartbeat_at: new Date().toISOString(),
          phase: "processing",
          meta,
        })
        .eq("id", jobId);
      return { newCursor: processed, done: false, meta };
    }

    // Pega a fatia atual do Array
    const effectiveBatch = allItems.slice(processed, processed + BATCH_SIZE);

    let rpcError: any = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

      const { error } = await supabase.rpc(
        "process_dol_raw_batch",
        {
          p_raw_items: effectiveBatch,
          p_visa_type: source.visaType,
        },
        { signal: controller.signal },
      );

      clearTimeout(timeout);
      rpcError = error;
    } catch (abortErr: any) {
      rpcError = { message: `RPC timeout/abort: ${abortErr.message}` };
      meta = appendMetaError(meta, abortErr.message, `rpc_timeout_at_${processed}`);
    }

    if (rpcError) {
      const isTimeout =
        rpcError.message?.includes("timeout") ||
        rpcError.message?.includes("520") ||
        rpcError.message?.includes("abort");

      if (isTimeout && effectiveBatch.length > RETRY_CHUNK) {
        // Fallback: divide e conquista
        for (let i = 0; i < effectiveBatch.length; i += RETRY_CHUNK) {
          if (Date.now() > deadline) {
            meta.last_stage = "window_exhausted_in_retry";
            return { newCursor: processed, done: false, meta };
          }

          const subBatch = effectiveBatch.slice(i, i + RETRY_CHUNK);
          await new Promise((r) => setTimeout(r, 300)); // Rate limit respiro

          try {
            const subController = new AbortController();
            const subTimeout = setTimeout(() => subController.abort(), RPC_TIMEOUT_MS);

            const { error: retryErr } = await supabase.rpc(
              "process_dol_raw_batch",
              {
                p_raw_items: subBatch,
                p_visa_type: source.visaType,
              },
              { signal: subController.signal },
            );

            clearTimeout(subTimeout);

            if (retryErr) {
              consecutiveErrors++;
              meta = appendMetaError(meta, retryErr.message, `retry_err_at_${processed}`);
            } else {
              processed += subBatch.length;
              consecutiveErrors = 0;
            }
          } catch (subAbortErr: any) {
            consecutiveErrors++;
            meta = appendMetaError(meta, subAbortErr.message, `sub_timeout_at_${processed}`);
          }
        }
      } else {
        consecutiveErrors++;
        meta = appendMetaError(meta, rpcError.message, `batch_err_at_${processed}`);
      }

      if (consecutiveErrors >= 20) {
        const msg = `${consecutiveErrors} erros consecutivos. Abortando lote.`;
        console.error(`[ABORT] ${source.key}: ${msg}`);
        meta.last_stage = "abort_consecutive_errors";
        return { newCursor: processed, done: true, error: msg, meta };
      }
    } else {
      processed += effectiveBatch.length;
      consecutiveErrors = 0;
    }

    // Heartbeat no banco a cada 200 itens processados
    if (processed % 200 < BATCH_SIZE) {
      meta.last_stage = "processing";
      meta.last_batch_cursor = processed;
      await supabase
        .from("import_jobs")
        .update({
          cursor_pos: processed,
          processed_rows: processed,
          last_heartbeat_at: new Date().toISOString(),
          meta,
        })
        .eq("id", jobId);
      console.log(`[PROG] ${source.key}: ${processed} / ${allItems.length} itens processados`);
    }
  }

  meta.last_stage = "completed";
  return { newCursor: processed, done: true, meta };
}

// ─── SERVER ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const cronToken = body?.cron_token || req.headers.get("x-cron-token");

    // Validação
    if (cronToken) {
      const { data: settings } = await supabase.from("app_settings").select("cron_token").eq("id", 1).single();
      if (!settings || settings.cron_token !== cronToken) {
        return new Response(JSON.stringify({ error: "Invalid cron token" }), { status: 401, headers: corsHeaders });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer "))
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      const token = authHeader.replace("Bearer ", "");
      if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub)
          return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }
    }

    const sourceKey = body.source || "jo";
    const source = DOL_SOURCES.find((s) => s.key === sourceKey);
    if (!source)
      return new Response(JSON.stringify({ error: "Source inválida" }), { status: 400, headers: corsHeaders });

    const { data: activeJob } = await supabase
      .from("import_jobs")
      .select("id, cursor_pos, phase, status, attempt_count, meta, last_heartbeat_at, total_rows")
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
      const heartbeatAge = activeJob.last_heartbeat_at
        ? Date.now() - new Date(activeJob.last_heartbeat_at).getTime()
        : Infinity;

      if (heartbeatAge < LEASE_TTL_MS) {
        console.log(
          `[SKIP] ${source.key}: Processo em andamento. Bloqueado por mais ${Math.round((LEASE_TTL_MS - heartbeatAge) / 1000)}s`,
        );
        return new Response(JSON.stringify({ success: true, message: `Em processamento seguro`, skipped: true }), {
          headers: corsHeaders,
        });
      }

      jobId = activeJob.id;
      cursor = activeJob.cursor_pos || 0;
      currentMeta = activeJob.meta || {};
      isResume = true;

      const newAttempt = (activeJob.attempt_count || 0) + 1;
      currentMeta.last_stage = "resumed_by_cron";
      await supabase
        .from("import_jobs")
        .update({
          attempt_count: newAttempt,
          last_heartbeat_at: new Date().toISOString(),
          phase: cursor === 0 ? "downloading" : "processing",
          meta: currentMeta,
        })
        .eq("id", jobId);
    } else {
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

      if (jobErr || !job) throw new Error("Falha ao criar import_job");
      jobId = job.id;
    }

    // Processamento Assíncrono (O Cron pode fechar a chamada, o código continua rodando)
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          const deadline = Date.now() + WORK_WINDOW_MS;

          // Recupera o Array inteiro do Storage (rápido) ou baixa e salva
          const allItems = await getOrDownloadJsonArray(source.url, source.key, supabase);
          const totalRows = allItems.length;

          // Atualiza banco com totalRows correto
          await supabase.from("import_jobs").update({ total_rows: totalRows }).eq("id", jobId);

          currentMeta.last_stage = "downloaded_or_cached";
          console.log(`[START] ${source.key}: ${totalRows} itens. Iniciando da linha ${cursor}`);

          // Passa o array completo
          const result = await processSlice(allItems, cursor, source, supabase, jobId, deadline, currentMeta);

          if (result.error) {
            await supabase
              .from("import_jobs")
              .update({
                status: "failed",
                phase: "failed",
                error_message: result.error,
                last_heartbeat_at: new Date().toISOString(),
                meta: result.meta,
              })
              .eq("id", jobId);
            return;
          }

          if (result.done) {
            await supabase.rpc("deactivate_expired_jobs");
            await supabase
              .from("import_jobs")
              .update({
                status: "completed",
                phase: "completed",
                processed_rows: result.newCursor,
                cursor_pos: result.newCursor,
                last_heartbeat_at: new Date().toISOString(),
                meta: { ...result.meta, last_stage: "completed", completed_at: new Date().toISOString() },
              })
              .eq("id", jobId);
            console.log(`[DONE] ${source.key} finalizado com sucesso!`);
          }
        } catch (err: any) {
          console.error(`[FATAL] ${source.key}:`, err.message);
          const errorMeta = appendMetaError(currentMeta, err.message, "fatal");
          await supabase
            .from("import_jobs")
            .update({
              status: "failed",
              phase: "failed",
              error_message: err.message,
              last_heartbeat_at: new Date().toISOString(),
              meta: errorMeta,
            })
            .eq("id", jobId);
        }
      })(),
    );

    return new Response(JSON.stringify({ success: true, message: `Iniciado (cursor=${cursor})`, job_id: jobId }), {
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
