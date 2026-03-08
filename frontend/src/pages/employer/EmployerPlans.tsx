import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { EMPLOYER_PLANS, type EmployerTier } from "@/config/employer-plans.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

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

  const tiers = Object.values(EMPLOYER_PLANS);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-brand">{t("employer.plans.title")}</h1>
        <p className="text-muted-foreground">{t("employer.plans.subtitle")}</p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Label className="text-sm">{t("employer.plans.monthly")}</Label>
        <Switch checked={annual} onCheckedChange={setAnnual} />
        <Label className="text-sm">
          {t("employer.plans.annual")} <Badge variant="secondary" className="ml-1 text-xs">{t("employer.plans.annual_discount")}</Badge>
        </Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((plan) => {
          const isCurrent = employerProfile?.tier === plan.id && employerProfile?.status === "active";
          const price = annual ? plan.price.annual : plan.price.monthly;
          const period = annual ? "/yr" : "/mo";

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden ${
                plan.id === "professional" ? "border-primary shadow-lg ring-2 ring-primary/20" : ""
              }`}
            >
              {plan.id === "professional" && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
                  {t("employer.plans.popular")}
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{plan.label}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${price}</span>
                  <span className="text-muted-foreground">{period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" onClick={handlePortal}>
                    {t("employer.plans.manage")}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.id === "professional" ? "default" : "outline"}
                    disabled={!!loadingTier}
                    onClick={() => handleCheckout(plan.id)}
                  >
                    {loadingTier === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t("employer.plans.subscribe")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
