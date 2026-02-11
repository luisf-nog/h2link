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

// AJUSTE: Novos limites iniciais mais agressivos
const PROFILE_START_LIMITS: Record<RiskProfile, number> = {
  conservative: 50, // Gold: Começa com 1/3 do plano
  standard: 100, // Diamond: Começa com ~30% do plano
  aggressive: 150, // Black: Começa com 1/3 do plano (ou o total do Gold)
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
  }, [user?.id]);

  const riskProfile = smtpData?.risk_profile ?? null;

  let currentDailyLimit: number;

  if (planTier === "free") {
    currentDailyLimit = 5;
  } else if (smtpData?.current_daily_limit != null) {
    // Se já existe no banco (processado pelo motor SQL), usamos o valor do banco
    currentDailyLimit = smtpData.current_daily_limit;
  } else if (riskProfile) {
    // Se acabou de escolher o perfil mas o motor SQL ainda não rodou
    currentDailyLimit = PROFILE_START_LIMITS[riskProfile];
  } else {
    // Fallback inicial para novos usuários Gold
    currentDailyLimit = 50;
  }

  // A MÁGICA: O limite efetivo nunca ultrapassa o que ele pagou (planMax)
  // Mas se ele for Gold (150) e escolher Agressivo (Início 150),
  // o effectiveLimit já será 150 no primeiro dia!
  const effectiveLimit = Math.min(currentDailyLimit, planMax);

  const emailsSentToday = smtpData?.emails_sent_today ?? 0;

  // Consideramos "Velocidade Máxima" se o limite atual atingiu ou passou o plano
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
