import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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

// ─── Inline logo — full control over colors on dark bg ───────────────────────
function H2Logo({ size = 52 }: { size?: number }) {
  const fs = Math.round(size * 0.55);
  return (
    <div style={{ display: "flex", alignItems: "center", userSelect: "none", height: size }}>
      <span
        style={{
          fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
          fontWeight: 700,
          fontSize: fs,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        <span style={{ color: "#D4500A" }}>H2</span>
        <span style={{ color: "#ffffff" }}> Linker</span>
      </span>
    </div>
  );
}

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
    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

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
          } catch {
            /* ignore */
          }
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

  // ─── Confirmation overlay ─────────────────────────────────────────────────
  if (confirmFlow.active) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#020617",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "40px 36px",
          }}
        >
          <H2Logo size={44} />
          <div style={{ marginTop: 32, marginBottom: 12 }}>
            {confirmFlow.state === "processing" && (
              <Loader2 size={20} style={{ color: "#D4500A", animation: "spin 1s linear infinite" }} />
            )}
            {confirmFlow.state === "success" && <CheckCircle2 size={20} color="#22C55E" />}
            {confirmFlow.state === "error" && <AlertTriangle size={20} color="#EF4444" />}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
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
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
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

  // ─── Shared field style ────────────────────────────────────────────────────
  const S = {
    field: { display: "flex", flexDirection: "column", gap: 5 } as React.CSSProperties,
    label: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "#94A3B8",
    } as React.CSSProperties,
    submit: {
      width: "100%",
      background: "#D4500A",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "13px 20px",
      fontSize: 14,
      fontWeight: 700,
      fontFamily: "inherit",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      transition: "background 0.15s",
    } as React.CSSProperties,
    ghost: {
      width: "100%",
      background: "transparent",
      color: "#64748B",
      border: "1px solid #E2E8F0",
      borderRadius: 8,
      padding: "11px 20px",
      fontSize: 13,
      fontWeight: 500,
      fontFamily: "inherit",
      cursor: "pointer",
      transition: "all 0.15s",
    } as React.CSSProperties,
    notice: {
      padding: "12px 14px",
      background: "#F0FDF4",
      border: "1px solid #BBF7D0",
      borderRadius: 8,
      marginBottom: 20,
    } as React.CSSProperties,
  };

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .auth-page {
          min-height: 100vh;
          background: #020617;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 24px 60px;
          position: relative;
          overflow: hidden;
        }

        /* ── Diagonal stripe texture ── */
        .auth-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.012) 40px,
            rgba(255,255,255,0.012) 41px
          );
          pointer-events: none;
        }

        /* ── Orange glow — top center ── */
        .auth-page::after {
          content: '';
          position: absolute;
          top: -120px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(212,80,10,0.18) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── Top bar ── */
        .auth-topbar {
          width: 100%;
          max-width: 960px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 0 0;
          position: relative;
          z-index: 2;
        }

        /* ── Hero logo area ── */
        .auth-hero {
          position: relative;
          z-index: 2;
          text-align: center;
          padding: 56px 0 48px;
        }

        /* ── Divider line under tagline ── */
        .auth-divider {
          width: 40px;
          height: 2px;
          background: #D4500A;
          margin: 20px auto 0;
        }

        /* ── Form card ── */
        .auth-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border-radius: 16px;
          padding: 40px 36px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 24px 48px rgba(0,0,0,0.4),
            0 8px 16px rgba(0,0,0,0.3);
        }

        /* ── Custom tabs ── */
        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #F1F5F9;
          border-radius: 8px;
          padding: 3px;
          margin-bottom: 28px;
          gap: 0;
        }
        .auth-tab {
          padding: 9px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Space Grotesk', ui-sans-serif;
          cursor: pointer;
          transition: all 0.15s;
          color: #64748B;
          background: transparent;
        }
        .auth-tab.active {
          background: #020617;
          color: #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }
        .auth-tab:not(.active):hover { color: #020617; }

        /* ── Input override ── */
        .auth-card input:not([type='checkbox']) {
          font-family: 'Space Grotesk', ui-sans-serif !important;
          font-size: 14px !important;
          border-color: #E2E8F0 !important;
          border-radius: 7px !important;
          height: 40px !important;
        }
        .auth-card input:focus {
          border-color: #020617 !important;
          box-shadow: 0 0 0 2px rgba(2,6,23,0.08) !important;
          outline: none !important;
        }

        /* ── Footer link ── */
        .auth-footer-link {
          background: none; border: none; cursor: pointer;
          font-size: 12px; color: rgba(255,255,255,0.25);
          font-family: 'Space Grotesk', ui-sans-serif;
          margin-top: 24px;
          position: relative; z-index: 2;
          transition: color 0.15s;
        }
        .auth-footer-link:hover { color: rgba(255,255,255,0.5); }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Error dialog ───────────────────────────────────────────────── */}
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

      {/* ── Page ───────────────────────────────────────────────────────── */}
      <div className="auth-page">
        {/* Top bar: back link + language */}
        <div className="auth-topbar">
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            ← Voltar ao site
          </button>
          <LanguageSwitcher
            value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
            onChange={handleChangeLanguage}
            className="h-9 w-[130px] border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          />
        </div>

        {/* ── HERO ── */}
        <div className="auth-hero">
          {/* THE logo — big and proud */}
          <H2Logo size={72} />

          <p
            style={{
              marginTop: 14,
              fontSize: 15,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.01em",
              fontWeight: 400,
            }}
          >
            Vagas H-2A e H-2B · Do DOL direto pra você
          </p>

          <div className="auth-divider" />
        </div>

        {/* ── FORM CARD ── */}
        <div className="auth-card">
          {/* Tabs */}
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === "signin" ? "active" : ""}`} onClick={() => setTab("signin")}>
              {t("auth.tabs.signin")}
            </button>
            <button className={`auth-tab ${tab === "signup" ? "active" : ""}`} onClick={() => setTab("signup")}>
              {t("auth.tabs.signup")}
            </button>
          </div>

          {/* ── SIGN IN ── */}
          {tab === "signin" && (
            <div>
              {signupNotice.visible && (
                <div style={S.notice}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <CheckCircle2 size={15} color="#15803D" style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#14532D" }}>{t("auth.signup_notice.title")}</p>
                      <p style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                        {t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {signinPanel === "signin" && (
                <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={S.field}>
                    <label style={S.label}>{t("auth.fields.email")}</label>
                    <Input name="email" type="email" placeholder={t("auth.placeholders.email")} required />
                  </div>
                  <div style={S.field}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={S.label}>{t("auth.fields.password")}</label>
                      <button
                        type="button"
                        onClick={() => setSigninPanel("forgot")}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          color: "#D4500A",
                          fontFamily: "inherit",
                        }}
                      >
                        {t("auth.recovery.link")}
                      </button>
                    </div>
                    <Input name="password" type="password" required />
                  </div>
                  <button
                    type="submit"
                    style={S.submit}
                    disabled={isLoading}
                    onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = "#bf4209")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#D4500A")}
                  >
                    {isLoading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                    {t("auth.actions.signin")}
                  </button>
                </form>
              )}

              {signinPanel === "forgot" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#020617" }}>
                      {t("auth.recovery.request_title")}
                    </p>
                    <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{t("auth.recovery.request_desc")}</p>
                  </div>
                  {forgotState.sent && (
                    <div style={S.notice}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#14532D" }}>{t("auth.recovery.sent_title")}</p>
                      <p style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                        {t("auth.recovery.sent_desc", { email: forgotState.email })}
                      </p>
                    </div>
                  )}
                  <form
                    onSubmit={handleRequestPasswordReset}
                    style={{ display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    <div style={S.field}>
                      <label style={S.label}>{t("auth.fields.email")}</label>
                      <Input
                        name="recoveryEmail"
                        type="email"
                        value={forgotState.email}
                        onChange={(e) => setForgotState((p) => ({ ...p, email: e.target.value }))}
                        required
                      />
                    </div>
                    <button type="submit" style={S.submit} disabled={isLoading}>
                      {isLoading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                      {t("auth.recovery.actions.send_link")}
                    </button>
                    <button type="button" style={S.ghost} onClick={() => setSigninPanel("signin")}>
                      {t("auth.recovery.actions.back_to_login")}
                    </button>
                  </form>
                </div>
              )}

              {signinPanel === "reset" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#020617" }}>{t("auth.recovery.reset_title")}</p>
                    <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{t("auth.recovery.reset_desc")}</p>
                  </div>
                  <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={S.field}>
                      <label style={S.label}>{t("auth.recovery.fields.new_password")}</label>
                      <Input
                        type="password"
                        value={resetState.password}
                        required
                        minLength={6}
                        onChange={(e) => setResetState((p) => ({ ...p, password: e.target.value }))}
                      />
                    </div>
                    <div style={S.field}>
                      <label style={S.label}>{t("auth.recovery.fields.confirm_new_password")}</label>
                      <Input
                        type="password"
                        value={resetState.confirmPassword}
                        required
                        minLength={6}
                        onChange={(e) => setResetState((p) => ({ ...p, confirmPassword: e.target.value }))}
                      />
                    </div>
                    <button type="submit" style={S.submit} disabled={isLoading}>
                      {isLoading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                      {t("auth.recovery.actions.save_new_password")}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── SIGN UP ── */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={S.field}>
                <label style={S.label}>{t("auth.fields.full_name")}</label>
                <Input name="fullName" required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={S.field}>
                  <label style={S.label}>{t("auth.fields.age")}</label>
                  <Input name="age" type="number" min={14} max={90} required />
                </div>
                <div style={S.field}>
                  <label style={S.label}>{t("auth.fields.phone")}</label>
                  <PhoneE164Input name="phone" defaultCountry="BR" required />
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>{t("auth.fields.email")}</label>
                <Input name="email" type="email" required />
              </div>

              <div style={S.field}>
                <label style={S.label}>{t("auth.fields.contact_email")}</label>
                <Input name="contactEmail" type="email" required />
              </div>

              <div style={S.field}>
                <label style={S.label}>{t("auth.fields.referral_code")}</label>
                <Input name="referralCode" maxLength={12} />
              </div>

              <div style={S.field}>
                <label style={S.label}>{t("auth.fields.password")}</label>
                <Input name="password" type="password" minLength={6} required />
              </div>

              <div style={S.field}>
                <label style={S.label}>{t("auth.fields.confirm_password")}</label>
                <Input name="confirmPassword" type="password" minLength={6} required />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
                <p style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6 }}>{t("auth.disclaimer")}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Checkbox id="accept" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} />
                  <input type="hidden" name="acceptTerms" value={acceptTerms ? "on" : ""} />
                  <label
                    htmlFor="accept"
                    style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5, cursor: "pointer" }}
                  >
                    {t("auth.accept_terms")}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                style={S.submit}
                disabled={isLoading}
                onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = "#bf4209")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#D4500A")}
              >
                {isLoading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                {t("auth.actions.signup")}
              </button>
            </form>
          )}
        </div>

        {/* Footer link */}
        <button className="auth-footer-link" onClick={() => navigate("/jobs")}>
          Ver vagas sem criar conta →
        </button>
      </div>
    </>
  );
}
