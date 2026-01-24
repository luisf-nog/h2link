import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

// 1x1 transparent GIF
const GIF_1PX = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
  (c) => c.charCodeAt(0),
);

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

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
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Look for the tracking_id in queue_send_history (per-send tracking)
      const { data: historyRow } = await serviceClient
        .from("queue_send_history")
        .select("id,opened_at")
        .eq("tracking_id", id)
        .maybeSingle();

      if (historyRow?.id && !historyRow.opened_at) {
        // Update the specific send history record with opened_at
        await serviceClient
          .from("queue_send_history")
          .update({ opened_at: new Date().toISOString() } as any)
          .eq("id", historyRow.id)
          .is("opened_at", null);

        // Also update the my_queue.opened_at for backward compatibility
        // Get the queue_id from this history record to update it
        const { data: historyFull } = await serviceClient
          .from("queue_send_history")
          .select("queue_id")
          .eq("id", historyRow.id)
          .single();

        if (historyFull?.queue_id) {
          // Update opened_at in my_queue only if not already set
          await serviceClient
            .from("my_queue")
            .update({ opened_at: new Date().toISOString() } as any)
            .eq("id", historyFull.queue_id)
            .is("opened_at", null);
        }
      }

      // Fallback: check my_queue.tracking_id for older emails (backward compatibility)
      if (!historyRow) {
        const { data: row } = await serviceClient
          .from("my_queue")
          .select("id,opened_at")
          .eq("tracking_id", id)
          .maybeSingle();

        if (row?.id && !row.opened_at) {
          await serviceClient
            .from("my_queue")
            .update({ opened_at: new Date().toISOString() } as any)
            .eq("id", row.id)
            .is("opened_at", null);
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
