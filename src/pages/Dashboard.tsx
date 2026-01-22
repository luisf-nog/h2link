import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, getPlanLimit } from '@/config/plans.config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mail, ListTodo, Zap, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const planTier = profile?.plan_tier || 'free';
  const planConfig = PLANS_CONFIG[planTier];
  const creditsUsed = profile?.credits_used_today || 0;
  const dailyLimit = getPlanLimit(planTier, 'daily_emails');
  const creditsRemaining = dailyLimit - creditsUsed;
  const usagePercent = (creditsUsed / dailyLimit) * 100;

  const stats = [
    {
      title: 'Envios Hoje',
      value: creditsUsed,
      subtitle: `de ${dailyLimit} disponíveis`,
      icon: Mail,
      color: 'text-primary',
    },
    {
      title: 'Na Fila',
      value: 0,
      subtitle: 'vagas aguardando',
      icon: ListTodo,
      color: 'text-plan-gold',
    },
    {
      title: 'Taxa de Sucesso',
      value: '98%',
      subtitle: 'emails entregues',
      icon: Zap,
      color: 'text-success',
    },
    {
      title: 'Este Mês',
      value: 0,
      subtitle: 'aplicações enviadas',
      icon: TrendingUp,
      color: 'text-plan-diamond',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Aqui está o resumo da sua conta {planConfig.label}
        </p>
      </div>

      {/* Credits Card */}
      <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Créditos de Envio
          </CardTitle>
          <CardDescription>
            Seu limite diário de emails é resetado à meia-noite
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-4xl font-bold text-foreground">{creditsRemaining}</span>
                <span className="text-muted-foreground ml-2">restantes</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {creditsUsed} / {dailyLimit} usados
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
          <CardTitle>Próximos Passos</CardTitle>
          <CardDescription>
            Comece a aplicar para vagas H-2B agora
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/jobs"
              className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                1. Buscar Vagas
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Explore vagas H-2B disponíveis
              </p>
            </a>
            <a
              href="/queue"
              className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                2. Montar Fila
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione vagas à sua fila de envio
              </p>
            </a>
            <a
              href="/queue"
              className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                3. Enviar Emails
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Dispare suas aplicações em massa
              </p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
