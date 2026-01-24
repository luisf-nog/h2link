import * as pdfjs from "pdfjs-dist";
// Vite will bundle the worker and provide a URL; this avoids relying on external CDNs.
// eslint-disable-next-line import/no-unresolved
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

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
  if (file.type && file.type !== "application/pdf") {
    throw new Error("Invalid file type. Please upload a PDF.");
  }

  // pdfjs typing varies between builds; workerSrc is required for browser parsing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;

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
