import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, PlanTier, usesDynamicAI } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from '@/lib/pricing';
import { formatNumber } from '@/lib/number';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

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

  const getFeaturesList = (planId: PlanTier) => {
    const config = PLANS_CONFIG[planId];
    const features = [];

    features.push(t('plans.features.daily_emails', { count: formatNumber(config.limits.daily_emails) } as any));
    
    if (config.limits.max_templates > 100) {
      features.push(t('plans.features.unlimited_templates'));
    } else {
      features.push(t('plans.features.templates_count', { count: config.limits.max_templates } as any));
    }

    // Sending method
    if (usesDynamicAI(planId)) {
      features.push(t('plans.features.dynamic_ai'));
    } else if (planId !== 'free') {
      features.push(t('plans.features.static_templates'));
    }

    if (config.features.resume_parsing) features.push(t('plans.features.resume_parsing'));
    if (config.features.spy_pixel) features.push(t('plans.features.spy_pixel'));
    if (config.features.cloud_sending) features.push(t('plans.features.cloud_sending'));
    if (config.features.mask_user_agent) features.push(t('plans.features.mask_user_agent'));
    if (config.features.dns_bounce_check) features.push(t('plans.features.dns_bounce_check'));
    if (config.features.ai_email_writer) features.push(t('plans.features.ai_email_writer'));
    if (config.features.priority_support) features.push(t('plans.features.priority_support'));

    if (config.settings.show_housing_icons) features.push(t('plans.features.housing_icons'));
    if (config.settings.delay_strategy === 'human') features.push(t('plans.features.human_delay'));

    return features;
  };

  const getPlanIcon = (planId: PlanTier) => {
    if (planId === 'black') return <Zap className="h-5 w-5 text-plan-black" />;
    if (planId === 'diamond') return <Crown className="h-5 w-5 text-plan-diamond" />;
    return null;
  };

  const getPlanColorClass = (planId: PlanTier, type: 'text' | 'bg' | 'border') => {
    const colors = {
      free: { text: 'text-foreground', bg: '', border: '' },
      gold: { text: 'text-plan-gold', bg: 'bg-plan-gold', border: 'border-plan-gold' },
      diamond: { text: 'text-plan-diamond', bg: 'bg-plan-diamond', border: 'border-plan-diamond' },
      black: { text: 'text-plan-black', bg: 'bg-plan-black', border: 'border-plan-black' },
    };
    return colors[planId][type];
  };

  const plans = Object.values(PLANS_CONFIG);

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground">{t('plans.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('plans.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isRecommended = plan.id === 'black';

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative overflow-hidden transition-all hover:shadow-lg',
                isRecommended && `${getPlanColorClass(plan.id, 'border')} shadow-lg`,
                isCurrentPlan && 'ring-2 ring-primary'
              )}
            >
              {isRecommended && (
                <div className={cn(
                  "absolute top-0 right-0 text-white text-xs px-3 py-1 rounded-bl-lg font-medium",
                  getPlanColorClass(plan.id, 'bg')
                )}>
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  {t('plans.recommended')}
                </div>
              )}

              {/* Method Badge */}
              {plan.id !== 'free' && (
                <div className="absolute top-0 left-0 px-2 py-1">
                  <Badge variant={usesDynamicAI(plan.id) ? "default" : "secondary"} className="text-xs">
                    {usesDynamicAI(plan.id) ? t('plans.method.dynamic') : t('plans.method.static')}
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4 pt-8">
                <div className="flex items-center gap-2">
                  {getPlanIcon(plan.id)}
                  <CardTitle className={getPlanColorClass(plan.id, 'text')}>
                    {t(`plans.tiers.${plan.id}.label`)}
                  </CardTitle>
                </div>
                <CardDescription>{t(`plans.tiers.${plan.id}.description`)}</CardDescription>

                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {renderPlanPrice(plan.id)}
                    </span>
                    {plan.id !== 'free' && <span className="text-muted-foreground">{t('plans.lifetime')}</span>}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {getFeaturesList(plan.id).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check
                        className={cn(
                          'h-4 w-4 flex-shrink-0',
                          getPlanColorClass(plan.id, 'text') || 'text-muted-foreground'
                        )}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    'w-full',
                    plan.id === 'black' && 'bg-plan-black hover:bg-plan-black/90',
                    plan.id === 'diamond' && 'bg-plan-diamond hover:bg-plan-diamond/90',
                    plan.id === 'gold' && 'bg-plan-gold hover:bg-plan-gold/90'
                  )}
                  variant={plan.id === 'free' ? 'outline' : 'default'}
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
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