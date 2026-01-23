import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Map price IDs to plan tiers
const PRICE_TO_PLAN: Record<string, "gold" | "diamond"> = {
  "price_1SsohfKliiuLyRPm2t81CuGj": "gold",
  "price_1SsovLKliiuLyRPmIqN11GXC": "gold",
  "price_1SsojDKliiuLyRPmyXXkAI9o": "diamond",
  "price_1SsovqKliiuLyRPmqNZclNky": "diamond",
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", errorMessage);
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const priceId = session.line_items?.data?.[0]?.price?.id;

    if (!userId || !priceId) {
      console.error("Missing user_id or priceId in session metadata/line_items");
      return new Response("Missing data", { status: 400 });
    }

    const planTier = PRICE_TO_PLAN[priceId];
    if (!planTier) {
      console.error(`Unknown priceId: ${priceId}`);
      return new Response("Unknown price", { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        plan_tier: planTier,
        stripe_customer_id: session.customer as string,
      })
      .eq("id", userId);

    if (error) {
      console.error("Failed to update profile:", error);
      return new Response("Database error", { status: 500 });
    }

    console.log(`User ${userId} upgraded to ${planTier}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});