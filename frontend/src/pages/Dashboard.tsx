import { useEffect, useState, useCallback } from "react";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanLimit } from "@/config/plans.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Mail,
  ListTodo,
  TrendingUp,
  AlertTriangle,
  Rocket,
  Globe,
  Briefcase,
  MapPin,
  Search,
  Zap,
  Eye,
  FileText,
  BarChart3,
  Target,
  Tractor,
  Building2,
  DollarSign,
  Send,
  MousePointerClick,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/number";
import { Button } from "@/components/ui/button";
import { WarmupStatusWidget } from "@/components/dashboard/WarmupStatusWidget";
import { useWarmupStatus } from "@/hooks/useWarmupStatus";

import { getCurrencyForLanguage } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Mapeamento de Estados (Sigla -> Nome Completo)
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const planTier = profile?.plan_tier || "free";
  const isFreeUser = planTier === "free";
  const currency = getCurrencyForLanguage(i18n.resolvedLanguage || i18n.language);

  // Use warmup status as single source of truth for paid users
  const warmup = useWarmupStatus();

  // For free users, use profile data; for paid, use warmup data
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  const dailyLimit = isFreeUser
    ? getPlanLimit(planTier, "daily_emails") + referralBonus
    : warmup.effectiveLimit;
  const creditsUsed = isFreeUser
    ? (profile?.credits_used_today || 0)
    : warmup.emailsSentToday;
  const creditsRemaining = Math.max(0, dailyLimit - creditsUsed);
  const usagePercent = dailyLimit > 0 ? (creditsUsed / dailyLimit) * 100 : 0;

  // --- Store-backed data (survives navigation) ---
  const {
    visaCounts, hotCount, topCategories, topStates, topPayingStates,
    marketDataLastFetchedAt, fetchMarketData,
    queueCount, sentThisMonth, personalLastFetchedAt, fetchPersonalStats,
    totalEmailsSent, totalOpened, totalCvViewed, totalSentItems,
    engagementLastFetchedAt, fetchEngagement,
  } = useDashboardStore();

  const jobMarketLoading = marketDataLastFetchedAt === 0;
  const engagementLoading = engagementLastFetchedAt === 0;

  // Initial fetches (stale-checked)
  useEffect(() => {
    fetchMarketData();
  }, []);

  useEffect(() => {
    if (profile?.id) fetchPersonalStats(profile.id);
  }, [profile?.id, creditsUsed]);

  useEffect(() => {
    if (profile?.id) fetchEngagement(profile.id, (profile as any).emails_sent_total || 0);
  }, [profile?.id, (profile as any)?.emails_sent_total]);

  // Silent refresh on tab focus
  const handleVisibility = useCallback(() => {
    fetchMarketData();
    if (profile?.id) {
      fetchPersonalStats(profile.id);
      fetchEngagement(profile.id, (profile as any).emails_sent_total || 0);
    }
  }, [profile?.id, (profile as any)?.emails_sent_total]);
  useVisibilityRefresh(handleVisibility);

  const getTimeOfDayGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return t("common.good_morning", "Good Morning");
    if (hours < 18) return t("common.good_afternoon", "Good Afternoon");
    return t("common.good_evening", "Good Evening");
  };

  const planLabel = t(`plans.tiers.${planTier}.label`, { defaultValue: planTier });

  // Engagement rates
  const openRate = totalSentItems > 0 ? (totalOpened / totalSentItems) * 100 : 0;
  const cvViewRate = totalSentItems > 0 ? (totalCvViewed / totalSentItems) * 100 : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8 pb-12 animate-in fade-in duration-700">
        

        {/* --- HERO SECTION --- */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="relative z-10 p-8 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div>
                <Badge
                  variant="outline"
                  className="mb-3 border-white/20 text-white/80 bg-white/5 backdrop-blur-md uppercase tracking-wide"
                >
                  {t("dashboard.plan_badge", { plan: planLabel, defaultValue: `${planLabel} Plan` })}
                </Badge>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
                  {getTimeOfDayGreeting()}, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    {profile?.full_name?.split(" ")[0] || t("common.user")}
                  </span>
                </h1>
                <p className="text-slate-400 text-lg mt-2 max-w-md">
                  {t("dashboard.subtitle", {
                    plan: planLabel,
                    defaultValue: `Here is your ${planLabel} account summary`,
                  })}
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button
                  className="bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-lg shadow-white/10"
                  onClick={() => (window.location.href = "/jobs")}
                >
                  <Search className="h-4 w-4 mr-2" /> {t("common.view_all", "Search Jobs")}
                </Button>
                {isFreeUser && (
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => (window.location.href = "/plans")}
                  >
                    <Rocket className="h-4 w-4 mr-2" /> Upgrade Plan
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 lg:max-w-md ml-auto w-full">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm font-medium text-slate-300 uppercase tracking-wider">
                    {t("dashboard.credits.title", "Sending Credits")}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black text-white">{creditsRemaining}</span>
                    <span className="text-sm text-slate-400 font-medium">/ {dailyLimit}</span>
                  </div>
                </div>
                <div className="p-3 bg-primary/20 rounded-full">
                  <Mail className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>{t("dashboard.credits.used_today", "Used Today")}: {creditsUsed}</span>
                  <span>{Math.round(usagePercent)}%</span>
                </div>
                <Progress value={usagePercent} className="h-2.5 bg-slate-700" />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                <div>
                  <p className="text-xs text-slate-400">{t("dashboard.stats.in_queue")}</p>
                  <p className="text-xl font-bold text-white flex items-center gap-2">
                    {formatNumber(queueCount)} <ListTodo className="h-4 w-4 text-amber-400" />
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t("dashboard.stats.this_month")}</p>
                  <p className="text-xl font-bold text-white flex items-center gap-2">
                    {formatNumber(sentThisMonth)} <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Widgets Area */}
        <div className="grid grid-cols-1 gap-6">
          {planTier !== "free" && <WarmupStatusWidget />}

          {isFreeUser && usagePercent >= 80 && (
            <Card className="bg-amber-50 border-amber-200 border-l-4 border-l-amber-500 shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-full text-amber-600 shrink-0">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-lg">{t("dashboard.free_warning.title")}</h4>
                    <p className="text-sm text-amber-700">{t("dashboard.free_warning.description")}</p>
                  </div>
                </div>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm whitespace-nowrap"
                  asChild
                >
                  <a href="/plans">{t("dashboard.free_warning.cta")}</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* --- YOUR PERFORMANCE --- */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {t("dashboard.performance.title", "Your Performance")}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("dashboard.performance.subtitle", "Track your outreach effectiveness")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Emails Sent */}
            <Card className="relative overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mt-8 -mr-8"></div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">
                      {t("dashboard.performance.total_sent", "Total Emails Sent")}
                    </p>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                      {engagementLoading ? (
                        <span className="animate-pulse opacity-50">--</span>
                      ) : (
                        formatNumber(totalSentItems)
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {t("dashboard.performance.all_time", "All time")}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                    <Send className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Open Rate */}
            <Card className="relative overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mt-8 -mr-8"></div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">
                      {t("dashboard.performance.open_rate", "Email Open Rate")}
                    </p>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                      {engagementLoading ? (
                        <span className="animate-pulse opacity-50">--</span>
                      ) : (
                        <>{openRate.toFixed(1)}%</>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {engagementLoading ? "..." : `${formatNumber(totalOpened)} / ${formatNumber(totalSentItems)}`}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
                    <MousePointerClick className="h-5 w-5" />
                  </div>
                </div>
                {!engagementLoading && totalSentItems > 0 && (
                  <Progress value={openRate} className="h-1.5 mt-3 bg-slate-100" />
                )}
              </CardContent>
            </Card>

            {/* CV View Rate */}
            <Card className="relative overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mt-8 -mr-8"></div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">
                      {t("dashboard.performance.cv_view_rate", "CV View Rate")}
                    </p>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                      {engagementLoading ? (
                        <span className="animate-pulse opacity-50">--</span>
                      ) : (
                        <>{cvViewRate.toFixed(1)}%</>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {engagementLoading ? "..." : `${formatNumber(totalCvViewed)} / ${formatNumber(totalSentItems)}`}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                    <Eye className="h-5 w-5" />
                  </div>
                </div>
                {!engagementLoading && totalSentItems > 0 && (
                  <Progress value={cvViewRate} className="h-1.5 mt-3 bg-slate-100" />
                )}
              </CardContent>
            </Card>

            {/* This Month */}
            <Card className="relative overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mt-8 -mr-8"></div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">
                      {t("dashboard.performance.this_month", "Sent This Month")}
                    </p>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                      {formatNumber(sentThisMonth)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {new Date().toLocaleString(i18n.resolvedLanguage || "en", { month: "long" })}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                    <Target className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Insight Banner */}
          {!engagementLoading && totalSentItems >= 10 && (
            <Card className="border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0 mt-0.5">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm mb-1">
                      {t("dashboard.performance.insight_title", "Performance Insight")}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {cvViewRate >= 5
                        ? t("dashboard.performance.insight_good_cv", {
                            rate: cvViewRate.toFixed(1),
                            defaultValue: `Great work! ${cvViewRate.toFixed(1)}% of recruiters viewed your CV — your profile is attracting attention.`,
                          })
                        : openRate >= 20
                          ? t("dashboard.performance.insight_good_open", {
                              rate: openRate.toFixed(1),
                              defaultValue: `Your emails have a ${openRate.toFixed(1)}% open rate. Make sure your CV link is prominent to increase profile views.`,
                            })
                          : t("dashboard.performance.insight_improve", {
                              defaultValue: "Tip: Customize your email templates and resume to improve engagement rates.",
                            })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* --- MARKET INTELLIGENCE --- */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {t("dashboard.market.title", "Job Market Snapshot")}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("dashboard.market.subtitle", "Real-time overview of the US Labor Market")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              loading={jobMarketLoading}
              title="Early Access"
              value={visaCounts.early}
              icon={Rocket}
              color="purple"
              desc={t("dashboard.market.early_access_desc", "Exclusive Jobs")}
            />
            <StatCard
              loading={jobMarketLoading}
              title="H-2A Visa"
              value={visaCounts.h2a}
              icon={Tractor}
              color="emerald"
              desc={t("dashboard.market.h2a_desc", "Agriculture")}
            />
            <StatCard
              loading={jobMarketLoading}
              title="H-2B Visa"
              value={visaCounts.h2b}
              icon={Building2}
              color="blue"
              desc={t("dashboard.market.h2b_desc", "Non-Agricultural")}
            />
            <StatCard
              loading={jobMarketLoading}
              title="Hot Jobs (24h)"
              value={hotCount}
              icon={Zap}
              color="amber"
              desc={t("dashboard.market.hot_jobs_desc", "New Opportunities")}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 1. Categorias */}
            <Card className="lg:col-span-1 border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-slate-500" />
                  {t("dashboard.market.top_categories", "Jobs by category")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <div className="space-y-5">
                  {jobMarketLoading
                    ? Array(5)
                        .fill(0)
                        .map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)
                    : topCategories.map((cat) => (
                        <div key={cat.name} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-slate-700 truncate max-w-[200px]" title={cat.name}>
                              {cat.name}
                            </span>
                            <span className="font-bold text-slate-900">{formatNumber(cat.count)}</span>
                          </div>
                          <Progress value={cat.percent} className="h-1.5 bg-slate-100" />
                        </div>
                      ))}
                </div>
              </CardContent>
            </Card>

            {/* 2. Volume por Estado */}
            <Card className="lg:col-span-1 border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-slate-500" />
                  {t("dashboard.market.top_states", "Most jobs by state")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <div className="space-y-4">
                  {jobMarketLoading
                    ? Array(5)
                        .fill(0)
                        .map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)
                    : topStates.map((st, i) => (
                        <div
                          key={st.name}
                          className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-default group"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-bold text-slate-700 shadow-sm border border-slate-100 group-hover:border-slate-300 transition-colors">
                            {st.name}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-semibold text-slate-800">
                                {US_STATES[st.name] || st.name}
                              </span>
                              <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                {formatNumber(st.count)}
                              </span>
                            </div>
                            <Progress value={st.percent} className="h-1.5 bg-slate-200" />
                          </div>
                        </div>
                      ))}
                </div>
              </CardContent>
            </Card>

            {/* 3. Estados com Melhores Salários */}
            <Card className="lg:col-span-1 border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-slate-500" />
                  {t("dashboard.market.best_paid_states", "Highest Paying States")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <div className="space-y-4">
                  {jobMarketLoading
                    ? Array(5)
                        .fill(0)
                        .map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)
                    : topPayingStates.map((st, i) => (
                        <div
                          key={st.name}
                          className="flex items-center gap-4 p-3 rounded-xl bg-emerald-50/50 hover:bg-emerald-50 transition-colors cursor-default border border-emerald-100/50"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 shadow-sm">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-slate-800 block">
                              {US_STATES[st.name] || st.name}
                            </span>
                            <span className="text-sm font-bold text-emerald-700">
                              Avg. ${st.avgSalary.toFixed(2)}{" "}
                              <span className="text-xs font-normal text-emerald-600/70">/ hour</span>
                            </span>
                          </div>
                        </div>
                      ))}
                  {!jobMarketLoading && topPayingStates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center pt-10">No salary data available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// --- Subcomponents ---

function StatCard({ loading, title, value, icon: Icon, color, desc }: any) {
  const colors: Record<string, string> = {
    purple: "bg-purple-100 text-purple-600 border-purple-200",
    emerald: "bg-emerald-100 text-emerald-600 border-emerald-200",
    blue: "bg-blue-100 text-blue-600 border-blue-200",
    amber: "bg-amber-100 text-amber-600 border-amber-200",
  };

  return (
    <Card
      className={`border-l-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 ${colors[color].replace("bg-", "border-l-")}`}
    >
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
              {loading ? <span className="animate-pulse opacity-50">--</span> : formatNumber(value)}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">{desc}</p>
          </div>
          <div className={`p-2.5 rounded-xl ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
