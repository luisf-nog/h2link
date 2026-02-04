// Visa type utilities for consistent badge rendering

export type VisaType = 'H-2A' | 'H-2B' | 'H-2A (Early Access)';

export interface VisaBadgeConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

/**
 * Get badge configuration for a visa type
 */
export function getVisaBadgeConfig(visaType: string | null | undefined): VisaBadgeConfig {
  const type = visaType?.trim();
  
  if (type === 'H-2A (Early Access)') {
    return {
      label: 'Early Access',
      variant: 'destructive', // Use destructive for eye-catching red/pink color
      className: 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500',
    };
  }
  
  if (type === 'H-2A') {
    return {
      label: 'H-2A',
      variant: 'secondary',
    };
  }
  
  // Default to H-2B
  return {
    label: 'H-2B',
    variant: 'default',
  };
}

/**
 * Get all available visa type options for filtering
 */
export const VISA_TYPE_OPTIONS = [
  { value: 'all', label: 'All Visas' },
  { value: 'H-2B', label: 'H-2B' },
  { value: 'H-2A', label: 'H-2A' },
  { value: 'H-2A (Early Access)', label: 'H-2A (Early Access)' },
] as const;

export type VisaTypeFilter = typeof VISA_TYPE_OPTIONS[number]['value'];
