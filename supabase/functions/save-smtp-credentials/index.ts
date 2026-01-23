import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Provider = "gmail" | "outlook";

type SaveSmtpRequest = {
  provider: Provider;
  email: string;
  password?: string;
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

    if (!email) return json(400, { success: false, error: "Missing email" });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: credsError } = await serviceClient
      .from("smtp_credentials")
      .upsert({ user_id: userId, provider, email }, { onConflict: "user_id" });
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
