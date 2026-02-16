// supabase/functions/save-smtp-credentials/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "https://esm.sh/nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Validar Autenticação
    const authHeader = req.headers.get("Authorization");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader?.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { provider, email, password, host, port, risk_profile } = await req.json();

    // --- LÓGICA DE PERFIL DE RISCO ---
    // Se o payload contém apenas o risk_profile, atualizamos e encerramos
    if (risk_profile && !password) {
      const { error: updateError } = await supabaseClient
        .from("smtp_credentials")
        .update({ risk_profile })
        .eq("user_id", user.id);

      if (updateError) throw updateError;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- LÓGICA DE CONFIGURAÇÃO SMTP ---
    let smtpConfig = {
      host: "",
      port: 465,
      secure: true,
      auth: { user: email, pass: password },
    };

    if (provider === "gmail") {
      smtpConfig.host = "smtp.gmail.com";
      smtpConfig.port = 465;
      smtpConfig.secure = true;
    } else if (provider === "outlook") {
      smtpConfig.host = "smtp-mail.outlook.com";
      smtpConfig.port = 587;
      smtpConfig.secure = false; // Outlook usa STARTTLS na porta 587
    } else if (provider === "custom") {
      smtpConfig.host = host;
      smtpConfig.port = Number(port);
      smtpConfig.secure = Number(port) === 465;
    }

    // 2. TESTAR CONEXÃO (O "Pulo do Gato")
    const transporter = nodemailer.createTransport(smtpConfig);

    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error("Erro na verificação SMTP:", verifyError);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Falha na autenticação SMTP. Verifique se a 'Senha de App' está correta e se o e-mail permite conexões externas.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // 3. SALVAR NO BANCO
    // Aqui usamos upsert para criar ou atualizar as credenciais do usuário
    const { error: dbError } = await supabaseClient.from("smtp_credentials").upsert(
      {
        user_id: user.id,
        provider,
        email,
        password, // Idealmente, você deve criptografar isso antes de salvar
        host: smtpConfig.host,
        port: smtpConfig.port,
        has_password: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
