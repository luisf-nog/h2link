export type PlanTier = 'free' | 'gold' | 'diamond';

export interface PlanConfig {
  id: PlanTier;
  label: string;
  color: 'slate' | 'blue' | 'violet';
  description: string;
  price: {
    brl: number;
    usd: number;
    stripe_id_brl: string | null;
    stripe_id_usd: string | null;
  };
  limits: {
    daily_emails: number;
    max_queue_size: number;
    max_templates: number;
  };
  features: {
    cloud_sending: boolean;
    mask_user_agent: boolean;
    dns_bounce_check: boolean;
    magic_paste: boolean;
    ai_email_writer: boolean;
    priority_support: boolean;
  };
  settings: {
    job_db_access: 'view_limited' | 'text_only' | 'visual_premium';
    job_db_blur: boolean;
    show_housing_icons: boolean;
    delay_strategy: 'none' | 'fixed' | 'human';
  };
}

export const PLANS_CONFIG: Record<PlanTier, PlanConfig> = {
  free: {
    id: 'free',
    label: 'Starter',
    color: 'slate',
    description: 'Para testar e conhecer',
    price: { brl: 0, usd: 0, stripe_id_brl: null, stripe_id_usd: null },
    limits: { daily_emails: 5, max_queue_size: 10, max_templates: 0 },
    features: {
      cloud_sending: false,
      mask_user_agent: false,
      dns_bounce_check: false,
      magic_paste: false,
      ai_email_writer: false,
      priority_support: false
    },
    settings: {
      job_db_access: 'view_limited',
      job_db_blur: true,
      show_housing_icons: false,
      delay_strategy: 'none'
    }
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    color: 'blue',
    description: 'Para quem busca volume',
    price: { brl: 19.90, usd: 4.90, stripe_id_brl: 'price_gold_test', stripe_id_usd: 'price_gold_usd_test' },
    limits: { daily_emails: 150, max_queue_size: 500, max_templates: 1 },
    features: {
      cloud_sending: true,
      mask_user_agent: true,
      dns_bounce_check: true,
      magic_paste: false,
      ai_email_writer: false,
      priority_support: false
    },
    settings: {
      job_db_access: 'text_only',
      job_db_blur: false,
      show_housing_icons: false,
      delay_strategy: 'fixed'
    }
  },
  diamond: {
    id: 'diamond',
    label: 'Diamond',
    color: 'violet',
    description: 'A ferramenta profissional completa',
    price: { brl: 39.90, usd: 9.90, stripe_id_brl: 'price_diamond_test', stripe_id_usd: 'price_diamond_usd_test' },
    limits: { daily_emails: 350, max_queue_size: 9999, max_templates: 5 },
    features: {
      cloud_sending: true,
      mask_user_agent: true,
      dns_bounce_check: true,
      magic_paste: true,
      ai_email_writer: true,
      priority_support: true
    },
    settings: {
      job_db_access: 'visual_premium',
      job_db_blur: false,
      show_housing_icons: true,
      delay_strategy: 'human'
    }
  }
} as const;

export const getPlanConfig = (tier: PlanTier): PlanConfig => PLANS_CONFIG[tier];

export const canAccessFeature = (tier: PlanTier, feature: keyof PlanConfig['features']): boolean => {
  return PLANS_CONFIG[tier].features[feature];
};

export const getPlanLimit = (tier: PlanTier, limit: keyof PlanConfig['limits']): number => {
  return PLANS_CONFIG[tier].limits[limit];
};
