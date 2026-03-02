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
// Includes both current and legacy (promotional) price IDs for backward compatibility
// Worker plan price mappings
const PRICE_TO_PLAN: Record<string, "gold" | "diamond" | "black"> = {
  // TEST (R$1,00)
  "price_1Suek1KliiuLyRPmSG0MMBGH": "gold",
  // Gold - current BRL R$64,99
  "price_1T6UOXKliiuLyRPmdKHaaHye": "gold",
  // Gold - current USD $19,99
  "price_1Suea8KliiuLyRPmQjhJrZdA": "gold",
  // Gold - legacy promo BRL R$47,99
  "price_1SueZyKliiuLyRPmL9R7Sdxm": "gold",
  // Gold - legacy promo USD $9,99
  "price_1Sv6f3KliiuLyRPmXpH9Tuhq": "gold",
  // Diamond - current BRL R$114,99
  "price_1T6UOYKliiuLyRPmu9EmXIAH": "diamond",
  // Diamond - current USD $34,99
  "price_1SueaAKliiuLyRPmo48RI0R9": "diamond",
  // Diamond - legacy promo BRL R$69,99
  "price_1Suea9KliiuLyRPmrRCXm6TP": "diamond",
  // Diamond - legacy promo USD $19,99
  "price_1Sv6f4KliiuLyRPmONdH2NOt": "diamond",
  // Black - current BRL R$299,00
  "price_1T6UOZKliiuLyRPmrrp3AQQR": "black",
  // Black - current USD $89,99
  "price_1SueaDKliiuLyRPmjqiMMWAs": "black",
  // Black - legacy promo BRL R$97,99
  "price_1SueaCKliiuLyRPmevGCARiq": "black",
  // Black - legacy promo USD $49,99
  "price_1Sv6f5KliiuLyRPmoMTWZXyT": "black",
};

// Employer subscription price mappings
const PRICE_TO_EMPLOYER_TIER: Record<string, "essential" | "professional" | "enterprise"> = {
  "price_1T6bxlKliiuLyRPmO9GFlS6r": "essential",
  "price_1T6bxsKliiuLyRPmgvfvRGIP": "essential",
  "price_1T6bxmKliiuLyRPmwJR0R7v3": "professional",
  "price_1T6bxtKliiuLyRPmS25a2n9i": "professional",
  "price_1T6bxnKliiuLyRPmqVuaZkco": "enterprise",
  "price_1T6bxuKliiuLyRPmsb45WH0y": "enterprise",
};

function isEmployerPrice(priceId: string): boolean {
  return priceId in PRICE_TO_EMPLOYER_TIER;
}

async function handleEmployerSubscriptionChange(
  customerId: string,
  subscriptionId: string,
  priceId: string | undefined,
  status: string
) {
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || (customer as any).deleted) return;
  const email = (customer as Stripe.Customer).email;
  if (!email) return;

  // Find user by email
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);
  if (!user) {
    console.log(`[stripe-webhook] No user found for email ${email}`);
    return;
  }

  if (status === "active" && priceId && isEmployerPrice(priceId)) {
    const tier = PRICE_TO_EMPLOYER_TIER[priceId];
    // Upsert employer profile
    const { data: existing } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      await supabase
        .from("employer_profiles")
        .update({
          tier,
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        .eq("user_id", user.id);
    }
    console.log(`[stripe-webhook] Employer ${user.id} activated/updated to ${tier}`);
  } else if (["canceled", "unpaid", "past_due", "incomplete_expired"].includes(status)) {
    // Deactivate employer
    const { data: employer } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (employer) {
      await supabase
        .from("employer_profiles")
        .update({ status: "inactive" })
        .eq("user_id", user.id);

      // Deactivate sponsored jobs
      await supabase.rpc("deactivate_employer_jobs", { p_employer_id: employer.id });
      console.log(`[stripe-webhook] Employer ${user.id} deactivated, jobs set to free`);
    }
  }
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
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

  // Handle employer subscription events
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const priceId = subscription.items.data[0]?.price?.id;
    const customerId = typeof subscription.customer === "string" ? subscription.customer : (subscription.customer as Stripe.Customer).id;
    
    if (priceId && isEmployerPrice(priceId)) {
      await handleEmployerSubscriptionChange(
        customerId,
        subscription.id,
        priceId,
        subscription.status
      );
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }
  }

  // Existing worker checkout flow
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    console.log(`[stripe-webhook] Processing checkout session: ${session.id}, userId: ${userId}, customer: ${session.customer}`);

    let priceId: string | undefined;
    let customerId: string | undefined;
    
    try {
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price", "customer"],
      });
      priceId = fullSession.line_items?.data?.[0]?.price?.id ?? undefined;
      
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

    // Check if this is an employer checkout
    if (priceId && isEmployerPrice(priceId) && userId) {
      const tier = PRICE_TO_EMPLOYER_TIER[priceId];
      
      // Get or create employer profile
      const { data: existing } = await supabase
        .from("employer_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existing) {
        await supabase
          .from("employer_profiles")
          .update({
            tier,
            status: "active",
            stripe_customer_id: customerId || null,
            stripe_subscription_id: session.subscription ? String(session.subscription) : null,
          })
          .eq("user_id", userId);
      }

      // Ensure employer role
      await supabase.from("user_roles").upsert(
        { user_id: userId, role: "employer" },
        { onConflict: "user_id,role" }
      );

      console.log(`[stripe-webhook] Employer ${userId} checkout completed, tier: ${tier}`);
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // Worker flow continues...
    if (!customerId && session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        if (pi.customer) {
          customerId = typeof pi.customer === "string" ? pi.customer : (pi.customer as Stripe.Customer).id;
        }
      } catch (e) {
        console.warn(`[stripe-webhook] Could not retrieve payment_intent customer: ${e}`);
      }
    }

    if (!customerId && session.customer_details?.email) {
      try {
        const customers = await stripe.customers.list({ email: session.customer_details.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        } else {
          const newCustomer = await stripe.customers.create({
            email: session.customer_details.email,
            name: session.customer_details.name ?? undefined,
          });
          customerId = newCustomer.id;
        }
      } catch (e) {
        console.warn(`[stripe-webhook] Could not find/create customer by email: ${e}`);
      }
    }

    if (!userId || !priceId) {
      console.error("Missing user_id or priceId", { userId, priceId });
      return new Response("Missing data", { status: 400 });
    }

    const planTier = PRICE_TO_PLAN[priceId];
    if (!planTier) {
      console.error(`Unknown priceId: ${priceId}`);
      return new Response("Unknown price", { status: 400 });
    }

    const updateData: Record<string, string> = { plan_tier: planTier };
    if (customerId) updateData.stripe_customer_id = customerId;

    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);
    if (error) {
      console.error("Failed to update profile:", error);
      return new Response("Database error", { status: 500 });
    }

    console.log(`[stripe-webhook] User ${userId} upgraded to ${planTier}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
