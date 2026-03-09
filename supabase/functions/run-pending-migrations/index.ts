import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Execute raw SQL via Supabase Management API (pg-meta)
async function execSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Use the pg-meta REST endpoint that accepts raw SQL
  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({}),
  });

  // Alternative: use the direct postgres connection via edge function
  // Since we can't use raw SQL via PostgREST, we'll use the supabase-js
  // with a workaround: create a temporary function and call it

  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const results: { name: string; ok: boolean; data?: any; error?: string }[] = [];

    // Since we can't execute raw SQL through PostgREST,
    // we'll use the Supabase postgres connection via Deno's postgres driver
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_DB_URL not available. Migrations must be run via dashboard SQL editor or migration tool." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Use Deno postgres
    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const client = new Client(dbUrl);
    await client.connect();

    // Migration 1: set_sent_at_on_sent trigger
    try {
      await client.queryArray(`
        CREATE OR REPLACE FUNCTION public.set_sent_at_on_sent()
        RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
        BEGIN
          IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
            NEW.sent_at := NOW();
          END IF;
          RETURN NEW;
        END; $$;
      `);
      await client.queryArray(`DROP TRIGGER IF EXISTS trg_set_sent_at_on_sent ON public.my_queue;`);
      await client.queryArray(`
        CREATE TRIGGER trg_set_sent_at_on_sent
          BEFORE UPDATE ON public.my_queue
          FOR EACH ROW EXECUTE FUNCTION public.set_sent_at_on_sent();
      `);
      results.push({ name: "set_sent_at_on_sent trigger", ok: true });
    } catch (e: any) {
      results.push({ name: "set_sent_at_on_sent trigger", ok: false, error: e.message });
    }

    // Migration 2: RLS policy for sponsored_jobs public read
    try {
      await client.queryArray(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'sponsored_jobs' AND policyname = 'sj_public_read'
          ) THEN
            CREATE POLICY sj_public_read ON public.sponsored_jobs FOR SELECT TO anon, authenticated USING (is_active = true);
          END IF;
        END $$;
      `);
      results.push({ name: "sponsored_jobs public read RLS", ok: true });
    } catch (e: any) {
      results.push({ name: "sponsored_jobs public read RLS", ok: false, error: e.message });
    }

    // Migration 3: employer_tier 'free' enum value
    try {
      await client.queryArray(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'free' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'employer_tier')) THEN
            ALTER TYPE public.employer_tier ADD VALUE 'free' BEFORE 'essential';
          END IF;
        END $$;
      `);
      results.push({ name: "employer_tier free value", ok: true });
    } catch (e: any) {
      results.push({ name: "employer_tier free value", ok: false, error: e.message });
    }

    // Migration 4: sponsored_jobs new columns
    try {
      await client.queryArray(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_jobs' AND column_name = 'req_english') THEN
            ALTER TABLE public.sponsored_jobs 
              ADD COLUMN req_english boolean NOT NULL DEFAULT false,
              ADD COLUMN req_experience boolean NOT NULL DEFAULT false,
              ADD COLUMN req_drivers_license boolean NOT NULL DEFAULT false,
              ADD COLUMN consular_only boolean NOT NULL DEFAULT false;
          END IF;
        END $$;
      `);
      results.push({ name: "sponsored_jobs new columns", ok: true });
    } catch (e: any) {
      results.push({ name: "sponsored_jobs new columns", ok: false, error: e.message });
    }

    // Migration 5: Default employer tier to 'free'
    try {
      await client.queryArray(`
        ALTER TABLE public.employer_profiles ALTER COLUMN tier SET DEFAULT 'free'::employer_tier;
      `);
      results.push({ name: "employer_profiles default tier free", ok: true });
    } catch (e: any) {
      results.push({ name: "employer_profiles default tier free", ok: false, error: e.message });
    }

    await client.end();

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
