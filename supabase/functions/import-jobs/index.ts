import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Minimal job shape from incoming spreadsheet */
interface ImportedJob {
  job_id: string;
  visa_type?: string;
  company: string;
  email: string;
  job_title: string;
  category?: string | null;
  city: string;
  state: string;
  salary?: number | null;
  start_date?: string | null;
  posted_date?: string | null;
  housing_info?: string | null;
  transport_provided?: boolean;
  tools_provided?: boolean;
  weekly_hours?: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace(/^Bearer\s+/, '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleRow) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { jobs }: { jobs: ImportedJob[] } = await req.json();

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return new Response(JSON.stringify({ error: 'No jobs provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare upsert rows
    const rows = jobs.map((j) => ({
      job_id: j.job_id,
      visa_type: j.visa_type || 'H-2B',
      company: j.company,
      email: j.email,
      job_title: j.job_title,
      category: j.category || null,
      city: j.city,
      state: j.state,
      salary: j.salary ?? null,
      start_date: j.start_date || null,
      posted_date: j.posted_date || new Date().toISOString().slice(0, 10),
      housing_info: j.housing_info || null,
      transport_provided: !!j.transport_provided,
      tools_provided: !!j.tools_provided,
      weekly_hours: j.weekly_hours ?? null,
    }));

    // Upsert by (job_id, visa_type)
    const { error: upsertError, count } = await supabase
      .from('public_jobs')
      .upsert(rows, { onConflict: 'job_id,visa_type', count: 'exact' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, imported: count ?? rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
