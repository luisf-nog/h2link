import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MIGRATIONS = [
  {
    name: "set_sent_at_on_sent trigger",
    sqls: [
      `CREATE OR REPLACE FUNCTION public.set_sent_at_on_sent()
       RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
       BEGIN
         IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
           NEW.sent_at := NOW();
         END IF;
         RETURN NEW;
       END; $$;`,
      `DROP TRIGGER IF EXISTS trg_set_sent_at_on_sent ON public.my_queue;`,
      `CREATE TRIGGER trg_set_sent_at_on_sent
         BEFORE UPDATE ON public.my_queue
         FOR EACH ROW EXECUTE FUNCTION public.set_sent_at_on_sent();`,
    ],
  },
  {
    name: "sponsored_jobs public read RLS",
    sqls: [
      `DO $$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_policies WHERE tablename = 'sponsored_jobs' AND policyname = 'sj_public_read'
         ) THEN
           CREATE POLICY sj_public_read ON public.sponsored_jobs FOR SELECT TO anon, authenticated USING (is_active = true);
         END IF;
       END $$;`,
    ],
  },
  {
    name: "employer_tier free enum",
    sqls: [
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'free' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'employer_tier')) THEN
           ALTER TYPE public.employer_tier ADD VALUE 'free' BEFORE 'essential';
         END IF;
       END $$;`,
    ],
  },
  {
    name: "employer_profiles default tier",
    sqls: [
      `ALTER TABLE public.employer_profiles ALTER COLUMN tier SET DEFAULT 'free'::employer_tier;`,
    ],
  },
  {
    name: "public_jobs dol_pdf_available column",
    sqls: [
      `ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS dol_pdf_available boolean DEFAULT null;`,
    ],
  },
  {
    name: "sponsored_jobs new columns",
    sqls: [
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_jobs' AND column_name = 'req_english') THEN
           ALTER TABLE public.sponsored_jobs
             ADD COLUMN req_english boolean NOT NULL DEFAULT false,
             ADD COLUMN req_experience boolean NOT NULL DEFAULT false,
             ADD COLUMN req_drivers_license boolean NOT NULL DEFAULT false,
             ADD COLUMN consular_only boolean NOT NULL DEFAULT false;
         END IF;
       END $$;`,
    ],
  },
  {
    name: "RPC get_market_dashboard_stats",
    sqls: [
      `CREATE OR REPLACE FUNCTION public.get_market_dashboard_stats()
       RETURNS jsonb
       LANGUAGE plpgsql
       STABLE
       SECURITY DEFINER
       SET search_path TO 'public'
       AS $fn$
       DECLARE result jsonb;
       BEGIN
         SELECT jsonb_build_object(
           'h2a', COUNT(*) FILTER (WHERE visa_type = 'H-2A'),
           'h2b', COUNT(*) FILTER (WHERE visa_type = 'H-2B'),
           'early', COUNT(*) FILTER (WHERE job_id LIKE 'JO-%' OR visa_type LIKE '%Early%'),
           'hot', COUNT(*) FILTER (WHERE posted_date >= CURRENT_DATE - 1),
           'total', COUNT(*),
           'top_categories', (SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
             SELECT category as name, COUNT(*)::int as count FROM public_jobs WHERE is_active=true AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC LIMIT 6
           ) c),
           'top_states', (SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) FROM (
             SELECT state as name, COUNT(*)::int as count FROM public_jobs WHERE is_active=true AND state IS NOT NULL AND state != '' GROUP BY state ORDER BY count DESC LIMIT 6
           ) s),
           'top_paying_states', (SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM (
             SELECT state as name, ROUND(AVG(salary)::numeric, 2) as "avgSalary" FROM public_jobs WHERE is_active=true AND salary > 7 AND salary < 150 GROUP BY state HAVING COUNT(*) >= 5 ORDER BY "avgSalary" DESC LIMIT 5
           ) p)
         ) INTO result FROM public_jobs WHERE is_active = true;
         RETURN result;
       END; $fn$;`,
    ],
  },
  {
    name: "RPC get_engagement_stats",
    sqls: [
      `CREATE OR REPLACE FUNCTION public.get_engagement_stats(p_user_id uuid)
       RETURNS jsonb
       LANGUAGE sql
       STABLE
       SECURITY DEFINER
       SET search_path TO 'public'
       AS $fn$
         SELECT jsonb_build_object(
           'sent_count', COUNT(*)::int,
           'opened_count', COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int,
           'cv_viewed_count', COUNT(*) FILTER (WHERE profile_viewed_at IS NOT NULL)::int
         ) FROM my_queue WHERE user_id = p_user_id AND status = 'sent';
       $fn$;`,
    ],
  },
  {
    name: "Index queue_send_history user+status+sent_at",
    sqls: [
      `CREATE INDEX IF NOT EXISTS idx_queue_send_history_user_status_sent ON public.queue_send_history (user_id, status, sent_at DESC);`,
    ],
  },
  {
    name: "cron process-queue 10 min interval",
    sqls: [
      `SELECT cron.alter_job(
        (SELECT jobid FROM cron.job WHERE jobname = 'process-queue-every-minute'),
        '*/10 * * * *'
      );`,
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const step = Number(body?.step ?? 0);

  // step=0 => list all migrations
  if (step === 0) {
    return new Response(JSON.stringify({
      migrations: MIGRATIONS.map((m, i) => ({ step: i + 1, name: m.name })),
      usage: "POST with {\"step\": N} to run migration N",
    }), { headers });
  }

  if (step < 1 || step > MIGRATIONS.length) {
    return new Response(JSON.stringify({ error: `Invalid step ${step}. Use 1-${MIGRATIONS.length}` }), { headers, status: 400 });
  }

  const migration = MIGRATIONS[step - 1];
  console.log(`[run-migrations] Running step ${step}: ${migration.name}`);

  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const client = new Client(dbUrl);

  try {
    await client.connect();
    for (const sql of migration.sqls) {
      console.log(`[run-migrations] Executing SQL...`);
      await client.queryArray(sql);
    }
    await client.end();

    console.log(`[run-migrations] Step ${step} completed successfully`);
    return new Response(JSON.stringify({ step, name: migration.name, ok: true }), { headers });
  } catch (e: any) {
    try { await client.end(); } catch { /* ignore */ }
    console.error(`[run-migrations] Step ${step} failed:`, e.message);
    return new Response(JSON.stringify({ step, name: migration.name, ok: false, error: e.message }), { headers });
  }
});
