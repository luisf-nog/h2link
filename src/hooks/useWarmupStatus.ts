import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanLimit } from "@/config/plans.config";

export type RiskProfile = "conservative" | "standard" | "aggressive";

export interface WarmupStatus {
  riskProfile: RiskProfile | null;
  currentDailyLimit: number;
  emailsSentToday: number;
  lastUsageDate: string | null;
  warmupStartedAt: string | null;
  planMax: number;
  effectiveLimit: number;
  isWarmingUp: boolean;
  isMaxSpeed: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const PROFILE_START_LIMITS: Record<RiskProfile, number> = {
  conservative: 20,
  standard: 50,
  aggressive: 100,
};

export function useWarmupStatus(): WarmupStatus {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smtpData, setSmtpData] = useState<{
    risk_profile: RiskProfile | null;
    current_daily_limit: number | null;
    emails_sent_today: number;
    last_usage_date: string | null;
    warmup_started_at: string | null;
  } | null>(null);

  const planTier = profile?.plan_tier || "free";
  const referralBonus = Number((profile as any)?.referral_bonus_limit ?? 0);
  const planMax = getPlanLimit(planTier, "daily_emails");

  const fetchStatus = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("smtp_credentials")
        .select("risk_profile, current_daily_limit, emails_sent_today, last_usage_date, warmup_started_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setSmtpData(data as any);
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch warm-up status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Calculate effective values
  const riskProfile = smtpData?.risk_profile ?? null;
  
  // Current daily limit (from DB or start limit based on profile)
  let currentDailyLimit: number;
  if (planTier === "free") {
    currentDailyLimit = 5;
  } else if (smtpData?.current_daily_limit != null) {
    currentDailyLimit = smtpData.current_daily_limit;
  } else if (riskProfile) {
    currentDailyLimit = PROFILE_START_LIMITS[riskProfile];
  } else {
    currentDailyLimit = 20; // Default conservative start
  }

  // Cap at plan max + referral bonus
  const effectiveLimit = Math.min(currentDailyLimit, planMax) + referralBonus;
  
  const emailsSentToday = smtpData?.emails_sent_today ?? 0;
  const isMaxSpeed = currentDailyLimit >= planMax;
  const isWarmingUp = !isMaxSpeed && planTier !== "free";

  return {
    riskProfile,
    currentDailyLimit,
    emailsSentToday,
    lastUsageDate: smtpData?.last_usage_date ?? null,
    warmupStartedAt: smtpData?.warmup_started_at ?? null,
    planMax,
    effectiveLimit,
    isWarmingUp,
    isMaxSpeed,
    loading,
    error,
    refetch: fetchStatus,
  };
}
