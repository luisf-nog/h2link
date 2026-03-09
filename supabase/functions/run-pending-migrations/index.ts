import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function runSQL(sql: string, name: string): Promise<{ name: string; ok: boolean; error?: string }> {
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");

    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pool = new Pool(dbUrl, 1);
    const conn = await pool.connect();
    try {
      await conn.queryArray(sql);
      return { name, ok: true };
    } finally {
      conn.release();
      await pool.end();
    }
  } catch (e: any) {
    return { name, ok: false, error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse which migration to run (one at a time to avoid timeouts)
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const step = body?.step ?? 1;

  const migrations: { name: string; sql: string }[] = [
    {
      name: "set_sent_at_on_sent trigger",
      sql: `
        CREATE OR REPLACE FUNCTION public.set_sent_at_on_sent()
        RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
        BEGIN
          IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
            NEW.sent_at := NOW();
          END IF;
          RETURN NEW;
        END; $$;
        DROP TRIGGER IF EXISTS trg_set_sent_at_on_sent ON public.my_queue;
        CREATE TRIGGER trg_set_sent_at_on_sent
          BEFORE UPDATE ON public.my_queue
          FOR EACH ROW EXECUTE FUNCTION public.set_sent_at_on_sent();
      `,
    },
    {
      name: "sponsored_jobs public read RLS",
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'sponsored_jobs' AND policyname = 'sj_public_read'
          ) THEN
            CREATE POLICY sj_public_read ON public.sponsored_jobs FOR SELECT TO anon, authenticated USING (is_active = true);
          END IF;
        END $$;
      `,
    },
    {
      name: "employer_tier free enum",
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'free' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'employer_tier')) THEN
            ALTER TYPE public.employer_tier ADD VALUE 'free' BEFORE 'essential';
          END IF;
        END $$;
      `,
    },
    {
      name: "employer_profiles default tier",
      sql: `ALTER TABLE public.employer_profiles ALTER COLUMN tier SET DEFAULT 'free'::employer_tier;`,
    },
    {
      name: "sponsored_jobs new columns",
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_jobs' AND column_name = 'req_english') THEN
            ALTER TABLE public.sponsored_jobs 
              ADD COLUMN req_english boolean NOT NULL DEFAULT false,
              ADD COLUMN req_experience boolean NOT NULL DEFAULT false,
              ADD COLUMN req_drivers_license boolean NOT NULL DEFAULT false,
              ADD COLUMN consular_only boolean NOT NULL DEFAULT false;
          END IF;
        END $$;
      `,
    },
  ];

  if (step < 1 || step > migrations.length) {
    return new Response(JSON.stringify({ error: `Invalid step. Use 1-${migrations.length}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }

  const m = migrations[step - 1];
  const result = await runSQL(m.sql, m.name);

  return new Response(JSON.stringify({ step, total: migrations.length, result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
