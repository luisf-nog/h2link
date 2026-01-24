import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanLimit } from '@/config/plans.config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mail, ListTodo, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber } from '@/lib/number';
import { Button } from '@/components/ui/button';


export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const planTier = profile?.plan_tier || 'free';
  const creditsUsed = profile?.credits_used_today || 0;
  const referralBonus = Number((profile as any)?.referral_bonus_limit ?? 0);
  const dailyLimit = getPlanLimit(planTier, 'daily_emails') + referralBonus;
  const creditsRemaining = dailyLimit - creditsUsed;
  const usagePercent = dailyLimit > 0 ? (creditsUsed / dailyLimit) * 100 : 0;

  const [jobMarketLoading, setJobMarketLoading] = useState(false);
  const [jobMarketError, setJobMarketError] = useState<string | null>(null);
  const [visaCounts, setVisaCounts] = useState<{ h2a: number; h2b: number }>({ h2a: 0, h2b: 0 });
  const [hotCount, setHotCount] = useState(0);
  const [topCategories, setTopCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [topStates, setTopStates] = useState<Array<{ name: string; count: number }>>([]);
  const [bestPaidState, setBestPaidState] = useState<{ name: string; avgSalary: number } | null>(null);

  useEffect(() => {
    // Silent timezone auto-detect -> persist to profile
    if (!profile?.id) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || tz === profile.timezone) return;

    (async () => {
      try {
        await supabase.from('profiles').update({ timezone: tz }).eq('id', profile.id);
      } catch {
        // silent best-effort
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const stats = [
    {
      title: t('dashboard.stats.sent_today'),
      value: creditsUsed,
      subtitle: t('dashboard.stats.sent_today_subtitle', { dailyLimit: formatNumber(dailyLimit) }),
      icon: Mail,
      color: 'text-primary',
    },
    {
      title: t('dashboard.stats.in_queue'),
      value: 0,
      subtitle: t('dashboard.stats.in_queue_subtitle'),
      icon: ListTodo,
      color: 'text-plan-gold',
    },
    {
      title: t('dashboard.stats.success_rate'),
      value: '98%',
      subtitle: t('dashboard.stats.success_rate_subtitle'),
      icon: Zap,
      color: 'text-success',
    },
    {
      title: t('dashboard.stats.this_month'),
      value: 0,
      subtitle: t('dashboard.stats.this_month_subtitle'),
      icon: TrendingUp,
      color: 'text-plan-diamond',
    },
  ];

  useEffect(() => {
    const fetchJobMarket = async () => {
      setJobMarketLoading(true);
      setJobMarketError(null);

      // We aggregate client-side and paginate because the backend caps at 1000 rows per request.
      const pageSize = 1000;
      const maxPages = 25; // safety cap (25k rows)

      const byVisa = { h2a: 0, h2b: 0 };
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
            .from('public_jobs')
            .select('visa_type, category, state, salary, posted_date')
            .range(from, to);

          if (error) throw error;
          const rows = (data ?? []) as Array<{
            visa_type: string | null;
            category: string | null;
            state: string;
            salary: number | null;
            posted_date: string;
          }>;

          for (const r of rows) {
            const visa = String(r.visa_type ?? '').trim();
            if (visa === 'H-2A') byVisa.h2a += 1;
            else byVisa.h2b += 1;

            const cat = String(r.category ?? '').trim();
            if (cat) byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);

            const st = String(r.state ?? '').trim();
            if (st) byState.set(st, (byState.get(st) ?? 0) + 1);

            if (typeof r.salary === 'number' && Number.isFinite(r.salary)) {
              const acc = salaryByState.get(st) ?? { sum: 0, count: 0 };
              salaryByState.set(st, { sum: acc.sum + r.salary, count: acc.count + 1 });
            }

            // posted_date is a DATE (YYYY-MM-DD)
            const d = new Date(`${r.posted_date}T00:00:00Z`);
            if (!Number.isNaN(d.getTime()) && d >= yesterdayUtc) hot += 1;
          }

          if (!data || data.length < pageSize) break;
        }

        setVisaCounts(byVisa);
        setHotCount(hot);

        const catsSorted = Array.from(byCategory.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        setTopCategories(catsSorted);

        const statesSorted = Array.from(byState.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopStates(statesSorted);

        const best = Array.from(salaryByState.entries())
          .map(([name, v]) => ({ name, avgSalary: v.count ? v.sum / v.count : 0 }))
          .filter((x) => x.avgSalary > 0)
          .sort((a, b) => b.avgSalary - a.avgSalary)[0];
        setBestPaidState(best ? { name: best.name, avgSalary: best.avgSalary } : null);
      } catch (e: any) {
        console.error('Error fetching job market metrics:', e);
        setJobMarketError(e?.message ?? 'Error');
      } finally {
        setJobMarketLoading(false);
      }
    };

    // reset hotCount before fetch
    setHotCount(0);
    fetchJobMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bestPaidStateLabel = useMemo(() => {
    if (!bestPaidState) return '-';
    return `${bestPaidState.name} ($${bestPaidState.avgSalary.toFixed(2)}/h)`;
  }, [bestPaidState]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t('dashboard.greeting', { name: profile?.full_name?.split(' ')[0] || t('common.user') })} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('dashboard.subtitle', { plan: t(`plans.tiers.${planTier}.label`) })}
        </p>
      </div>

      

      {/* Credits Card */}
      <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t('dashboard.credits.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.credits.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-4xl font-bold text-foreground">{creditsRemaining}</span>
                <span className="text-muted-foreground ml-2">{t('dashboard.credits.remaining')}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {t('dashboard.credits.used', { used: formatNumber(creditsUsed), dailyLimit: formatNumber(dailyLimit) })}
              </span>
            </div>
            <Progress value={usagePercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Free warning (kamikaze mode) */}
      {planTier === 'free' && usagePercent >= 60 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              {t('dashboard.free_warning.title')}
            </CardTitle>
            <CardDescription>{t('dashboard.free_warning.description')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" asChild>
              <a href="/plans">{t('dashboard.free_warning.cta')}</a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Job Market */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.market.title')}</CardTitle>
          <CardDescription>{t('dashboard.market.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {jobMarketError ? (
            <p className="text-sm text-destructive">{t('dashboard.market.error')}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/60">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{t('dashboard.market.visa_h2a')}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{jobMarketLoading ? '—' : formatNumber(visaCounts.h2a)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{t('dashboard.market.visa_h2b')}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{jobMarketLoading ? '—' : formatNumber(visaCounts.h2b)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{t('dashboard.market.hot_last_day')}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{jobMarketLoading ? '—' : formatNumber(hotCount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{t('dashboard.market.best_paid_state')}</p>
                    <p className="text-lg font-semibold text-foreground mt-1">{jobMarketLoading ? '—' : bestPaidStateLabel}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('dashboard.market.top_categories')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(jobMarketLoading ? [] : topCategories).map((c) => (
                        <div key={c.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <span className="text-sm text-foreground truncate">{c.name}</span>
                          <span className="text-sm font-semibold text-foreground">{formatNumber(c.count)}</span>
                        </div>
                      ))}
                      {!jobMarketLoading && topCategories.length === 0 && (
                        <p className="text-sm text-muted-foreground">{t('dashboard.market.no_data')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('dashboard.market.top_states')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(jobMarketLoading ? [] : topStates).map((s) => (
                        <div key={s.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <span className="text-sm text-foreground">{s.name}</span>
                          <span className="text-sm font-semibold text-foreground">{formatNumber(s.count)}</span>
                        </div>
                      ))}
                      {!jobMarketLoading && topStates.length === 0 && (
                        <p className="text-sm text-muted-foreground">{t('dashboard.market.no_data')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.next_steps.title')}</CardTitle>
          <CardDescription>
            {t('dashboard.next_steps.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/jobs"
              className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {t('dashboard.next_steps.step1_title')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('dashboard.next_steps.step1_desc')}
              </p>
            </a>
            <a
              href="/queue"
              className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {t('dashboard.next_steps.step2_title')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('dashboard.next_steps.step2_desc')}
              </p>
            </a>
            <a
              href="/queue"
              className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {t('dashboard.next_steps.step3_title')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('dashboard.next_steps.step3_desc')}
              </p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
