export type EmployerTier = "free" | "essential" | "professional" | "enterprise";

export interface EmployerPlanConfig {
  id: EmployerTier;
  label: string;
  color: string;
  jobLimit: number;
  canPublish: boolean;
  price: {
    monthly: number;
    annual: number;
    stripe_monthly: string;
    stripe_annual: string;
  };
  features: string[];
  highlights: string[]; // top-level selling points
}

export const EMPLOYER_PLANS: Record<EmployerTier, EmployerPlanConfig> = {
  free: {
    id: "free",
    label: "Free",
    color: "gray",
    jobLimit: 1,
    canPublish: false,
    price: {
      monthly: 0,
      annual: 0,
      stripe_monthly: "",
      stripe_annual: "",
    },
    features: [
      "1 draft job posting",
      "Preview applicant form",
      "Upgrade to publish & receive applicants",
    ],
    highlights: ["Test the platform"],
  },
  essential: {
    id: "essential",
    label: "Essential",
    color: "emerald",
    jobLimit: 1,
    canPublish: true,
    price: {
      monthly: 49,
      annual: 470,
      stripe_monthly: "price_1T6bxlKliiuLyRPmO9GFlS6r",
      stripe_annual: "price_1T6bxsKliiuLyRPmgvfvRGIP",
    },
    features: [
      "1 active Featured job",
      "AI-powered applicant screening & scoring",
      "Shareable job link for social media",
      "Full ATS dashboard",
      "Recruitment audit log",
      "Compliance report",
    ],
    highlights: ["1 Featured Job", "AI Screening"],
  },
  professional: {
    id: "professional",
    label: "Professional",
    color: "blue",
    jobLimit: 3,
    canPublish: true,
    price: {
      monthly: 99,
      annual: 950,
      stripe_monthly: "price_1T6r4CKliiuLyRPmCsUC8SHa",
      stripe_annual: "price_1T6r4CKliiuLyRPmR44u7HqC",
    },
    features: [
      "3 active Featured jobs",
      "Priority listing in Job Hub",
      "AI-powered applicant screening & scoring",
      "Shareable job links for social media",
      "Full ATS dashboard",
      "Recruitment audit log",
      "Compliance report",
      "All Essential features",
    ],
    highlights: ["3 Featured Jobs", "Priority Listing"],
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    color: "amber",
    jobLimit: 5,
    canPublish: true,
    price: {
      monthly: 149,
      annual: 1430,
      stripe_monthly: "price_1T6r4sKliiuLyRPmIy0y7drp",
      stripe_annual: "price_1T6r4sKliiuLyRPmSp5PmrAq",
    },
    features: [
      "5 active Featured jobs",
      "Top priority in Job Hub",
      
      "AI-powered applicant screening & scoring",
      "Shareable job links for social media",
      "Full ATS dashboard",
      "Recruitment audit log",
      "Compliance report",
      "All Professional features",
    ],
    highlights: ["5 Featured Jobs", "Top Priority"],
  },
};

export const getEmployerPlan = (tier: EmployerTier) => EMPLOYER_PLANS[tier] ?? EMPLOYER_PLANS.free;
export const getTierJobLimit = (tier: EmployerTier) => (EMPLOYER_PLANS[tier] ?? EMPLOYER_PLANS.free).jobLimit;
export const canPublish = (tier: EmployerTier) => (EMPLOYER_PLANS[tier] ?? EMPLOYER_PLANS.free).canPublish;
