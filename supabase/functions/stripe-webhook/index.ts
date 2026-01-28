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

// Map price IDs to plan tiers (Production)
const PRICE_TO_PLAN: Record<string, "gold" | "diamond" | "black"> = {
  // Gold BRL / USD
  "price_1SueZyKliiuLyRPmL9R7Sdxm": "gold",
  "price_1Suea8KliiuLyRPmQjhJrZdA": "gold",
  // Diamond BRL / USD
  "price_1Suea9KliiuLyRPmrRCXm6TP": "diamond",
  "price_1SueaAKliiuLyRPmo48RI0R9": "diamond",
  // Black BRL / USD
  "price_1SueaCKliiuLyRPmevGCARiq": "black",
  "price_1SueaDKliiuLyRPmjqiMMWAs": "black",
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    // In Deno (Lovable Cloud Functions runtime), webhook signature verification must be async.
    event = await stripe.webhooks.constructEventAsync(
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

    // checkout.session.completed does NOT include line_items by default.
    // We must retrieve the session with expanded line items.
    let priceId: string | undefined;
    try {
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price"],
      });
      priceId = fullSession.line_items?.data?.[0]?.price?.id ?? undefined;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to retrieve checkout session line_items:", msg);
      return new Response("Failed to retrieve session", { status: 500 });
    }

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