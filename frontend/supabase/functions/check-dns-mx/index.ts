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
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "");
    const domain = domainFromEmail(email);
    if (!domain) {
      return json(400, { ok: false, error: "Invalid email" });
    }

    // Retry MX check up to 3 times with delays
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Increase timeout for DNS resolution
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const mx = await Deno.resolveDns(domain, "MX");
        clearTimeout(timeoutId);
        
        const ok = Array.isArray(mx) && mx.length > 0;
        
        if (ok || attempt === maxRetries) {
          return json(200, { 
            ok, 
            domain, 
            mx_count: ok ? mx.length : 0,
            attempts: attempt 
          });
        }
        
        // Wait before retry (exponential backoff: 500ms, 1000ms, 2000ms)
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If it's the last attempt, return the error
        if (attempt === maxRetries) {
          console.error(`DNS MX check failed for ${domain} after ${maxRetries} attempts:`, lastError.message);
          
          // Return false but with more context
          return json(200, { 
            ok: false, 
            domain, 
            mx_count: 0,
            error: "DNS resolution failed",
            attempts: maxRetries
          });
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
      }
    }
    
    // Should not reach here, but fallback
    return json(200, { ok: false, domain, mx_count: 0, attempts: maxRetries });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error in check-dns-mx:", errorMessage);
    return json(500, { ok: false, error: errorMessage });
  }
};

serve(handler);
