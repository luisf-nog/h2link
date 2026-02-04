// Share utilities for generating user-friendly share URLs

const SHARE_DOMAIN = 'https://h2linker.com';

/**
 * Get the share URL for a job
 * Always uses h2linker.com/api/job/{id}
 * This route renders Open Graph meta tags and redirects to the job page
 */
export function getJobShareUrl(jobId: string): string {
  return `${SHARE_DOMAIN}/api/job/${jobId}`;
}

/**
 * Get short URL display for UI (without protocol)
 * Shows h2linker.com/jobs/{id} for user-friendly display
 */
export function getShortShareUrl(jobId: string): string {
  return `h2linker.com/jobs/${jobId}`;
}
