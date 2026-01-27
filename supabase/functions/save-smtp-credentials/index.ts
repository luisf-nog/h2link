import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Provider = "gmail" | "outlook";
type RiskProfile = "conservative" | "standard" | "aggressive";

type SaveSmtpRequest = {
  provider: Provider;
  email: string;
  password?: string;
  risk_profile?: RiskProfile;
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const body: SaveSmtpRequest = await req.json();
    const provider: Provider = body.provider === "outlook" ? "outlook" : "gmail";
    const email = String(body.email ?? "").trim();
    const password = typeof body.password === "string" ? body.password.trim() : "";
    const riskProfile = ["conservative", "standard", "aggressive"].includes(body.risk_profile ?? "")
      ? body.risk_profile as RiskProfile
      : null;

    if (!email) return json(400, { success: false, error: "Missing email" });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build upsert data
    const upsertData: Record<string, unknown> = { user_id: userId, provider, email };
    
    // If risk_profile is provided, set it along with warmup initialization
    if (riskProfile) {
      upsertData.risk_profile = riskProfile;
      upsertData.warmup_started_at = new Date().toISOString().slice(0, 10);
      
      // Set initial daily limit based on profile
      const startLimits: Record<RiskProfile, number> = {
        conservative: 20,
        standard: 50,
        aggressive: 100,
      };
      upsertData.current_daily_limit = startLimits[riskProfile];
      upsertData.emails_sent_today = 0;
      upsertData.last_usage_date = new Date().toISOString().slice(0, 10);
    }

    const { error: credsError } = await serviceClient
      .from("smtp_credentials")
      .upsert(upsertData, { onConflict: "user_id" });
    if (credsError) throw credsError;

    if (password.length > 0) {
      const { error: secretError } = await serviceClient
        .from("smtp_credentials_secrets")
        .upsert({ user_id: userId, password }, { onConflict: "user_id" });
      if (secretError) throw secretError;
    }

    return json(200, { success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to save SMTP";
    return json(500, { success: false, error: errorMessage });
  }
};

serve(handler);
