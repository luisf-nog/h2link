export type EmployerTier = "essential" | "professional" | "enterprise";

export interface EmployerPlanConfig {
  id: EmployerTier;
  label: string;
  color: string;
  jobLimit: number;
  price: {
    monthly: number;
    annual: number;
    stripe_monthly: string;
    stripe_annual: string;
  };
  features: string[];
}

export const EMPLOYER_PLANS: Record<EmployerTier, EmployerPlanConfig> = {
  essential: {
    id: "essential",
    label: "Essential",
    color: "emerald",
    jobLimit: 1,
    price: {
      monthly: 49,
      annual: 470,
      stripe_monthly: "price_1T6r3dKliiuLyRPmG9jZz17K",
      stripe_annual: "price_1T6r3dKliiuLyRPmjWL9NsSu",
    },
    features: [
      "1 active job posting",
      "Applicant screening & scoring",
      "Contact & reject tracking",
      "Email notifications",
    ],
  },
  professional: {
    id: "professional",
    label: "Professional",
    color: "blue",
    jobLimit: 3,
    price: {
      monthly: 99,
      annual: 950,
      stripe_monthly: "price_1T6r4CKliiuLyRPmCsUC8SHa",
      stripe_annual: "price_1T6r4CKliiuLyRPmR44u7HqC",
    },
    features: [
      "3 active job postings",
      "Priority listing in Job Hub",
      "Silver badge on listings",
      "All Essential features",
    ],
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    color: "amber",
    jobLimit: 5,
    price: {
      monthly: 149,
      annual: 1430,
      stripe_monthly: "price_1T6r4sKliiuLyRPmIy0y7drp",
      stripe_annual: "price_1T6r4sKliiuLyRPmSp5PmrAq",
    },
    features: [
      "5 active job postings",
      "Top priority in Job Hub",
      "Gold badge on listings",
      "Verified Employer badge",
      "All Professional features",
    ],
  },
};

export const getEmployerPlan = (tier: EmployerTier) => EMPLOYER_PLANS[tier];
export const getTierJobLimit = (tier: EmployerTier) => EMPLOYER_PLANS[tier].jobLimit;
