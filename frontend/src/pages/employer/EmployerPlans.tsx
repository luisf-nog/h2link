import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { EMPLOYER_PLANS, type EmployerTier } from "@/config/employer-plans.config";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Loader2,
  Zap,
  Crown,
  Star,
  Shield,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TIER_ICONS: Record<string, React.ElementType> = {
  essential: Zap,
  professional: Star,
  enterprise: Crown,
};

const TIER_COLORS: Record<string, { text: string; btn: string }> = {
  essential: {
    text: "text-emerald-600",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  professional: {
    text: "text-cyan-600",
    btn: "bg-cyan-600 hover:bg-cyan-700 text-white",
  },
  enterprise: {
    text: "text-slate-900",
    btn: "bg-slate-900 hover:bg-slate-800 text-white",
  },
};

export default function EmployerPlans() {
  const { session } = useAuth();
  const { employerProfile } = useIsEmployer();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<EmployerTier | null>(null);

  const handleCheckout = async (tier: EmployerTier) => {
    if (!session) return;
    setLoadingTier(tier);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employer-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ tier, billing_interval: annual ? "year" : "month" }),
        },
      );
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast({ title: t("employer.plans.error"), description: data.error || t("employer.plans.checkout_error") });
    } catch {
      toast({ title: t("employer.plans.error"), description: t("employer.plans.network_error") });
    } finally {
      setLoadingTier(null);
    }
  };

  const handlePortal = async () => {
    if (!session) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employer-portal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
  };

  const paidTiers = (["essential", "professional", "enterprise"] as EmployerTier[]).map(
    (id) => EMPLOYER_PLANS[id],
  );

  return (
    <div className="space-y-12 pb-12">
      {/* Hero */}
      <div className="text-center space-y-4 pt-8 max-w-3xl mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
          {t("employer.plans.title", "Recruitment Plans")}
        </h1>
        <p className="text-xl text-slate-600">
          {t("employer.plans.subtitle", "Publish Featured Jobs, receive applications, and manage your hiring pipeline — all in one place.")}
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <Label className={cn("text-sm font-semibold transition-colors", !annual ? "text-slate-900" : "text-slate-400")}>
          {t("employer.plans.monthly", "Monthly")}
        </Label>
        <Switch checked={annual} onCheckedChange={setAnnual} />
        <Label className={cn("text-sm font-semibold transition-colors", annual ? "text-slate-900" : "text-slate-400")}>
          {t("employer.plans.annual", "Annual")}
          <Badge variant="outline" className="ml-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
            {t("employer.plans.annual_discount", "Save ~20%")}
          </Badge>
        </Label>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
        {paidTiers.map((plan) => {
          const isCurrent = employerProfile?.tier === plan.id && employerProfile?.status === "active";
          const price = annual ? plan.price.annual : plan.price.monthly;
          const period = annual ? "/yr" : "/mo";
          const isPopular = plan.id === "professional";
          const isBest = plan.id === "enterprise";
          const colors = TIER_COLORS[plan.id] || TIER_COLORS.essential;
          const TierIcon = TIER_ICONS[plan.id] || Zap;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col transition-all duration-300 hover:-translate-y-1",
                isBest
                  ? "border-2 border-slate-900 shadow-xl scale-105 z-10"
                  : "border border-slate-200 shadow-sm hover:shadow-lg",
                isCurrent && "ring-4 ring-primary/20 ring-offset-2",
              )}
            >
              {isPopular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wider">
                    {t("employer.plans.popular", "Most Popular")}
                  </span>
                </div>
              )}
              {isBest && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
                    <Crown className="h-3 w-3" /> {t("employer.plans.best", "Best Value")}
                  </span>
                </div>
              )}

              <CardHeader className="text-center pb-8 pt-8">
                <h3 className={cn("text-2xl font-bold uppercase tracking-tight", colors.text)}>
                  {plan.label}
                </h3>

                <div className="mt-4 flex flex-col items-center justify-center min-h-[80px]">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">${price}</span>
                    <span className="text-slate-500 text-sm font-medium">{period}</span>
                  </div>
                  {annual && (
                    <p className="text-slate-400 text-xs mt-1">
                      ${Math.round(plan.price.annual / 12)}/mo billed annually
                    </p>
                  )}
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="flex-1 flex flex-col gap-6 pt-6">
                {/* Highlights */}
                <div className="space-y-2">
                  {plan.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-3">
                      <div className="p-1 rounded-full bg-green-100 text-green-700 shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{h}</span>
                    </div>
                  ))}
                </div>

                {/* Feature list */}
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <div className="mt-0.5 p-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm text-slate-600">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <Button
                    className="w-full py-6 text-base font-bold shadow-md"
                    variant="outline"
                    onClick={handlePortal}
                  >
                    <Shield className="mr-2 h-5 w-5" />
                    {t("employer.plans.manage", "Manage Subscription")}
                  </Button>
                ) : (
                  <Button
                    className={cn("w-full py-6 text-base font-bold shadow-md transition-all", colors.btn)}
                    disabled={!!loadingTier}
                    onClick={() => handleCheckout(plan.id)}
                  >
                    {loadingTier === plan.id ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-5 w-5" />
                    )}
                    {t("employer.plans.subscribe", "Get Started")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="max-w-3xl mx-auto px-4 text-center space-y-2">
        <p className="text-sm text-slate-600">
          {t("employer.plans.enterprise_note", "Need custom volume or have questions?")}
        </p>
        <a href="mailto:help@h2linker.com" className="text-sm font-bold text-primary hover:underline">
          help@h2linker.com
        </a>
      </div>
    </div>
  );
}
