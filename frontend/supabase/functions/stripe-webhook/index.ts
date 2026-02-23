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
  // TEST (R$1,00) - upgrades to gold for testing
  "price_1Suek1KliiuLyRPmSG0MMBGH": "gold",
  // Gold BRL (original) / USD (original)
  "price_1SueZyKliiuLyRPmL9R7Sdxm": "gold",
  "price_1Suea8KliiuLyRPmQjhJrZdA": "gold",
  // Gold USD (promotional $9.99)
  "price_1Sv6f3KliiuLyRPmXpH9Tuhq": "gold",
  // Diamond BRL (original) / USD (original)
  "price_1Suea9KliiuLyRPmrRCXm6TP": "diamond",
  "price_1SueaAKliiuLyRPmo48RI0R9": "diamond",
  // Diamond USD (promotional $19.99)
  "price_1Sv6f4KliiuLyRPmONdH2NOt": "diamond",
  // Black BRL (original) / USD (original)
  "price_1SueaCKliiuLyRPmevGCARiq": "black",
  "price_1SueaDKliiuLyRPmjqiMMWAs": "black",
  // Black USD (promotional $49.99)
  "price_1Sv6f5KliiuLyRPmoMTWZXyT": "black",
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

  console.log(`[stripe-webhook] Event received: ${event.type}`);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    console.log(`[stripe-webhook] Processing checkout session: ${session.id}, userId: ${userId}, customer: ${session.customer}`);

    // checkout.session.completed does NOT include line_items by default.
    // We must retrieve the session with expanded line items.
    let priceId: string | undefined;
    let customerId: string | undefined;
    
    try {
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price", "customer"],
      });
      priceId = fullSession.line_items?.data?.[0]?.price?.id ?? undefined;
      
      // customer may be null for guest checkouts (customer_creation: "if_required")
      // Try to get customer from the session's customer field first
      if (fullSession.customer) {
        customerId = typeof fullSession.customer === "string"
          ? fullSession.customer
          : (fullSession.customer as Stripe.Customer).id;
      }
      
      console.log(`[stripe-webhook] Retrieved session - priceId: ${priceId}, customerId: ${customerId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to retrieve checkout session line_items:", msg);
      return new Response("Failed to retrieve session", { status: 500 });
    }

    // If still no customer, try to find/create one from payment_intent
    if (!customerId && session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        if (pi.customer) {
          customerId = typeof pi.customer === "string" ? pi.customer : (pi.customer as Stripe.Customer).id;
          console.log(`[stripe-webhook] Got customerId from payment_intent: ${customerId}`);
        }
      } catch (e) {
        console.warn(`[stripe-webhook] Could not retrieve payment_intent customer: ${e}`);
      }
    }

    // If still no customer, try to find by email (guest checkout scenario)
    if (!customerId && session.customer_details?.email) {
      try {
        const customers = await stripe.customers.list({
          email: session.customer_details.email,
          limit: 1,
        });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          console.log(`[stripe-webhook] Found customer by email: ${customerId}`);
        } else {
          // Create a customer for this guest so future purchases are linked
          const newCustomer = await stripe.customers.create({
            email: session.customer_details.email,
            name: session.customer_details.name ?? undefined,
          });
          customerId = newCustomer.id;
          console.log(`[stripe-webhook] Created new customer for guest: ${customerId}`);
        }
      } catch (e) {
        console.warn(`[stripe-webhook] Could not find/create customer by email: ${e}`);
      }
    }

    if (!userId || !priceId) {
      console.error("Missing user_id or priceId in session metadata/line_items", {
        userId,
        priceId,
        metadata: session.metadata,
      });
      return new Response("Missing data", { status: 400 });
    }

    const planTier = PRICE_TO_PLAN[priceId];
    if (!planTier) {
      console.error(`Unknown priceId: ${priceId}`);
      return new Response("Unknown price", { status: 400 });
    }

    const updateData: Record<string, string> = { plan_tier: planTier };
    if (customerId) {
      updateData.stripe_customer_id = customerId;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (error) {
      console.error("Failed to update profile:", error);
      return new Response("Database error", { status: 500 });
    }

    console.log(`[stripe-webhook] User ${userId} upgraded to ${planTier} (customer: ${customerId ?? "none"})`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
