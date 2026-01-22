import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, PlanTier } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from '@/lib/pricing';

export default function Plans() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const currentPlan = profile?.plan_tier || 'free';

  const locale = i18n.resolvedLanguage || i18n.language;
  const currency = getCurrencyForLanguage(locale);

  const renderPlanPrice = (planId: PlanTier) => {
    const plan = PLANS_CONFIG[planId];
    const amount = getPlanAmountForCurrency(plan, currency);

    if (amount === 0) return t('plans.free');
    return formatCurrency(amount, currency, locale);
  };

  const handleCheckout = async (planId: PlanTier) => {
    if (planId === 'free') return;

    // For demo: Simulate checkout and upgrade
    toast({
      title: t('plans.toasts.processing_title'),
      description: t('plans.toasts.processing_desc'),
    });

    // Mock: Update plan directly for testing
    const { error } = await supabase
      .from('profiles')
      .update({ plan_tier: planId })
      .eq('id', profile?.id);

    if (error) {
      toast({
        title: t('plans.toasts.error_title'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await refreshProfile();
      toast({
        title: t('plans.toasts.updated_title'),
        description: t('plans.toasts.updated_desc', { plan: PLANS_CONFIG[planId].label }),
      });
    }
  };

  const getFeaturesList = (planId: PlanTier) => {
    const config = PLANS_CONFIG[planId];
    const features = [];

    features.push(t('plans.features.daily_emails', { count: config.limits.daily_emails }));
    features.push(
      t('plans.features.queue_size', {
        size: config.limits.max_queue_size === 9999 ? t('plans.features.unlimited') : config.limits.max_queue_size,
      })
    );

    if (config.features.cloud_sending) features.push(t('plans.features.cloud_sending'));
    if (config.features.mask_user_agent) features.push(t('plans.features.mask_user_agent'));
    if (config.features.dns_bounce_check) features.push(t('plans.features.dns_bounce_check'));
    if (config.features.magic_paste) features.push(t('plans.features.magic_paste'));
    if (config.features.ai_email_writer) features.push(t('plans.features.ai_email_writer'));
    if (config.features.priority_support) features.push(t('plans.features.priority_support'));

    if (config.settings.show_housing_icons) features.push(t('plans.features.housing_icons'));
    if (config.settings.delay_strategy === 'human') features.push(t('plans.features.human_delay'));

    return features;
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isRecommended = plan.id === 'diamond';

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative overflow-hidden transition-all hover:shadow-lg',
                isRecommended && 'border-plan-diamond shadow-plan-diamond/20',
                isCurrentPlan && 'ring-2 ring-primary'
              )}
            >
              {isRecommended && (
                <div className="absolute top-0 right-0 bg-plan-diamond text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  {t('plans.recommended')}
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  {plan.id === 'diamond' && <Crown className="h-5 w-5 text-plan-diamond" />}
                  <CardTitle
                    className={cn(
                      plan.color === 'slate' && 'text-foreground',
                      plan.color === 'blue' && 'text-plan-gold',
                      plan.color === 'violet' && 'text-plan-diamond'
                    )}
                  >
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
                          plan.color === 'slate' && 'text-muted-foreground',
                          plan.color === 'blue' && 'text-plan-gold',
                          plan.color === 'violet' && 'text-plan-diamond'
                        )}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    'w-full',
                    plan.id === 'diamond' && 'bg-plan-diamond hover:bg-plan-diamond/90',
                    plan.id === 'gold' && 'bg-plan-gold hover:bg-plan-gold/90'
                  )}
                  variant={plan.id === 'free' ? 'outline' : 'default'}
                  disabled={isCurrentPlan}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {isCurrentPlan ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {t('plans.actions.current')}
                    </>
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
