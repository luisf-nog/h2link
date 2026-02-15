import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();

    // --- LIMPEZA E NORMALIZAÇÃO ---
    const provider = String(body.provider ?? "gmail").toLowerCase();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    // Remove todos os espaços e força minúsculas (Padrão Gmail)
    const rawPassword = typeof body.password === "string" ? body.password : "";
    const password = rawPassword.replace(/\s/g, "").toLowerCase();

    // Validação de segurança para evitar o Pattern Mismatch no Banco
    if (password.length > 0 && !/^[a-z]{16}$/.test(password)) {
      return new Response(JSON.stringify({ success: false, error: "A senha deve ter 16 letras minúsculas." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: existing } = await supabase
      .from("smtp_credentials")
      .select("warmup_started_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const upsertData: any = {
      user_id: user.id,
      provider,
      email,
      updated_at: new Date().toISOString(),
    };

    if (body.risk_profile) {
      upsertData.risk_profile = body.risk_profile;
      if (!existing?.warmup_started_at) {
        upsertData.warmup_started_at = new Date().toISOString().slice(0, 10);
        const limits: any = { conservative: 50, standard: 100, aggressive: 150 };
        upsertData.current_daily_limit = limits[body.risk_profile] || 100;
        upsertData.emails_sent_today = 0;
      }
    }

    const { error: dbError } = await supabase.from("smtp_credentials").upsert(upsertData, { onConflict: "user_id" });
    if (dbError) throw dbError;

    if (password.length > 0) {
      const { error: secretError } = await supabase
        .from("smtp_credentials_secrets")
        .upsert({ user_id: user.id, password }, { onConflict: "user_id" });
      if (secretError) throw secretError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
