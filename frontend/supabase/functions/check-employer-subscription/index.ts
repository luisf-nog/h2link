import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Stripe price IDs to employer tiers
const PRICE_TO_TIER: Record<string, string> = {
  "price_1T6bxlKliiuLyRPmO9GFlS6r": "essential",
  "price_1T6bxsKliiuLyRPmgvfvRGIP": "essential",
  "price_1T6bxmKliiuLyRPmwJR0R7v3": "professional",
  "price_1T6bxtKliiuLyRPmS25a2n9i": "professional",
  "price_1T6bxnKliiuLyRPmqVuaZkco": "enterprise",
  "price_1T6bxuKliiuLyRPmsb45WH0y": "enterprise",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: userData.user.email, limit: 1 });

    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "active",
      limit: 10,
    });

    // Find employer subscription specifically
    for (const sub of subscriptions.data) {
      const priceId = sub.items.data[0]?.price?.id;
      if (priceId && PRICE_TO_TIER[priceId]) {
        return new Response(JSON.stringify({
          subscribed: true,
          tier: PRICE_TO_TIER[priceId],
          subscription_end: new Date(sub.current_period_end * 1000).toISOString(),
          customer_id: customers.data[0].id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[check-employer-subscription] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
