import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";
import { z } from "https://esm.sh/zod@3.25.76";
// pdf-parse depends on Node's fs, which is not available in the edge runtime.
// Use pdfjs-dist to extract text from PDFs.
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  // Edge runtime (Deno) cannot load a relative worker script.
  // Even with disableWorker=true, pdfjs may attempt a "fake worker" fallback and
  // import(workerSrc). Therefore workerSrc MUST be an absolute URL.
  // Use a CDN that serves the worker file directly as an ES module.
  // esm.sh doesn't reliably expose internal worker files for pdfjs-dist 4.x.
  // @ts-ignore - types vary across builds
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";

  let doc: any;
  try {
    // @ts-ignore - disableWorker is supported by pdfjs
    doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  } catch (e) {
    // Fallback: non-legacy worker path (package structure can differ by build).
    // @ts-ignore
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    // @ts-ignore
    doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  }
  const maxPages = Math.min(doc.numPages, 25);
  let out = "";
  for (let p = 1; p <= maxPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = (content.items ?? [])
      // @ts-ignore
      .map((it) => (typeof it?.str === "string" ? it.str : ""))
      .filter(Boolean);
    out += strings.join(" ") + "\n";
    // Avoid overly large prompts
    if (out.length > 40_000) break;
  }
  return out.trim();
}

const resumeSchema = z.object({
  name: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience_years: z.number().int().nonnegative().default(0),
  previous_jobs: z.array(z.string()).default([]),
  bio: z.string().default(""),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { success: false, error: "Unauthorized" });

    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return json(401, { success: false, error: "Unauthorized" });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json(400, { success: false, error: "Missing PDF file (field: file)" });
    }

    if (file.type && file.type !== "application/pdf") {
      return json(400, { success: false, error: "Invalid file type. Please upload a PDF." });
    }

    // 20MB client-side limit exists, but enforce a soft limit here too.
    if (file.size > 20 * 1024 * 1024) {
      return json(413, { success: false, error: "File too large (max 20MB)" });
    }

    const buf = new Uint8Array(await file.arrayBuffer());

    console.info("parse-resume: received file", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const text = await extractPdfText(buf);
    if (!text) return json(400, { success: false, error: "Could not extract text from PDF" });

    console.info("parse-resume: extracted text", {
      length: text.length,
      preview: text.slice(0, 200),
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { success: false, error: "AI not configured" });

    const systemPrompt =
      "Extract resume data and return ONLY valid JSON with keys: " +
      "{name, skills, experience_years, previous_jobs, bio}. " +
      "skills and previous_jobs must be arrays of strings. experience_years must be an integer.";

    const userPrompt =
      "Resume text:\n\n" +
      text.slice(0, 20_000);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      return json(aiResp.status, { success: false, error: `AI error (${aiResp.status})`, details: t.slice(0, 500) });
    }

    const aiJson = await aiResp.json();
    const content = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json(500, { success: false, error: "AI returned invalid JSON" });
    }

    const validated = resumeSchema.safeParse(parsed);
    if (!validated.success) {
      return json(500, { success: false, error: "AI output validation failed" });
    }

    return json(200, { success: true, resume_data: validated.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("parse-resume: unhandled error", e);
    return json(500, { success: false, error: message });
  }
});
