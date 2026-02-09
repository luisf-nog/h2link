import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return new Response('Job ID required', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('public_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return new Response('Job not found', { status: 404, headers: corsHeaders });
    }

    const visaType = job.visa_type || 'H-2B';
    const location = `${job.city}, ${job.state}`;

    let salaryText = '';
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      salaryText = `$${Number(job.wage_from).toFixed(2)} - $${Number(job.wage_to).toFixed(2)}/${job.wage_unit || 'hr'}`;
    } else if (job.wage_from) {
      salaryText = `$${Number(job.wage_from).toFixed(2)}/${job.wage_unit || 'hr'}`;
    } else if (job.salary) {
      salaryText = `$${Number(job.salary).toFixed(2)}/${job.wage_unit || 'hr'}`;
    }

    const openingsText = job.openings ? `${job.openings} opening${job.openings > 1 ? 's' : ''}` : '';
    const title = `${job.job_title} — ${job.company}`;

    const descParts: string[] = [];
    descParts.push(`📍 ${location}`);
    if (salaryText) descParts.push(`💰 ${salaryText}`);
    if (openingsText) descParts.push(`👥 ${openingsText}`);
    descParts.push(`🛂 ${visaType}`);
    if (job.start_date) descParts.push(`📅 Start: ${job.start_date}`);
    const description = descParts.join(' • ');

    const appUrl = Deno.env.get('APP_URL') || 'https://h2linker.com';
    const shareUrl = `${appUrl}/job/${job.id}`;
    const logoUrl = 'https://storage.googleapis.com/gpt-engineer-file-uploads/qLZbvqI1JJV7s7qLCqiN2u0iNM93/uploads/1769111120896-Gemini_Generated_Image_yeubloyeubloyeub.png';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | H2 Linker</title>
    <meta name="description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${shareUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${logoUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="H2 Linker">
    <meta property="og:locale" content="en_US">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${shareUrl}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${logoUrl}">
    <meta http-equiv="refresh" content="0;url=${shareUrl}">
    <script>window.location.href = "${shareUrl}";</script>
</head>
<body>
    <h1>${title}</h1>
    <p>${description}</p>
    <p>Redirecting to job details...</p>
    <a href="${shareUrl}">Click here if not redirected</a>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
