// Share utilities for generating user-friendly share URLs

/**
 * Get the friendly share URL for a job
 * Returns the backend URL which handles meta tags and redirects to frontend
 */
export function getJobShareUrl(jobId: string): string {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
  
  // Use backend /job/ route which handles Open Graph meta tags
  return `${backendUrl}/job/${jobId}`;
}

/**
 * Get short URL display for UI (without protocol)
 * Shows friendly domain if configured, otherwise shows actual domain
 */
export function getShortShareUrl(jobId: string): string {
  const customDomain = import.meta.env.VITE_APP_DOMAIN;
  
  // Display friendly domain in UI even if not yet configured
  if (customDomain) {
    return `${customDomain}/jobs/${jobId}`;
  }
  
  // Extract domain from backend URL for display
  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || '';
  const domain = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${domain}/job/${jobId}`;
}
