import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return new Response('Job ID required', { status: 400, headers: corsHeaders });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch job data
    const { data: job, error } = await supabase
      .from('public_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return new Response('Job not found', { status: 404, headers: corsHeaders });
    }

    // Build meta tags
    const visaType = job.visa_type || 'H-2B';
    const title = `${visaType}: ${job.job_title} - ${job.company}`;
    const location = `${job.city}, ${job.state}`;
    const salary = job.salary ? `$${job.salary.toFixed(2)}/hr` : '';
    
    const descriptionParts = ['Job opportunity', visaType, location];
    if (salary) descriptionParts.push(salary);
    const description = descriptionParts.join(' • ');

    const appUrl = Deno.env.get('APP_URL') || 'https://h2linker.lovable.app';
    const shareUrl = `${appUrl}/job/${job.id}`;
    const logoUrl = 'https://storage.googleapis.com/gpt-engineer-file-uploads/qLZbvqI1JJV7s7qLCqiN2u0iNM93/uploads/1769111120896-Gemini_Generated_Image_yeubloyeubloyeub.png';

    // Generate HTML with meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Basic Meta Tags -->
    <title>${title} | H2 Linker</title>
    <meta name="description" content="${description}">
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${shareUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${logoUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="H2 Linker">
    <meta property="og:locale" content="en_US">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${shareUrl}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${logoUrl}">
    
    <!-- Redirect to React app -->
    <meta http-equiv="refresh" content="0;url=${shareUrl}">
    <script>
        window.location.href = "${shareUrl}";
    </script>
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
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
