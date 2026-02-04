/**
 * Application configuration constants
 */

// Production domain - always use this for external-facing URLs
export const PRODUCTION_URL = 'https://h2linker.com';

// Supabase project ID for edge functions
export const SUPABASE_PROJECT_ID = 'dalarhopratsgzmmzhxx';

// Help email
export const HELP_EMAIL = 'help@h2linker.com';

/**
 * Get the base URL for external links.
 * Always returns production URL to avoid exposing preview/staging domains.
 */
export function getBaseUrl(): string {
  return PRODUCTION_URL;
}

/**
 * Get the share URL for a job that works with social media crawlers.
 * Uses the Edge Function to render proper meta tags for WhatsApp/Facebook previews.
 * @param jobId - The job UUID
 * @returns The share URL that renders meta tags for bots and redirects humans
 */
export function getJobShareUrl(jobId: string): string {
  return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/render-job-meta?jobId=${jobId}`;
}

/**
 * Get the direct job URL on the production domain.
 * Use this for canonical URLs and after-redirect destinations.
 * @param jobId - The job UUID
 * @returns The direct job page URL
 */
export function getJobDirectUrl(jobId: string): string {
  return `${PRODUCTION_URL}/job/${jobId}`;
}
