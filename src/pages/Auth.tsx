import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { z } from 'zod';
import { PhoneE164Input } from '@/components/inputs/PhoneE164Input';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Checkbox } from '@/components/ui/checkbox';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { isSupportedLanguage, type SupportedLanguage } from '@/i18n';
import authWordmark from '@/assets/h2link-logo-wordmark.png';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [signinPanel, setSigninPanel] = useState<'signin' | 'forgot' | 'reset'>(() => 'signin');
  const [forgotState, setForgotState] = useState<{ email: string; sent: boolean; cooldownUntilMs: number }>(() => ({
    email: '',
    sent: false,
    cooldownUntilMs: 0,
  }));
  const [resetState, setResetState] = useState<{ password: string; confirmPassword: string }>(() => ({
    password: '',
    confirmPassword: '',
  }));
  const [confirmKind, setConfirmKind] = useState<'email' | 'recovery'>(() => 'email');
  const [confirmFlow, setConfirmFlow] = useState<{ active: boolean; state: 'processing' | 'success' | 'error' }>(() => ({
    active: false,
    state: 'processing',
  }));
  const [signupNotice, setSignupNotice] = useState<{ visible: boolean; email?: string }>(() => ({
    visible: false,
    email: undefined,
  }));
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>(() => ({
    open: false,
    title: '',
    description: '',
  }));
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const openError = (title: string, description: string) => {
    setErrorDialog({ open: true, title, description });
  };

  const okLabel = useMemo(() => {
    // fallback safety: don't ever render an empty button label
    const label = t('common.ok');
    return label === 'common.ok' ? 'OK' : label;
  }, [t]);

  const forgotEmailSchema = useMemo(() => z.string().trim().email().max(255), []);
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

  // Handle email-confirmation redirect (OTP / PKCE) and send user straight to dashboard.
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

      // New dedicated flow: move recovery callbacks to /reset-password to avoid any route guards.
      if (isRecovery && window.location.pathname === '/auth') {
        navigate(`/reset-password${window.location.search}`, { replace: true });
        return;
      }

      // If auth provider redirected with an error (common for expired recovery links), show a friendly message.
      if (authError) {
        setTab('signin');
        setSigninPanel(isRecovery ? 'forgot' : 'signin');

        if (isRecovery) {
          const isExpired = authErrorCode === 'otp_expired' || /expired/i.test(String(authErrorDesc ?? ''));
          openError(
            isExpired ? t('auth.recovery.errors.link_expired_title') : t('auth.recovery.errors.link_invalid_title'),
            isExpired ? t('auth.recovery.errors.link_expired_desc') : t('auth.recovery.errors.link_invalid_desc')
          );
        } else {
          openError(t('auth.toasts.signin_error_title'), String(authErrorDesc ?? authError));
        }

        // Clean the URL to avoid re-processing on refresh.
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // Nothing to handle
      if (!code && !(type && tokenHash)) return;

      setIsLoading(true);
      setConfirmKind(isRecovery ? 'recovery' : 'email');
      setConfirmFlow({ active: true, state: 'processing' });
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!cancelled) openError(t('auth.toasts.signin_error_title'), error.message);
            if (!cancelled) setConfirmFlow({ active: true, state: 'error' });
            return;
          }
        } else if (type && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash: tokenHash,
          });

          if (error) {
            if (!cancelled) openError(t('auth.toasts.signin_error_title'), error.message);
            if (!cancelled) setConfirmFlow({ active: true, state: 'error' });
            return;
          }
        }

        // Wait a bit for the session to become available (fallback for slower auth propagation).
        const maxAttempts = 20; // ~6s
        for (let i = 0; i < maxAttempts; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) break;
          await new Promise((r) => setTimeout(r, 300));
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) {
            setConfirmFlow({ active: true, state: 'error' });
            openError(
              t('auth.toasts.signin_error_title'),
              t('auth.confirmation.session_timeout')
            );
          }
          return;
        }

        // Clean the URL to avoid re-processing on refresh.
        window.history.replaceState({}, document.title, window.location.pathname);

        if (!cancelled) setConfirmFlow({ active: true, state: 'success' });

        if (isRecovery) {
          // Small branded moment, then show the reset password panel (stay on /auth).
          await new Promise((r) => setTimeout(r, 900));
          if (!cancelled) {
            setTab('signin');
            setSigninPanel('reset');
            setConfirmFlow({ active: false, state: 'processing' });
          }
          return;
        }

        // Small branded confirmation moment (~2s)
        await new Promise((r) => setTimeout(r, 2000));
        if (!cancelled) navigate('/dashboard', { replace: true });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem('app_language', next);
  };

  const signupSchema = z
    .object({
      fullName: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(255),
      password: z.string().min(6).max(200),
      confirmPassword: z.string().min(6).max(200),
      age: z
        .string()
        .trim()
        .transform((v) => Number(v))
        .refine((n) => Number.isInteger(n) && n >= 14 && n <= 90, { message: 'invalid_age' }),
      phone: z
        .string()
        .trim()
        .min(1)
        .refine((v) => Boolean(parsePhoneNumberFromString(v)?.isValid()), { message: 'invalid_phone' }),
      contactEmail: z.string().trim().email().max(255),
      referralCode: z
        .string()
        .trim()
        .transform((v) => v.toUpperCase())
        .refine((v) => v === '' || /^[A-Z0-9]{6}$/.test(v), { message: 'invalid_referral_code' }),
      acceptTerms: z.preprocess(
        (v) => v === 'on' || v === true,
        z.boolean().refine((v) => v === true, { message: 'accept_required' })
      ),
    })
    .superRefine(({ password, confirmPassword }, ctx) => {
      if (password !== confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'password_mismatch' });
      }
    });

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupNotice({ visible: false, email: undefined });

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);

    if (error) {
      openError(t('auth.toasts.signin_error_title'), error.message);
    } else {
      navigate('/dashboard');
    }

    setIsLoading(false);
  };

  const handleRequestPasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const now = Date.now();
    if (forgotState.cooldownUntilMs && now < forgotState.cooldownUntilMs) {
      openError(t('auth.recovery.errors.cooldown_title'), t('auth.recovery.errors.cooldown_desc'));
      setIsLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('recoveryEmail') ?? '').trim();
    const parsed = forgotEmailSchema.safeParse(email);

    if (!parsed.success) {
      openError(t('auth.recovery.errors.invalid_email_title'), t('auth.recovery.errors.invalid_email_desc'));
      setIsLoading(false);
      return;
    }

     const redirectTo = `${window.location.origin}/reset-password?type=recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });

    if (error) {
      const anyErr = error as any;
      const code = String(anyErr?.code ?? '');
      const msg = String(error.message ?? '');
      const isRateLimit = code === 'over_email_send_rate_limit' || /rate limit/i.test(msg);

      if (isRateLimit) {
        openError(t('auth.recovery.errors.email_rate_limit_title'), t('auth.recovery.errors.email_rate_limit_desc'));
      } else {
        openError(t('auth.recovery.errors.request_error_title'), error.message);
      }
    } else {
      setForgotState((prev) => ({
        ...prev,
        email: parsed.data,
        sent: true,
        cooldownUntilMs: Date.now() + 60_000,
      }));
      toast({
        title: t('auth.recovery.toasts.sent_title'),
        description: t('auth.recovery.toasts.sent_desc'),
      });
    }

    setIsLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const parsed = resetPasswordSchema.safeParse(resetState);
    if (!parsed.success) {
      // We only surface a single friendly message (consistent w/ rest of page)
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

    // Force a clean return-to-login flow (user preference)
    await supabase.auth.signOut();
    setResetState({ password: '', confirmPassword: '' });
    setSigninPanel('signin');
    toast({
      title: t('auth.recovery.toasts.reset_success_title'),
      description: t('auth.recovery.toasts.reset_success_desc'),
    });

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const raw = {
      fullName: String(formData.get('fullName') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
      age: String(formData.get('age') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      contactEmail: String(formData.get('contactEmail') ?? ''),
      referralCode: String(formData.get('referralCode') ?? ''),
      acceptTerms: formData.get('acceptTerms') ?? undefined,
    };

    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = String(first?.path?.[0] ?? '');
      const code = typeof first?.message === 'string' ? first.message : '';
      const description =
        field === 'age' || code === 'invalid_age'
          ? t('auth.validation.invalid_age')
          : field === 'phone' || code === 'invalid_phone'
            ? t('auth.validation.invalid_phone')
              : field === 'referralCode' || code === 'invalid_referral_code'
                ? t('auth.validation.invalid_referral_code')
            : field === 'confirmPassword' || code === 'password_mismatch'
              ? t('auth.validation.password_mismatch')
              : field === 'acceptTerms' || code === 'accept_required'
                ? t('auth.validation.accept_required')
                : t('auth.validation.invalid_contact_email');

      openError(t('auth.toasts.signup_error_title'), description);
      setIsLoading(false);
      return;
    }

    const { fullName, email, password, age, phone, contactEmail, referralCode } = parsed.data;

    const normalizedReferral = String(referralCode ?? '').trim();
    if (normalizedReferral) localStorage.setItem('pending_referral_code', normalizedReferral);
    const { error } = await signUp(email, password, fullName, {
      age,
      phone_e164: phone,
      contact_email: contactEmail,
    });

    if (error) {
      const anyErr = error as any;
      const code = String(anyErr?.code ?? '');
      const msg = String(error.message ?? '');
      const isRateLimit = code === 'over_email_send_rate_limit' || /rate limit/i.test(msg);

      if (isRateLimit) {
        openError(t('auth.errors.email_rate_limit_title'), t('auth.errors.email_rate_limit_desc'));
      } else {
        openError(t('auth.toasts.signup_error_title'), error.message);
      }
    } else {
      // If auto-confirm is enabled (or user already has a session), go to dashboard.
      // Otherwise show a clear confirmation-needed message.
      const { data: sessionData } = await supabase.auth.getSession();
      const isConfirmed = Boolean((sessionData.session?.user as any)?.email_confirmed_at);

      if (sessionData.session && isConfirmed) {
        if (normalizedReferral) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-referral-code`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
              body: JSON.stringify({ code: normalizedReferral }),
            });
          } catch {
            // ignore (will retry on next session load)
          }
        }
        navigate('/dashboard');
      } else {
        setTab('signin');
        setSignupNotice({ visible: true, email });
        toast({
          title: t('auth.signup_notice.toast_title'),
          description: t('auth.signup_notice.toast_desc'),
        });
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen">
      <AlertDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent className="border-destructive/40 bg-background shadow-2xl">
          <AlertDialogHeader className="space-y-0 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-semibold text-foreground">
                  {errorDialog.title}
                </AlertDialogTitle>
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
          className="h-9 w-[168px] border border-auth-right-border bg-auth-right-card text-auth-right-foreground backdrop-blur-md"
        />
      </header>

      {confirmFlow.active && (
        <main className="fixed inset-0 z-30 grid grid-cols-1 md:grid-cols-2">
          <section className="flex items-center justify-center bg-auth-left px-6 py-16 text-auth-left-foreground md:px-14">
            <div className="w-full max-w-md">
              <Card className="border border-border bg-card/95 shadow-2xl backdrop-blur">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <BrandLogo src={authWordmark} height={44} className="max-w-[220px]" />

                    {confirmFlow.state === 'processing' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
                    ) : confirmFlow.state === 'success' ? (
                      <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
                    )}
                  </div>

                  <CardTitle className="mt-6 text-2xl">
                    {confirmKind === 'recovery'
                      ? confirmFlow.state === 'success'
                        ? t('auth.recovery.confirmation.success_title')
                        : confirmFlow.state === 'processing'
                          ? t('auth.recovery.confirmation.processing_title')
                          : t('auth.recovery.confirmation.error_title')
                      : confirmFlow.state === 'success'
                        ? t('auth.confirmation.success_title')
                        : confirmFlow.state === 'processing'
                          ? t('auth.confirmation.processing_title')
                          : t('auth.confirmation.error_title')}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {confirmKind === 'recovery'
                      ? confirmFlow.state === 'success'
                        ? t('auth.recovery.confirmation.success_desc')
                        : confirmFlow.state === 'processing'
                          ? t('auth.recovery.confirmation.processing_desc')
                          : t('auth.recovery.confirmation.error_desc')
                      : confirmFlow.state === 'success'
                        ? t('auth.confirmation.success_desc')
                        : confirmFlow.state === 'processing'
                          ? t('auth.confirmation.processing_desc')
                          : t('auth.confirmation.error_desc')}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      {confirmKind === 'recovery'
                        ? confirmFlow.state === 'success'
                          ? t('auth.recovery.confirmation.redirecting')
                          : t('auth.recovery.confirmation.finalizing')
                        : confirmFlow.state === 'success'
                          ? t('auth.confirmation.redirecting')
                          : t('auth.confirmation.finalizing')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" aria-hidden="true" />
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary/30" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="relative hidden items-center justify-center overflow-hidden bg-auth-right px-10 py-16 text-auth-right-foreground md:flex">
            <div className="absolute inset-0" aria-hidden="true" />
            <div className="relative w-full max-w-lg">
              <div className="relative overflow-hidden rounded-2xl border border-auth-right-border bg-auth-right-card p-10 shadow-2xl backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex items-center gap-2">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium tracking-wide text-auth-right-foreground">{t('app.name')}</p>
                      <p className="text-xs text-auth-right-foreground/70">{t('auth.confirmation.brand_tagline')}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">{t('auth.confirmation.brand_title')}</h2>
                  <p className="text-sm text-auth-right-foreground/70">{t('auth.confirmation.brand_desc')}</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        {/* Left: Form */}
        <section className="flex items-center justify-center bg-auth-left px-6 py-16 text-auth-left-foreground md:px-14">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <BrandLogo src={authWordmark} height={76} className="max-w-[320px]" />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v === 'signup' ? 'signup' : 'signin')} className="w-full">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">
                  {tab === 'signup' ? t('auth.signup.title') : t('auth.signin.title')}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tab === 'signup' ? t('auth.signup.description') : t('auth.signin.description')}
                </p>
              </div>

              <TabsList className="grid h-11 w-full grid-cols-2 rounded-lg bg-secondary">
                <TabsTrigger value="signin" className="rounded-md">
                  {t('auth.tabs.signin')}
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-md">
                  {t('auth.tabs.signup')}
                </TabsTrigger>
              </TabsList>

              <div className="mt-8">
                <TabsContent value="signin" className="mt-0">
                  <Card className="border-0 bg-transparent shadow-none">
                    <CardHeader className="px-0 pb-6">
                      <CardTitle className="text-lg">{t('auth.signin.description')}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-0">
                      {signupNotice.visible && (
                        <div className="mb-5 rounded-lg border border-primary/30 bg-primary/10 p-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                              <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {t('auth.signup_notice.title')}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {t('auth.signup_notice.desc', { email: signupNotice.email ?? '' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {signinPanel === 'signin' && (
                        <form onSubmit={handleSignIn} className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="signin-email">{t('auth.fields.email')}</Label>
                            <Input
                              id="signin-email"
                              name="email"
                              type="email"
                              placeholder={t('auth.placeholders.email')}
                              defaultValue={forgotState.email}
                              required
                              className="h-11 rounded-lg"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <Label htmlFor="signin-password">{t('auth.fields.password')}</Label>
                              <button
                                type="button"
                                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                                onClick={() => {
                                  setSigninPanel('forgot');
                                  setForgotState((prev) => ({ ...prev, sent: false }));
                                }}
                              >
                                {t('auth.recovery.link')}
                              </button>
                            </div>
                            <Input
                              id="signin-password"
                              name="password"
                              type="password"
                              placeholder="••••••••"
                              required
                              className="h-11 rounded-lg"
                            />
                          </div>

                          <Button
                            type="submit"
                            className="h-11 w-full rounded-lg bg-primary shadow-lg hover:bg-primary/90"
                            disabled={isLoading}
                          >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('auth.actions.signin')}
                          </Button>
                        </form>
                      )}

                      {signinPanel === 'forgot' && (
                        <div className="space-y-5">
                          <div>
                            <p className="text-base font-semibold text-foreground">{t('auth.recovery.request_title')}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{t('auth.recovery.request_desc')}</p>
                          </div>

                          {forgotState.sent && (
                            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                                  <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{t('auth.recovery.sent_title')}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {t('auth.recovery.sent_desc', { email: forgotState.email })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="recovery-email">{t('auth.fields.email')}</Label>
                              <Input
                                id="recovery-email"
                                name="recoveryEmail"
                                type="email"
                                placeholder={t('auth.placeholders.email')}
                                value={forgotState.email}
                                onChange={(e) => setForgotState((prev) => ({ ...prev, email: e.target.value }))}
                                required
                                className="h-11 rounded-lg"
                              />
                            </div>

                            <Button
                              type="submit"
                              className="h-11 w-full rounded-lg bg-primary shadow-lg hover:bg-primary/90"
                              disabled={isLoading}
                            >
                              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {t('auth.recovery.actions.send_link')}
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11 w-full rounded-lg"
                              onClick={() => setSigninPanel('signin')}
                              disabled={isLoading}
                            >
                              {t('auth.recovery.actions.back_to_login')}
                            </Button>
                          </form>
                        </div>
                      )}

                      {signinPanel === 'reset' && (
                        <div className="space-y-5">
                          <div>
                            <p className="text-base font-semibold text-foreground">{t('auth.recovery.reset_title')}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{t('auth.recovery.reset_desc')}</p>
                          </div>

                          <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="reset-password">{t('auth.recovery.fields.new_password')}</Label>
                              <Input
                                id="reset-password"
                                type="password"
                                placeholder="••••••••"
                                value={resetState.password}
                                onChange={(e) => setResetState((prev) => ({ ...prev, password: e.target.value }))}
                                minLength={6}
                                required
                                className="h-11 rounded-lg"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="reset-confirm">{t('auth.recovery.fields.confirm_new_password')}</Label>
                              <Input
                                id="reset-confirm"
                                type="password"
                                placeholder="••••••••"
                                value={resetState.confirmPassword}
                                onChange={(e) => setResetState((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                minLength={6}
                                required
                                className="h-11 rounded-lg"
                              />
                            </div>

                            <Button
                              type="submit"
                              className="h-11 w-full rounded-lg bg-primary shadow-lg hover:bg-primary/90"
                              disabled={isLoading}
                            >
                              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {t('auth.recovery.actions.save_new_password')}
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11 w-full rounded-lg"
                              onClick={async () => {
                                setIsLoading(true);
                                await supabase.auth.signOut();
                                setSigninPanel('signin');
                                setIsLoading(false);
                              }}
                              disabled={isLoading}
                            >
                              {t('auth.recovery.actions.cancel')}
                            </Button>
                          </form>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <Card className="border-0 bg-transparent shadow-none">
                    <CardHeader className="px-0 pb-6">
                      <CardTitle className="text-lg">{t('auth.signup.description')}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-0">
                      <form onSubmit={handleSignUp} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="signup-name">{t('auth.fields.full_name')}</Label>
                          <Input
                            id="signup-name"
                            name="fullName"
                            type="text"
                            placeholder={t('auth.placeholders.full_name')}
                            required
                            className="h-11 rounded-lg"
                          />
                        </div>

                        <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
                          <div className="min-w-0 space-y-2">
                            <Label htmlFor="signup-age">{t('auth.fields.age')}</Label>
                            <Input
                              id="signup-age"
                              name="age"
                              type="number"
                              inputMode="numeric"
                              min={14}
                              max={90}
                              placeholder={t('auth.placeholders.age')}
                              required
                              className="h-11 rounded-lg"
                            />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <Label htmlFor="signup-phone">{t('auth.fields.phone')}</Label>
                            <PhoneE164Input
                              id="signup-phone"
                              name="phone"
                              defaultCountry="BR"
                              required
                              // placeholder comes from PhoneE164Input (smart by country)
                              invalidHint={t('auth.validation.invalid_phone')}
                              inputClassName="h-11 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-email">{t('auth.fields.email')}</Label>
                          <Input
                            id="signup-email"
                            name="email"
                            type="email"
                            placeholder={t('auth.placeholders.email')}
                            required
                            className="h-11 rounded-lg"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-contact-email">{t('auth.fields.contact_email')}</Label>
                          <Input
                            id="signup-contact-email"
                            name="contactEmail"
                            type="email"
                            placeholder={t('auth.placeholders.contact_email')}
                            required
                            className="h-11 rounded-lg"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-referral">{t('auth.fields.referral_code')}</Label>
                          <Input
                            id="signup-referral"
                            name="referralCode"
                            type="text"
                            placeholder={t('auth.placeholders.referral_code')}
                            className="h-11 rounded-lg"
                            maxLength={12}
                            autoCapitalize="characters"
                          />
                          <p className="text-xs text-muted-foreground">{t('referrals.signup_hint')}</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-password">{t('auth.fields.password')}</Label>
                          <Input
                            id="signup-password"
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            minLength={6}
                            required
                            className="h-11 rounded-lg"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-confirm-password">{t('auth.fields.confirm_password')}</Label>
                          <Input
                            id="signup-confirm-password"
                            name="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            minLength={6}
                            required
                            className="h-11 rounded-lg"
                          />
                        </div>

                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">{t('auth.disclaimer')}</p>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="signup-accept"
                              checked={acceptTerms}
                              onCheckedChange={(v) => setAcceptTerms(v === true)}
                            />
                            <input type="hidden" name="acceptTerms" value={acceptTerms ? 'on' : ''} />
                            <Label htmlFor="signup-accept" className="text-sm leading-snug">
                              {t('auth.accept_terms')}
                            </Label>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          className="h-11 w-full rounded-lg bg-primary shadow-lg hover:bg-primary/90"
                          disabled={isLoading}
                        >
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t('auth.actions.signup')}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </section>

        {/* Right: Marketing */}
        <section className="relative hidden items-center justify-center overflow-hidden bg-auth-right px-10 py-16 text-auth-right-foreground md:flex">
          <div className="absolute inset-0" aria-hidden="true" />

          <div className="relative w-full max-w-lg">
            <div className="relative overflow-hidden rounded-2xl border border-auth-right-border bg-auth-right-card p-10 shadow-2xl backdrop-blur-md">
              <Zap className="pointer-events-none absolute -right-10 -bottom-10 h-56 w-56 opacity-10" />

              <p className="text-sm text-auth-right-foreground/80">{t('auth.hero_tagline')}</p>

              <div className="mt-10 space-y-7">
                <p className="text-3xl font-semibold leading-tight">{t('auth.marketing.q1')}</p>
                <p className="text-xl leading-relaxed text-auth-right-foreground/85">{t('auth.marketing.q2')}</p>

                <div className="mt-6 rounded-xl border border-auth-right-border bg-auth-right-card p-6">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-auth-right-border bg-auth-right-card">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base leading-snug">
                        {t('auth.marketing.solution_prefix')}{' '}
                        <span className="font-semibold">{t('auth.marketing.solution_emphasis')}</span>{' '}
                        {t('auth.marketing.solution_suffix')}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-sm text-auth-right-foreground/80">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t('auth.marketing.subline')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 text-sm text-auth-right-foreground/70">{t('auth.marketing.footer')}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

