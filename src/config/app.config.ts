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
 * Uses h2linker.com/api/job/ route to render proper meta tags.
 * @param jobId - The job UUID
 * @returns The share URL with h2linker.com domain
 */
export function getJobShareUrl(jobId: string): string {
  return `${PRODUCTION_URL}/api/job/${jobId}`;
}

/**
 * Get the direct job URL on the production domain.
 * This is where users are redirected after meta tags are rendered.
 * @param jobId - The job UUID
 * @returns The direct job page URL
 */
export function getJobDirectUrl(jobId: string): string {
  return `${PRODUCTION_URL}/job/${jobId}`;
}
