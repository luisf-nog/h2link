/**
 * Application configuration constants
 */

// Production domain - always use this for external-facing URLs
export const PRODUCTION_URL = 'https://h2linker.com';

// Help email
export const HELP_EMAIL = 'help@h2linker.com';

/**
 * Get the base URL for external links.
 * Always returns production URL to avoid exposing preview/staging domains.
 */
export function getBaseUrl(): string {
  return PRODUCTION_URL;
}
