import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG, PlanTier, usesDynamicAI } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Check,
  Crown,
  Sparkles,
  Zap,
  Mail,
  FileText,
  Cloud,
  Clock,
  Headphones,
  Eye,
  Infinity as InfinityIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PromotionCountdown } from "@/components/plans/PromotionCountdown";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

export default function Plans() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const currentPlan = (profile?.plan_tier || "free") as PlanTier;

  const locale = i18n.resolvedLanguage || i18n.language;
  const currency = getCurrencyForLanguage(locale);

  // Monitora retorno do Stripe (Sucesso ou Cancelamento)
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast({
        title: t("plans.toasts.payment_success_title"),
        description: t("plans.toasts.payment_success_desc"),
      });
      setSearchParams({});
      refreshProfile();
    } else if (paymentStatus === "canceled") {
      toast({
        title: t("plans.toasts.payment_canceled_title"),
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast, t, refreshProfile]);

  const renderPlanPrice = (planId: PlanTier) => {
    const plan = PLANS_CONFIG[planId];
    const amount = getPlanAmountForCurrency(plan, currency);

    const originalBrl = plan.price.brl_original;
    const originalUsd = plan.price.usd_original;

    let hasPromo = false;
    let originalAmount: number | undefined;

    if (currency === "BRL" && originalBrl && originalBrl > amount) {
      hasPromo = true;
      originalAmount = originalBrl;
    } else if (currency === "USD" && originalUsd && originalUsd > amount) {
      hasPromo = true;
      originalAmount = originalUsd;
    }

    if (amount === 0) return { current: t("plans.free"), original: null };

    return {
      current: formatCurrency(amount, currency, locale),
      original: hasPromo && originalAmount ? formatCurrency(originalAmount, currency, locale) : null,
    };
  };

  // --- LÓGICA DE PAGAMENTO (MANTIDA INTACTA) ---
  const handleCheckout = async (planId: PlanTier) => {
    if (planId === "free") return;

    setLoadingPlan(planId);
    const plan = PLANS_CONFIG[planId];
    // Define qual ID de preço usar baseada na moeda do usuário
    const priceId = currency === "BRL" ? plan.price.stripe_id_brl : plan.price.stripe_id_usd;

    if (!priceId) {
      toast({
        title: t("plans.toasts.error_title"),
        description: "Price ID not configured",
        variant: "destructive",
      });
      setLoadingPlan(null);
      return;
    }

    try {
      // Chama a Edge Function do Supabase para criar a sessão do Stripe
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { priceId },
      });

      if (error) throw error;

      // Redireciona o usuário para o Checkout do Stripe
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: t("plans.toasts.error_title"),
        description: error instanceof Error ? error.message : "Failed to create checkout",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const getPlanFeatures = (planId: PlanTier) => {
    const config = PLANS_CONFIG[planId];

    type FeatureItem = {
      key: string;
      icon: React.ElementType;
      highlight?: boolean;
      tooltipKey?: string;
    };

    const features: FeatureItem[] = [];

    // 1. Limite Diário de Emails (Core Value)
    features.push({
      key: t("plans.features.daily_emails", { count: formatNumber(config.limits.daily_emails) } as any),
      icon: Mail,
      highlight: true,
    });

    // 2. Templates
    if (planId === "free") {
      features.push({ key: t("plans.features.basic_template"), icon: FileText });
    } else if (config.limits.max_templates > 100) {
      features.push({ key: t("plans.features.unlimited_generation"), icon: Sparkles, highlight: true });
    } else {
      features.push({
        key: t("plans.features.templates_saved", { count: config.limits.max_templates } as any),
        icon: FileText,
      });
    }

    // 3. Recursos de IA (Carta de Apresentação)
    if (planId !== "free") {
      if (usesDynamicAI(planId)) {
        features.push({
          key: t("plans.features.ai_real_writer"),
          icon: Zap,
          highlight: true,
          tooltipKey: "plans.features.ai_real_writer_tooltip",
        });
      } else {
        features.push({ key: t("plans.features.auto_fill_templates"), icon: FileText });
      }
    }

    // 4. Rastreamento de Currículo (Resume Tracking)
    if (config.features.resume_view_tracking) {
      features.push({
        key: t("plans.features.resume_view_tracking"),
        icon: Eye,
        highlight: true,
        tooltipKey: "plans.features.resume_view_tracking_tooltip",
      });
    }

    // 5. Envio em Nuvem (Cloud)
    if (config.features.cloud_sending) {
      features.push({ key: t("plans.features.cloud_sending"), icon: Cloud });
    }

    // 6. Análise de Currículo (Resume Parsing)
    if (config.features.resume_parsing) {
      if (planId === "black") {
        features.push({ key: t("plans.features.resume_advanced"), icon: FileText });
      } else {
        features.push({ key: t("plans.features.resume_basic"), icon: FileText });
      }
    }

    // 7. Delay Inteligente (Performance)
    if (planId === "black") {
      features.push({
        key: t("plans.features.delay_black"),
        icon: Clock,
        tooltipKey: "plans.features.delay_black_tooltip",
      });
    } else if (planId === "diamond") {
      features.push({
        key: t("plans.features.delay_diamond"),
        icon: Clock,
        tooltipKey: "plans.features.delay_diamond_tooltip",
      });
    } else if (planId === "gold") {
      features.push({
        key: t("plans.features.delay_gold"),
        icon: Clock,
        tooltipKey: "plans.features.delay_gold_tooltip",
      });
    }

    // 8. Suporte Prioritário
    if (config.features.priority_support) {
      features.push({ key: t("plans.features.priority_support"), icon: Headphones });
    }

    return features;
  };

  const getPlanColorClass = (planId: PlanTier, type: "text" | "bg" | "border" | "btn") => {
    const colors = {
      free: { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", btn: "default" },
      gold: {
        text: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        btn: "bg-amber-600 hover:bg-amber-700 text-white",
      },
      diamond: {
        text: "text-cyan-600",
        bg: "bg-cyan-50",
        border: "border-cyan-200",
        btn: "bg-cyan-600 hover:bg-cyan-700 text-white",
      },
      black: {
        text: "text-slate-900",
        bg: "bg-slate-100",
        border: "border-slate-900",
        btn: "bg-slate-900 hover:bg-slate-800 text-white",
      },
    };
    return (colors[planId] || colors.free)[type];
  };

  const plans = Object.values(PLANS_CONFIG);

  return (
    <TooltipProvider>
      <div className="space-y-12 pb-12">
        {/* Header Section */}
        <div className="text-center space-y-6 pt-8">
          <PromotionCountdown />

          <div className="space-y-4 max-w-3xl mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">{t("plans.title")}</h1>
            <p className="text-xl text-slate-600">{t("plans.subtitle")}</p>

            {/* Banner Vitalício Gigante */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-emerald-500/20 text-emerald-800 px-6 py-3 rounded-full border border-emerald-500/30 shadow-sm animate-pulse">
              <InfinityIcon className="h-6 w-6" />
              <span className="font-bold text-lg uppercase tracking-wide">
                {locale === "pt" ? "Pagamento Único • Acesso Vitalício" : "One-Time Payment • Lifetime Access"}
              </span>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-7xl mx-auto px-4">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isPopular = plan.id === "diamond";
            const isBest = plan.id === "black";
            const features = getPlanFeatures(plan.id);
            const priceInfo = renderPlanPrice(plan.id);

            const colorClass = getPlanColorClass(plan.id, "text");
            const btnClass = getPlanColorClass(plan.id, "btn");

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col transition-all duration-300 hover:-translate-y-1",
                  isBest
                    ? "border-2 border-slate-900 shadow-xl scale-105 z-10"
                    : "border border-slate-200 shadow-sm hover:shadow-lg",
                  isCurrentPlan && "ring-4 ring-primary/20 ring-offset-2",
                )}
              >
                {/* Badges de Topo */}
                {isPopular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}
                {isBest && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Ultimate Power
                    </span>
                  </div>
                )}

                <CardHeader className="text-center pb-8 pt-8">
                  <h3 className={cn("text-2xl font-bold uppercase tracking-tight", colorClass)}>
                    {t(`plans.tiers.${plan.id}.label`)}
                  </h3>

                  <div className="mt-4 flex flex-col items-center justify-center min-h-[80px]">
                    {priceInfo.original && (
                      <span className="text-slate-400 line-through text-sm font-medium">{priceInfo.original}</span>
                    )}
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-extrabold text-slate-900">{priceInfo.current}</span>
                    </div>
                    {/* Badge Vitalício Individual */}
                    {plan.id !== "free" && (
                      <Badge
                        variant="outline"
                        className="mt-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold"
                      >
                        {t("plans.lifetime")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <Separator />

                <CardContent className="flex-1 flex flex-col gap-6 pt-6">
                  {/* Lista de Features */}
                  <ul className="space-y-4 flex-1">
                    {features.map((feature, i) => {
                      const Icon = feature.icon;
                      const hasTooltip = !!feature.tooltipKey;

                      return (
                        <li key={i} className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 p-1 rounded-full shrink-0",
                              feature.highlight ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 text-sm">
                            {hasTooltip ? (
                              <Tooltip>
                                <TooltipTrigger className="text-left cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">
                                  <span
                                    className={cn(
                                      feature.highlight ? "font-semibold text-slate-900" : "text-slate-600",
                                    )}
                                  >
                                    {feature.key}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{t(feature.tooltipKey!)}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span
                                className={cn(feature.highlight ? "font-semibold text-slate-900" : "text-slate-600")}
                              >
                                {feature.key}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Botão de Ação - CHAMA handleCheckout */}
                  <Button
                    className={cn("w-full py-6 text-base font-bold shadow-md transition-all", btnClass)}
                    onClick={() => handleCheckout(plan.id)}
                    disabled={isCurrentPlan || loadingPlan !== null}
                  >
                    {loadingPlan === plan.id && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    {isCurrentPlan ? (
                      <>
                        <Check className="mr-2 h-5 w-5" /> {t("plans.actions.current")}
                      </>
                    ) : plan.id === "free" ? (
                      t("plans.actions.start_free")
                    ) : (
                      t("plans.actions.subscribe_now")
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer Notes */}
        <div className="max-w-3xl mx-auto px-4 text-center space-y-4">
          <div className="bg-slate-100/50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600">{t("plans.referral_note")}</p>
          </div>

          <p className="text-xs text-slate-400">
            {t("plans.footer.line1")}
            {t("plans.footer.line2") && (
              <>
                <br />
                {t("plans.footer.line2")}
              </>
            )}
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
