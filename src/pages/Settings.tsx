import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Shield, User, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/number';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailSettingsPanel } from '@/components/settings/EmailSettingsPanel';
import { z } from 'zod';
import { TemplatesSettingsPanel } from '@/components/settings/TemplatesSettingsPanel';
import { PhoneE164Input } from '@/components/inputs/PhoneE164Input';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { ResumeSettingsSection } from '@/components/settings/ResumeSettingsSection';
import { PublicProfileSection } from '@/components/settings/PublicProfileSection';

type SettingsTab = 'profile' | 'account' | 'email' | 'templates';

export default function Settings({ defaultTab }: { defaultTab?: SettingsTab }) {

  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const { isAdmin } = useIsAdmin();

  const [adminTargetEmail, setAdminTargetEmail] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const initialTab = useMemo<SettingsTab>(() => defaultTab ?? 'profile', [defaultTab]);

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = String(formData.get('fullName') ?? '');
    const ageRaw = String(formData.get('age') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const contactEmail = String(formData.get('contactEmail') ?? '').trim();

    const schema = z.object({
      fullName: z.string().trim().min(2).max(120),
      age: z
        .string()
        .trim()
        .transform((v) => (v === '' ? null : Number(v)))
        .refine((v) => v === null || (Number.isFinite(v) && v >= 14 && v <= 90), {
          message: t('settings.profile.validation.invalid_age'),
        }),
      phone: z
        .string()
        .trim()
        .refine((v) => Boolean(parsePhoneNumberFromString(v)?.isValid()), {
          message: t('settings.profile.validation.invalid_phone'),
        }),
      contactEmail: z.string().trim().email().max(255),
    });

    const parsed = schema.safeParse({
      fullName,
      age: ageRaw,
      phone,
      contactEmail,
    });

    if (!parsed.success) {
      toast({
        title: t('settings.toasts.update_error_title'),
        description: parsed.error.issues?.[0]?.message ?? t('common.errors.invalid_data'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.fullName,
        age: parsed.data.age,
        phone_e164: parsed.data.phone,
        contact_email: parsed.data.contactEmail,
      })
      .eq('id', profile?.id);

    if (error) {
      toast({
        title: t('settings.toasts.update_error_title'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await refreshProfile();

      // Onboarding trigger: create first AI template after profile is complete.
      try {
        const hasAllFields =
          parsed.data.fullName.trim().length > 0 &&
          parsed.data.age != null &&
          parsed.data.phone.trim().length > 0 &&
          parsed.data.contactEmail.trim().length > 0;

        if (hasAllFields && profile?.id) {
          const { count } = await supabase
            .from('email_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          if ((count ?? 0) === 0) {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            const token = sessionData.session?.access_token;
            if (!token) throw new Error(t('common.errors.no_session'));

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-template`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({}),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || payload?.success === false) throw new Error(payload?.error || `HTTP ${res.status}`);

            await supabase.from('email_templates').insert({
              user_id: profile.id,
              name: 'Meu Primeiro Template (IA)',
              subject: String(payload.subject ?? ''),
              body: String(payload.body ?? ''),
            });
          }
        }
      } catch {
        // Best-effort: do not block profile save flow.
      }

      toast({
        title: t('settings.toasts.update_success_title'),
        description: t('settings.toasts.update_success_desc'),
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            {t('settings.tabs.profile')}
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Shield className="h-4 w-4" />
            {t('settings.tabs.account')}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            {t('settings.tabs.smtp')}
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            {t('settings.tabs.templates')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('settings.profile.title')}
              </CardTitle>
              <CardDescription>{t('settings.profile.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('settings.profile.fields.email')}</Label>
                  <Input id="email" type="email" value={profile?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">{t('settings.profile.email_note')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('settings.profile.fields.full_name')}</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    defaultValue={profile?.full_name || ''}
                    placeholder={t('settings.profile.placeholders.full_name')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">{t('settings.profile.fields.age')}</Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      min={14}
                      max={90}
                      defaultValue={profile?.age ?? ''}
                      placeholder={t('settings.profile.placeholders.age')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('settings.profile.fields.phone')}</Label>
                    <PhoneE164Input
                      id="phone"
                      name="phone"
                      defaultValue={profile?.phone_e164 ?? ''}
                      placeholder={t('settings.profile.placeholders.phone')}
                      invalidHint={t('settings.profile.validation.invalid_phone')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t('settings.profile.fields.contact_email')}</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    defaultValue={profile?.contact_email ?? profile?.email ?? ''}
                    placeholder={t('settings.profile.placeholders.contact_email')}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.profile.contact_email_note')}</p>
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('settings.profile.actions.save')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <ResumeSettingsSection />

          {/* Public Profile Section */}
          <PublicProfileSection
            publicToken={(profile as any)?.public_token ?? null}
            viewsCount={(profile as any)?.views_count ?? 0}
            whatsappClicks={(profile as any)?.whatsapp_clicks ?? 0}
            lastViewedAt={(profile as any)?.last_viewed_at ?? null}
          />
        </TabsContent>

        <TabsContent value="account" className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('settings.account.title')}
              </CardTitle>
              <CardDescription>{t('settings.account.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">{t('settings.account.current_plan')}</span>
                <span className="font-medium">{t(`plans.tiers.${profile?.plan_tier || 'free'}.label`)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">{t('settings.account.credits_used_today')}</span>
                <span className="font-medium">{formatNumber(profile?.credits_used_today || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">{t('settings.account.member_since')}</span>
                <span className="font-medium">
                  {profile?.created_at
                    ? new Date(profile.created_at as unknown as string).toLocaleDateString(i18n.language)
                    : '-'}
                </span>
              </div>

              <Button variant="outline" onClick={() => (window.location.href = '/plans')}>
                {t('settings.account.actions.manage_plan')}
              </Button>
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Admin: Suporte de Pagamento
                </CardTitle>
                <CardDescription>
                  Reprocessa o upgrade do usuário buscando o último Checkout pago e ajustando o plano no banco.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminTargetEmail">Email do usuário</Label>
                  <Input
                    id="adminTargetEmail"
                    value={adminTargetEmail}
                    onChange={(e) => setAdminTargetEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>

                <Button
                  onClick={async () => {
                    const email = adminTargetEmail.trim().toLowerCase();
                    if (!email) {
                      toast({
                        title: 'Informe um email',
                        description: 'Digite o email do usuário para reprocessar o upgrade.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    setAdminLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('reprocess-upgrade', {
                        body: { email },
                      });

                      if (error) throw error;

                      toast({
                        title: 'Upgrade reprocessado',
                        description: `Plano atualizado para ${data?.plan_tier ?? '—'} (session ${data?.checkout_session_id ?? '—'}).`,
                      });

                      // If the admin reprocessed their own account, refresh locally.
                      await refreshProfile();
                    } catch (e: any) {
                      toast({
                        title: 'Falha ao reprocessar',
                        description: e?.message ?? 'Erro desconhecido',
                        variant: 'destructive',
                      });
                    } finally {
                      setAdminLoading(false);
                    }
                  }}
                  disabled={adminLoading}
                >
                  {adminLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reprocessar upgrade
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="email" className="space-y-6 max-w-2xl">
          <EmailSettingsPanel />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplatesSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
