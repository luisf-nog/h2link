// Share utilities for generating user-friendly share URLs

/**
 * Get the share URL for a job
 * Uses the actual backend URL (works now) until DNS is configured
 */
export function getJobShareUrl(jobId: string): string {
  // Use actual backend URL from environment (works immediately)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 
                     import.meta.env.REACT_APP_BACKEND_URL ||
                     'https://visa-type-badge-fix.preview.emergentagent.com';
  
  return `${backendUrl}/api/job/${jobId}`;
}

/**
 * Get short URL display for UI (without protocol)
 * Shows h2linker.com for branding even if not yet configured
 */
export function getShortShareUrl(jobId: string): string {
  // Always display h2linker.com for professional appearance
  return `h2linker.com/jobs/${jobId}`;
}
