import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanLimit } from "@/config/plans.config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowRight,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/number";
import { Button } from "@/components/ui/button";
import { WarmupStatusWidget } from "@/components/dashboard/WarmupStatusWidget";
import { PromoBanner } from "@/components/dashboard/PromoBanner";
import { getCurrencyForLanguage } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const planTier = profile?.plan_tier || "free";
  const isFreeUser = planTier === "free";
  const currency = getCurrencyForLanguage(i18n.resolvedLanguage || i18n.language);

  // Créditos e Limites
  const creditsUsed = profile?.credits_used_today || 0;
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  const dailyLimit = getPlanLimit(planTier, "daily_emails") + referralBonus;
  const creditsRemaining = Math.max(0, dailyLimit - creditsUsed);
  const usagePercent = dailyLimit > 0 ? (creditsUsed / dailyLimit) * 100 : 0;

  // Estados
  const [jobMarketLoading, setJobMarketLoading] = useState(false);
  const [jobMarketError, setJobMarketError] = useState<string | null>(null);
  const [visaCounts, setVisaCounts] = useState<{ h2a: number; h2b: number; early: number }>({
    h2a: 0,
    h2b: 0,
    early: 0,
  });
  const [hotCount, setHotCount] = useState(0);
  const [topCategories, setTopCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [topStates, setTopStates] = useState<Array<{ name: string; count: number }>>([]);
  const [bestPaidState, setBestPaidState] = useState<{ name: string; avgSalary: number } | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [sentThisMonth, setSentThisMonth] = useState(0);

  // Busca estatísticas pessoais (Fila e Envios)
  useEffect(() => {
    if (!profile?.id) return;

    const fetchStats = async () => {
      // 1. Contagem da Fila (Pendentes)
      const { count: pendingCount } = await supabase
        .from("my_queue")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("status", "pending");

      setQueueCount(pendingCount ?? 0);

      // 2. Contagem Real de Envios no Mês Atual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthCount } = await supabase
        .from("queue_send_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("status", "sent")
        .gte("sent_at", startOfMonth.toISOString());

      setSentThisMonth(monthCount ?? 0);
    };

    fetchStats();
  }, [profile?.id, creditsUsed]);

  // Atualização silenciosa de timezone
  useEffect(() => {
    if (!profile?.id) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || tz === profile.timezone) return;
    (async () => {
      try {
        await supabase.from("profiles").update({ timezone: tz }).eq("id", profile.id);
      } catch {}
    })();
  }, [profile?.id, profile?.timezone]);

  // Busca dados de Mercado
  useEffect(() => {
    const fetchJobMarket = async () => {
      setJobMarketLoading(true);
      setJobMarketError(null);

      const pageSize = 1000;
      const maxPages = 25;

      const byVisa = { h2a: 0, h2b: 0, early: 0 };
      const byCategory = new Map<string, number>();
      const byState = new Map<string, number>();
      const salaryByState = new Map<string, { sum: number; count: number }>();
      let hot = 0;

      const now = new Date();
      const yesterdayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));

      try {
        for (let page = 0; page < maxPages; page++) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data, error } = await supabase
            .from("public_jobs")
            .select("visa_type, category, state, salary, posted_date, job_id")
            .range(from, to);

          if (error) throw error;
          const rows = data || [];

          for (const r of rows) {
            const visa = String(r.visa_type ?? "").trim();
            const jobId = String(r.job_id ?? "").toUpperCase();

            // Lógica de Contagem: Early Access tem prioridade, depois H-2B, resto H-2A
            if (jobId.startsWith("JO-") || visa.includes("Early Access")) {
              byVisa.early += 1;
            } else if (visa === "H-2B") {
              byVisa.h2b += 1;
            } else {
              byVisa.h2a += 1;
            }

            const cat = String(r.category ?? "").trim();
            if (cat) byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);

            const st = String(r.state ?? "").trim();
            if (st) byState.set(st, (byState.get(st) ?? 0) + 1);

            if (typeof r.salary === "number" && Number.isFinite(r.salary)) {
              const acc = salaryByState.get(st) ?? { sum: 0, count: 0 };
              salaryByState.set(st, { sum: acc.sum + r.salary, count: acc.count + 1 });
            }

            const d = new Date(`${r.posted_date}T00:00:00Z`);
            if (!Number.isNaN(d.getTime()) && d >= yesterdayUtc) hot += 1;
          }

          if (!data || data.length < pageSize) break;
        }

        setVisaCounts(byVisa);
        setHotCount(hot);

        setTopCategories(
          Array.from(byCategory.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        );

        setTopStates(
          Array.from(byState.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        );

        const best = Array.from(salaryByState.entries())
          .map(([name, v]) => ({ name, avgSalary: v.count ? v.sum / v.count : 0 }))
          .filter((x) => x.avgSalary > 0)
          .sort((a, b) => b.avgSalary - a.avgSalary)[0];
        setBestPaidState(best ? { name: best.name, avgSalary: best.avgSalary } : null);
      } catch (e: any) {
        console.error("Error fetching job market metrics:", e);
        setJobMarketError(e?.message ?? "Error");
      } finally {
        setJobMarketLoading(false);
      }
    };

    fetchJobMarket();
  }, []);

  const bestPaidStateLabel = useMemo(() => {
    if (!bestPaidState) return "-";
    return `${bestPaidState.name} ($${bestPaidState.avgSalary.toFixed(2)}/h)`;
  }, [bestPaidState]);

  const getTimeOfDayGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return t("common.good_morning", "Good Morning");
    if (hours < 18) return t("common.good_afternoon", "Good Afternoon");
    return t("common.good_evening", "Good Evening");
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Banner Promocional para usuários Free BR */}
      {profile && isFreeUser && currency === "BRL" && <PromoBanner />}

      {/* HEADER SECTION: Welcome & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Welcome Card */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 border-slate-200">
          <CardContent className="p-8 flex flex-col justify-center h-full">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-slate-800">
                {getTimeOfDayGreeting()}, {profile?.full_name?.split(" ")[0] || t("common.user")}! 👋
              </h1>
              <p className="text-slate-500 text-lg">
                {t("dashboard.subtitle", { plan: t(`plans.tiers.${planTier}.label`) })}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8">
              {/* Stat: Queue */}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-amber-500" /> {t("dashboard.stats.in_queue")}
                </span>
                <span className="text-2xl font-bold text-slate-800">{formatNumber(queueCount)}</span>
              </div>

              {/* Stat: Sent Month */}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> {t("dashboard.stats.this_month")}
                </span>
                <span className="text-2xl font-bold text-slate-800">{formatNumber(sentThisMonth)}</span>
              </div>

              {/* Stat: Hot Jobs */}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" /> {t("dashboard.market.hot_last_day")}
                </span>
                <span className="text-2xl font-bold text-slate-800">
                  {jobMarketLoading ? "..." : formatNumber(hotCount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits Status Card (Destaque) */}
        <Card className="bg-slate-900 text-white border-slate-800 overflow-hidden relative">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl"></div>

          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="flex items-center gap-2 text-primary-foreground">
              <Mail className="h-5 w-5" />
              {t("dashboard.credits.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex flex-col h-full justify-between gap-6">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight">{creditsRemaining}</span>
                  <span className="text-slate-400 font-medium">{t("dashboard.credits.remaining")}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  {t("dashboard.credits.used", {
                    used: formatNumber(creditsUsed),
                    dailyLimit: formatNumber(dailyLimit),
                  })}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0%</span>
                  <span>{Math.round(usagePercent)}%</span>
                </div>
                <Progress value={usagePercent} className="h-2 bg-slate-800" indicatorClassName="bg-primary" />
              </div>

              {isFreeUser && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => (window.location.href = "/plans")}
                >
                  <Rocket className="h-4 w-4 mr-2" /> {t("plans.actions.subscribe_now")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Widgets & Warnings Area */}
      <div className="grid grid-cols-1 gap-6">
        {planTier !== "free" && <WarmupStatusWidget />}

        {isFreeUser && usagePercent >= 80 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900">{t("dashboard.free_warning.title")}</h4>
                  <p className="text-sm text-amber-700">{t("dashboard.free_warning.description")}</p>
                </div>
              </div>
              <Button variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100" asChild>
                <a href="/plans">{t("dashboard.free_warning.cta")}</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* MARKET INTELLIGENCE SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {t("dashboard.market.title")}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => (window.location.href = "/jobs")}
          >
            {t("common.view_all")} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Visa Type Cards (Contadores) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Early Access */}
          <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-purple-600 mb-1 flex items-center gap-1">
                    <Rocket className="h-3 w-3" /> Early Access
                  </p>
                  <h3 className="text-3xl font-bold text-slate-900">
                    {jobMarketLoading ? "..." : formatNumber(visaCounts.early)}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Vagas exclusivas</p>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Rocket className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* H-2A */}
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">H-2A Visa</p>
                  <h3 className="text-3xl font-bold text-slate-900">
                    {jobMarketLoading ? "..." : formatNumber(visaCounts.h2a)}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Agricultura</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* H-2B */}
          <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-emerald-600 mb-1">H-2B Visa</p>
                  <h3 className="text-3xl font-bold text-slate-900">
                    {jobMarketLoading ? "..." : formatNumber(visaCounts.h2b)}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Não-agrícola</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Briefcase className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Lists Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Categories */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-slate-500" />
                {t("dashboard.market.top_categories")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {jobMarketLoading ? (
                  <div className="space-y-2">
                    <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
                    <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
                    <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
                  </div>
                ) : topCategories.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("dashboard.market.no_data")}</p>
                ) : (
                  topCategories.map((cat, i) => (
                    <div key={cat.name} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className="w-6 h-6 flex items-center justify-center rounded-full p-0 text-xs font-mono"
                        >
                          {i + 1}
                        </Badge>
                        <span
                          className="text-sm font-medium text-slate-700 truncate max-w-[180px] sm:max-w-xs"
                          title={cat.name}
                        >
                          {cat.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{formatNumber(cat.count)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top States & Best Paid */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {t("dashboard.market.top_states")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {jobMarketLoading ? (
                    <div className="space-y-2">
                      <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
                      <div className="h-8 bg-slate-100 rounded w-full animate-pulse" />
                    </div>
                  ) : topStates.length === 0 ? (
                    <p className="text-sm text-slate-500">{t("dashboard.market.no_data")}</p>
                  ) : (
                    topStates.map((st, i) => (
                      <div key={st.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className="w-6 h-6 flex items-center justify-center rounded-full p-0 text-xs font-mono bg-slate-50"
                          >
                            {i + 1}
                          </Badge>
                          <span className="text-sm font-medium text-slate-700">{st.name}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{formatNumber(st.count)}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Best Paid State Highlight */}
            <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <Zap className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    {t("dashboard.market.best_paid_state")}
                  </p>
                  <p className="text-lg font-bold text-slate-900">{jobMarketLoading ? "..." : bestPaidStateLabel}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">{t("dashboard.next_steps.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 group"
            onClick={() => (window.location.href = "/jobs")}
          >
            <Search className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
            <span className="font-semibold text-slate-700 group-hover:text-primary">
              {t("dashboard.next_steps.step1_title")}
            </span>
            <span className="text-xs text-slate-500 font-normal">{t("dashboard.next_steps.step1_desc")}</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 group"
            onClick={() => (window.location.href = "/queue")}
          >
            <ListTodo className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
            <span className="font-semibold text-slate-700 group-hover:text-primary">
              {t("dashboard.next_steps.step2_title")}
            </span>
            <span className="text-xs text-slate-500 font-normal">{t("dashboard.next_steps.step2_desc")}</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 group"
            onClick={() => (window.location.href = "/settings")}
          >
            <Mail className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
            <span className="font-semibold text-slate-700 group-hover:text-primary">
              {t("dashboard.next_steps.step3_title")}
            </span>
            <span className="text-xs text-slate-500 font-normal">{t("dashboard.next_steps.step3_desc")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
