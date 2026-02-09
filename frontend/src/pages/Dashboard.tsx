import { useEffect, useState } from "react";
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
  Info,
  Tractor,
  Building2,
  DollarSign,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/number";
import { Button } from "@/components/ui/button";
import { WarmupStatusWidget } from "@/components/dashboard/WarmupStatusWidget";
import { PromoBanner } from "@/components/dashboard/PromoBanner";
import { getCurrencyForLanguage } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mapeamento de Estados (Sigla -> Nome Completo)
const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const planTier = profile?.plan_tier || "free";
  const isFreeUser = planTier === "free";
  const currency = getCurrencyForLanguage(i18n.resolvedLanguage || i18n.language);

  // --- Dados do Perfil ---
  const creditsUsed = profile?.credits_used_today || 0;
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  const dailyLimit = getPlanLimit(planTier, "daily_emails") + referralBonus;
  const creditsRemaining = Math.max(0, dailyLimit - creditsUsed);
  const usagePercent = dailyLimit > 0 ? (creditsUsed / dailyLimit) * 100 : 0;

  // --- Estados de Dados ---
  const [jobMarketLoading, setJobMarketLoading] = useState(true);
  const [visaCounts, setVisaCounts] = useState<{ h2a: number; h2b: number; early: number }>({
    h2a: 0,
    h2b: 0,
    early: 0,
  });
  const [hotCount, setHotCount] = useState(0);

  // Listas Top 5
  const [topCategories, setTopCategories] = useState<Array<{ name: string; count: number; percent: number }>>([]);
  const [topStates, setTopStates] = useState<Array<{ name: string; count: number; percent: number }>>([]);
  const [topPayingStates, setTopPayingStates] = useState<Array<{ name: string; avgSalary: number }>>([]);

  const [queueCount, setQueueCount] = useState(0);
  const [sentThisMonth, setSentThisMonth] = useState(0);

  // 1. Estatísticas Pessoais
  useEffect(() => {
    if (!profile?.id) return;

    const fetchPersonalStats = async () => {
      const { count: pendingCount } = await supabase
        .from("my_queue")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("status", "pending");
      setQueueCount(pendingCount ?? 0);

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

    fetchPersonalStats();
  }, [profile?.id, creditsUsed]);

  // 2. Dados de Mercado (Paginação Robusta)
  useEffect(() => {
    const fetchMarketData = async () => {
      setJobMarketLoading(true);

      const PAGE_SIZE = 2500;
      let allRows: any[] = [];
      let page = 0;
      let hasMore = true;

      try {
        while (hasMore) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;

          const { data, error } = await supabase
            .from("public_jobs")
            .select("visa_type, category, state, salary, posted_date, job_id")
            .eq("is_active", true)
            .range(from, to);

          if (error) throw error;

          if (data && data.length > 0) {
            allRows = [...allRows, ...data];
            if (data.length < PAGE_SIZE) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        }

        // --- Processamento ---
        const counts = { h2a: 0, h2b: 0, early: 0 };
        const cats = new Map<string, number>();
        const states = new Map<string, number>();
        const salaries = new Map<string, { sum: number; count: number }>();
        let hot = 0;

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        allRows.forEach((job) => {
          const visa = (job.visa_type || "").trim();
          const jobId = (job.job_id || "").toUpperCase();

          if (jobId.startsWith("JO-") || visa.includes("Early Access")) {
            counts.early++;
          } else if (visa === "H-2B") {
            counts.h2b++;
          } else {
            counts.h2a++;
          }

          const c = job.category?.trim();
          if (c) cats.set(c, (cats.get(c) || 0) + 1);

          const s = job.state?.trim();
          if (s) states.set(s, (states.get(s) || 0) + 1);

          if (job.salary && typeof job.salary === "number" && job.salary > 7 && job.salary < 150) {
            const acc = salaries.get(s || "Unknown") || { sum: 0, count: 0 };
            salaries.set(s || "Unknown", { sum: acc.sum + job.salary, count: acc.count + 1 });
          }

          const pDate = new Date(job.posted_date);
          if (!isNaN(pDate.getTime()) && pDate >= yesterday) hot++;
        });

        setVisaCounts(counts);
        setHotCount(hot);

        const totalCats = Array.from(cats.values()).reduce((a, b) => a + b, 0);
        setTopCategories(
          Array.from(cats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({
              name,
              count,
              percent: totalCats > 0 ? (count / totalCats) * 100 : 0,
            })),
        );

        const totalStates = Array.from(states.values()).reduce((a, b) => a + b, 0);
        setTopStates(
          Array.from(states.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({
              name,
              count,
              percent: totalStates > 0 ? (count / totalStates) * 100 : 0,
            })),
        );

        const topSalaries = Array.from(salaries.entries())
          .map(([name, val]) => ({ name, avgSalary: val.sum / val.count, count: val.count }))
          .filter((x) => x.count >= 5)
          .sort((a, b) => b.avgSalary - a.avgSalary)
          .slice(0, 5);

        setTopPayingStates(topSalaries);

        // Define o melhor estado para o card de destaque (o primeiro da lista)
        if (topSalaries.length > 0) {
          setBestPaidState(topSalaries[0]);
        } else {
          setBestPaidState(null);
        }
      } catch (error) {
        console.error("Market data error:", error);
      } finally {
        setJobMarketLoading(false);
      }
    };

    fetchMarketData();
  }, []);

  const bestPaidStateLabel = useMemo(() => {
    if (!bestPaidState) return null;
    const fullName = US_STATES[bestPaidState.name] || bestPaidState.name;
    return { name: fullName, amount: `$${bestPaidState.avgSalary.toFixed(2)} / hour` };
  }, [bestPaidState]);

  const getTimeOfDayGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return t("common.good_morning", "Good Morning");
    if (hours < 18) return t("common.good_afternoon", "Good Afternoon");
    return t("common.good_evening", "Good Evening");
  };

  const planLabel = t(`plans.tiers.${planTier}.label`, { defaultValue: planTier });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8 pb-12 animate-in fade-in duration-700">
        {profile && isFreeUser && currency === "BRL" && <PromoBanner />}

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
                  <span>{t("dashboard.credits.used_today", "Used Today")}</span>
                  <span>{Math.round(usagePercent)}%</span>
                </div>
                {/* Correção: removido indicatorClassName */}
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
              <p className="text-muted-foreground text-sm">Real-time overview of the US Labor Market</p>
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
              <CardContent className="flex-1">
                <ScrollArea className="h-[320px] pr-4">
                  <div className="space-y-5">
                    {jobMarketLoading
                      ? Array(5)
                          .fill(0)
                          .map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)
                      : topCategories.map((cat, i) => (
                          <div key={cat.name} className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-slate-700 truncate max-w-[200px]" title={cat.name}>
                                {cat.name}
                              </span>
                              <span className="font-bold text-slate-900">{formatNumber(cat.count)}</span>
                            </div>
                            {/* Correção: removido indicatorClassName */}
                            <Progress value={cat.percent} className="h-1.5 bg-slate-100" />
                          </div>
                        ))}
                  </div>
                </ScrollArea>
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
              <CardContent className="flex-1">
                <ScrollArea className="h-[320px] pr-4">
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
                              {/* Correção: removido indicatorClassName */}
                              <Progress value={st.percent} className="h-1.5 bg-slate-200" />
                            </div>
                          </div>
                        ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 3. Estados com Melhores Salários (LISTA TOP 5) */}
            <Card className="lg:col-span-1 border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-slate-500" />
                  {t("dashboard.market.best_paid_states", "Highest Paying States")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <ScrollArea className="h-[320px] pr-4">
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
                                ${st.avgSalary.toFixed(2)}{" "}
                                <span className="text-xs font-normal text-emerald-600/70">/ hour</span>
                              </span>
                            </div>
                          </div>
                        ))}
                    {!jobMarketLoading && topPayingStates.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center pt-10">No salary data available.</p>
                    )}
                  </div>
                </ScrollArea>
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
