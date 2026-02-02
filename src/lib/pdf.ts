type PdfJsModule = typeof import("pdfjs-dist");

async function loadPdfJs(): Promise<PdfJsModule> {
  // Preview generation can evaluate modules in a non-browser context.
  // Only load pdfjs in the browser.
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser.");
  }

  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    // Vite will bundle the worker and provide a URL; this avoids relying on external CDNs.
    // eslint-disable-next-line import/no-unresolved
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);

  // pdfjs typing varies between builds; workerSrc is required for browser parsing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = (worker as any).default;

  return pdfjs;
}

/**
 * Extracts text from a PDF file in the browser.
 * Reads up to `maxPages` pages and caps total output to `maxChars`.
 */
export async function extractTextFromPDF(
  file: File,
  {
    maxPages = 25,
    maxChars = 40_000,
  }: {
    maxPages?: number;
    maxChars?: number;
  } = {},
): Promise<string> {
  const pdfjs = await loadPdfJs();

  if (file.type && file.type !== "application/pdf") {
    throw new Error("Invalid file type. Please upload a PDF.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (pdfjs as any).getDocument({ data }).promise;

  const pages = Math.min(doc.numPages ?? 0, maxPages);
  let out = "";

  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = (content.items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
      .filter(Boolean);

    out += strings.join(" ") + "\n";
    if (out.length >= maxChars) break;
  }

  return out.trim().slice(0, maxChars);
}
