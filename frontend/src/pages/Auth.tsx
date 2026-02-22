import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PhoneE164Input } from "@/components/inputs/PhoneE164Input";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n";
import { getBaseUrl } from "@/config/app.config";
import { supabase } from "@/integrations/supabase/client";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [signinPanel, setSigninPanel] = useState<"signin" | "forgot" | "reset">("signin");
  const [forgotState, setForgotState] = useState({ email: "", sent: false, cooldownUntilMs: 0 });
  const [resetState, setResetState] = useState({ password: "", confirmPassword: "" });
  const [confirmKind, setConfirmKind] = useState<"email" | "recovery">("email");
  const [confirmFlow, setConfirmFlow] = useState<{ active: boolean; state: "processing" | "success" | "error" }>({
    active: false,
    state: "processing",
  });
  const [signupNotice, setSignupNotice] = useState<{ visible: boolean; email?: string }>({
    visible: false,
    email: undefined,
  });
  const [errorDialog, setErrorDialog] = useState({ open: false, title: "", description: "" });

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const openError = (title: string, description: string) => setErrorDialog({ open: true, title, description });

  const okLabel = useMemo(() => {
    const label = t("common.ok");
    return label === "common.ok" ? "OK" : label;
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
          if (password !== confirmPassword)
            ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
        }),
    [],
  );

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
        .refine((n) => Number.isInteger(n) && n >= 14 && n <= 90, { message: "invalid_age" }),
      phone: z
        .string()
        .trim()
        .min(1)
        .refine((v) => Boolean(parsePhoneNumberFromString(v)?.isValid()), { message: "invalid_phone" }),
      contactEmail: z.string().trim().email().max(255),
      referralCode: z
        .string()
        .trim()
        .transform((v) => v.toUpperCase())
        .refine((v) => v === "" || /^[A-Z0-9]{6}$/.test(v), { message: "invalid_referral_code" }),
      acceptTerms: z.preprocess(
        (v) => v === "on" || v === true,
        z.boolean().refine((v) => v === true, { message: "accept_required" }),
      ),
    })
    .superRefine(({ password, confirmPassword }, ctx) => {
      if (password !== confirmPassword)
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
    });

  // ─── URL confirmation flow (email confirm, recovery, etc.) ─────────────
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const type = url.searchParams.get("type");
      const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
      const authError = url.searchParams.get("error");
      const authErrorCode = url.searchParams.get("error_code");
      const authErrorDesc = url.searchParams.get("error_description");
      const isRecovery = type === "recovery";

      if (isRecovery && window.location.pathname === "/auth") {
        navigate(`/reset-password${window.location.search}`, { replace: true });
        return;
      }
      if (authError) {
        setTab("signin");
        setSigninPanel(isRecovery ? "forgot" : "signin");
        if (isRecovery) {
          const isExpired = authErrorCode === "otp_expired" || /expired/i.test(String(authErrorDesc ?? ""));
          openError(
            isExpired ? t("auth.recovery.errors.link_expired_title") : t("auth.recovery.errors.link_invalid_title"),
            isExpired ? t("auth.recovery.errors.link_expired_desc") : t("auth.recovery.errors.link_invalid_desc"),
          );
        } else {
          openError(t("auth.toasts.signin_error_title"), String(authErrorDesc ?? authError));
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      if (!code && !(type && tokenHash)) return;

      setIsLoading(true);
      setConfirmKind(isRecovery ? "recovery" : "email");
      setConfirmFlow({ active: true, state: "processing" });
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!cancelled) openError(t("auth.toasts.signin_error_title"), error.message);
            if (!cancelled) setConfirmFlow({ active: true, state: "error" });
            return;
          }
        } else if (type && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash: tokenHash });
          if (error) {
            if (!cancelled) openError(t("auth.toasts.signin_error_title"), error.message);
            if (!cancelled) setConfirmFlow({ active: true, state: "error" });
            return;
          }
        }
        const maxAttempts = 20;
        for (let i = 0; i < maxAttempts; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) {
            setConfirmFlow({ active: true, state: "error" });
            openError(t("auth.toasts.signin_error_title"), t("auth.confirmation.session_timeout"));
          }
          return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        if (!cancelled) setConfirmFlow({ active: true, state: "success" });
        if (isRecovery) {
          await new Promise((r) => setTimeout(r, 900));
          if (!cancelled) {
            setTab("signin");
            setSigninPanel("reset");
            setConfirmFlow({ active: false, state: "processing" });
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
        if (!cancelled) navigate("/dashboard", { replace: true });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [navigate, t]);

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupNotice({ visible: false });
    const fd = new FormData(e.currentTarget);
    const { error } = await signIn(fd.get("email") as string, fd.get("password") as string);
    if (error) openError(t("auth.toasts.signin_error_title"), error.message);
    else navigate("/dashboard");
    setIsLoading(false);
  };

  const handleRequestPasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const now = Date.now();
    if (forgotState.cooldownUntilMs && now < forgotState.cooldownUntilMs) {
      openError(t("auth.recovery.errors.cooldown_title"), t("auth.recovery.errors.cooldown_desc"));
      setIsLoading(false);
      return;
    }
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("recoveryEmail") ?? "").trim();
    const parsed = forgotEmailSchema.safeParse(email);
    if (!parsed.success) {
      openError(t("auth.recovery.errors.invalid_email_title"), t("auth.recovery.errors.invalid_email_desc"));
      setIsLoading(false);
      return;
    }
    const redirectTo = `${getBaseUrl()}/reset-password?type=recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });
    if (error) {
      const code = String((error as any)?.code ?? "");
      const msg = String(error.message ?? "");
      const isRateLimit = code === "over_email_send_rate_limit" || /rate limit/i.test(msg);
      openError(
        isRateLimit ? t("auth.recovery.errors.email_rate_limit_title") : t("auth.recovery.errors.request_error_title"),
        isRateLimit ? t("auth.recovery.errors.email_rate_limit_desc") : error.message,
      );
    } else {
      setForgotState({ email: parsed.data, sent: true, cooldownUntilMs: Date.now() + 60_000 });
      toast({ title: t("auth.recovery.toasts.sent_title"), description: t("auth.recovery.toasts.sent_desc") });
    }
    setIsLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const parsed = resetPasswordSchema.safeParse(resetState);
    if (!parsed.success) {
      openError(t("auth.recovery.errors.reset_error_title"), t("auth.validation.password_mismatch"));
      setIsLoading(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      openError(t("auth.recovery.errors.no_session_title"), t("common.errors.no_session"));
      setIsLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      openError(t("auth.recovery.errors.reset_error_title"), error.message);
      setIsLoading(false);
      return;
    }
    await supabase.auth.signOut();
    setResetState({ password: "", confirmPassword: "" });
    setSigninPanel("signin");
    toast({
      title: t("auth.recovery.toasts.reset_success_title"),
      description: t("auth.recovery.toasts.reset_success_desc"),
    });
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const fd = new FormData(e.currentTarget);
    const raw = {
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
      age: String(fd.get("age") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""),
      referralCode: String(fd.get("referralCode") ?? ""),
      acceptTerms: fd.get("acceptTerms") ?? undefined,
    };
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = String(first?.path?.[0] ?? "");
      const code = typeof first?.message === "string" ? first.message : "";
      const description =
        field === "age" || code === "invalid_age"
          ? t("auth.validation.invalid_age")
          : field === "phone" || code === "invalid_phone"
            ? t("auth.validation.invalid_phone")
            : field === "referralCode" || code === "invalid_referral_code"
              ? t("auth.validation.invalid_referral_code")
              : field === "confirmPassword" || code === "password_mismatch"
                ? t("auth.validation.password_mismatch")
                : field === "acceptTerms" || code === "accept_required"
                  ? t("auth.validation.accept_required")
                  : t("auth.validation.invalid_contact_email");
      openError(t("auth.toasts.signup_error_title"), description);
      setIsLoading(false);
      return;
    }
    const { fullName, email, password, age, phone, contactEmail, referralCode } = parsed.data;
    const normalizedReferral = String(referralCode ?? "").trim();
    if (normalizedReferral) localStorage.setItem("pending_referral_code", normalizedReferral);
    const { error } = await signUp(email, password, fullName, { age, phone_e164: phone, contact_email: contactEmail });
    if (error) {
      const code = String((error as any)?.code ?? "");
      const msg = String(error.message ?? "");
      const isRateLimit = code === "over_email_send_rate_limit" || /rate limit/i.test(msg);
      const isWeakPassword = code === "weak_password" || /weak.*password|password.*weak/i.test(msg);
      openError(
        t("auth.toasts.signup_error_title"),
        isRateLimit
          ? t("auth.errors.email_rate_limit_desc")
          : isWeakPassword
            ? t("auth.errors.weak_password_desc")
            : error.message,
      );
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const isConfirmed = Boolean((sessionData.session?.user as any)?.email_confirmed_at);
      if (sessionData.session && isConfirmed) {
        if (normalizedReferral) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-referral-code`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
              body: JSON.stringify({ code: normalizedReferral }),
            });
          } catch { /* ignore */ }
        }
        navigate("/dashboard");
      } else {
        setTab("signin");
        setSignupNotice({ visible: true, email });
        toast({ title: t("auth.signup_notice.toast_title"), description: t("auth.signup_notice.toast_desc") });
      }
    }
    setIsLoading(false);
  };

  // ─── Confirmation overlay ─────────────────────────────────────────────
  if (confirmFlow.active) {
    return (
      <div className="fixed inset-0 bg-primary flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-10">
          <BrandWordmark height={44} className="[&_span]:text-primary-foreground [&_span_.text-primary]:text-ring" />
          <div className="mt-8 mb-3">
            {confirmFlow.state === "processing" && (
              <Loader2 size={20} className="text-ring animate-spin" />
            )}
            {confirmFlow.state === "success" && <CheckCircle2 size={20} className="text-success" />}
            {confirmFlow.state === "error" && <AlertTriangle size={20} className="text-destructive" />}
          </div>
          <div className="text-lg font-bold text-primary-foreground mb-1.5">
            {confirmKind === "recovery"
              ? confirmFlow.state === "success"
                ? t("auth.recovery.confirmation.success_title")
                : confirmFlow.state === "processing"
                  ? t("auth.recovery.confirmation.processing_title")
                  : t("auth.recovery.confirmation.error_title")
              : confirmFlow.state === "success"
                ? t("auth.confirmation.success_title")
                : confirmFlow.state === "processing"
                  ? t("auth.confirmation.processing_title")
                  : t("auth.confirmation.error_title")}
          </div>
          <div className="text-sm text-primary-foreground/50 leading-relaxed">
            {confirmKind === "recovery"
              ? confirmFlow.state === "success"
                ? t("auth.recovery.confirmation.success_desc")
                : confirmFlow.state === "processing"
                  ? t("auth.recovery.confirmation.processing_desc")
                  : t("auth.recovery.confirmation.error_desc")
              : confirmFlow.state === "success"
                ? t("auth.confirmation.success_desc")
                : confirmFlow.state === "processing"
                  ? t("auth.confirmation.processing_desc")
                  : t("auth.confirmation.error_desc")}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────
  return (
    <>
      {/* Error dialog */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((p) => ({ ...p, open }))}>
        <AlertDialogContent className="border-destructive/40 shadow-2xl">
          <AlertDialogHeader className="space-y-0 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-semibold">{errorDialog.title}</AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-sm">{errorDialog.description}</AlertDialogDescription>
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

      <div className="min-h-screen bg-primary relative overflow-hidden flex">
        {/* ── Decorative background patterns (US-inspired) ── */}
        {/* Diagonal stripes */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 28px,
              white 28px,
              white 29px
            )`,
          }}
        />
        {/* Stars pattern — top area */}
        <div className="absolute top-8 left-8 opacity-[0.06] pointer-events-none hidden lg:block">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <Star key={i} size={12} className="text-white fill-white" />
            ))}
          </div>
        </div>
        {/* Glow accent */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, hsl(199 88% 48% / 0.12) 0%, transparent 70%)" }}
        />

        {/* ── Left panel — branding (desktop only) ── */}
        <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative z-10">
          <div>
            <BrandWordmark height={48} className="[&_span]:text-primary-foreground [&_span_.text-primary]:text-ring" />
            <p className="mt-6 text-primary-foreground/40 text-sm max-w-xs leading-relaxed">
              Vagas H-2A e H-2B · Do DOL direto pra você
            </p>
            <div className="mt-4 w-10 h-0.5 bg-ring/60 rounded-full" />
          </div>

          {/* Decorative visa badges */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-primary-foreground/60 tracking-wide">
                <Star size={10} className="text-ring fill-ring" /> H-2A Agricultural
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-primary-foreground/60 tracking-wide">
                <Star size={10} className="text-ring fill-ring" /> H-2B Non-Agricultural
              </span>
            </div>
            <p className="text-[11px] text-primary-foreground/20 max-w-xs">
              U.S. Department of Labor · Temporary Employment Certification
            </p>
          </div>
        </div>

        {/* ── Right panel — form ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative z-10">
          {/* Top bar (mobile logo + language) */}
          <div className="w-full max-w-md flex items-center justify-between mb-8 lg:mb-0 lg:absolute lg:top-8 lg:right-12 lg:w-auto">
            <div className="lg:hidden">
              <BrandWordmark height={36} className="[&_span]:text-primary-foreground [&_span_.text-primary]:text-ring" />
            </div>
            <LanguageSwitcher
              value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
              onChange={handleChangeLanguage}
              className="h-9 w-[130px] border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            />
          </div>

          {/* Form card */}
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/50 p-8 sm:p-10">
            {/* Tabs */}
            <div className="grid grid-cols-2 bg-muted rounded-lg p-1 mb-7 gap-0">
              <button
                className={`py-2.5 px-4 rounded-md text-sm font-semibold font-brand transition-all ${
                  tab === "signin"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTab("signin")}
              >
                {t("auth.tabs.signin")}
              </button>
              <button
                className={`py-2.5 px-4 rounded-md text-sm font-semibold font-brand transition-all ${
                  tab === "signup"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTab("signup")}
              >
                {t("auth.tabs.signup")}
              </button>
            </div>

            {/* ── SIGN IN ── */}
            {tab === "signin" && (
              <div>
                {signupNotice.visible && (
                  <div className="p-3 bg-success/10 border border-success/30 rounded-lg mb-5">
                    <div className="flex gap-2 items-start">
                      <CheckCircle2 size={15} className="text-success mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-success">{t("auth.signup_notice.title")}</p>
                        <p className="text-xs text-success/80 mt-0.5">
                          {t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {signinPanel === "signin" && (
                  <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("auth.fields.email")}
                      </label>
                      <Input name="email" type="email" placeholder={t("auth.placeholders.email")} required />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t("auth.fields.password")}
                        </label>
                        <button
                          type="button"
                          onClick={() => setSigninPanel("forgot")}
                          className="text-xs text-ring hover:text-ring/80 font-medium bg-transparent border-none cursor-pointer"
                        >
                          {t("auth.recovery.link")}
                        </button>
                      </div>
                      <Input name="password" type="password" required />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-2 bg-ring hover:bg-ring/90 text-white font-bold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading && <Loader2 size={15} className="animate-spin" />}
                      {t("auth.actions.signin")}
                    </button>
                  </form>
                )}

                {signinPanel === "forgot" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-base font-semibold text-foreground">{t("auth.recovery.request_title")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("auth.recovery.request_desc")}</p>
                    </div>
                    {forgotState.sent && (
                      <div className="p-3 bg-success/10 border border-success/30 rounded-lg">
                        <p className="text-sm font-semibold text-success">{t("auth.recovery.sent_title")}</p>
                        <p className="text-xs text-success/80 mt-0.5">
                          {t("auth.recovery.sent_desc", { email: forgotState.email })}
                        </p>
                      </div>
                    )}
                    <form onSubmit={handleRequestPasswordReset} className="flex flex-col gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t("auth.fields.email")}
                        </label>
                        <Input
                          name="recoveryEmail"
                          type="email"
                          value={forgotState.email}
                          onChange={(e) => setForgotState((p) => ({ ...p, email: e.target.value }))}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-ring hover:bg-ring/90 text-white font-bold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isLoading && <Loader2 size={15} className="animate-spin" />}
                        {t("auth.recovery.actions.send_link")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigninPanel("signin")}
                        className="w-full border border-border text-muted-foreground hover:text-foreground font-medium py-2.5 rounded-lg text-sm transition-colors bg-transparent cursor-pointer"
                      >
                        {t("auth.recovery.actions.back_to_login")}
                      </button>
                    </form>
                  </div>
                )}

                {signinPanel === "reset" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-base font-semibold text-foreground">{t("auth.recovery.reset_title")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("auth.recovery.reset_desc")}</p>
                    </div>
                    <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t("auth.recovery.fields.new_password")}
                        </label>
                        <Input
                          type="password"
                          value={resetState.password}
                          required
                          minLength={6}
                          onChange={(e) => setResetState((p) => ({ ...p, password: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t("auth.recovery.fields.confirm_new_password")}
                        </label>
                        <Input
                          type="password"
                          value={resetState.confirmPassword}
                          required
                          minLength={6}
                          onChange={(e) => setResetState((p) => ({ ...p, confirmPassword: e.target.value }))}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-ring hover:bg-ring/90 text-white font-bold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isLoading && <Loader2 size={15} className="animate-spin" />}
                        {t("auth.recovery.actions.save_new_password")}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── SIGN UP ── */}
            {tab === "signup" && (
              <form onSubmit={handleSignUp} className="flex flex-col gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("auth.fields.full_name")}
                  </label>
                  <Input name="fullName" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("auth.fields.age")}
                    </label>
                    <Input name="age" type="number" min={14} max={90} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("auth.fields.phone")}
                    </label>
                    <PhoneE164Input id="phone" name="phone" defaultCountry="BR" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("auth.fields.email")}
                  </label>
                  <Input name="email" type="email" required />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("auth.fields.contact_email")}
                  </label>
                  <Input name="contactEmail" type="email" required />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("auth.fields.referral_code")}
                  </label>
                  <Input name="referralCode" maxLength={12} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("auth.fields.password")}
                  </label>
                  <Input name="password" type="password" minLength={6} required />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("auth.fields.confirm_password")}
                  </label>
                  <Input name="confirmPassword" type="password" minLength={6} required />
                </div>

                <div className="flex flex-col gap-2.5 pt-1">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{t("auth.disclaimer")}</p>
                  <div className="flex gap-2 items-start">
                    <Checkbox id="accept" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} />
                    <input type="hidden" name="acceptTerms" value={acceptTerms ? "on" : ""} />
                    <label htmlFor="accept" className="text-[11px] text-muted-foreground leading-snug cursor-pointer">
                      {t("auth.accept_terms")}
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 bg-ring hover:bg-ring/90 text-white font-bold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading && <Loader2 size={15} className="animate-spin" />}
                  {t("auth.actions.signup")}
                </button>
              </form>
            )}
          </div>

          {/* Footer link */}
          <button
            onClick={() => navigate("/jobs")}
            className="mt-6 text-xs text-primary-foreground/25 hover:text-primary-foreground/50 transition-colors bg-transparent border-none cursor-pointer font-brand"
          >
            Ver vagas sem criar conta →
          </button>
        </div>
      </div>
    </>
  );
}
