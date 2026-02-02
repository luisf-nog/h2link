import type { PlanConfig } from "@/config/plans.config";

export type SupportedCurrency = "BRL" | "USD";

export const getCurrencyForLanguage = (language: string | undefined): SupportedCurrency => {
  const lang = (language ?? "").toLowerCase();
  // We only have BRL + USD amounts today.
  // Default to USD for non-PT locales.
  return lang.startsWith("pt") ? "BRL" : "USD";
};

export const getPlanAmountForCurrency = (plan: PlanConfig, currency: SupportedCurrency): number => {
  return currency === "BRL" ? plan.price.brl : plan.price.usd;
};

export const formatCurrency = (amount: number, currency: SupportedCurrency, locale: string): string => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
