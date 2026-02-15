import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ... (types e helpers json/requireEnv permanecem iguais)

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ... (lógica de auth e userId permanece igual até o body)

    const body: SaveSmtpRequest = await req.json();
    const provider: Provider = body.provider === "outlook" ? "outlook" : "gmail";
    const email = String(body.email ?? "").trim();

    // --- LÓGICA DE LIMPEZA DA SENHA ---
    // Remove espaços internos e garante que são apenas letras minúsculas
    const rawPassword = typeof body.password === "string" ? body.password : "";
    const password = rawPassword.replace(/\s/g, "").toLowerCase();

    // --- VALIDAÇÃO ANTES DE IR AO BANCO ---
    // Se enviou senha, ela PRECISA ter 16 letras. Se não, barramos aqui com erro amigável.
    if (password.length > 0 && !/^[a-z]{16}$/.test(password)) {
      return json(400, {
        success: false,
        error: "A senha de app deve ter exatamente 16 letras (sem números ou espaços).",
      });
    }

    const riskProfile = ["conservative", "standard", "aggressive"].includes(body.risk_profile ?? "")
      ? (body.risk_profile as RiskProfile)
      : null;

    if (!email) return json(400, { success: false, error: "Missing email" });

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ... (Restante da lógica de warmup e upsert na smtp_credentials permanece igual)

    // 4. Upsert da Senha na tabela de secrets
    if (password.length > 0) {
      const { error: secretError } = await serviceClient
        .from("smtp_credentials_secrets")
        .upsert({ user_id: userId, password }, { onConflict: "user_id" });

      if (secretError) {
        // Se ainda der erro de padrão aqui, o log vai nos dizer exatamente o que o banco rejeitou
        console.error("Erro de Constraint no Banco:", secretError);
        throw new Error("O formato da senha foi rejeitado pelo banco de dados.");
      }
    }

    return json(200, { success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to save SMTP";
    return json(500, { success: false, error: errorMessage });
  }
};

serve(handler);
