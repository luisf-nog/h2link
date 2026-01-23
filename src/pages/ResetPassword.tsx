import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { isSupportedLanguage, type SupportedLanguage } from '@/i18n';
import { useToast } from '@/hooks/use-toast';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { z } from 'zod';

type FlowState = 'idle' | 'processing' | 'ready' | 'error';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [isLoading, setIsLoading] = useState(false);

  const [resetState, setResetState] = useState<{ password: string; confirmPassword: string }>(() => ({
    password: '',
    confirmPassword: '',
  }));

  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>(() => ({
    open: false,
    title: '',
    description: '',
  }));

  const openError = (title: string, description: string) => {
    setErrorDialog({ open: true, title, description });
  };

  const okLabel = useMemo(() => {
    const label = t('common.ok');
    return label === 'common.ok' ? 'OK' : label;
  }, [t]);

  const resetPasswordSchema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(6).max(200),
          confirmPassword: z.string().min(6).max(200),
        })
        .superRefine(({ password, confirmPassword }, ctx) => {
          if (password !== confirmPassword) {
            ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'password_mismatch' });
          }
        }),
    []
  );

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem('app_language', next);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const url = new URL(window.location.href);

      const code = url.searchParams.get('code');
      const type = url.searchParams.get('type');
      const tokenHash = url.searchParams.get('token_hash') ?? url.searchParams.get('token');

      const authError = url.searchParams.get('error');
      const authErrorCode = url.searchParams.get('error_code');
      const authErrorDesc = url.searchParams.get('error_description');

      const isRecovery = type === 'recovery';

      // If we got here without callback params, just show the form container (disabled until session exists).
      if (!code && !(type && tokenHash) && !authError) {
        setFlowState('idle');
        return;
      }

      // Friendly error mapping (expired links are common)
      if (authError) {
        const isExpired = authErrorCode === 'otp_expired' || /expired/i.test(String(authErrorDesc ?? ''));
        openError(
          isExpired ? t('auth.recovery.errors.link_expired_title') : t('auth.recovery.errors.link_invalid_title'),
          isExpired ? t('auth.recovery.errors.link_expired_desc') : t('auth.recovery.errors.link_invalid_desc')
        );
        setFlowState('error');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // Only handle recovery here.
      if (!isRecovery) {
        openError(t('auth.toasts.signin_error_title'), String(authErrorDesc ?? t('auth.recovery.errors.link_invalid_desc')));
        setFlowState('error');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      setFlowState('processing');
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!cancelled) {
              openError(t('auth.recovery.errors.request_error_title'), error.message);
              setFlowState('error');
            }
            return;
          }
        } else if (type && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash: tokenHash });
          if (error) {
            if (!cancelled) {
              openError(t('auth.recovery.errors.request_error_title'), error.message);
              setFlowState('error');
            }
            return;
          }
        }

        // Wait briefly for session propagation.
        const maxAttempts = 20;
        for (let i = 0; i < maxAttempts; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) break;
          await new Promise((r) => setTimeout(r, 300));
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) {
            openError(t('auth.recovery.errors.no_session_title'), t('common.errors.no_session'));
            setFlowState('error');
          }
          return;
        }

        window.history.replaceState({}, document.title, window.location.pathname);
        if (!cancelled) setFlowState('ready');
      } catch (e: any) {
        if (!cancelled) {
          openError(t('auth.recovery.errors.request_error_title'), String(e?.message ?? e));
          setFlowState('error');
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const parsed = resetPasswordSchema.safeParse(resetState);
    if (!parsed.success) {
      openError(t('auth.recovery.errors.reset_error_title'), t('auth.validation.password_mismatch'));
      setIsLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      openError(t('auth.recovery.errors.no_session_title'), t('common.errors.no_session'));
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      openError(t('auth.recovery.errors.reset_error_title'), error.message);
      setIsLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setResetState({ password: '', confirmPassword: '' });
    toast({
      title: t('auth.recovery.toasts.reset_success_title'),
      description: t('auth.recovery.toasts.reset_success_desc'),
    });
    navigate('/auth', { replace: true });
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((p) => ({ ...p, open }))}>
        <AlertDialogContent className="border-destructive/40 bg-background shadow-2xl">
          <AlertDialogHeader className="space-y-0 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-semibold text-foreground">{errorDialog.title}</AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-sm text-muted-foreground">
                  {errorDialog.description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {okLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="fixed right-4 top-4 z-20 md:right-6 md:top-6">
        <LanguageSwitcher
          value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : 'en'}
          onChange={handleChangeLanguage}
          className="h-9 w-[168px]"
        />
      </header>

      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-foreground">{t('auth.recovery.reset_title')}</CardTitle>
            <CardDescription className="text-muted-foreground">{t('auth.recovery.reset_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">{t('auth.recovery.fields.new_password')}</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="••••••••"
                  value={resetState.password}
                  onChange={(e) => setResetState((p) => ({ ...p, password: e.target.value }))}
                  minLength={6}
                  required
                  className="h-11 rounded-lg"
                  disabled={flowState !== 'ready' || isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">{t('auth.recovery.fields.confirm_new_password')}</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={resetState.confirmPassword}
                  onChange={(e) => setResetState((p) => ({ ...p, confirmPassword: e.target.value }))}
                  minLength={6}
                  required
                  className="h-11 rounded-lg"
                  disabled={flowState !== 'ready' || isLoading}
                />
              </div>

              <Button type="submit" className="h-11 w-full rounded-lg" disabled={flowState !== 'ready' || isLoading}>
                {(flowState === 'processing' || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('auth.recovery.actions.save_new_password')}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full rounded-lg"
                onClick={() => navigate('/auth', { replace: true })}
                disabled={isLoading}
              >
                {t('auth.recovery.actions.cancel')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
