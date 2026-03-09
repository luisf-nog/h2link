import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { EMPLOYER_PLANS, type EmployerTier } from "@/config/employer-plans.config";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Check,
  Loader2,
  Briefcase,
  Shield,
  Zap,
  Crown,
  Star,
  ArrowRight,
  Users,
  Share2,
  ClipboardList,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TIER_ICONS: Record<string, React.ElementType> = {
  essential: Zap,
  professional: Star,
  enterprise: Crown,
};

const TIER_GRADIENT: Record<string, string> = {
  essential: "from-emerald-500 to-emerald-700",
  professional: "from-blue-500 to-indigo-700",
  enterprise: "from-amber-500 to-orange-700",
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
    <div className="space-y-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-black font-brand tracking-tight text-foreground">
          {t("employer.plans.title", "Recruitment Plans")}
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
          {t("employer.plans.subtitle", "Publish Featured Jobs, receive applications, and manage your hiring pipeline — all in one place.")}
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <Label className={cn("text-sm font-semibold transition-colors", !annual ? "text-foreground" : "text-muted-foreground")}>
          {t("employer.plans.monthly", "Monthly")}
        </Label>
        <Switch checked={annual} onCheckedChange={setAnnual} />
        <Label className={cn("text-sm font-semibold transition-colors", annual ? "text-foreground" : "text-muted-foreground")}>
          {t("employer.plans.annual", "Annual")}
          <Badge variant="secondary" className="ml-2 text-[10px] font-bold bg-green-100 text-green-800 border-green-200">
            {t("employer.plans.annual_discount", "Save ~20%")}
          </Badge>
        </Label>
      </div>

      {/* Platform features banner */}
      <div className="bg-muted/50 border rounded-2xl p-5 sm:p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 text-center">
          {t("employer.plans.all_plans_include", "All paid plans include")}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Sparkles, label: t("employer.plans.feat_ai", "AI Applicant Scoring") },
            { icon: Share2, label: t("employer.plans.feat_share", "Shareable Job Links") },
            { icon: ClipboardList, label: t("employer.plans.feat_ats", "Full ATS Dashboard") },
            { icon: ShieldCheck, label: t("employer.plans.feat_compliance", "Compliance Reports") },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground leading-tight">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {paidTiers.map((plan) => {
          const isCurrent = employerProfile?.tier === plan.id && employerProfile?.status === "active";
          const price = annual ? plan.price.annual : plan.price.monthly;
          const period = annual ? "/yr" : "/mo";
          const isPopular = plan.id === "professional";
          const TierIcon = TIER_ICONS[plan.id] || Briefcase;
          const gradient = TIER_GRADIENT[plan.id] || "from-gray-500 to-gray-700";

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden transition-all border-2",
                isPopular
                  ? "border-primary shadow-xl shadow-primary/10 scale-[1.02]"
                  : "border-border hover:border-muted-foreground/30 hover:shadow-md",
                isCurrent && "ring-2 ring-green-500/30 border-green-500",
              )}
            >
              {/* Gradient header */}
              <div className={cn("bg-gradient-to-br text-white p-5 pb-6", gradient)}>
                {isPopular && (
                  <Badge className="absolute top-3 right-3 bg-white/20 text-white border-white/30 text-[10px] font-bold uppercase backdrop-blur-sm">
                    {t("employer.plans.popular", "Most Popular")}
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute top-3 right-3 bg-green-500 text-white border-0 text-[10px] font-bold uppercase">
                    {t("employer.plans.current", "Current Plan")}
                  </Badge>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <TierIcon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black tracking-tight">{plan.label}</h2>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tighter">${price}</span>
                  <span className="text-white/70 text-sm font-medium">{period}</span>
                </div>

                {annual && (
                  <p className="text-white/60 text-xs mt-1">
                    ${Math.round(plan.price.annual / 12)}/mo billed annually
                  </p>
                )}
              </div>

              <CardContent className="p-5 space-y-5">
                {/* Key highlights */}
                <div className="space-y-1">
                  {plan.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      {h}
                    </div>
                  ))}
                </div>

                {/* Feature list */}
                <ul className="space-y-2 border-t pt-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <Button variant="outline" className="w-full font-semibold" onClick={handlePortal}>
                    <Shield className="h-4 w-4 mr-2" />
                    {t("employer.plans.manage", "Manage Subscription")}
                  </Button>
                ) : (
                  <Button
                    className={cn(
                      "w-full font-bold",
                      isPopular
                        ? "bg-primary hover:bg-primary/90 shadow-lg"
                        : "",
                    )}
                    variant={isPopular ? "default" : "outline"}
                    disabled={!!loadingTier}
                    onClick={() => handleCheckout(plan.id)}
                  >
                    {loadingTier === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
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
      <div className="text-center space-y-2 pb-4">
        <p className="text-sm text-muted-foreground">
          {t("employer.plans.enterprise_note", "Need custom volume or have questions?")}
        </p>
        <a
          href="mailto:help@h2linker.com"
          className="text-sm font-bold text-primary hover:underline"
        >
          help@h2linker.com
        </a>
      </div>
    </div>
  );
}
