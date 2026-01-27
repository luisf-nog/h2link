import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Shield, Rocket, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/number";
import { useWarmupStatus, type RiskProfile } from "@/hooks/useWarmupStatus";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export function WarmupStatusWidget() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const planTier = profile?.plan_tier || "free";
  const referralBonus = Number((profile as any)?.referral_bonus_limit ?? 0);

  const {
    riskProfile,
    currentDailyLimit,
    emailsSentToday,
    planMax,
    effectiveLimit,
    isWarmingUp,
    isMaxSpeed,
    loading,
  } = useWarmupStatus();

  const usagePercent = effectiveLimit > 0 ? (emailsSentToday / effectiveLimit) * 100 : 0;
  const remaining = Math.max(0, effectiveLimit - emailsSentToday);

  // Progress toward 80% threshold for next day increase
  const progressThreshold = effectiveLimit * 0.8;
  const progressToNextLevel = Math.min(100, (emailsSentToday / progressThreshold) * 100);

  // Calculate days to max (rough estimate)
  const daysToMax = useMemo(() => {
    if (isMaxSpeed || planTier === "free") return 0;

    const multipliers: Record<RiskProfile, number> = {
      conservative: 1.3,
      standard: 1.5,
      aggressive: 2.0,
    };

    const mult = multipliers[riskProfile ?? "conservative"];
    let limit = currentDailyLimit;
    let days = 0;

    while (limit < planMax && days < 30) {
      limit = Math.ceil(limit * mult);
      days++;
    }

    return days;
  }, [currentDailyLimit, planMax, riskProfile, isMaxSpeed, planTier]);

  // Loading state
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            {t("warmup.widget.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Free tier has no warm-up
  if (planTier === "free") {
    return (
      <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            {t("warmup.widget.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-2xl font-bold text-foreground">{remaining}</span>
                <span className="text-muted-foreground ml-2 text-sm">{t("warmup.widget.remaining")}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {emailsSentToday} / {effectiveLimit}
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <p className="text-xs text-muted-foreground">{t("warmup.widget.free_tier_note")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            {t("warmup.widget.title")}
          </span>
          {isMaxSpeed ? (
            <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
              <Rocket className="h-3 w-3 mr-1" />
              {t("warmup.widget.max_speed")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 border-blue-500/30">
              <Shield className="h-3 w-3 mr-1" />
              {t("warmup.widget.warming_up")}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t("warmup.widget.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main usage */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-3xl font-bold text-foreground">{remaining}</span>
                <span className="text-muted-foreground ml-2">{t("warmup.widget.remaining")}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {t("warmup.widget.used", { used: formatNumber(emailsSentToday), limit: formatNumber(effectiveLimit) })}
              </span>
            </div>
            <Progress value={usagePercent} className="h-3" />
          </div>

          {/* Progress to next level (only if warming up) */}
          {isWarmingUp && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("warmup.widget.progress_to_increase")}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {Math.round(progressToNextLevel)}%
                </span>
              </div>
              <Progress 
                value={progressToNextLevel} 
                className="h-1.5 [&>div]:bg-amber-500" 
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("warmup.widget.send_target", { target: Math.ceil(progressThreshold) })}
                </span>
                {daysToMax > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t("warmup.widget.days_to_max", { days: daysToMax })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Profile info */}
          {riskProfile && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("warmup.widget.profile_label")}</span>
                <Badge variant="outline" className="text-xs">
                  {t(`warmup.profiles.${riskProfile}.title`)}
                </Badge>
              </div>
              {!isMaxSpeed && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">{t("warmup.widget.plan_max")}</span>
                  <span className="font-medium text-foreground">{formatNumber(planMax)}/dia</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
