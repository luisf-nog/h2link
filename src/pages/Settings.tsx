import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { t, i18n } = useTranslation();

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('fullName') as string;

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
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

      {/* Profile Settings */}
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
              <Input
                id="email"
                type="email"
                value={profile?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.profile.email_note')}
              </p>
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

            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.profile.actions.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Info */}
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
            <span className="font-medium">{profile?.credits_used_today || 0}</span>
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
    </div>
  );
}
