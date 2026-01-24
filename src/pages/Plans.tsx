import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, PlanTier, usesDynamicAI } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Sparkles, Zap, Shield, Eye, Cpu, Mail, FileText, Cloud, Clock, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from '@/lib/pricing';
import { formatNumber } from '@/lib/number';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Plans() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const currentPlan = (profile?.plan_tier || 'free') as PlanTier;

  const locale = i18n.resolvedLanguage || i18n.language;
  const currency = getCurrencyForLanguage(locale);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast({ 
        title: t('plans.toasts.payment_success_title'),
        description: t('plans.toasts.payment_success_desc')
      });
      setSearchParams({});
      refreshProfile();
    } else if (paymentStatus === 'canceled') {
      toast({ 
        title: t('plans.toasts.payment_canceled_title'),
        variant: 'destructive'
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast, t, refreshProfile]);

  const renderPlanPrice = (planId: PlanTier) => {
    const plan = PLANS_CONFIG[planId];
    const amount = getPlanAmountForCurrency(plan, currency);

    if (amount === 0) return t('plans.free');
    return formatCurrency(amount, currency, locale);
  };

  const handleCheckout = async (planId: PlanTier) => {
    if (planId === 'free') return;

    setLoadingPlan(planId);
    const plan = PLANS_CONFIG[planId];
    const priceId = currency === 'BRL' ? plan.price.stripe_id_brl : plan.price.stripe_id_usd;

    if (!priceId) {
      toast({ 
        title: t('plans.toasts.error_title'),
        description: 'Price ID not configured',
        variant: 'destructive'
      });
      setLoadingPlan(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { priceId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: t('plans.toasts.error_title'),
        description: error instanceof Error ? error.message : 'Failed to create checkout',
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  // Feature configurations per plan with icons
  const getPlanFeatures = (planId: PlanTier) => {
    const config = PLANS_CONFIG[planId];
    
    type FeatureItem = {
      key: string;
      icon: React.ElementType;
      highlight?: boolean;
    };
    
    const features: FeatureItem[] = [];

    // Daily emails
    features.push({ 
      key: t('plans.features.daily_emails', { count: formatNumber(config.limits.daily_emails) } as any) as string,
      icon: Mail
    });
    
    // Templates
    if (planId === 'free') {
      features.push({ key: t('plans.features.basic_template') as string, icon: FileText });
    } else if (config.limits.max_templates > 100) {
      features.push({ key: t('plans.features.unlimited_generation') as string, icon: Sparkles, highlight: true });
    } else {
      features.push({ key: t('plans.features.templates_saved', { count: config.limits.max_templates } as any) as string, icon: FileText });
    }

    // Sending method - only for paid plans
    if (planId !== 'free') {
      if (usesDynamicAI(planId)) {
        features.push({ key: t('plans.features.ai_real_writer') as string, icon: Cpu, highlight: true });
      } else {
        features.push({ key: t('plans.features.auto_fill_templates') as string, icon: FileText });
      }
    }

    // Resume parsing
    if (config.features.resume_parsing) {
      if (planId === 'black') {
        features.push({ key: t('plans.features.resume_advanced') as string, icon: FileText });
      } else {
        features.push({ key: t('plans.features.resume_basic') as string, icon: FileText });
      }
    }

    // Spy pixel - highlight for diamond
    if (config.features.spy_pixel) {
      features.push({ 
        key: t('plans.features.spy_pixel') as string, 
        icon: Eye,
        highlight: planId === 'diamond'
      });
    }

    // Cloud sending
    if (config.features.cloud_sending) {
      features.push({ key: t('plans.features.cloud_sending') as string, icon: Cloud });
    }

    // Anti-spam protection
    if (config.features.mask_user_agent) {
      if (planId === 'black') {
        features.push({ key: t('plans.features.antispam_armored') as string, icon: Shield, highlight: true });
      } else {
        features.push({ key: t('plans.features.mask_user_agent') as string, icon: Shield });
      }
    }

    // DNS check
    if (config.features.dns_bounce_check) {
      features.push({ key: t('plans.features.dns_bounce_check') as string, icon: Shield });
    }

    // Human delay - only for black
    if (config.settings.delay_strategy === 'human') {
      features.push({ key: t('plans.features.human_delay') as string, icon: Clock });
    }

    // Priority support - only for black
    if (config.features.priority_support) {
      features.push({ key: t('plans.features.priority_support') as string, icon: Headphones });
    }

    return features;
  };

  const getPlanIcon = (planId: PlanTier) => {
    if (planId === 'black') return <Zap className="h-6 w-6" />;
    if (planId === 'diamond') return <Crown className="h-6 w-6" />;
    return null;
  };

  const getPlanColorClass = (planId: PlanTier, type: 'text' | 'bg' | 'border' | 'gradient') => {
    const colors = {
      free: { text: 'text-muted-foreground', bg: '', border: 'border-border', gradient: '' },
      gold: { text: 'text-plan-gold', bg: 'bg-plan-gold', border: 'border-plan-gold', gradient: 'from-plan-gold/20 to-transparent' },
      diamond: { text: 'text-plan-diamond', bg: 'bg-plan-diamond', border: 'border-plan-diamond', gradient: 'from-plan-diamond/20 to-transparent' },
      black: { text: 'text-foreground', bg: 'bg-plan-black', border: 'border-plan-black', gradient: 'from-plan-black/30 to-zinc-900/80' },
    };
    return colors[planId][type];
  };

  const plans = Object.values(PLANS_CONFIG);

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold font-brand text-foreground">{t('plans.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('plans.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isRecommended = plan.id === 'black';
          const isBlack = plan.id === 'black';
          const features = getPlanFeatures(plan.id);

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative overflow-hidden transition-all duration-300 flex flex-col',
                isBlack && 'bg-gradient-to-b from-zinc-900 to-background border-plan-black shadow-xl shadow-plan-black/20',
                isRecommended && !isBlack && `border-2 ${getPlanColorClass(plan.id, 'border')} shadow-lg`,
                isCurrentPlan && 'ring-2 ring-primary',
                !isBlack && !isRecommended && 'hover:shadow-md hover:border-muted-foreground/30'
              )}
            >
              {/* Recommended badge */}
              {isRecommended && (
                <div className={cn(
                  "absolute top-0 right-0 text-white text-xs px-3 py-1.5 rounded-bl-lg font-medium flex items-center gap-1",
                  getPlanColorClass(plan.id, 'bg')
                )}>
                  <Sparkles className="h-3 w-3" />
                  {t('plans.recommended')}
                </div>
              )}

              <CardHeader className="pb-4 pt-6">
                <div className="flex items-center gap-2">
                  <span className={getPlanColorClass(plan.id, 'text')}>
                    {getPlanIcon(plan.id)}
                  </span>
                  <CardTitle className={cn(
                    "text-xl font-bold",
                    isBlack ? 'text-foreground' : getPlanColorClass(plan.id, 'text')
                  )}>
                    {t(`plans.tiers.${plan.id}.label`)}
                  </CardTitle>
                </div>
                <CardDescription className={cn(
                  "text-sm",
                  isBlack && 'text-muted-foreground'
                )}>
                  {t(`plans.tiers.${plan.id}.description`)}
                </CardDescription>

                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-4xl font-bold",
                      isBlack ? 'text-foreground' : 'text-foreground'
                    )}>
                      {renderPlanPrice(plan.id)}
                    </span>
                    {plan.id !== 'free' && (
                      <span className="text-sm text-muted-foreground">{t('plans.lifetime')}</span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <Separator className={cn(
                isBlack && 'bg-zinc-800'
              )} />

              <CardContent className="flex-1 pt-4 space-y-4">
                <ul className="space-y-2.5">
                  {features.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <li key={index} className={cn(
                        "flex items-start gap-2.5 text-sm",
                        feature.highlight && 'font-medium'
                      )}>
                        <Icon
                          className={cn(
                            'h-4 w-4 flex-shrink-0 mt-0.5',
                            feature.highlight 
                              ? getPlanColorClass(plan.id, 'text') 
                              : isBlack 
                                ? 'text-zinc-400' 
                                : 'text-muted-foreground'
                          )}
                        />
                        <span className={cn(
                          feature.highlight && getPlanColorClass(plan.id, 'text'),
                          isBlack && !feature.highlight && 'text-zinc-300'
                        )}>
                          {feature.key}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>

              <div className="p-6 pt-0 mt-auto">
                <Button
                  className={cn(
                    'w-full font-medium',
                    plan.id === 'black' && 'bg-foreground text-background hover:bg-foreground/90',
                    plan.id === 'diamond' && 'bg-plan-diamond hover:bg-plan-diamond/90 text-white',
                    plan.id === 'gold' && 'bg-plan-gold hover:bg-plan-gold/90 text-white'
                  )}
                  variant={plan.id === 'free' ? 'outline' : 'default'}
                  size="lg"
                  disabled={isCurrentPlan || loadingPlan !== null}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {loadingPlan === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCurrentPlan ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {t('plans.actions.current')}
                    </>
                  ) : loadingPlan === plan.id ? (
                    t('plans.toasts.processing_title')
                  ) : plan.id === 'free' ? (
                    t('plans.actions.start_free')
                  ) : (
                    t('plans.actions.subscribe_now')
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto text-center pt-8">
        <p className="text-sm text-muted-foreground">
          {t('plans.footer.line1')}
          {t('plans.footer.line2') ? (
            <>
              <br />
              {t('plans.footer.line2')}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
