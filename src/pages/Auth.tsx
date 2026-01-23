import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { z } from 'zod';
import { PhoneE164Input } from '@/components/inputs/PhoneE164Input';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const signupSchema = z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(6).max(200),
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
  });

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: t('auth.toasts.signin_error_title'),
        description: error.message,
        variant: 'destructive',
      });
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
      age: String(formData.get('age') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      contactEmail: String(formData.get('contactEmail') ?? ''),
    };

    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = String(first?.path?.[0] ?? '');
      const code = typeof first?.message === 'string' ? first.message : '';
      toast({
        title: t('common.errors.invalid_data'),
        description:
          field === 'age' || code === 'invalid_age'
            ? t('auth.validation.invalid_age')
            : field === 'phone' || code === 'invalid_phone'
              ? t('auth.validation.invalid_phone')
              : t('auth.validation.invalid_contact_email'),
        variant: 'destructive',
      });
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
      toast({
        title: t('auth.toasts.signup_error_title'),
        description: error.message,
        variant: 'destructive',
      });
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* soft glass blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-stretch gap-6 p-4 md:grid-cols-2 md:gap-10 md:p-8">
        {/* Left marketing */}
        <section className="hidden md:flex">
          <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-border/40 bg-background/20 p-10 shadow-2xl backdrop-blur-xl">
            <div>
              <BrandLogo height={72} className="drop-shadow-sm max-w-[280px]" />
              <p className="mt-4 text-sm text-muted-foreground">{t('auth.hero_tagline')}</p>

              <div className="mt-10 space-y-6">
                <p className="text-2xl font-semibold leading-snug text-foreground">{t('auth.marketing.q1')}</p>
                <p className="text-xl leading-snug text-foreground/70">{t('auth.marketing.q2')}</p>

                <div className="mt-6 rounded-xl border border-border/40 bg-background/25 p-5 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-background/30">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="leading-snug">
                      <p className="text-base text-foreground">
                        {t('auth.marketing.solution_prefix')}{' '}
                        <span className="font-semibold text-primary">{t('auth.marketing.solution_emphasis')}</span>{' '}
                        {t('auth.marketing.solution_suffix')}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t('auth.marketing.subline')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 text-sm text-muted-foreground">
              {t('auth.marketing.footer')}
            </div>
          </div>
        </section>

        {/* Right auth */}
        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center md:hidden">
              <div className="inline-flex items-center justify-center">
                <BrandLogo height={72} className="drop-shadow-sm max-w-[280px]" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t('auth.hero_tagline')}</p>
            </div>

            <Card className="border-border/40 bg-background/25 shadow-2xl backdrop-blur-xl">
              <Tabs defaultValue="signin" className="w-full">
                <CardHeader className="pb-4">
                  <TabsList className="grid w-full grid-cols-2 bg-background/30">
                    <TabsTrigger value="signin">{t('auth.tabs.signin')}</TabsTrigger>
                    <TabsTrigger value="signup">{t('auth.tabs.signup')}</TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent>
                  <TabsContent value="signin" className="mt-0">
                    <CardTitle className="text-xl mb-1">{t('auth.signin.title')}</CardTitle>
                    <CardDescription className="mb-6">{t('auth.signin.description')}</CardDescription>

                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">{t('auth.fields.email')}</Label>
                        <Input
                          id="signin-email"
                          name="email"
                          type="email"
                          placeholder={t('auth.placeholders.email')}
                          required
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
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('auth.actions.signin')}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0">
                    <CardTitle className="text-xl mb-1">{t('auth.signup.title')}</CardTitle>
                    <CardDescription className="mb-6">{t('auth.signup.description')}</CardDescription>

                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">{t('auth.fields.full_name')}</Label>
                        <Input
                          id="signup-name"
                          name="fullName"
                          type="text"
                          placeholder={t('auth.placeholders.full_name')}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
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
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-phone">{t('auth.fields.phone')}</Label>
                          <PhoneE164Input
                            id="signup-phone"
                            name="phone"
                            required
                            placeholder={t('auth.placeholders.phone')}
                            invalidHint={t('auth.validation.invalid_phone')}
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
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('auth.actions.signup')}
                      </Button>
                    </form>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
