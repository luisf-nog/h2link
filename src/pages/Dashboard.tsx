import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, getPlanLimit } from '@/config/plans.config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mail, ListTodo, Zap, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const planTier = profile?.plan_tier || 'free';
  const planConfig = PLANS_CONFIG[planTier];
  const creditsUsed = profile?.credits_used_today || 0;
  const dailyLimit = getPlanLimit(planTier, 'daily_emails');
  const creditsRemaining = dailyLimit - creditsUsed;
  const usagePercent = (creditsUsed / dailyLimit) * 100;

  const stats = [
    {
      title: t('dashboard.stats.sent_today'),
      value: creditsUsed,
      subtitle: t('dashboard.stats.sent_today_subtitle', { dailyLimit }),
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
                {t('dashboard.credits.used', { used: creditsUsed, dailyLimit })}
              </span>
            </div>
            <Progress value={usagePercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
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
