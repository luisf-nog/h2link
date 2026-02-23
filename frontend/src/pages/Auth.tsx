import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PhoneE164Input } from "@/components/inputs/PhoneE164Input";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { isSupportedLanguage, type SupportedLanguage } from "@/i18n";
import { getBaseUrl } from "@/config/app.config";
import { supabase } from "@/integrations/supabase/client";
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
      z.object({
        password: z.string().min(6).max(200),
        confirmPassword: z.string().min(6).max(200),
      }).superRefine(({ password, confirmPassword }, ctx) => {
        if (password !== confirmPassword)
          ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
      }),
    [],
  );

  const signupSchema = z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(6).max(200),
    confirmPassword: z.string().min(6).max(200),
    age: z.string().trim().transform((v) => Number(v)).refine((n) => Number.isInteger(n) && n >= 14 && n <= 90, { message: "invalid_age" }),
    phone: z.string().trim().min(1).refine((v) => Boolean(parsePhoneNumberFromString(v)?.isValid()), { message: "invalid_phone" }),
    contactEmail: z.string().trim().email().max(255),
    referralCode: z.string().trim().transform((v) => v.toUpperCase()).refine((v) => v === "" || /^[A-Z0-9]{6}$/.test(v), { message: "invalid_referral_code" }),
    acceptTerms: z.preprocess((v) => v === "on" || v === true, z.boolean().refine((v) => v === true, { message: "accept_required" })),
  }).superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword)
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
  });

  // ─── URL confirmation flow ─────────────────────────────────────────────
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
          if (error) { if (!cancelled) { openError(t("auth.toasts.signin_error_title"), error.message); setConfirmFlow({ active: true, state: "error" }); } return; }
        } else if (type && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash: tokenHash });
          if (error) { if (!cancelled) { openError(t("auth.toasts.signin_error_title"), error.message); setConfirmFlow({ active: true, state: "error" }); } return; }
        }
        for (let i = 0; i < 20; i++) { const { data } = await supabase.auth.getSession(); if (data.session) break; await new Promise((r) => setTimeout(r, 300)); }
        const { data } = await supabase.auth.getSession();
        if (!data.session) { if (!cancelled) { setConfirmFlow({ active: true, state: "error" }); openError(t("auth.toasts.signin_error_title"), t("auth.confirmation.session_timeout")); } return; }
        window.history.replaceState({}, document.title, window.location.pathname);
        if (!cancelled) setConfirmFlow({ active: true, state: "success" });
        if (isRecovery) { await new Promise((r) => setTimeout(r, 900)); if (!cancelled) { setTab("signin"); setSigninPanel("reset"); setConfirmFlow({ active: false, state: "processing" }); } return; }
        await new Promise((r) => setTimeout(r, 2000));
        if (!cancelled) navigate("/dashboard", { replace: true });
      } finally { if (!cancelled) setIsLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [navigate, t]);

  const handleChangeLanguage = (next: SupportedLanguage) => { i18n.changeLanguage(next); localStorage.setItem("app_language", next); };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsLoading(true); setSignupNotice({ visible: false });
    const fd = new FormData(e.currentTarget);
    const { error } = await signIn(fd.get("email") as string, fd.get("password") as string);
    if (error) openError(t("auth.toasts.signin_error_title"), error.message);
    else navigate("/dashboard");
    setIsLoading(false);
  };

  const handleRequestPasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsLoading(true);
    if (forgotState.cooldownUntilMs && Date.now() < forgotState.cooldownUntilMs) { openError(t("auth.recovery.errors.cooldown_title"), t("auth.recovery.errors.cooldown_desc")); setIsLoading(false); return; }
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("recoveryEmail") ?? "").trim();
    const parsed = forgotEmailSchema.safeParse(email);
    if (!parsed.success) { openError(t("auth.recovery.errors.invalid_email_title"), t("auth.recovery.errors.invalid_email_desc")); setIsLoading(false); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${getBaseUrl()}/reset-password?type=recovery` });
    if (error) {
      const code = String((error as any)?.code ?? ""); const msg = String(error.message ?? "");
      const isRateLimit = code === "over_email_send_rate_limit" || /rate limit/i.test(msg);
      openError(isRateLimit ? t("auth.recovery.errors.email_rate_limit_title") : t("auth.recovery.errors.request_error_title"), isRateLimit ? t("auth.recovery.errors.email_rate_limit_desc") : error.message);
    } else { setForgotState({ email: parsed.data, sent: true, cooldownUntilMs: Date.now() + 60_000 }); toast({ title: t("auth.recovery.toasts.sent_title"), description: t("auth.recovery.toasts.sent_desc") }); }
    setIsLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsLoading(true);
    const parsed = resetPasswordSchema.safeParse(resetState);
    if (!parsed.success) { openError(t("auth.recovery.errors.reset_error_title"), t("auth.validation.password_mismatch")); setIsLoading(false); return; }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { openError(t("auth.recovery.errors.no_session_title"), t("common.errors.no_session")); setIsLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) { openError(t("auth.recovery.errors.reset_error_title"), error.message); setIsLoading(false); return; }
    await supabase.auth.signOut();
    setResetState({ password: "", confirmPassword: "" }); setSigninPanel("signin");
    toast({ title: t("auth.recovery.toasts.reset_success_title"), description: t("auth.recovery.toasts.reset_success_desc") });
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsLoading(true);
    const fd = new FormData(e.currentTarget);
    const raw = {
      fullName: String(fd.get("fullName") ?? ""), email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""), confirmPassword: String(fd.get("confirmPassword") ?? ""),
      age: String(fd.get("age") ?? ""), phone: String(fd.get("phone") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""), referralCode: String(fd.get("referralCode") ?? ""),
      acceptTerms: fd.get("acceptTerms") ?? undefined,
    };
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0]; const field = String(first?.path?.[0] ?? ""); const code = typeof first?.message === "string" ? first.message : "";
      const description = field === "age" || code === "invalid_age" ? t("auth.validation.invalid_age")
        : field === "phone" || code === "invalid_phone" ? t("auth.validation.invalid_phone")
        : field === "referralCode" || code === "invalid_referral_code" ? t("auth.validation.invalid_referral_code")
        : field === "confirmPassword" || code === "password_mismatch" ? t("auth.validation.password_mismatch")
        : field === "acceptTerms" || code === "accept_required" ? t("auth.validation.accept_required")
        : t("auth.validation.invalid_contact_email");
      openError(t("auth.toasts.signup_error_title"), description); setIsLoading(false); return;
    }
    const { fullName, email, password, age, phone, contactEmail, referralCode } = parsed.data;
    const normalizedReferral = String(referralCode ?? "").trim();
    if (normalizedReferral) localStorage.setItem("pending_referral_code", normalizedReferral);
    const { error } = await signUp(email, password, fullName, { age, phone_e164: phone, contact_email: contactEmail });
    if (error) {
      const code = String((error as any)?.code ?? ""); const msg = String(error.message ?? "");
      const isRateLimit = code === "over_email_send_rate_limit" || /rate limit/i.test(msg);
      const isWeakPassword = code === "weak_password" || /weak.*password|password.*weak/i.test(msg);
      openError(t("auth.toasts.signup_error_title"), isRateLimit ? t("auth.errors.email_rate_limit_desc") : isWeakPassword ? t("auth.errors.weak_password_desc") : error.message);
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const isConfirmed = Boolean((sessionData.session?.user as any)?.email_confirmed_at);
      if (sessionData.session && isConfirmed) {
        if (normalizedReferral) { try { await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-referral-code`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ code: normalizedReferral }) }); } catch {} }
        navigate("/dashboard");
      } else { setTab("signin"); setSignupNotice({ visible: true, email }); toast({ title: t("auth.signup_notice.toast_title"), description: t("auth.signup_notice.toast_desc") }); }
    }
    setIsLoading(false);
  };

  // ─── Confirmation overlay ─────────────────────────────────────────────
  if (confirmFlow.active) {
    return (
      <div className="auth-premium-bg fixed inset-0 flex items-center justify-center p-6">
        <div className="w-full max-w-sm auth-glass-card p-10">
          <h1 className="text-2xl font-bold font-brand text-white">
            <span className="auth-accent-text">H2</span> Linker
          </h1>
          <div className="mt-8 mb-3">
            {confirmFlow.state === "processing" && <Loader2 size={20} className="auth-accent-text animate-spin" />}
            {confirmFlow.state === "success" && <CheckCircle2 size={20} className="text-emerald-400" />}
            {confirmFlow.state === "error" && <AlertTriangle size={20} className="text-red-400" />}
          </div>
          <div className="text-lg font-bold text-white mb-1.5">
            {confirmKind === "recovery"
              ? confirmFlow.state === "success" ? t("auth.recovery.confirmation.success_title") : confirmFlow.state === "processing" ? t("auth.recovery.confirmation.processing_title") : t("auth.recovery.confirmation.error_title")
              : confirmFlow.state === "success" ? t("auth.confirmation.success_title") : confirmFlow.state === "processing" ? t("auth.confirmation.processing_title") : t("auth.confirmation.error_title")}
          </div>
          <div className="text-sm text-white/40 leading-relaxed">
            {confirmKind === "recovery"
              ? confirmFlow.state === "success" ? t("auth.recovery.confirmation.success_desc") : confirmFlow.state === "processing" ? t("auth.recovery.confirmation.processing_desc") : t("auth.recovery.confirmation.error_desc")
              : confirmFlow.state === "success" ? t("auth.confirmation.success_desc") : confirmFlow.state === "processing" ? t("auth.confirmation.processing_desc") : t("auth.confirmation.error_desc")}
          </div>
        </div>
      </div>
    );
  }

  const labelCls = "text-[11px] font-bold uppercase tracking-[0.08em] text-white/40";
  const inputCls = "bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/20 focus:border-white/20 focus:ring-white/10 h-11 rounded-xl";
  const btnPrimary = "w-full mt-3 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 auth-btn-gradient text-white shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 hover:brightness-110";
  const btnGhost = "w-full border border-white/10 text-white/50 hover:text-white hover:border-white/20 font-medium py-2.5 rounded-xl text-sm transition-all bg-transparent cursor-pointer";

  return (
    <>
      <style>{`
        .auth-premium-bg {
          background: linear-gradient(145deg, #0a0e1a 0%, #0c1929 35%, #0a1628 65%, #080d18 100%);
        }
        .auth-glass-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          backdrop-filter: blur(40px);
          box-shadow: 
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 32px 64px -12px rgba(0,0,0,0.5),
            0 0 120px -40px rgba(14,165,233,0.08);
        }
        .auth-accent-text {
          background: linear-gradient(135deg, #0ea5e9, #38bdf8);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .auth-btn-gradient {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
        }
        .auth-btn-gradient:hover {
          background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
        }
        .auth-tab-active {
          background: linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(14,165,233,0.05) 100%);
          border: 1px solid rgba(14,165,233,0.25);
          color: #38bdf8;
        }
        .auth-grid-pattern {
          background-image: 
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .auth-glow-1 {
          position: absolute;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%);
          top: -200px; right: -100px;
          pointer-events: none;
        }
        .auth-glow-2 {
          position: absolute;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(220,38,38,0.04) 0%, transparent 70%);
          bottom: -150px; left: -100px;
          pointer-events: none;
        }
        .auth-stripe {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(14,165,233,0.15), transparent);
        }
        @keyframes auth-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .auth-premium-bg input {
          font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif !important;
        }
      `}</style>

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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{okLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="auth-premium-bg min-h-screen relative overflow-hidden flex">
        {/* Background effects */}
        <div className="absolute inset-0 auth-grid-pattern pointer-events-none" />
        <div className="auth-glow-1" />
        <div className="auth-glow-2" />
        <div className="auth-stripe" style={{ top: "20%", left: 0, right: 0 }} />
        <div className="auth-stripe" style={{ top: "80%", left: 0, right: 0, opacity: 0.5 }} />

        {/* ── Left branding panel (lg+) ── */}
        <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-16 relative z-10">
          <div>
            <h1 className="text-4xl font-bold font-brand text-white tracking-tight">
              <span className="auth-accent-text">H2</span> Linker
            </h1>
            <p className="mt-5 text-white/30 text-base max-w-sm leading-relaxed">
              {t("auth.hero_description")}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-sky-500/40 to-transparent" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-semibold">{t("auth.visa_programs_label")}</span>
            </div>
          </div>

          {/* Stats / trust signals */}
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-3xl font-bold text-white font-brand">10,000<span className="auth-accent-text">+</span></div>
                <div className="text-xs text-white/30 mt-1">{t("auth.stats.jobs_in_database")}</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white font-brand">100<span className="auth-accent-text">%</span></div>
                <div className="text-xs text-white/30 mt-1">{t("auth.stats.free_to_start")}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 text-[10px] font-bold text-sky-400/70 tracking-wider uppercase">
                {t("auth.badges.h2a")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 text-[10px] font-bold text-sky-400/70 tracking-wider uppercase">
                {t("auth.badges.h2b")}
              </span>
            </div>

          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 relative z-10">
          {/* Top bar */}
          <div className="w-full max-w-[440px] flex items-center justify-between mb-10 lg:absolute lg:top-10 lg:right-16 lg:w-auto">
            <div className="lg:hidden">
              <h1 className="text-xl font-bold font-brand text-white">
                <span className="auth-accent-text">H2</span> Linker
              </h1>
            </div>
            <LanguageSwitcher
              value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
              onChange={handleChangeLanguage}
              className="h-9 w-[130px] border-white/10 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl"
            />
          </div>

          {/* Form card */}
          <div className="w-full max-w-[440px] auth-glass-card p-8 sm:p-10">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-8">
              <button
                className={`py-2.5 px-4 rounded-xl text-sm font-semibold font-brand transition-all ${
                  tab === "signin" ? "auth-tab-active" : "text-white/30 hover:text-white/50 border border-transparent"
                }`}
                onClick={() => setTab("signin")}
              >
                {t("auth.tabs.signin")}
              </button>
              <button
                className={`py-2.5 px-4 rounded-xl text-sm font-semibold font-brand transition-all ${
                  tab === "signup" ? "auth-tab-active" : "text-white/30 hover:text-white/50 border border-transparent"
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
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-6">
                    <div className="flex gap-2.5 items-start">
                      <CheckCircle2 size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-300">{t("auth.signup_notice.title")}</p>
                        <p className="text-xs text-emerald-400/60 mt-0.5">{t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}</p>
                      </div>
                    </div>
                  </div>
                )}

                {signinPanel === "signin" && (
                  <form onSubmit={handleSignIn} className="flex flex-col gap-5">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("auth.fields.email")}</label>
                      <Input name="email" type="email" placeholder={t("auth.placeholders.email")} required className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className={labelCls}>{t("auth.fields.password")}</label>
                        <button type="button" onClick={() => setSigninPanel("forgot")} className="text-[11px] auth-accent-text hover:brightness-125 font-medium bg-transparent border-none cursor-pointer transition-all">
                          {t("auth.recovery.link")}
                        </button>
                      </div>
                      <Input name="password" type="password" required className={inputCls} />
                    </div>
                    <button type="submit" disabled={isLoading} className={btnPrimary}>
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      {t("auth.actions.signin")}
                    </button>
                  </form>
                )}

                {signinPanel === "forgot" && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-base font-semibold text-white">{t("auth.recovery.request_title")}</p>
                      <p className="text-sm text-white/40 mt-1">{t("auth.recovery.request_desc")}</p>
                    </div>
                    {forgotState.sent && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <p className="text-sm font-semibold text-emerald-300">{t("auth.recovery.sent_title")}</p>
                        <p className="text-xs text-emerald-400/60 mt-0.5">{t("auth.recovery.sent_desc", { email: forgotState.email })}</p>
                      </div>
                    )}
                    <form onSubmit={handleRequestPasswordReset} className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <label className={labelCls}>{t("auth.fields.email")}</label>
                        <Input name="recoveryEmail" type="email" value={forgotState.email} onChange={(e) => setForgotState((p) => ({ ...p, email: e.target.value }))} required className={inputCls} />
                      </div>
                      <button type="submit" disabled={isLoading} className={btnPrimary}>
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {t("auth.recovery.actions.send_link")}
                      </button>
                      <button type="button" onClick={() => setSigninPanel("signin")} className={btnGhost}>{t("auth.recovery.actions.back_to_login")}</button>
                    </form>
                  </div>
                )}

                {signinPanel === "reset" && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-base font-semibold text-white">{t("auth.recovery.reset_title")}</p>
                      <p className="text-sm text-white/40 mt-1">{t("auth.recovery.reset_desc")}</p>
                    </div>
                    <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <label className={labelCls}>{t("auth.recovery.fields.new_password")}</label>
                        <Input type="password" value={resetState.password} required minLength={6} onChange={(e) => setResetState((p) => ({ ...p, password: e.target.value }))} className={inputCls} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelCls}>{t("auth.recovery.fields.confirm_new_password")}</label>
                        <Input type="password" value={resetState.confirmPassword} required minLength={6} onChange={(e) => setResetState((p) => ({ ...p, confirmPassword: e.target.value }))} className={inputCls} />
                      </div>
                      <button type="submit" disabled={isLoading} className={btnPrimary}>
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {t("auth.recovery.actions.save_new_password")}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── SIGN UP ── */}
            {tab === "signup" && (
              <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className={labelCls}>{t("auth.fields.full_name")}</label>
                  <Input name="fullName" required className={inputCls} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className={labelCls}>{t("auth.fields.age")}</label>
                    <Input name="age" type="number" min={14} max={90} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>{t("auth.fields.phone")}</label>
                    <PhoneE164Input id="phone" name="phone" defaultCountry="BR" required inputClassName={inputCls} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelCls}>{t("auth.fields.email")}</label>
                  <Input name="email" type="email" required className={inputCls} />
                </div>

                <div className="space-y-2">
                  <label className={labelCls}>{t("auth.fields.contact_email")}</label>
                  <Input name="contactEmail" type="email" required className={inputCls} />
                </div>

                <div className="space-y-2">
                  <label className={labelCls}>{t("auth.fields.referral_code")}</label>
                  <Input name="referralCode" maxLength={12} className={inputCls} />
                </div>

                <div className="space-y-2">
                  <label className={labelCls}>{t("auth.fields.password")}</label>
                  <Input name="password" type="password" minLength={6} required className={inputCls} />
                </div>

                <div className="space-y-2">
                  <label className={labelCls}>{t("auth.fields.confirm_password")}</label>
                  <Input name="confirmPassword" type="password" minLength={6} required className={inputCls} />
                </div>

                <div className="flex flex-col gap-3 pt-1">
                  <p className="text-[10px] text-white/25 leading-relaxed">{t("auth.disclaimer")}</p>
                  <div className="flex gap-2.5 items-start">
                    <Checkbox id="accept" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500" />
                    <input type="hidden" name="acceptTerms" value={acceptTerms ? "on" : ""} />
                    <label htmlFor="accept" className="text-[11px] text-white/40 leading-snug cursor-pointer">{t("auth.accept_terms")}</label>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className={btnPrimary}>
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {t("auth.actions.signup")}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <button onClick={() => navigate("/jobs")} className="mt-8 text-[11px] text-white/15 hover:text-white/35 transition-colors bg-transparent border-none cursor-pointer font-brand tracking-wide">
            {t("auth.browse_jobs_link")}
          </button>
        </div>
      </div>
    </>
  );
}
