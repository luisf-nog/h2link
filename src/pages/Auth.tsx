import { useMemo, useState } from 'react';
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
            : field === 'confirmPassword' || code === 'password_mismatch'
              ? t('auth.validation.password_mismatch')
              : field === 'acceptTerms' || code === 'accept_required'
                ? t('auth.validation.accept_required')
                : t('auth.validation.invalid_contact_email');

      openError(t('auth.toasts.signup_error_title'), description);
      setIsLoading(false);
      return;
    }

    const { fullName, email, password, age, phone, contactEmail } = parsed.data;
    const { error } = await signUp(email, password, fullName, {
      age,
      phone_e164: phone,
      contact_email: contactEmail,
    });

    if (error) {
      openError(t('auth.toasts.signup_error_title'), error.message);
    } else {
      toast({
        title: t('auth.toasts.signup_success_title'),
        description: t('auth.toasts.signup_success_desc'),
      });
      navigate('/dashboard');
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
                      <form onSubmit={handleSignIn} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="signin-email">{t('auth.fields.email')}</Label>
                          <Input
                            id="signin-email"
                            name="email"
                            type="email"
                            placeholder={t('auth.placeholders.email')}
                            required
                            className="h-11 rounded-lg"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signin-password">{t('auth.fields.password')}</Label>
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

