import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPLOYER_PRICES: Record<string, Record<string, string>> = {
  essential: {
    month: "price_1T6r3dKliiuLyRPmG9jZz17K",
    year: "price_1T6r3dKliiuLyRPmjWL9NsSu",
  },
  professional: {
    month: "price_1T6r4CKliiuLyRPmCsUC8SHa",
    year: "price_1T6r4CKliiuLyRPmR44u7HqC",
  },
  enterprise: {
    month: "price_1T6r4sKliiuLyRPmIy0y7drp",
    year: "price_1T6r4sKliiuLyRPmSp5PmrAq",
  },
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

    const user = userData.user;
    const { tier, billing_interval } = await req.json();

    if (!tier || !billing_interval) throw new Error("Missing tier or billing_interval");
    if (!EMPLOYER_PRICES[tier]) throw new Error(`Invalid tier: ${tier}`);
    if (!["month", "year"].includes(billing_interval)) throw new Error("Invalid billing_interval");

    const priceId = EMPLOYER_PRICES[tier][billing_interval];
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Check existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const origin = req.headers.get("origin") || "https://h2linker.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/employer/dashboard?checkout=success`,
      cancel_url: `${origin}/employer/plans?checkout=cancelled`,
      metadata: { user_id: user.id, employer_tier: tier },
    });

    console.log(`[create-employer-checkout] Session created for user ${user.id}, tier: ${tier}, interval: ${billing_interval}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[create-employer-checkout] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
