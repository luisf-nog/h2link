import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function domainFromEmail(email: string): string | null {
  const s = String(email).trim();
  const at = s.lastIndexOf("@");
  if (at <= 0 || at === s.length - 1) return null;
  const domain = s.slice(at + 1).trim().toLowerCase();
  if (!domain) return null;
  return domain;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    // Validate token (rate limiting / abuse prevention)
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "");
    const domain = domainFromEmail(email);
    if (!domain) {
      return json(400, { ok: false, error: "Invalid email" });
    }

    try {
      const mx = await Deno.resolveDns(domain, "MX");
      const ok = Array.isArray(mx) && mx.length > 0;
      return json(200, { ok, domain, mx_count: ok ? mx.length : 0 });
    } catch (_e) {
      // If DNS resolution fails, treat as invalid MX
      return json(200, { ok: false, domain, mx_count: 0 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return json(500, { ok: false, error: errorMessage });
  }
};

serve(handler);
