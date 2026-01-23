import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG, PlanTier } from "@/config/plans.config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import { formatNumber } from "@/lib/number";

type PremiumSection = {
  key: string;
  title: string;
  summary: string;
  details: string[];
  cta?: { label: string; href: string };
};

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(true);

  const tier = (profile?.plan_tier ?? "free") as PlanTier;
  const config = PLANS_CONFIG[tier];

  useEffect(() => {
    // On Stripe redirect, refresh profile so the user sees the upgraded tier immediately.
    (async () => {
      try {
        await refreshProfile();
      } finally {
        setRefreshing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sections = useMemo<PremiumSection[]>(() => {
    const premium: PremiumSection[] = [];

    premium.push({
      key: "limits",
      title: String(t("plans.payment_success.sections.limits.title")),
      summary: String(t("plans.payment_success.sections.limits.summary", {
        daily: formatNumber(config.limits.daily_emails),
        queue:
          config.limits.max_queue_size === 9999
            ? t("plans.features.unlimited")
            : formatNumber(config.limits.max_queue_size),
        templates: formatNumber(config.limits.max_templates),
      } as any)),
      details: [
        String(t("plans.payment_success.sections.limits.detail_daily", {
          daily: formatNumber(config.limits.daily_emails),
        } as any)),
        String(t("plans.payment_success.sections.limits.detail_queue", {
          queue:
            config.limits.max_queue_size === 9999
              ? t("plans.features.unlimited")
              : formatNumber(config.limits.max_queue_size),
        } as any)),
        String(t("plans.payment_success.sections.limits.detail_templates", {
          templates: formatNumber(config.limits.max_templates),
        } as any)),
      ],
      cta: { label: t("plans.payment_success.ctas.go_settings"), href: "/settings" },
    });

    if (config.features.cloud_sending) {
      premium.push({
        key: "sending",
        title: String(t("plans.payment_success.sections.sending.title")),
        summary: String(t("plans.payment_success.sections.sending.summary")),
        details: [
          String(t("plans.payment_success.sections.sending.detail_1")),
          String(t("plans.payment_success.sections.sending.detail_2")),
        ],
        cta: { label: t("plans.payment_success.ctas.open_queue"), href: "/queue" },
      });
    }

    if (config.features.dns_bounce_check) {
      premium.push({
        key: "dns",
        title: String(t("plans.payment_success.sections.dns.title")),
        summary: String(t("plans.payment_success.sections.dns.summary")),
        details: [
          String(t("plans.payment_success.sections.dns.detail_1")),
          String(t("plans.payment_success.sections.dns.detail_2")),
        ],
        cta: { label: t("plans.payment_success.ctas.open_queue"), href: "/queue" },
      });
    }

    if (config.features.mask_user_agent) {
      premium.push({
        key: "privacy",
        title: String(t("plans.payment_success.sections.privacy.title")),
        summary: String(t("plans.payment_success.sections.privacy.summary")),
        details: [String(t("plans.payment_success.sections.privacy.detail_1"))],
      });
    }

    if (config.features.magic_paste) {
      premium.push({
        key: "magic_paste",
        title: String(t("plans.payment_success.sections.magic_paste.title")),
        summary: String(t("plans.payment_success.sections.magic_paste.summary")),
        details: [
          String(t("plans.payment_success.sections.magic_paste.detail_1")),
          String(t("plans.payment_success.sections.magic_paste.detail_2")),
        ],
        cta: { label: t("plans.payment_success.ctas.open_jobs"), href: "/jobs" },
      });
    }

    if (config.features.ai_email_writer) {
      premium.push({
        key: "ai",
        title: String(t("plans.payment_success.sections.ai.title")),
        summary: String(t("plans.payment_success.sections.ai.summary")),
        details: [
          String(t("plans.payment_success.sections.ai.detail_1")),
          String(t("plans.payment_success.sections.ai.detail_2")),
        ],
        cta: { label: t("plans.payment_success.ctas.open_templates"), href: "/settings/templates" },
      });
    }

    if (config.features.priority_support) {
      premium.push({
        key: "support",
        title: String(t("plans.payment_success.sections.support.title")),
        summary: String(t("plans.payment_success.sections.support.summary")),
        details: [String(t("plans.payment_success.sections.support.detail_1"))],
        cta: { label: t("plans.payment_success.ctas.go_settings"), href: "/settings" },
      });
    }

    if (config.settings.show_housing_icons) {
      premium.push({
        key: "visual",
        title: String(t("plans.payment_success.sections.visual.title")),
        summary: String(t("plans.payment_success.sections.visual.summary")),
        details: [String(t("plans.payment_success.sections.visual.detail_1"))],
        cta: { label: t("plans.payment_success.ctas.open_jobs"), href: "/jobs" },
      });
    }

    if (config.settings.delay_strategy === "human") {
      premium.push({
        key: "delay",
        title: String(t("plans.payment_success.sections.delay.title")),
        summary: String(t("plans.payment_success.sections.delay.summary")),
        details: [
          String(t("plans.payment_success.sections.delay.detail_1")),
          String(t("plans.payment_success.sections.delay.detail_2")),
        ],
        cta: { label: t("plans.payment_success.ctas.open_queue"), href: "/queue" },
      });
    }

    return premium;
  }, [config, t]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("plans.payment_success.title")}</h1>
            <p className="text-muted-foreground">{t("plans.payment_success.subtitle")}</p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {t("plans.payment_success.your_plan")}
            </span>
            <Badge variant="secondary">{t(`plans.tiers.${tier}.label`)}</Badge>
          </CardTitle>
          <CardDescription>
            {refreshing ? t("plans.payment_success.refreshing") : t("plans.payment_success.ready")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tier === "free" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("plans.payment_success.free_note")}</p>
              <Button asChild>
                <a href="/plans">{t("plans.payment_success.ctas.back_plans")}</a>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">{t("plans.payment_success.highlights.daily")}</p>
                    <p className="text-xl font-semibold text-foreground mt-1">
                      {formatNumber(config.limits.daily_emails)}
                      <span className="text-muted-foreground text-sm font-normal">/dia</span>
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">{t("plans.payment_success.highlights.queue")}</p>
                    <p className="text-xl font-semibold text-foreground mt-1">
                      {config.limits.max_queue_size === 9999 ? t("plans.features.unlimited") : formatNumber(config.limits.max_queue_size)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">{t("plans.payment_success.highlights.templates")}</p>
                    <p className="text-xl font-semibold text-foreground mt-1">{formatNumber(config.limits.max_templates)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("plans.payment_success.whats_unlocked")}</CardTitle>
                  <CardDescription>{t("plans.payment_success.whats_unlocked_desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {sections.map((s) => (
                      <AccordionItem key={s.key} value={s.key}>
                        <AccordionTrigger>
                          <div className="text-left">
                            <div className="font-medium text-foreground">{s.title}</div>
                            <div className="text-sm text-muted-foreground mt-0.5">{s.summary}</div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            <ul className="space-y-2">
                              {s.details.map((d, idx) => (
                                <li key={idx} className="flex gap-2 text-sm">
                                  <span className="mt-0.5">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  </span>
                                  <span className="text-foreground">{d}</span>
                                </li>
                              ))}
                            </ul>
                            {s.cta ? (
                              <Button variant="outline" asChild>
                                <a href={s.cta.href} className="inline-flex items-center gap-2">
                                  {s.cta.label}
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="sm:flex-1">
                  <a href="/jobs">{t("plans.payment_success.ctas.start_now")}</a>
                </Button>
                <Button variant="outline" asChild className="sm:flex-1">
                  <a href="/settings/templates">{t("plans.payment_success.ctas.setup_templates")}</a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
