import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

// Keep mapping consistent with `stripe-webhook`.
const PRICE_TO_PLAN: Record<string, "gold" | "diamond"> = {
  "price_1SsohfKliiuLyRPm2t81CuGj": "gold",
  "price_1SsovLKliiuLyRPmIqN11GXC": "gold",
  "price_1SsojDKliiuLyRPmyXXkAI9o": "diamond",
  "price_1SsovqKliiuLyRPmqNZclNky": "diamond",
};

type Body = {
  email?: string;
  user_id?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY is not set" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const requester = userData.user;

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleRow) return json({ error: "Forbidden: admin only" }, 403);

    const body = (await req.json().catch(() => ({}))) as Body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";

    if (!email && !userId) return json({ error: "Provide email or user_id" }, 400);

    const profileQuery = supabase.from("profiles").select("id,email,plan_tier,stripe_customer_id");
    const { data: targetProfile, error: profileError } = userId
      ? await profileQuery.eq("id", userId).maybeSingle()
      : await profileQuery.eq("email", email).maybeSingle();

    if (profileError) return json({ error: profileError.message }, 500);
    if (!targetProfile) return json({ error: "Profile not found" }, 404);

    // Ensure we have a Stripe customer ID
    let customerId = targetProfile.stripe_customer_id as string | null;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: targetProfile.email, limit: 1 });
      customerId = customers.data?.[0]?.id ?? null;
      if (!customerId) return json({ error: "No Stripe customer found for this user" }, 404);

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", targetProfile.id);
    }

    // Find latest paid checkout session
    const sessions = (await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 20,
    })) as Stripe.ApiList<Stripe.Checkout.Session>;

    const candidates = (sessions.data ?? [])
      .filter((s: Stripe.Checkout.Session) => s.mode === "payment")
      .filter((s: Stripe.Checkout.Session) => s.payment_status === "paid")
      .filter((s: Stripe.Checkout.Session) => s.status === "complete")
      .sort(
        (a: Stripe.Checkout.Session, b: Stripe.Checkout.Session) =>
          (b.created ?? 0) - (a.created ?? 0)
      );

    const latest = candidates[0];
    if (!latest) return json({ error: "No paid checkout session found for this user" }, 404);

    const fullSession = await stripe.checkout.sessions.retrieve(latest.id, {
      expand: ["line_items.data.price"],
    });
    const priceId = fullSession.line_items?.data?.[0]?.price?.id ?? null;
    if (!priceId) return json({ error: "Could not determine priceId from latest session" }, 500);

    const planTier = PRICE_TO_PLAN[String(priceId)];
    if (!planTier) return json({ error: `Unknown priceId: ${priceId}` }, 400);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ plan_tier: planTier, stripe_customer_id: customerId })
      .eq("id", targetProfile.id);

    if (updateError) return json({ error: updateError.message }, 500);

    return json({
      ok: true,
      user_id: targetProfile.id,
      email: targetProfile.email,
      plan_tier: planTier,
      price_id: priceId,
      checkout_session_id: latest.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reprocess-upgrade]", msg);
    return json({ error: msg }, 500);
  }
});
