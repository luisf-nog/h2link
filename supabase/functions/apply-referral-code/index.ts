import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const bodySchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]{6}$/.test(v), { message: "Invalid code" }),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { ok: false, error: "Unauthorized" });

    const token = authHeader.slice("Bearer ".length);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) return json(401, { ok: false, error: "Unauthorized" });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json(400, { ok: false, error: "Invalid request" });
    const code = parsed.data.code;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: child, error: childErr } = await serviceClient
      .from("profiles")
      .select("id,referral_code,referred_by")
      .eq("id", userId)
      .maybeSingle();
    if (childErr) throw childErr;
    if (!child) return json(404, { ok: false, error: "Profile not found" });
    if (child.referred_by) return json(200, { ok: true, alreadyApplied: true });

    if (String(child.referral_code ?? "").toUpperCase() === code) {
      return json(400, { ok: false, error: "Cannot use your own code" });
    }

    const { data: referrer, error: refErr } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (refErr) throw refErr;
    if (!referrer?.id) return json(404, { ok: false, error: "Code not found" });
    if (referrer.id === userId) return json(400, { ok: false, error: "Cannot use your own code" });

    const { error: updErr } = await serviceClient
      .from("profiles")
      .update({ referred_by: referrer.id } as any)
      .eq("id", userId);
    if (updErr) throw updErr;

    // Link row will be created/updated by DB trigger; this is just a safety upsert.
    await serviceClient
      .from("referral_links")
      .upsert({ referrer_id: referrer.id, referred_id: userId } as any, { onConflict: "referrer_id,referred_id" });

    return json(200, { ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return json(500, { ok: false, error: msg });
  }
});
