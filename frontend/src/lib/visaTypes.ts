// Visa type utilities for consistent badge rendering

export type VisaType = 'H-2A' | 'H-2B' | 'H-2A (Early Access)';

export interface VisaBadgeConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

/**
 * Check if a visa type is Early Access
 */
export function isEarlyAccess(visaType: string | null | undefined): boolean {
  return visaType?.trim() === 'H-2A (Early Access)';
}

/**
 * Get the Early Access disclaimer message
 */
export function getEarlyAccessDisclaimer(locale: string = 'pt'): string {
  const disclaimers: Record<string, string> = {
    pt: 'Atenção: Esta vaga foi registrada recentemente e está em processamento inicial pelo Departamento de Trabalho (DOL). A certificação final pode ou não ser aprovada.',
    en: 'Attention: This job was recently filed and is in initial processing with the Department of Labor (DOL). Final certification may or may not be approved.',
    es: 'Atención: Esta oferta fue registrada recientemente y está en procesamiento inicial por el Departamento de Trabajo (DOL). La certificación final puede o no ser aprobada.',
  };
  
  return disclaimers[locale] || disclaimers['en'];
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
