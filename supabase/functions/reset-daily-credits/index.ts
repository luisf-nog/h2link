import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate cron token from Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify cron token
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("cron_token")
      .limit(1)
      .single();

    if (settingsError || !settings?.cron_token) {
      console.error("Failed to fetch cron_token:", settingsError);
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (token !== settings.cron_token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get today's date in UTC (YYYY-MM-DD)
    const today = new Date().toISOString().slice(0, 10);

    // Reset credits_used_today to 0 for all users whose credits_reset_date is before today
    const { data, error, count } = await supabase
      .from("profiles")
      .update({
        credits_used_today: 0,
        credits_reset_date: today,
      })
      .lt("credits_reset_date", today)
      .select("id");

    if (error) {
      console.error("Error resetting credits:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetCount = data?.length ?? 0;
    console.log(`Reset daily credits for ${resetCount} users on ${today}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resetCount,
        date: today,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
