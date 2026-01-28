export type PlanTier = "free" | "gold" | "diamond" | "black";

export type SendingMethod = "static" | "dynamic";

export interface PlanConfig {
  id: PlanTier;
  label: string;
  color: "slate" | "amber" | "violet" | "zinc";
  description: string;
  price: {
    brl: number;
    brl_original?: number; // Original price for promotional display
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
    resume_view_tracking: boolean;
    resume_parsing: boolean;
  };
  settings: {
    job_db_access: "view_limited" | "text_only" | "visual_premium";
    job_db_blur: boolean;
    show_housing_icons: boolean;
    delay_strategy: "none" | "fixed" | "human";
    sending_method: SendingMethod;
  };
}

export const PLANS_CONFIG: Record<PlanTier, PlanConfig> = {
  free: {
    id: "free",
    label: "Starter",
    color: "slate",
    description: "Para testar e conhecer",
    price: { brl: 0, usd: 0, stripe_id_brl: null, stripe_id_usd: null },
    limits: { daily_emails: 5, max_queue_size: 10, max_templates: 1 },
    features: {
      cloud_sending: false,
      mask_user_agent: false,
      dns_bounce_check: false,
      magic_paste: false,
      ai_email_writer: false,
      priority_support: false,
      resume_view_tracking: false,
      resume_parsing: false,
    },
    settings: {
      job_db_access: "text_only",
      job_db_blur: false,
      show_housing_icons: false,
      delay_strategy: "none",
      sending_method: "static",
    },
  },
  gold: {
    id: "gold",
    label: "Gold",
    color: "amber",
    description: "Para quem busca volume",
    price: {
      brl: 47.99,
      brl_original: 64.99,
      usd: 19.99,
      stripe_id_brl: "price_1SueZyKliiuLyRPmL9R7Sdxm",
      stripe_id_usd: "price_1Suea8KliiuLyRPmQjhJrZdA",
    },
    limits: { daily_emails: 150, max_queue_size: 500, max_templates: 3 },
    features: {
      cloud_sending: true,
      mask_user_agent: true,
      dns_bounce_check: true,
      magic_paste: false,
      ai_email_writer: false,
      priority_support: false,
      resume_view_tracking: false,
      resume_parsing: true,
    },
    settings: {
      job_db_access: "text_only",
      job_db_blur: false,
      show_housing_icons: false,
      delay_strategy: "fixed",
      sending_method: "static",
    },
  },
  diamond: {
    id: "diamond",
    label: "Diamond",
    color: "violet",
    description: "Volume e visibilidade",
    price: {
      brl: 69.99,
      brl_original: 114.99,
      usd: 34.99,
      stripe_id_brl: "price_1Suea9KliiuLyRPmrRCXm6TP",
      stripe_id_usd: "price_1SueaAKliiuLyRPmo48RI0R9",
    },
    limits: { daily_emails: 350, max_queue_size: 9999, max_templates: 10 },
    features: {
      cloud_sending: true,
      mask_user_agent: true,
      dns_bounce_check: true,
      magic_paste: false,
      ai_email_writer: false,
      priority_support: false,
      resume_view_tracking: true,
      resume_parsing: true,
    },
    settings: {
      job_db_access: "visual_premium",
      job_db_blur: false,
      show_housing_icons: true,
      delay_strategy: "fixed",
      sending_method: "static",
    },
  },
  black: {
    id: "black",
    label: "Black",
    color: "zinc",
    description: "IA dinâmica por vaga",
    price: {
      brl: 97.99,
      brl_original: 299.0,
      usd: 89.99,
      stripe_id_brl: "price_1SueaCKliiuLyRPmevGCARiq",
      stripe_id_usd: "price_1SueaDKliiuLyRPmjqiMMWAs",
    },
    limits: { daily_emails: 450, max_queue_size: 9999, max_templates: 999 },
    features: {
      cloud_sending: true,
      mask_user_agent: true,
      dns_bounce_check: true,
      magic_paste: true,
      ai_email_writer: true,
      priority_support: true,
      resume_view_tracking: true,
      resume_parsing: true,
    },
    settings: {
      job_db_access: "visual_premium",
      job_db_blur: false,
      show_housing_icons: true,
      delay_strategy: "human",
      sending_method: "dynamic",
    },
  },
} as const;

export const getPlanConfig = (tier: PlanTier): PlanConfig => PLANS_CONFIG[tier];

export const canAccessFeature = (tier: PlanTier, feature: keyof PlanConfig["features"]): boolean => {
  return PLANS_CONFIG[tier].features[feature];
};

export const getPlanLimit = (tier: PlanTier, limit: keyof PlanConfig["limits"]): number => {
  return PLANS_CONFIG[tier].limits[limit];
};

export const usesDynamicAI = (tier: PlanTier): boolean => {
  return PLANS_CONFIG[tier].settings.sending_method === "dynamic";
};
