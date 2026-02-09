// Share utilities for generating user-friendly share URLs

const SUPABASE_URL = "https://dalarhopratsgzmmzhxx.supabase.co";

/**
 * Get the share URL for a job
 * Points to the render-job-meta edge function so crawlers (WhatsApp, Facebook, etc.)
 * can read dynamic OG meta tags before being redirected to the app.
 */
export function getJobShareUrl(jobId: string): string {
  return `${SUPABASE_URL}/functions/v1/render-job-meta?jobId=${jobId}`;
}

/**
 * Get short URL display for UI (without protocol)
 */
export function getShortShareUrl(jobId: string): string {
  return `h2linker.com/job/${jobId}`;
}
