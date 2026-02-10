import mammoth from "mammoth";

/**
 * Extracts plain text from a DOCX file in the browser.
 */
export async function extractTextFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim().slice(0, 40_000);
}
