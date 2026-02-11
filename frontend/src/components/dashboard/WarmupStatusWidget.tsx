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

  const { riskProfile, currentDailyLimit, emailsSentToday, planMax, effectiveLimit, isWarmingUp, isMaxSpeed, loading } =
    useWarmupStatus();

  const usagePercent = effectiveLimit > 0 ? (emailsSentToday / effectiveLimit) * 100 : 0;
  const remaining = Math.max(0, effectiveLimit - emailsSentToday);

  // Mantemos o threshold de 80% como uma "meta diária recomendada" para o usuário
  const progressThreshold = effectiveLimit * 0.8;
  const progressToNextLevel = Math.min(100, (emailsSentToday / progressThreshold) * 100);

  /**
   * AJUSTE: Cálculo Linear de dias para o máximo.
   * Agora bate com a lógica do Motor SQL (+20, +50, +75).
   */
  const daysToMax = useMemo(() => {
    if (isMaxSpeed || planTier === "free" || !riskProfile) return 0;

    const dailyIncrements: Record<RiskProfile, number> = {
      conservative: 20,
      standard: 50,
      aggressive: 75,
    };

    const increment = dailyIncrements[riskProfile];
    const diff = planMax - currentDailyLimit;

    if (diff <= 0) return 0;

    return Math.ceil(diff / increment);
  }, [currentDailyLimit, planMax, riskProfile, isMaxSpeed, planTier]);

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
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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

          {isWarmingUp && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("warmup.widget.progress_to_increase")}
                </span>
                <span className="text-xs font-medium text-foreground">{Math.round(progressToNextLevel)}%</span>
              </div>
              <Progress value={progressToNextLevel} className="h-1.5 [&>div]:bg-amber-500" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta: {Math.ceil(progressThreshold)} envios hoje</span>
                {daysToMax > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    {daysToMax} {daysToMax === 1 ? "dia" : "dias"} para o máximo
                  </span>
                )}
              </div>
            </div>
          )}

          {riskProfile && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("warmup.widget.profile_label")}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {t(`warmup.profiles.${riskProfile}.title`)}
                </Badge>
              </div>
              {!isMaxSpeed && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Limite Final do Plano</span>
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
