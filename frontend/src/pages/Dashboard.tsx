import { useEffect, useMemo, useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { getPlanLimit } from '@/config/plans.config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  Info,
  Tractor,
  Building2,
  Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber } from '@/lib/number';
import { Button } from '@/components/ui/button';
import { WarmupStatusWidget } from '@/components/dashboard/WarmupStatusWidget';
import { PromoBanner } from '@/components/dashboard/PromoBanner';
import { getCurrencyForLanguage } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Dashboard() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const planTier = profile?.plan_tier || 'free';
  const isFreeUser = planTier === 'free';
  const currency = getCurrencyForLanguage(i18n.resolvedLanguage || i18n.language);
  
  // Dados do Perfil
  const creditsUsed = profile?.credits_used_today || 0;
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  const dailyLimit = getPlanLimit(planTier, 'daily_emails') + referralBonus;
  const creditsRemaining = Math.max(0, dailyLimit - creditsUsed);
  const usagePercent = dailyLimit > 0 ? (creditsUsed / dailyLimit) * 100 : 0;

  // Estados de Carregamento e Dados
  const [jobMarketLoading, setJobMarketLoading] = useState(true);
  const [visaCounts, setVisaCounts] = useState<{ h2a: number; h2b: number; early: number }>({ h2a: 0, h2b: 0, early: 0 });
  const [hotCount, setHotCount] = useState(0);
  const [topCategories, setTopCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [topStates, setTopStates] = useState<Array<{ name: string; count: number }>>([]);
  const [bestPaidState, setBestPaidState] = useState<{ name: string; avgSalary: number } | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [sentThisMonth, setSentThisMonth] = useState(0);

  // 1. Carregar Estatísticas Pessoais (Rápido)
  useEffect(() => {
    if (!profile?.id) return;
    
    const fetchPersonalStats = async () => {
      // Fila Pendente
      const { count: pendingCount } = await supabase
        .from('my_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('status', 'pending');
      setQueueCount(pendingCount ?? 0);

      // Envios do Mês
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count: monthCount } = await supabase
        .from('queue_send_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('status', 'sent')
        .gte('sent_at', startOfMonth.toISOString());
      setSentThisMonth(monthCount ?? 0);
    };
    
    fetchPersonalStats();
  }, [profile?.id, creditsUsed]);

  // 2. Carregar Dados de Mercado (Otimizado para Performance)
  useEffect(() => {
    const fetchMarketData = async () => {
      setJobMarketLoading(true);
      try {
        // A. Contagem Rápida de Totais (Parallel Requests)
        // Usamos 'head: true' para não baixar o JSON, apenas contar. Muito mais rápido.
        const [h2aReq, h2bReq, earlyReq] = await Promise.all([
            supabase.from('public_jobs').select('*', { count: 'exact', head: true }).eq('visa_type', 'H-2A'),
            supabase.from('public_jobs').select('*', { count: 'exact', head: true }).eq('visa_type', 'H-2B'),
            // Early access filter aproximado para performance
            supabase.from('public_jobs').select('*', { count: 'exact', head: true }).or('job_id.ilike.JO-%,visa_type.ilike.%Early Access%')
        ]);

        setVisaCounts({
            h2a: h2aReq.count || 0,
            h2b: h2bReq.count || 0,
            early: earlyReq.count || 0
        });

        // B. Análise de Tendências (Apenas as últimas 1000 vagas)
        // Em vez de ler o banco todo, lemos apenas o "agora" para definir tendências.
        const { data: recentJobs } = await supabase
            .from('public_jobs')
            .select('category, state, salary, posted_date')
            .order('posted_date', { ascending: false })
            .limit(1000);

        if (recentJobs) {
            const byCategory = new Map<string, number>();
            const byState = new Map<string, number>();
            const salaryByState = new Map<string, { sum: number; count: number }>();
            let hot = 0;
            const yesterdayUtc = new Date();
            yesterdayUtc.setDate(yesterdayUtc.getDate() - 1);

            for (const job of recentJobs) {
                // Categorias
                const cat = job.category?.trim();
                if (cat) byCategory.set(cat, (byCategory.get(cat) || 0) + 1);

                // Estados
                const st = job.state?.trim();
                if (st) byState.set(st, (byState.get(st) || 0) + 1);

                // Salário
                if (job.salary && typeof job.salary === 'number') {
                    const acc = salaryByState.get(st || 'Unknown') || { sum: 0, count: 0 };
                    salaryByState.set(st || 'Unknown', { sum: acc.sum + job.salary, count: acc.count + 1 });
                }

                // Hot Count (Últimas 24h)
                const postDate = new Date(job.posted_date);
                if (postDate >= yesterdayUtc) hot++;
            }

            setHotCount(hot);
            
            setTopCategories(
                Array.from(byCategory.entries())
                .sort((a, b) => b.1 - a.1)
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }))
            );

            setTopStates(
                Array.from(byState.entries())
                .sort((a, b) => b.1 - a.1)
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }))
            );

            const bestState = Array.from(salaryByState.entries())
                .map(([name, val]) => ({ name, avgSalary: val.sum / val.count }))
                .sort((a, b) => b.avgSalary - a.avgSalary)[0];
            
            setBestPaidState(bestState || null);
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
    if (!bestPaidState) return '-';
    return `${bestPaidState.name} ($${bestPaidState.avgSalary.toFixed(2)}/h)`;
  }, [bestPaidState]);

  const getTimeOfDayGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return t('common.good_morning', 'Good Morning');
    if (hours < 18) return t('common.good_afternoon', 'Good Afternoon');
    return t('common.good_evening', 'Good Evening');
  };

  // Componente auxiliar para Card de Info
  const InfoCard = ({ title, value, sub, icon: Icon, colorClass, tooltip }: any) => (
    <Card className="hover:shadow-md transition-all duration-200 border-border/60">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              {title}
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-primary transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              )}
            </p>
            <h4 className="text-2xl font-bold text-foreground tracking-tight">{value}</h4>
            {sub && <p className="text-xs text-muted-foreground font-medium">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-8 pb-12 animate-in fade-in duration-500">
        
        {/* Banner Promocional (Apenas Free BR) */}
        {profile && isFreeUser && currency === 'BRL' && <PromoBanner />}

        {/* HERO SECTION: Saudação e Painel de Controle Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card de Boas Vindas e Resumo */}
          <Card className="lg:col-span-2 border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            
            <CardContent className="p-8 flex flex-col justify-center h-full relative z-10">
              <div className="space-y-2 mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  {getTimeOfDayGreeting()}, <span className="text-primary">{profile?.full_name?.split(' ')[0] || t('common.user')}</span>!
                </h1>
                <p className="text-muted-foreground text-lg max-w-xl">
                  {t('dashboard.subtitle', { plan: t(`plans.tiers.${planTier}.label`) })}. 
                  {planTier === 'free' 
                    ? " Atualize seu plano para remover limites diários." 
                    : " Você está operando com potência máxima."}
                </p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                 <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                      <ListTodo className="h-3.5 w-3.5 text-amber-500" /> {t('dashboard.stats.in_queue')}
                    </span>
                    <span className="text-2xl font-bold text-foreground">{formatNumber(queueCount)}</span>
                 </div>
                 
                 <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> {t('dashboard.stats.this_month')}
                    </span>
                    <span className="text-2xl font-bold text-foreground">{formatNumber(sentThisMonth)}</span>
                 </div>

                 <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-yellow-500" /> {t('dashboard.market.hot_last_day')}
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {jobMarketLoading ? <span className="animate-pulse">...</span> : formatNumber(hotCount)}
                    </span>
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* Card de Créditos Diários (Visual de "Tanque de Combustível") */}
          <Card className="bg-slate-900 dark:bg-black text-white border-slate-800 shadow-xl overflow-hidden relative flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/10 pointer-events-none" />
            
            <CardHeader className="pb-2 relative z-10">
              <div className="flex justify-between items-start">
                <CardTitle className="flex items-center gap-2 text-white/90">
                  <Mail className="h-5 w-5 text-primary" />
                  <span className="font-semibold tracking-wide">Envios Hoje</span>
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-slate-500 hover:text-white transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Seu limite renova a cada 24h.
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>

            <CardContent className="relative z-10 flex-1 flex flex-col justify-end gap-6">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black tracking-tighter text-white">{creditsRemaining}</span>
                  <span className="text-sm text-slate-400 font-medium uppercase tracking-widest mb-2 ml-2">Restantes</span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-400 mt-2">
                  <span>Usado: {formatNumber(creditsUsed)}</span>
                  <span>Limite: {formatNumber(dailyLimit)}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Progress value={usagePercent} className="h-2 bg-slate-800" indicatorClassName={usagePercent > 90 ? 'bg-red-500' : 'bg-primary'} />
                {usagePercent >= 100 && (
                  <p className="text-xs text-red-400 font-medium text-center animate-pulse">Limite diário atingido!</p>
                )}
              </div>

              {isFreeUser && (
                <Button 
                  className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold transition-all hover:scale-[1.02]" 
                  size="sm" 
                  onClick={() => window.location.href='/plans'}
                >
                  <Rocket className="h-4 w-4 mr-2 text-primary" /> Aumentar Limite
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas e Warmup */}
        <div className="grid grid-cols-1 gap-6">
          {planTier !== 'free' && <WarmupStatusWidget />}
          
          {isFreeUser && usagePercent >= 80 && (
            <Card className="bg-amber-50 border-amber-200 shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-full text-amber-600 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">{t('dashboard.free_warning.title')}</h4>
                    <p className="text-sm text-amber-700">{t('dashboard.free_warning.description')}</p>
                  </div>
                </div>
                <Button variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0 w-full sm:w-auto" asChild>
                  <a href="/plans">{t('dashboard.free_warning.cta')}</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* MARKET INTELLIGENCE SECTION */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Globe className="h-6 w-6 text-blue-600" />
                    {t('dashboard.market.title')}
                </h2>
                <p className="text-muted-foreground text-sm">Panorama atualizado do mercado de trabalho H-2A e H-2B nos EUA.</p>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => window.location.href='/jobs'}>
                  {t('common.view_all')} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
          </div>

          {/* Cards de Tipos de Visto (Destaque Visual) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <InfoCard 
                title="Early Access" 
                sub="Vagas Exclusivas & Novas"
                value={jobMarketLoading ? '...' : formatNumber(visaCounts.early)}
                icon={Rocket}
                colorClass="bg-purple-100 text-purple-600"
                tooltip="Vagas recém-adicionadas disponíveis primeiro aqui antes de outros sites."
              />
              <InfoCard 
                title="H-2A (Agricultura)" 
                sub="Trabalho no Campo"
                value={jobMarketLoading ? '...' : formatNumber(visaCounts.h2a)}
                icon={Tractor}
                colorClass="bg-emerald-100 text-emerald-600"
                tooltip="Vistos para trabalho agrícola temporário ou sazonal."
              />
              <InfoCard 
                title="H-2B (Não-Agrícola)" 
                sub="Construção, Hotelaria, etc."
                value={jobMarketLoading ? '...' : formatNumber(visaCounts.h2b)}
                icon={Building2}
                colorClass="bg-blue-100 text-blue-600"
                tooltip="Vistos para trabalho temporário não-agrícola."
              />
          </div>

          {/* Listas Top 5 (Categorias e Estados) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Categorias */}
              <Card className="flex flex-col h-full border-border/60">
                  <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
                      <CardTitle className="text-base flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-slate-500" />
                          {t('dashboard.market.top_categories')}
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 flex-1">
                      <div className="space-y-3">
                          {jobMarketLoading ? (
                              [1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)
                          ) : topCategories.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t('dashboard.market.no_data')}</p>
                          ) : (
                              topCategories.map((cat, i) => (
                                  <div key={cat.name} className="flex items-center justify-between group p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors">
                                      <div className="flex items-center gap-3 overflow-hidden">
                                          <Badge variant="secondary" className="w-6 h-6 flex shrink-0 items-center justify-center rounded-full p-0 text-[10px] font-mono">
                                              {i + 1}
                                          </Badge>
                                          <span className="text-sm font-medium text-foreground truncate" title={cat.name}>
                                              {cat.name}
                                          </span>
                                      </div>
                                      <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">{formatNumber(cat.count)}</span>
                                  </div>
                              ))
                          )}
                      </div>
                  </CardContent>
              </Card>

              <div className="flex flex-col gap-6">
                  {/* Estados */}
                  <Card className="border-border/60 flex-1">
                      <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
                          <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-500" />
                              {t('dashboard.market.top_states')}
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                          <div className="space-y-3">
                              {jobMarketLoading ? (
                                  [1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)
                              ) : topStates.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">{t('dashboard.market.no_data')}</p>
                              ) : (
                                  topStates.map((st, i) => (
                                      <div key={st.name} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors">
                                          <div className="flex items-center gap-3">
                                              <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full p-0 text-[10px] font-mono">
                                                  {i + 1}
                                              </Badge>
                                              <span className="text-sm font-medium text-foreground">{st.name}</span>
                                          </div>
                                          <span className="text-sm font-bold text-muted-foreground">{formatNumber(st.count)}</span>
                                      </div>
                                  ))
                              )}
                          </div>
                      </CardContent>
                  </Card>

                  {/* Estado com Melhor Salário (Destaque) */}
                  <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100 dark:from-emerald-950 dark:to-teal-950 dark:border-emerald-900">
                      <CardContent className="p-5 flex items-center gap-5">
                          <div className="p-3 bg-white dark:bg-black/20 rounded-full shadow-sm shrink-0">
                              <DollarSignIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide mb-1">
                                  {t('dashboard.market.best_paid_state')}
                              </p>
                              <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                                  {jobMarketLoading ? '...' : bestPaidStateLabel}
                              </p>
                              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">Média salarial baseada nas vagas recentes.</p>
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </div>
        </div>

        {/* QUICK ACTIONS FOOTER */}
        <div className="pt-4 border-t border-border">
          <h2 className="text-lg font-bold text-foreground mb-4">{t('dashboard.next_steps.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionButton 
                icon={Search} 
                title={t('dashboard.next_steps.step1_title')} 
                desc={t('dashboard.next_steps.step1_desc')} 
                href="/jobs" 
              />
              <ActionButton 
                icon={ListTodo} 
                title={t('dashboard.next_steps.step2_title')} 
                desc={t('dashboard.next_steps.step2_desc')} 
                href="/queue" 
              />
              <ActionButton 
                icon={Mail} 
                title={t('dashboard.next_steps.step3_title')} 
                desc={t('dashboard.next_steps.step3_desc')} 
                href="/settings" 
              />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Componente simples para os botões de ação
function ActionButton({ icon: Icon, title, desc, href }: any) {
    return (
        <Button 
            variant="outline" 
            className="h-auto py-4 px-6 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 group transition-all duration-300 bg-card"
            onClick={() => window.location.href=href}
        >
            <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                <Icon className="h-5 w-5 text-slate-500 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
                <span className="font-bold text-foreground group-hover:text-primary block">{title}</span>
                <span className="text-xs text-muted-foreground font-normal mt-1 block">{desc}</span>
            </div>
        </Button>
    )
}

// Ícone auxiliar de Dólar
function DollarSignIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" x2="12" y1="2" y2="22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    )
}