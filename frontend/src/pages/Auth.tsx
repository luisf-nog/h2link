import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, Zap, Infinity as InfinityIcon, Send, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
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

// ─── Brand panel highlights ──────────────────────────────────────────────────
const highlights = [
  {
    icon: Send,
    label: "Candidaturas automatizadas",
    desc: "Envie dezenas de emails profissionais por dia, direto do seu email.",
  },
  {
    icon: Eye,
    label: "Vagas direto do DOL",
    desc: "Base oficial do Departamento de Trabalho dos EUA, atualizada diariamente.",
  },
  {
    icon: InfinityIcon,
    label: "Pagamento único vitalício",
    desc: "Sem mensalidades. Pague uma vez, use para sempre.",
  },
];

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [signinPanel, setSigninPanel] = useState<"signin" | "forgot" | "reset">(() => "signin");
  const [forgotState, setForgotState] = useState<{ email: string; sent: boolean; cooldownUntilMs: number }>(() => ({
    email: "",
    sent: false,
    cooldownUntilMs: 0,
  }));
  const [resetState, setResetState] = useState<{ password: string; confirmPassword: string }>(() => ({
    password: "",
    confirmPassword: "",
  }));
  const [confirmKind, setConfirmKind] = useState<"email" | "recovery">(() => "email");
  const [confirmFlow, setConfirmFlow] = useState<{ active: boolean; state: "processing" | "success" | "error" }>(
    () => ({
      active: false,
      state: "processing",
    }),
  );
  const [signupNotice, setSignupNotice] = useState<{ visible: boolean; email?: string }>(() => ({
    visible: false,
    email: undefined,
  }));
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>(() => ({
    open: false,
    title: "",
    description: "",
  }));
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const openError = (title: string, description: string) => {
    setErrorDialog({ open: true, title, description });
  };

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
          if (password !== confirmPassword) {
            ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
          }
        }),
    [],
  );

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
          const { error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash: tokenHash,
          });

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
      if (password !== confirmPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
      }
    });

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupNotice({ visible: false, email: undefined });

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await signIn(email, password);

    if (error) {
      openError(t("auth.toasts.signin_error_title"), error.message);
    } else {
      navigate("/dashboard");
    }

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

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("recoveryEmail") ?? "").trim();
    const parsed = forgotEmailSchema.safeParse(email);

    if (!parsed.success) {
      openError(t("auth.recovery.errors.invalid_email_title"), t("auth.recovery.errors.invalid_email_desc"));
      setIsLoading(false);
      return;
    }

    const redirectTo = `${getBaseUrl()}/reset-password?type=recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });

    if (error) {
      const anyErr = error as any;
      const code = String(anyErr?.code ?? "");
      const msg = String(error.message ?? "");
      const isRateLimit = code === "over_email_send_rate_limit" || /rate limit/i.test(msg);

      if (isRateLimit) {
        openError(t("auth.recovery.errors.email_rate_limit_title"), t("auth.recovery.errors.email_rate_limit_desc"));
      } else {
        openError(t("auth.recovery.errors.request_error_title"), error.message);
      }
    } else {
      setForgotState((prev) => ({
        ...prev,
        email: parsed.data,
        sent: true,
        cooldownUntilMs: Date.now() + 60_000,
      }));
      toast({
        title: t("auth.recovery.toasts.sent_title"),
        description: t("auth.recovery.toasts.sent_desc"),
      });
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

    const formData = new FormData(e.currentTarget);
    const raw = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
      age: String(formData.get("age") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      referralCode: String(formData.get("referralCode") ?? ""),
      acceptTerms: formData.get("acceptTerms") ?? undefined,
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
    const { error } = await signUp(email, password, fullName, {
      age,
      phone_e164: phone,
      contact_email: contactEmail,
    });

    if (error) {
      const anyErr = error as any;
      const code = String(anyErr?.code ?? "");
      const msg = String(error.message ?? "");
      const isRateLimit = code === "over_email_send_rate_limit" || /rate limit/i.test(msg);
      const isWeakPassword = code === "weak_password" || /weak.*password|password.*weak/i.test(msg);

      if (isRateLimit) {
        openError(t("auth.errors.email_rate_limit_title"), t("auth.errors.email_rate_limit_desc"));
      } else if (isWeakPassword) {
        openError(t("auth.toasts.signup_error_title"), t("auth.errors.weak_password_desc"));
      } else {
        openError(t("auth.toasts.signup_error_title"), error.message);
      }
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
            // ignore
          }
        }
        navigate("/dashboard");
      } else {
        setTab("signin");
        setSignupNotice({ visible: true, email });
        toast({
          title: t("auth.signup_notice.toast_title"),
          description: t("auth.signup_notice.toast_desc"),
        });
      }
    }

    setIsLoading(false);
  };

  // ─── Confirmation flow overlay (logic unchanged) ──────────────────────────
  if (confirmFlow.active) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#020617] px-6">
        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <Card className="relative w-full max-w-md border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <BrandWordmark height={44} className="max-w-[220px]" />
              {confirmFlow.state === "processing" ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : confirmFlow.state === "success" ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-destructive" />
              )}
            </div>
            <CardTitle className="mt-6 text-2xl text-white">
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
            </CardTitle>
            <CardDescription className="text-white/70">
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
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-white/70">
                {confirmKind === "recovery"
                  ? confirmFlow.state === "success"
                    ? t("auth.recovery.confirmation.redirecting")
                    : t("auth.recovery.confirmation.finalizing")
                  : confirmFlow.state === "success"
                    ? t("auth.confirmation.redirecting")
                    : t("auth.confirmation.finalizing")}
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" />
                <span className="inline-flex h-2 w-2 rounded-full bg-primary/30" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

        .auth-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr;
          font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
        }
        @media (min-width: 1024px) {
          .auth-root { grid-template-columns: 480px 1fr; }
        }

        /* ── LEFT PANEL ── */
        .auth-left {
          display: none;
          background: #020617;
          position: relative;
          overflow: hidden;
          flex-direction: column;
          padding: 44px 48px;
        }
        @media (min-width: 1024px) {
          .auth-left { display: flex; }
        }

        /* Large decorative "H2" watermark */
        .auth-left-watermark {
          position: absolute;
          bottom: -40px;
          right: -30px;
          font-size: 280px;
          font-weight: 800;
          color: rgba(255,255,255,0.025);
          line-height: 1;
          pointer-events: none;
          letter-spacing: -0.04em;
          font-family: 'Space Grotesk', ui-sans-serif;
          user-select: none;
        }

        /* Vertical orange bar — left edge accent */
        .auth-left-bar {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 3px;
          background: linear-gradient(to bottom, #D4500A 0%, rgba(212,80,10,0.2) 60%, transparent 100%);
        }

        /* ── RIGHT PANEL ── */
        .auth-right {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #F8FAFC;
          position: relative;
        }

        /* Subtle pattern on right bg */
        .auth-right::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(2,6,23,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(2,6,23,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        /* Mobile top bar */
        .auth-mobile-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          background: #020617;
          position: relative;
          z-index: 1;
        }
        @media (min-width: 1024px) {
          .auth-mobile-bar { display: none; }
        }

        /* Form area */
        .auth-form-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
          z-index: 1;
        }

        /* The white card */
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 36px 32px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.04);
        }

        /* Highlight items */
        .hl-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 16px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .hl-item:last-child { border-bottom: none; }

        .hl-num {
          font-size: 11px;
          font-weight: 700;
          color: #D4500A;
          letter-spacing: 0.05em;
          padding-top: 2px;
          flex-shrink: 0;
          min-width: 20px;
        }

        /* Custom tab styling */
        .auth-tabs-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 28px;
          background: #F8FAFC;
        }
        .auth-tab-btn {
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          color: #64748B;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }
        .auth-tab-btn.active {
          background: #020617;
          color: #fff;
        }
        .auth-tab-btn:not(.active):hover { background: #F1F5F9; }

        /* Input overrides */
        .auth-card input {
          font-family: 'Space Grotesk', ui-sans-serif !important;
          font-size: 14px !important;
        }
        .auth-card label {
          font-family: 'Space Grotesk', ui-sans-serif !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          letter-spacing: 0.03em !important;
          text-transform: uppercase !important;
          color: #475569 !important;
        }

        /* Submit button */
        .auth-submit {
          width: 100%;
          background: #020617;
          color: #fff;
          border: none;
          border-radius: 7px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.15s;
          margin-top: 4px;
        }
        .auth-submit:hover { background: #0f172a; }
        .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Ghost button */
        .auth-ghost {
          width: 100%;
          background: transparent;
          color: #64748B;
          border: 1px solid #E2E8F0;
          border-radius: 7px;
          padding: 11px 20px;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }
        .auth-ghost:hover { background: #F8FAFC; color: #020617; }
      `}</style>

      {/* Error dialog */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}>
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

      <div className="auth-root">
        {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
        <div className="auth-left">
          <div className="auth-left-bar" />
          <div className="auth-left-watermark">H2</div>

          {/* Logo — large and prominent */}
          <div style={{ position: "relative", zIndex: 1, marginBottom: "auto" }}>
            <BrandWordmark height={48} />
          </div>

          {/* Main content */}
          <div style={{ position: "relative", zIndex: 1, paddingTop: 56 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#D4500A",
                marginBottom: 20,
              }}
            >
              Vagas H-2A · H-2B
            </p>

            <h1
              style={{
                fontSize: "clamp(28px, 2.8vw, 38px)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.025em",
                lineHeight: 1.15,
                marginBottom: 48,
              }}
            >
              Chegar primeiro
              <br />é a maior vantagem
              <br />
              no processo H-2.
            </h1>

            {/* Highlights as numbered list */}
            <div>
              {highlights.map((h, i) => (
                <div key={h.label} className="hl-item">
                  <span className="hl-num">0{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3, lineHeight: 1.3 }}>
                      {h.label}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{h.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: "relative", zIndex: 1, marginTop: 48 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 500, letterSpacing: "0.03em" }}>
              © {new Date().getFullYear()} H2 Linker
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div className="auth-right">
          {/* Mobile bar — dark, consistent with left panel */}
          <div className="auth-mobile-bar">
            <BrandWordmark height={36} />
            <LanguageSwitcher
              value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
              onChange={handleChangeLanguage}
              className="h-9 w-[120px] border-white/20 bg-white/10 text-white"
            />
          </div>

          {/* Form */}
          <div className="auth-form-wrap">
            <div className="auth-card">
              {/* Desktop: language switcher top-right of card */}
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}
                className="auth-card-header"
              >
                <style>{`
                  @media(max-width:1023px){.auth-card-header .desktop-lang{display:none!important;}}
                `}</style>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#020617", letterSpacing: "-0.01em" }}>
                    {tab === "signin" ? t("auth.signin.title") : t("auth.signup.title")}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                    {tab === "signin" ? t("auth.signin.description") : t("auth.signup.description")}
                  </div>
                </div>
                <div className="desktop-lang" style={{ flexShrink: 0, marginLeft: 16 }}>
                  <LanguageSwitcher
                    value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
                    onChange={handleChangeLanguage}
                    className="h-9 w-[120px]"
                  />
                </div>
              </div>

              {/* Custom tabs */}
              <div className="auth-tabs-list">
                <button className={`auth-tab-btn ${tab === "signin" ? "active" : ""}`} onClick={() => setTab("signin")}>
                  {t("auth.tabs.signin")}
                </button>
                <button className={`auth-tab-btn ${tab === "signup" ? "active" : ""}`} onClick={() => setTab("signup")}>
                  {t("auth.tabs.signup")}
                </button>
              </div>

              {/* ── SIGN IN ── */}
              {tab === "signin" && (
                <div>
                  {signupNotice.visible && (
                    <div
                      style={{
                        marginBottom: 20,
                        padding: "12px 14px",
                        background: "#F0FDF4",
                        border: "1px solid #BBF7D0",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <CheckCircle2 size={15} color="#15803D" style={{ marginTop: 1, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#14532D" }}>
                            {t("auth.signup_notice.title")}
                          </p>
                          <p style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                            {t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {signinPanel === "signin" && (
                    <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <Label htmlFor="signin-email">{t("auth.fields.email")}</Label>
                        <Input
                          id="signin-email"
                          name="email"
                          type="email"
                          placeholder={t("auth.placeholders.email")}
                          required
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Label htmlFor="signin-password">{t("auth.fields.password")}</Label>
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 12,
                              color: "#D4500A",
                              fontFamily: "inherit",
                              fontWeight: 500,
                            }}
                            onClick={() => setSigninPanel("forgot")}
                          >
                            {t("auth.recovery.link")}
                          </button>
                        </div>
                        <Input id="signin-password" name="password" type="password" required />
                      </div>
                      <button type="submit" className="auth-submit" disabled={isLoading} style={{ marginTop: 8 }}>
                        {isLoading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                        {t("auth.actions.signin")}
                      </button>
                    </form>
                  )}

                  {signinPanel === "forgot" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#020617" }}>
                          {t("auth.recovery.request_title")}
                        </p>
                        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                          {t("auth.recovery.request_desc")}
                        </p>
                      </div>
                      {forgotState.sent && (
                        <div
                          style={{
                            padding: "12px 14px",
                            background: "#F0FDF4",
                            border: "1px solid #BBF7D0",
                            borderRadius: 8,
                          }}
                        >
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#14532D" }}>
                            {t("auth.recovery.sent_title")}
                          </p>
                          <p style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                            {t("auth.recovery.sent_desc", { email: forgotState.email })}
                          </p>
                        </div>
                      )}
                      <form
                        onSubmit={handleRequestPasswordReset}
                        style={{ display: "flex", flexDirection: "column", gap: 12 }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Label htmlFor="recovery-email">{t("auth.fields.email")}</Label>
                          <Input
                            id="recovery-email"
                            name="recoveryEmail"
                            type="email"
                            value={forgotState.email}
                            onChange={(e) => setForgotState((prev) => ({ ...prev, email: e.target.value }))}
                            required
                          />
                        </div>
                        <button type="submit" className="auth-submit" disabled={isLoading}>
                          {isLoading && <Loader2 size={15} />}
                          {t("auth.recovery.actions.send_link")}
                        </button>
                        <button type="button" className="auth-ghost" onClick={() => setSigninPanel("signin")}>
                          {t("auth.recovery.actions.back_to_login")}
                        </button>
                      </form>
                    </div>
                  )}

                  {signinPanel === "reset" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#020617" }}>
                          {t("auth.recovery.reset_title")}
                        </p>
                        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{t("auth.recovery.reset_desc")}</p>
                      </div>
                      <form
                        onSubmit={handleUpdatePassword}
                        style={{ display: "flex", flexDirection: "column", gap: 12 }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Label htmlFor="reset-password">{t("auth.recovery.fields.new_password")}</Label>
                          <Input
                            id="reset-password"
                            type="password"
                            value={resetState.password}
                            onChange={(e) => setResetState((prev) => ({ ...prev, password: e.target.value }))}
                            required
                            minLength={6}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Label htmlFor="reset-confirm">{t("auth.recovery.fields.confirm_new_password")}</Label>
                          <Input
                            id="reset-confirm"
                            type="password"
                            value={resetState.confirmPassword}
                            onChange={(e) => setResetState((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                            required
                            minLength={6}
                          />
                        </div>
                        <button type="submit" className="auth-submit" disabled={isLoading}>
                          {isLoading && <Loader2 size={15} />}
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label htmlFor="signup-name">{t("auth.fields.full_name")}</Label>
                    <Input id="signup-name" name="fullName" required />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label htmlFor="signup-age">{t("auth.fields.age")}</Label>
                      <Input id="signup-age" name="age" type="number" min={14} max={90} required />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label htmlFor="signup-phone">{t("auth.fields.phone")}</Label>
                      <PhoneE164Input id="signup-phone" name="phone" defaultCountry="BR" required />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label htmlFor="signup-email">{t("auth.fields.email")}</Label>
                    <Input id="signup-email" name="email" type="email" required />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label htmlFor="signup-contact-email">{t("auth.fields.contact_email")}</Label>
                    <Input id="signup-contact-email" name="contactEmail" type="email" required />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label htmlFor="signup-referral">{t("auth.fields.referral_code")}</Label>
                    <Input id="signup-referral" name="referralCode" maxLength={12} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label htmlFor="signup-password">{t("auth.fields.password")}</Label>
                    <Input id="signup-password" name="password" type="password" minLength={6} required />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label htmlFor="signup-confirm-password">{t("auth.fields.confirm_password")}</Label>
                    <Input id="signup-confirm-password" name="confirmPassword" type="password" minLength={6} required />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6 }}>{t("auth.disclaimer")}</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Checkbox
                        id="signup-accept"
                        checked={acceptTerms}
                        onCheckedChange={(v) => setAcceptTerms(v === true)}
                      />
                      <input type="hidden" name="acceptTerms" value={acceptTerms ? "on" : ""} />
                      <Label
                        htmlFor="signup-accept"
                        style={{
                          textTransform: "none",
                          fontSize: "11px",
                          fontWeight: "400",
                          letterSpacing: 0,
                          color: "#64748B",
                          lineHeight: 1.5,
                        }}
                      >
                        {t("auth.accept_terms")}
                      </Label>
                    </div>
                  </div>

                  <button type="submit" className="auth-submit" disabled={isLoading} style={{ marginTop: 4 }}>
                    {isLoading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                    {t("auth.actions.signup")}
                  </button>
                </form>
              )}

              {/* Browse jobs link */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F1F5F9", textAlign: "center" }}>
                <button
                  onClick={() => navigate("/jobs")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#94A3B8",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#64748B")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
                >
                  Ver vagas sem criar conta →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
