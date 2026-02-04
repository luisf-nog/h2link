// Share utilities for generating user-friendly share URLs

/**
 * Get the friendly share URL for a job
 * Uses custom domain (h2linker.com) if configured, otherwise falls back to backend URL
 */
export function getJobShareUrl(jobId: string): string {
  const customDomain = import.meta.env.VITE_APP_DOMAIN;
  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
  
  // If custom domain is configured, use it for a friendly URL
  if (customDomain) {
    return `https://${customDomain}/jobs/${jobId}`;
  }
  
  // Otherwise use backend URL (which redirects to frontend)
  return `${backendUrl}/job/${jobId}`;
}

/**
 * Get short URL display for UI (without protocol)
 */
export function getShortShareUrl(jobId: string): string {
  const customDomain = import.meta.env.VITE_APP_DOMAIN;
  
  if (customDomain) {
    return `${customDomain}/jobs/${jobId}`;
  }
  
  // Extract domain from backend URL
  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || '';
  const domain = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${domain}/job/${jobId}`;
}
