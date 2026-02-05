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
  openings?: number | null;
  salary?: number | null;
  overtime_salary?: number | null;
  source_url?: string | null;
  phone?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  posted_date?: string | null;
  experience_months?: number | null;
  description?: string | null;
  requirements?: string | null;
  housing_info?: string | null;
  transport_provided?: boolean;
  tools_provided?: boolean;
  weekly_hours?: number | null;
  education_required?: string | null;
  worksite_address?: string | null;
  worksite_zip?: string | null;
  job_duties?: string | null;
  job_min_special_req?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
  fingerprint?: string | null;
  is_active?: boolean;
  crop_activities?: string | null;
  zip?: string | null;
  website?: string | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  pay_frequency?: string | null;
  overtime_available?: boolean;
  overtime_from?: number | null;
  overtime_to?: number | null;
  transport_min_reimburse?: number | null;
  transport_max_reimburse?: number | null;
  transport_desc?: string | null;
  housing_type?: string | null;
  housing_addr?: string | null;
  housing_city?: string | null;
  housing_state?: string | null;
  housing_zip?: string | null;
  housing_capacity?: number | null;
  is_meal_provision?: boolean;
  meal_charge?: number | null;
  training_months?: number | null;
  job_is_lifting?: boolean;
  job_lifting_weight?: string | null;
  job_is_drug_screen?: boolean;
  job_is_background?: boolean;
  job_is_driver?: boolean;
  shift_start?: string | null;
  shift_end?: string | null;
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
      openings: j.openings ?? null,
      salary: j.salary ?? null,
      overtime_salary: j.overtime_salary ?? null,
      source_url: j.source_url ?? null,
      phone: j.phone ?? null,
      start_date: j.start_date || null,
      end_date: j.end_date || null,
      posted_date: j.posted_date || new Date().toISOString().slice(0, 10),
      experience_months: j.experience_months ?? null,
      description: j.description ?? null,
      requirements: j.requirements ?? null,
      housing_info: j.housing_info || null,
      transport_provided: !!j.transport_provided,
      tools_provided: !!j.tools_provided,
      weekly_hours: j.weekly_hours ?? null,
      education_required: j.education_required ?? null,
      worksite_address: j.worksite_address ?? null,
      worksite_zip: j.worksite_zip ?? null,
      job_duties: j.job_duties ?? null,
      job_min_special_req: j.job_min_special_req ?? null,
      wage_additional: j.wage_additional ?? null,
      rec_pay_deductions: j.rec_pay_deductions ?? null,
      fingerprint: j.fingerprint ?? null,
      is_active: j.is_active ?? true,
      crop_activities: j.crop_activities ?? null,
      zip: j.zip ?? null,
      website: j.website ?? null,
      wage_from: j.wage_from ?? null,
      wage_to: j.wage_to ?? null,
      wage_unit: j.wage_unit ?? 'Hour',
      pay_frequency: j.pay_frequency ?? null,
      overtime_available: j.overtime_available ?? false,
      overtime_from: j.overtime_from ?? null,
      overtime_to: j.overtime_to ?? null,
      transport_min_reimburse: j.transport_min_reimburse ?? null,
      transport_max_reimburse: j.transport_max_reimburse ?? null,
      transport_desc: j.transport_desc ?? null,
      housing_type: j.housing_type ?? null,
      housing_addr: j.housing_addr ?? null,
      housing_city: j.housing_city ?? null,
      housing_state: j.housing_state ?? null,
      housing_zip: j.housing_zip ?? null,
      housing_capacity: j.housing_capacity ?? null,
      is_meal_provision: j.is_meal_provision ?? false,
      meal_charge: j.meal_charge ?? null,
      training_months: j.training_months ?? null,
      job_is_lifting: j.job_is_lifting ?? false,
      job_lifting_weight: j.job_lifting_weight ?? null,
      job_is_drug_screen: j.job_is_drug_screen ?? false,
      job_is_background: j.job_is_background ?? false,
      job_is_driver: j.job_is_driver ?? false,
      shift_start: j.shift_start ?? null,
      shift_end: j.shift_end ?? null,
    }));

    // Process in batches to avoid CPU timeout
    const BATCH_SIZE = 100;
    let totalImported = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      const { error: upsertError, count } = await supabase
        .from('public_jobs')
        .upsert(batch, { onConflict: 'job_id,visa_type', count: 'exact' });

      if (upsertError) {
        console.error('Upsert error at batch', i, ':', upsertError);
        return new Response(JSON.stringify({ error: upsertError.message, importedSoFar: totalImported }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      totalImported += count ?? batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, imported: totalImported }),
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
