import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

// Helper function para validar variáveis de ambiente
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// 1x1 transparent GIF
const GIF_1PX = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
  (c) => c.charCodeAt(0),
);

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// Minimum seconds after send before we count a view as genuine (antivirus/scanner bypass)
const ANTIVIRUS_DELAY_SECONDS = 60;

const handler = async (req: Request): Promise<Response> => {
  // Pixel requests are simple GETs, but keep CORS-friendly anyway.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";

    if (isUuid(id)) {
      const supabaseUrl = requireEnv("SUPABASE_URL");
      const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      // --- Per-send tracking (queue_send_history) ---
      const { data: historyRow } = await serviceClient
        .from("queue_send_history")
        .select("id, opened_at, first_opened_at, open_count, sent_at, queue_id")
        .eq("tracking_id", id)
        .maybeSingle();

      if (historyRow?.id) {
        const now = new Date();
        const sentAt = historyRow.sent_at ? new Date(historyRow.sent_at) : null;
        const secondsSinceSend = sentAt
          ? (now.getTime() - sentAt.getTime()) / 1000
          : ANTIVIRUS_DELAY_SECONDS + 1; // If no sent_at, assume genuine

        // Always increment open_count (every pixel load = one view)
        const newOpenCount = (historyRow.open_count ?? 0) + 1;

        // Only set opened_at / first_opened_at if past the antivirus delay
        const isGenuineOpen = secondsSinceSend >= ANTIVIRUS_DELAY_SECONDS;

        const updateData: Record<string, unknown> = {
          open_count: newOpenCount,
        };

        if (isGenuineOpen) {
          // Set opened_at on first genuine open
          if (!historyRow.opened_at) {
            updateData.opened_at = now.toISOString();
          }
          // Set first_opened_at once, never overwrite
          if (!historyRow.first_opened_at) {
            updateData.first_opened_at = now.toISOString();
          }
        }

        await serviceClient
          .from("queue_send_history")
          .update(updateData as any)
          .eq("id", historyRow.id);

        // Update my_queue aggregate tracking
        if (historyRow.queue_id) {
          // Get current my_queue state
          const { data: queueRow } = await serviceClient
            .from("my_queue")
            .select("id, opened_at, email_open_count")
            .eq("id", historyRow.queue_id)
            .single();

          if (queueRow) {
            const queueUpdate: Record<string, unknown> = {
              email_open_count: (queueRow.email_open_count ?? 0) + 1,
            };

            // Only set opened_at on my_queue if it's genuine and not already set
            if (isGenuineOpen && !queueRow.opened_at) {
              queueUpdate.opened_at = now.toISOString();
            }

            await serviceClient
              .from("my_queue")
              .update(queueUpdate as any)
              .eq("id", historyRow.queue_id);
          }
        }

        console.log(`[track-email-open] tracking_id=${id} open_count=${newOpenCount} genuine=${isGenuineOpen} secondsSinceSend=${Math.round(secondsSinceSend)}`);
      } else {
        // Fallback: check my_queue.tracking_id for older emails (backward compatibility)
        const { data: row } = await serviceClient
          .from("my_queue")
          .select("id, opened_at, email_open_count")
          .eq("tracking_id", id)
          .maybeSingle();

        if (row?.id) {
          const updateData: Record<string, unknown> = {
            email_open_count: (row.email_open_count ?? 0) + 1,
          };
          if (!row.opened_at) {
            updateData.opened_at = new Date().toISOString();
          }
          await serviceClient
            .from("my_queue")
            .update(updateData as any)
            .eq("id", row.id);
        }
      }
    }
  } catch {
    // Never break the email rendering: always return the pixel.
  }

  return new Response(GIF_1PX, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
};

serve(handler);
