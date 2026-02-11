import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return json(401, { success: false, error: "Unauthorized" });
    }

    const body: SaveSmtpRequest = await req.json();
    const provider: Provider = body.provider === "outlook" ? "outlook" : "gmail";
    const email = String(body.email ?? "").trim();
    const password = typeof body.password === "string" ? body.password.trim() : "";
    const riskProfile = ["conservative", "standard", "aggressive"].includes(body.risk_profile ?? "")
      ? (body.risk_profile as RiskProfile)
      : null;

    if (!email) return json(400, { success: false, error: "Missing email" });

    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. ANTES DE QUALQUER COISA, VERIFICAR SE O USUÁRIO JÁ TEM HISTÓRICO
    const { data: existingSmtp } = await serviceClient
      .from("smtp_credentials")
      .select("warmup_started_at")
      .eq("user_id", userId)
      .maybeSingle();

    // 2. Build upsert data (Dados básicos)
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      provider,
      email,
      updated_at: new Date().toISOString(),
    };

    // 3. Lógica Blindada do Perfil de Risco
    if (riskProfile) {
      upsertData.risk_profile = riskProfile;
      upsertData.last_usage_date = new Date().toISOString().slice(0, 10);

      // SÓ INICIA O WARMUP E LIMITES SE FOR A PRIMEIRA VEZ!
      // Se existingSmtp?.warmup_started_at já existir, nós ignoramos isso para não resetar.
      if (!existingSmtp?.warmup_started_at) {
        upsertData.warmup_started_at = new Date().toISOString().slice(0, 10);

        // Novos limites Turbo da plataforma
        const startLimits: Record<RiskProfile, number> = {
          conservative: 50,
          standard: 100,
          aggressive: 150,
        };
        upsertData.current_daily_limit = startLimits[riskProfile];
        upsertData.emails_sent_today = 0;
      }
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
