import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results: { name: string; ok: boolean; error?: string }[] = [];

    // Migration 1: set_sent_at_on_sent trigger
    try {
      const { error } = await supabase.rpc("execute_sql" as any, {
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
        `
      });
      if (error) throw error;
      results.push({ name: "set_sent_at_on_sent trigger", ok: true });
    } catch (e: any) {
      results.push({ name: "set_sent_at_on_sent trigger", ok: false, error: e.message });
    }

    // Migration 2: RLS policy for public read on sponsored_jobs
    try {
      const { error } = await supabase.rpc("execute_sql" as any, {
        sql: `
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = 'sponsored_jobs' AND policyname = 'sj_public_read'
            ) THEN
              CREATE POLICY sj_public_read ON public.sponsored_jobs FOR SELECT TO anon, authenticated USING (is_active = true);
            END IF;
          END $$;
        `
      });
      if (error) throw error;
      results.push({ name: "sponsored_jobs public read RLS", ok: true });
    } catch (e: any) {
      results.push({ name: "sponsored_jobs public read RLS", ok: false, error: e.message });
    }

    // Migration 3: employer_tier 'free' value
    try {
      const { error } = await supabase.rpc("execute_sql" as any, {
        sql: `
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'free' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'employer_tier')) THEN
              ALTER TYPE public.employer_tier ADD VALUE 'free' BEFORE 'essential';
            END IF;
          END $$;
        `
      });
      if (error) throw error;
      results.push({ name: "employer_tier free value", ok: true });
    } catch (e: any) {
      results.push({ name: "employer_tier free value", ok: false, error: e.message });
    }

    // Migration 4: sponsored_jobs new columns
    try {
      const { error } = await supabase.rpc("execute_sql" as any, {
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
        `
      });
      if (error) throw error;
      results.push({ name: "sponsored_jobs new columns", ok: true });
    } catch (e: any) {
      results.push({ name: "sponsored_jobs new columns", ok: false, error: e.message });
    }

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
