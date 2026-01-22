import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, PlanTier } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Plans() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const currentPlan = profile?.plan_tier || 'free';

  const handleCheckout = async (planId: PlanTier) => {
    if (planId === 'free') return;

    // For demo: Simulate checkout and upgrade
    toast({
      title: 'Processando...',
      description: 'Atualizando seu plano...',
    });

    // Mock: Update plan directly for testing
    const { error } = await supabase
      .from('profiles')
      .update({ plan_tier: planId })
      .eq('id', profile?.id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await refreshProfile();
      toast({
        title: 'Plano atualizado!',
        description: `Você agora é ${PLANS_CONFIG[planId].label}! 🎉`,
      });
    }
  };

  const getFeaturesList = (planId: PlanTier) => {
    const config = PLANS_CONFIG[planId];
    const features = [];

    features.push(`${config.limits.daily_emails} envios/dia`);
    features.push(`Fila de até ${config.limits.max_queue_size === 9999 ? 'ilimitada' : config.limits.max_queue_size} vagas`);

    if (config.features.cloud_sending) features.push('Envio pela nuvem');
    if (config.features.mask_user_agent) features.push('Proteção anti-spam');
    if (config.features.dns_bounce_check) features.push('Verificação DNS');
    if (config.features.magic_paste) features.push('Magic Paste (IA)');
    if (config.features.ai_email_writer) features.push('Escritor de Email IA');
    if (config.features.priority_support) features.push('Suporte prioritário');

    if (config.settings.show_housing_icons) features.push('Ícones de benefícios');
    if (config.settings.delay_strategy === 'human') features.push('Delay humano (anti-spam)');

    return features;
  };

  const plans = Object.values(PLANS_CONFIG);

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground">Escolha seu Plano</h1>
        <p className="text-muted-foreground mt-2">
          Desbloqueie todo o potencial do H2B Sender e acelere suas aplicações
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
                  Recomendado
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
                    {plan.label}
                  </CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>

                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price.brl === 0 ? 'Grátis' : `R$ ${plan.price.brl.toFixed(2)}`}
                    </span>
                    {plan.price.brl > 0 && (
                      <span className="text-muted-foreground">/mês</span>
                    )}
                  </div>
                  {plan.price.usd > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ou ${plan.price.usd.toFixed(2)} USD
                    </p>
                  )}
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
                      Plano Atual
                    </>
                  ) : plan.id === 'free' ? (
                    'Começar Grátis'
                  ) : (
                    'Assinar Agora'
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
          Cancele a qualquer momento. Sem taxa de cancelamento.
          <br />
          Pagamentos processados com segurança via Stripe.
        </p>
      </div>
    </div>
  );
}
