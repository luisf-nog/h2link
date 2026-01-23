import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Shield, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/number';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailSettingsPanel } from '@/components/settings/EmailSettingsPanel';
import { z } from 'zod';
import { TemplatesSettingsPanel } from '@/components/settings/TemplatesSettingsPanel';

type SettingsTab = 'profile' | 'account' | 'email' | 'templates';

export default function Settings({ defaultTab }: { defaultTab?: SettingsTab }) {

  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { t, i18n } = useTranslation();

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
        .regex(/^\+\d{8,15}$/, { message: t('settings.profile.validation.invalid_phone') }),
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
        description: parsed.error.issues?.[0]?.message ?? 'Dados inválidos',
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
      toast({
        title: t('settings.toasts.update_success_title'),
        description: t('settings.toasts.update_success_desc'),
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
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

        <TabsContent value="profile" className="space-y-6">
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
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      defaultValue={profile?.phone_e164 ?? ''}
                      placeholder={t('settings.profile.placeholders.phone')}
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
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <EmailSettingsPanel />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplatesSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
