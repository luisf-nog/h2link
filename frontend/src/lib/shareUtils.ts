// Share utilities for generating user-friendly share URLs

/**
 * Get the share URL for a job
 * Always uses production domain (h2linker.com)
 */
export function getJobShareUrl(jobId: string): string {
  return `https://h2linker.com/job/${jobId}`;
}

/**
 * Get short URL display for UI (without protocol)
 */
export function getShortShareUrl(jobId: string): string {
  return `h2linker.com/job/${jobId}`;
}
