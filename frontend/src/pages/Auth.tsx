import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Building2,
  User,
  Briefcase,
  Shield,
  HardHat,
} from "lucide-react";
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

// ─── Employer multi-step state ────────────────────────────────────────────────
type EmployerStep = 1 | 2 | 3;

const EMPLOYER_STEPS = [
  { n: 1, icon: User, label: "Account" },
  { n: 2, icon: Building2, label: "Company" },
  { n: 3, icon: Briefcase, label: "Hiring" },
] as const;

// ─── Shared design tokens ─────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');

  .auth-root {
    font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    background: #F7F6F3;
    min-height: 100vh;
  }

  .auth-root * {
    font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif !important;
  }

  .auth-logo-text {
    font-family: 'DM Serif Display', Georgia, serif !important;
    letter-spacing: -0.02em;
  }

  /* Left branding panel */
  .auth-panel-left {
    background: #FFFFFF;
    border-right: 1px solid #EBEBEB;
    position: relative;
    overflow: hidden;
  }

  .auth-panel-pattern {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 1px 1px, #E5E3DE 1px, transparent 0);
    background-size: 28px 28px;
    opacity: 0.7;
  }

  .auth-panel-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 65%);
    top: -100px;
    left: -100px;
    pointer-events: none;
  }

  /* Right form panel */
  .auth-panel-right {
    background: #F7F6F3;
  }

  /* Card */
  .auth-card {
    background: #FFFFFF;
    border: 1px solid #E8E6E1;
    border-radius: 20px;
    box-shadow:
      0 1px 2px rgba(0,0,0,0.04),
      0 4px 16px rgba(0,0,0,0.06),
      0 12px 40px rgba(0,0,0,0.04);
  }

  /* Tabs */
  .auth-tab {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 500;
    color: #9CA3AF;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: all 0.18s ease;
  }
  .auth-tab:hover {
    color: #374151;
    background: #F3F2EF;
  }
  .auth-tab.active {
    color: #0284C7;
    background: #EFF8FF;
    border-color: #BAE6FD;
    font-weight: 600;
  }

  /* Inputs */
  .auth-input {
    background: #FAFAFA !important;
    border: 1.5px solid #E5E7EB !important;
    color: #111827 !important;
    border-radius: 10px !important;
    height: 44px !important;
    font-size: 14px !important;
    transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
  }
  .auth-input::placeholder {
    color: #C4C4C0 !important;
  }
  .auth-input:focus {
    border-color: #0ea5e9 !important;
    box-shadow: 0 0 0 3px rgba(14,165,233,0.1) !important;
    background: #FFFFFF !important;
    outline: none !important;
  }

  /* Select */
  .auth-select {
    background: #FAFAFA;
    border: 1.5px solid #E5E7EB;
    color: #111827;
    border-radius: 10px;
    height: 44px;
    font-size: 14px;
    padding: 0 12px;
    width: 100%;
    transition: border-color 0.15s ease;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
  }
  .auth-select:focus {
    border-color: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
    outline: none;
  }
  .auth-select option {
    background: #fff;
    color: #111827;
  }

  /* Labels */
  .auth-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #9CA3AF;
  }

  /* Primary button */
  .auth-btn-primary {
    width: 100%;
    height: 46px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    border: none;
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    color: #FFFFFF;
    box-shadow: 0 1px 2px rgba(2,132,199,0.2), 0 4px 12px rgba(14,165,233,0.25);
    transition: all 0.18s ease;
    letter-spacing: -0.01em;
  }
  .auth-btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
    box-shadow: 0 2px 4px rgba(2,132,199,0.2), 0 8px 20px rgba(14,165,233,0.3);
    transform: translateY(-1px);
  }
  .auth-btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }

  /* Ghost button */
  .auth-btn-ghost {
    width: 100%;
    padding: 10px 16px;
    border-radius: 10px;
    font-weight: 500;
    font-size: 14px;
    color: #6B7280;
    background: transparent;
    border: 1.5px solid #E5E7EB;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .auth-btn-ghost:hover {
    color: #111827;
    border-color: #D1D5DB;
    background: #F9F8F6;
  }

  /* Step dots */
  .step-dot {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .step-dot-done {
    background: #EFF8FF;
    border: 1.5px solid #BAE6FD;
    color: #0284C7;
  }
  .step-dot-active {
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    border: 1.5px solid #0ea5e9;
    color: #fff;
    box-shadow: 0 2px 8px rgba(14,165,233,0.35);
  }
  .step-dot-idle {
    background: #F3F4F6;
    border: 1.5px solid #E5E7EB;
    color: #D1D5DB;
  }
  .step-line {
    flex: 1;
    height: 1.5px;
    background: #E5E7EB;
    margin: 0 8px;
    margin-bottom: 18px;
  }
  .step-line-done {
    background: #BAE6FD;
  }

  /* Role cards */
  .auth-role-card {
    width: 100%;
    text-align: left;
    padding: 18px 20px;
    border-radius: 14px;
    border: 1.5px solid #E8E6E1;
    background: #FAFAF8;
    cursor: pointer;
    transition: all 0.18s ease;
  }
  .auth-role-card:hover {
    border-color: #BAE6FD;
    background: #F0F9FF;
    box-shadow: 0 2px 8px rgba(14,165,233,0.08);
  }

  /* Success notice */
  .auth-success-notice {
    padding: 14px 16px;
    background: #F0FDF4;
    border: 1.5px solid #BBF7D0;
    border-radius: 12px;
  }

  /* Link style */
  .auth-link {
    font-size: 12px;
    font-weight: 500;
    color: #0284C7;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
  }
  .auth-link:hover {
    color: #0ea5e9;
  }

  /* Badge pills */
  .auth-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 100px;
    border: 1px solid #E5E7EB;
    background: #F9F8F6;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6B7280;
  }

  /* Stat numbers */
  .auth-stat-number {
    font-family: 'DM Serif Display', Georgia, serif !important;
    font-size: 36px;
    color: #111827;
    line-height: 1;
  }
  .auth-stat-accent {
    color: #0ea5e9;
  }

  /* Disclaimer box */
  .auth-disclaimer {
    border: 1.5px solid #E8E6E1;
    border-radius: 12px;
    padding: 14px 16px;
    background: #FAFAF8;
  }

  /* Divider */
  .auth-divider {
    height: 1px;
    background: #E8E6E1;
    margin: 4px 0;
  }

  /* Confirmation overlay */
  .auth-confirm-overlay {
    background: #F7F6F3;
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .auth-confirm-card {
    background: #FFFFFF;
    border: 1px solid #E8E6E1;
    border-radius: 24px;
    padding: 48px 40px;
    width: 100%;
    max-width: 380px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }
`;

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [signupRole, setSignupRole] = useState<"worker" | "employer" | null>(null);
  const [employerStep, setEmployerStep] = useState<EmployerStep>(1);
  const [workerStep, setWorkerStep] = useState<1 | 2>(1);
  const [wrkFields, setWrkFields] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    phone: "",
    contactEmail: "",
    referralCode: "",
  });

  const [empFields, setEmpFields] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    legalEntityName: "",
    einTaxId: "",
    companySize: "",
    industry: "",
    website: "",
    country: "US",
    state: "",
    primaryHiringLocation: "",
    workerTypes: "",
    estimatedMonthlyVolume: "",
  });

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
        .object({ password: z.string().min(6).max(200), confirmPassword: z.string().min(6).max(200) })
        .superRefine(({ password, confirmPassword }, ctx) => {
          if (password !== confirmPassword)
            ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
        }),
    [],
  );

  const workerSignupSchema = z
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

  const employerSignupSchema = z
    .object({
      fullName: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(255),
      password: z.string().min(6).max(200),
      confirmPassword: z.string().min(6).max(200),
      companyName: z.string().trim().min(1).max(200),
      legalEntityName: z.string().trim().max(200).optional().default(""),
      einTaxId: z
        .string()
        .trim()
        .max(30)
        .optional()
        .default("")
        .refine((v) => !v || /^\d{2}-\d{7}$/.test(v), { message: "invalid_ein" }),
      companySize: z.string().trim().min(1),
      industry: z.string().trim().min(1).max(120),
      website: z.string().trim().max(255).optional().default(""),
      country: z.string().trim().min(1).max(60),
      state: z.string().trim().min(1).max(60),
      primaryHiringLocation: z.string().trim().min(1).max(200),
      workerTypes: z.string().trim().min(1),
      estimatedMonthlyVolume: z.string().trim().min(1),
      acceptTerms: z.preprocess(
        (v) => v === "on" || v === true,
        z.boolean().refine((v) => v === true, { message: "accept_required" }),
      ),
    })
    .superRefine(({ password, confirmPassword }, ctx) => {
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
          if (error) {
            if (!cancelled) {
              openError(t("auth.toasts.signin_error_title"), error.message);
              setConfirmFlow({ active: true, state: "error" });
            }
            return;
          }
        } else if (type && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash: tokenHash });
          if (error) {
            if (!cancelled) {
              openError(t("auth.toasts.signin_error_title"), error.message);
              setConfirmFlow({ active: true, state: "error" });
            }
            return;
          }
        }
        for (let i = 0; i < 20; i++) {
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
    else {
      const {
        data: { session: sess },
      } = await supabase.auth.getSession();
      if (sess) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", sess.user.id)
          .eq("role", "employer")
          .maybeSingle();
        navigate(roleData ? "/employer/dashboard" : "/dashboard");
      } else {
        navigate("/dashboard");
      }
    }
    setIsLoading(false);
  };

  const handleRequestPasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (forgotState.cooldownUntilMs && Date.now() < forgotState.cooldownUntilMs) {
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
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${getBaseUrl()}/reset-password?type=recovery`,
    });
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

  // ─── Employer step validation ──────────────────────────────────────────
  const validateEmployerStep = (step: EmployerStep): string | null => {
    if (step === 1) {
      if (!empFields.fullName.trim()) return "Full name is required.";
      if (!empFields.email.trim()) return "Email is required.";
      if (empFields.password.length < 6) return "Password must be at least 6 characters.";
      if (empFields.password !== empFields.confirmPassword) return t("auth.validation.password_mismatch");
    }
    if (step === 2) {
      if (!empFields.companyName.trim()) return "Company name is required.";
      if (!empFields.companySize) return "Company size is required.";
      if (!empFields.industry) return "Industry is required.";
    }
    if (step === 3) {
      if (!empFields.country.trim()) return "Country is required.";
      if (!empFields.state.trim()) return "State is required.";
      if (!empFields.primaryHiringLocation.trim()) return "Primary hiring location is required.";
      if (!empFields.workerTypes) return "Worker type is required.";
      if (!empFields.estimatedMonthlyVolume) return "Monthly volume is required.";
    }
    return null;
  };

  const handleEmployerNext = () => {
    const err = validateEmployerStep(employerStep);
    if (err) {
      openError("Required field", err);
      return;
    }
    setEmployerStep((s) => (s + 1) as EmployerStep);
  };

  // ─── Employer final submit ─────────────────────────────────────────────
  const handleEmployerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const err = validateEmployerStep(3);
    if (err) {
      openError("Required field", err);
      setIsLoading(false);
      return;
    }
    if (!acceptTerms) {
      openError(t("auth.toasts.signup_error_title"), t("auth.validation.accept_required"));
      setIsLoading(false);
      return;
    }
    const parsed = employerSignupSchema.safeParse({ ...empFields, acceptTerms: true });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = String(first?.path?.[0] ?? "");
      const code = typeof first?.message === "string" ? first.message : "";
      const description =
        field === "confirmPassword" || code === "password_mismatch"
          ? t("auth.validation.password_mismatch")
          : field === "einTaxId" || code === "invalid_ein"
            ? t("auth.validation.invalid_ein", "EIN must follow the format XX-XXXXXXX (e.g. 12-3456789)")
            : field === "acceptTerms" || code === "accept_required"
              ? t("auth.validation.accept_required")
              : `Please fill in the required field: ${field}`;
      openError(t("auth.toasts.signup_error_title"), description);
      setIsLoading(false);
      return;
    }
    const {
      fullName,
      email,
      password,
      companyName,
      legalEntityName,
      einTaxId,
      companySize,
      industry,
      website,
      country,
      state,
      primaryHiringLocation,
      workerTypes,
      estimatedMonthlyVolume,
    } = parsed.data;
    const { error } = await signUp(email, password, fullName);
    if (error) {
      const errCode = String((error as any)?.code ?? "");
      const msg = String(error.message ?? "");
      const isRateLimit = errCode === "over_email_send_rate_limit" || /rate limit/i.test(msg);
      const isWeakPassword = errCode === "weak_password" || /weak.*password|password.*weak/i.test(msg);
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
        const userId = sessionData.session.user.id;
        await supabase.from("user_roles").insert({ user_id: userId, role: "employer" } as any);
        await supabase.from("employer_profiles").insert({
          user_id: userId,
          company_name: companyName,
          legal_entity_name: legalEntityName || null,
          ein_tax_id: einTaxId || null,
          company_size: companySize,
          industry,
          website: website || null,
          country,
          state,
          primary_hiring_location: primaryHiringLocation,
          worker_types: workerTypes.split(",").map((s: string) => s.trim()),
          estimated_monthly_volume: estimatedMonthlyVolume,
        } as any);
        navigate("/employer/dashboard");
      } else {
        setTab("signin");
        setSignupNotice({ visible: true, email });
        toast({ title: t("auth.signup_notice.toast_title"), description: t("auth.signup_notice.toast_desc") });
      }
    }
    setIsLoading(false);
  };

  // ─── Confirmation overlay ──────────────────────────────────────────────
  if (confirmFlow.active) {
    return (
      <div className="auth-root auth-confirm-overlay">
        <style>{STYLES}</style>
        <div className="auth-confirm-card">
          <h1 className="auth-logo-text" style={{ fontSize: 24, color: "#111827", marginBottom: 32 }}>
            H2 <span style={{ color: "#0ea5e9" }}>Linker</span>
          </h1>
          <div style={{ marginBottom: 12 }}>
            {confirmFlow.state === "processing" && (
              <Loader2 size={22} style={{ color: "#0ea5e9" }} className="animate-spin" />
            )}
            {confirmFlow.state === "success" && <CheckCircle2 size={22} style={{ color: "#16a34a" }} />}
            {confirmFlow.state === "error" && <AlertTriangle size={22} style={{ color: "#DC2626" }} />}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
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
          <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
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

  // ─── Shared helpers ───────────────────────────────────────────────────
  const upd = (k: keyof typeof empFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEmpFields((p) => ({ ...p, [k]: e.target.value }));
  const wrkUpd = (k: keyof typeof wrkFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setWrkFields((p) => ({ ...p, [k]: e.target.value }));

  const validateWorkerStep = (step: 1 | 2): string | null => {
    if (step === 1) {
      if (!wrkFields.fullName.trim()) return t("auth.fields.full_name") + " is required.";
      if (!wrkFields.email.trim()) return t("auth.fields.email") + " is required.";
      if (wrkFields.password.length < 6) return "Password must be at least 6 characters.";
      if (wrkFields.password !== wrkFields.confirmPassword) return t("auth.validation.password_mismatch");
    }
    if (step === 2) {
      if (!wrkFields.age.trim() || Number(wrkFields.age) < 14 || Number(wrkFields.age) > 90)
        return t("auth.validation.invalid_age");
      if (!wrkFields.phone.trim()) return t("auth.fields.phone") + " is required.";
      if (!wrkFields.contactEmail.trim()) return t("auth.fields.contact_email") + " is required.";
    }
    return null;
  };

  const handleWorkerNext = () => {
    const err = validateWorkerStep(1);
    if (err) {
      openError("Required field", err);
      return;
    }
    setWorkerStep(2);
  };

  const handleWorkerFinalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const err2 = validateWorkerStep(2);
    if (err2) {
      openError("Required field", err2);
      setIsLoading(false);
      return;
    }
    if (!acceptTerms) {
      openError(t("auth.toasts.signup_error_title"), t("auth.validation.accept_required"));
      setIsLoading(false);
      return;
    }
    const parsed = workerSignupSchema.safeParse({ ...wrkFields, acceptTerms: true });
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
      const errCode = String((error as any)?.code ?? "");
      const msg = String(error.message ?? "");
      const isRateLimit = errCode === "over_email_send_rate_limit" || /rate limit/i.test(msg);
      const isWeakPassword = errCode === "weak_password" || /weak.*password|password.*weak/i.test(msg);
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
        const userId = sessionData.session.user.id;
        await supabase.from("user_roles").insert({ user_id: userId, role: "user" } as any);
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
          } catch {}
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

  const WORKER_STEPS = [
    { n: 1, icon: User, label: t("auth.steps.account", "Account") },
    { n: 2, icon: Shield, label: t("auth.steps.details", "Details") },
  ] as const;

  // ─── Error dialog (shared) ─────────────────────────────────────────────
  const ErrorDialog = () => (
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
  );

  // ─── Step indicator (shared) ───────────────────────────────────────────
  const StepIndicator = ({
    steps,
    current,
  }: {
    steps: readonly { n: number; icon: any; label: string }[];
    current: number;
  }) => (
    <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: 320, margin: "0 auto 40px" }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div
              className={`step-dot ${current > s.n ? "step-dot-done" : current === s.n ? "step-dot-active" : "step-dot-idle"}`}
            >
              {current > s.n ? <CheckCircle2 size={14} /> : <s.icon size={13} />}
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: current >= s.n ? "#0284C7" : "#D1D5DB",
              }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`step-line ${current > s.n ? "step-line-done" : ""}`} style={{ marginBottom: 20 }} />
          )}
        </div>
      ))}
    </div>
  );

  // ─── Multi-step nav header ─────────────────────────────────────────────
  const StepNavHeader = ({
    onBack,
    backLabel,
    roleLabel,
  }: {
    onBack: () => void;
    backLabel: string;
    roleLabel: string;
  }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 32px",
        borderBottom: "1px solid #EBEBEB",
        background: "#FFFFFF",
      }}
    >
      <h1 className="auth-logo-text" style={{ fontSize: 20, color: "#111827" }}>
        H2 <span style={{ color: "#0ea5e9" }}>Linker</span>
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={onBack}
          style={{
            fontSize: 13,
            color: "#9CA3AF",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ArrowLeft size={13} /> {backLabel}
        </button>
        <button
          onClick={() => {
            setTab("signin");
            setSignupRole(null);
          }}
          style={{ fontSize: 13, color: "#9CA3AF", background: "transparent", border: "none", cursor: "pointer" }}
        >
          {t("auth.tabs.signin")}
        </button>
        <LanguageSwitcher
          value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
          onChange={handleChangeLanguage}
          className="h-8 w-[120px] rounded-xl"
          style={{ fontSize: 13 }}
        />
      </div>
    </div>
  );

  // ─── WORKER MULTI-STEP ────────────────────────────────────────────────
  if (tab === "signup" && signupRole === "worker") {
    return (
      <div className="auth-root" style={{ minHeight: "100vh" }}>
        <style>{STYLES}</style>
        <ErrorDialog />

        <StepNavHeader
          onBack={() => {
            setSignupRole(null);
            setWorkerStep(1);
          }}
          backLabel={t("auth.back_to_selection", "Back")}
          roleLabel={t("auth.roles.worker")}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            minHeight: "calc(100vh - 65px)",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                borderRadius: 100,
                border: "1px solid #BAE6FD",
                background: "#F0F9FF",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#0284C7",
                marginBottom: 16,
              }}
            >
              <HardHat size={10} /> {t("auth.roles.worker")}
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
              {workerStep === 1
                ? t("auth.worker_steps.step1_title", "Create your account")
                : t("auth.worker_steps.step2_title", "Personal details")}
            </h2>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginTop: 6 }}>
              {workerStep === 1
                ? t("auth.worker_steps.step1_desc", "Your login credentials")
                : t("auth.worker_steps.step2_desc", "So employers can reach you")}
            </p>
          </div>

          <StepIndicator steps={WORKER_STEPS} current={workerStep} />

          {/* Form card */}
          <div className="auth-card" style={{ width: "100%", maxWidth: 480, padding: "36px 40px" }}>
            {workerStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label className="auth-label">{t("auth.fields.full_name")} *</label>
                  <Input
                    value={wrkFields.fullName}
                    onChange={wrkUpd("fullName")}
                    required
                    className="auth-input"
                    style={{ marginTop: 6 }}
                    placeholder="João Silva"
                  />
                </div>
                <div>
                  <label className="auth-label">{t("auth.fields.email")} *</label>
                  <Input
                    type="email"
                    value={wrkFields.email}
                    onChange={wrkUpd("email")}
                    required
                    className="auth-input"
                    style={{ marginTop: 6 }}
                    placeholder="you@email.com"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="auth-label">{t("auth.fields.password")} *</label>
                    <Input
                      type="password"
                      value={wrkFields.password}
                      onChange={wrkUpd("password")}
                      required
                      minLength={6}
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                  <div>
                    <label className="auth-label">{t("auth.fields.confirm_password")} *</label>
                    <Input
                      type="password"
                      value={wrkFields.confirmPassword}
                      onChange={wrkUpd("confirmPassword")}
                      required
                      minLength={6}
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                </div>
                <button type="button" onClick={handleWorkerNext} className="auth-btn-primary" style={{ marginTop: 4 }}>
                  {t("auth.actions.continue", "Continue")} <ArrowRight size={15} />
                </button>
              </div>
            )}

            {workerStep === 2 && (
              <form onSubmit={handleWorkerFinalSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="auth-label">{t("auth.fields.age")} *</label>
                    <Input
                      type="number"
                      min={14}
                      max={90}
                      value={wrkFields.age}
                      onChange={wrkUpd("age")}
                      required
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                  <div>
                    <label className="auth-label">{t("auth.fields.phone")} *</label>
                    <PhoneE164Input
                      id="phone-wrk"
                      name="phone-wrk"
                      defaultCountry="BR"
                      required
                      inputClassName="auth-input"
                      defaultValue={wrkFields.phone}
                      onChange={(val) => setWrkFields((p) => ({ ...p, phone: val }))}
                      style={{ marginTop: 6 }}
                    />
                  </div>
                </div>
                <div>
                  <label className="auth-label">{t("auth.fields.contact_email")} *</label>
                  <Input
                    type="email"
                    value={wrkFields.contactEmail}
                    onChange={wrkUpd("contactEmail")}
                    required
                    className="auth-input"
                    style={{ marginTop: 6 }}
                  />
                </div>
                <div>
                  <label className="auth-label">{t("auth.fields.referral_code")}</label>
                  <Input
                    value={wrkFields.referralCode}
                    onChange={wrkUpd("referralCode")}
                    maxLength={12}
                    className="auth-input"
                    style={{ marginTop: 6 }}
                  />
                </div>
                <div className="auth-disclaimer">
                  <p style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 12 }}>
                    {t("auth.disclaimer")}
                  </p>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Checkbox
                      id="accept-wrk"
                      checked={acceptTerms}
                      onCheckedChange={(v) => setAcceptTerms(v === true)}
                      className="border-gray-300 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500 mt-0.5"
                    />
                    <label
                      htmlFor="accept-wrk"
                      style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, cursor: "pointer" }}
                    >
                      {t("auth.accept_terms")}
                    </label>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setWorkerStep(1)} className="auth-btn-ghost">
                    <ArrowLeft size={13} /> {t("auth.actions.back", "Back")}
                  </button>
                  <button type="submit" disabled={isLoading} className="auth-btn-primary" style={{ marginTop: 0 }}>
                    {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    {t("auth.actions.signup")}
                  </button>
                </div>
              </form>
            )}
          </div>
          <p style={{ marginTop: 20, fontSize: 11, color: "#C4C4C0" }}>Step {workerStep} of 2</p>
        </div>
      </div>
    );
  }

  // ─── EMPLOYER MULTI-STEP ──────────────────────────────────────────────
  if (tab === "signup" && signupRole === "employer") {
    return (
      <div className="auth-root" style={{ minHeight: "100vh" }}>
        <style>{STYLES}</style>
        <ErrorDialog />

        <StepNavHeader
          onBack={() => {
            setSignupRole(null);
            setEmployerStep(1);
          }}
          backLabel={t("auth.back_to_selection", "Back")}
          roleLabel="Employer"
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            minHeight: "calc(100vh - 65px)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                borderRadius: 100,
                border: "1px solid #BAE6FD",
                background: "#F0F9FF",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#0284C7",
                marginBottom: 16,
              }}
            >
              <Building2 size={10} /> Employer Account
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
              {employerStep === 1
                ? "Create your account"
                : employerStep === 2
                  ? "Tell us about your company"
                  : "Hiring details"}
            </h2>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginTop: 6 }}>
              {employerStep === 1
                ? "Your login credentials"
                : employerStep === 2
                  ? "So workers know who you are"
                  : "Help us match the right workers"}
            </p>
          </div>

          <StepIndicator steps={EMPLOYER_STEPS} current={employerStep} />

          <div className="auth-card" style={{ width: "100%", maxWidth: 480, padding: "36px 40px" }}>
            {/* Step 1 */}
            {employerStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label className="auth-label">Full Name *</label>
                  <Input
                    value={empFields.fullName}
                    onChange={upd("fullName")}
                    required
                    className="auth-input"
                    style={{ marginTop: 6 }}
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="auth-label">Work Email *</label>
                  <Input
                    type="email"
                    value={empFields.email}
                    onChange={upd("email")}
                    required
                    className="auth-input"
                    style={{ marginTop: 6 }}
                    placeholder="you@company.com"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="auth-label">Password *</label>
                    <Input
                      type="password"
                      value={empFields.password}
                      onChange={upd("password")}
                      required
                      minLength={6}
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                  <div>
                    <label className="auth-label">Confirm Password *</label>
                    <Input
                      type="password"
                      value={empFields.confirmPassword}
                      onChange={upd("confirmPassword")}
                      required
                      minLength={6}
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEmployerNext}
                  className="auth-btn-primary"
                  style={{ marginTop: 4 }}
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* Step 2 */}
            {employerStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label className="auth-label">Company Name *</label>
                  <Input
                    value={empFields.companyName}
                    onChange={upd("companyName")}
                    required
                    className="auth-input"
                    style={{ marginTop: 6 }}
                    placeholder="Acme Farms LLC"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="auth-label">Legal Entity Name</label>
                    <Input
                      value={empFields.legalEntityName}
                      onChange={upd("legalEntityName")}
                      className="auth-input"
                      style={{ marginTop: 6 }}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="auth-label">EIN / Tax ID</label>
                    <Input
                      value={empFields.einTaxId}
                      onChange={upd("einTaxId")}
                      maxLength={30}
                      className="auth-input"
                      style={{ marginTop: 6 }}
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="auth-label">Company Size *</label>
                    <select
                      value={empFields.companySize}
                      onChange={upd("companySize")}
                      required
                      className="auth-select"
                      style={{ marginTop: 6 }}
                    >
                      <option value="">Select...</option>
                      <option value="1-10">1–10 employees</option>
                      <option value="11-50">11–50 employees</option>
                      <option value="51-200">51–200 employees</option>
                      <option value="201-500">201–500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </div>
                  <div>
                    <label className="auth-label">Industry *</label>
                    <select
                      value={empFields.industry}
                      onChange={upd("industry")}
                      required
                      className="auth-select"
                      style={{ marginTop: 6 }}
                    >
                      <option value="">Select...</option>
                      <option value="Agriculture">Agriculture</option>
                      <option value="Construction">Construction</option>
                      <option value="Hospitality">Hospitality</option>
                      <option value="Landscaping">Landscaping</option>
                      <option value="Food Processing">Food Processing</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Forestry">Forestry</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="auth-label">Website</label>
                  <Input
                    type="url"
                    value={empFields.website}
                    onChange={upd("website")}
                    className="auth-input"
                    style={{ marginTop: 6 }}
                    placeholder="https://yourcompany.com (optional)"
                  />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setEmployerStep(1)} className="auth-btn-ghost">
                    <ArrowLeft size={13} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleEmployerNext}
                    className="auth-btn-primary"
                    style={{ marginTop: 0 }}
                  >
                    Continue <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {employerStep === 3 && (
              <form onSubmit={handleEmployerSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="auth-label">Country *</label>
                    <Input
                      value={empFields.country}
                      onChange={upd("country")}
                      required
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                  <div>
                    <label className="auth-label">State *</label>
                    <Input
                      value={empFields.state}
                      onChange={upd("state")}
                      required
                      placeholder="e.g. Texas"
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                </div>
                <div>
                  <label className="auth-label">Primary Hiring Location *</label>
                  <Input
                    value={empFields.primaryHiringLocation}
                    onChange={upd("primaryHiringLocation")}
                    required
                    placeholder="City, State"
                    className="auth-input"
                    style={{ marginTop: 6 }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="auth-label">Worker Types *</label>
                    <select
                      value={empFields.workerTypes}
                      onChange={upd("workerTypes")}
                      required
                      className="auth-select"
                      style={{ marginTop: 6 }}
                    >
                      <option value="">Select...</option>
                      <option value="H-2A">H-2A (Agricultural)</option>
                      <option value="H-2B">H-2B (Non-Agricultural)</option>
                      <option value="H-2A,H-2B">Both H-2A & H-2B</option>
                    </select>
                  </div>
                  <div>
                    <label className="auth-label">Monthly Volume *</label>
                    <select
                      value={empFields.estimatedMonthlyVolume}
                      onChange={upd("estimatedMonthlyVolume")}
                      required
                      className="auth-select"
                      style={{ marginTop: 6 }}
                    >
                      <option value="">Select...</option>
                      <option value="1-10">1–10 workers</option>
                      <option value="11-50">11–50 workers</option>
                      <option value="51-100">51–100 workers</option>
                      <option value="100+">100+ workers</option>
                    </select>
                  </div>
                </div>
                <div className="auth-disclaimer">
                  <p style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 12 }}>
                    {t("auth.disclaimer")}
                  </p>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Checkbox
                      id="accept-emp"
                      checked={acceptTerms}
                      onCheckedChange={(v) => setAcceptTerms(v === true)}
                      className="border-gray-300 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500 mt-0.5"
                    />
                    <label
                      htmlFor="accept-emp"
                      style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, cursor: "pointer" }}
                    >
                      {t("auth.accept_terms")}
                    </label>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setEmployerStep(2)} className="auth-btn-ghost">
                    <ArrowLeft size={13} /> Back
                  </button>
                  <button type="submit" disabled={isLoading} className="auth-btn-primary" style={{ marginTop: 0 }}>
                    {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    Create employer account
                  </button>
                </div>
              </form>
            )}
          </div>
          <p style={{ marginTop: 20, fontSize: 11, color: "#C4C4C0" }}>Step {employerStep} of 3</p>
        </div>
      </div>
    );
  }

  // ─── DEFAULT LAYOUT ────────────────────────────────────────────────────
  return (
    <div className="auth-root" style={{ minHeight: "100vh", display: "flex" }}>
      <style>{STYLES}</style>
      <ErrorDialog />

      {/* ── Left branding panel ── */}
      <div
        className="auth-panel-left"
        style={{
          display: "none",
          width: "44%",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          position: "relative",
        }}
        // Show on lg+ via CSS below
      >
        <style>{`.auth-panel-left { display: none; } @media (min-width: 1024px) { .auth-panel-left { display: flex !important; } }`}</style>
        <div className="auth-panel-pattern" />
        <div className="auth-panel-glow" />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 className="auth-logo-text" style={{ fontSize: 36, color: "#111827" }}>
            H2 <span style={{ color: "#0ea5e9" }}>Linker</span>
          </h1>
          <p style={{ marginTop: 20, fontSize: 15, color: "#6B7280", maxWidth: 320, lineHeight: 1.7 }}>
            {t("auth.hero_description")}
          </p>
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ height: 1, width: 48, background: "linear-gradient(to right, #BAE6FD, transparent)" }} />
            <span
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#C4C4C0",
                fontWeight: 600,
              }}
            >
              {t("auth.visa_programs_label")}
            </span>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
            <div>
              <div className="auth-stat-number">
                10,000<span className="auth-stat-accent">+</span>
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>{t("auth.stats.jobs_in_database")}</div>
            </div>
            <div>
              <div className="auth-stat-number">
                100<span className="auth-stat-accent">%</span>
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>{t("auth.stats.free_to_start")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="auth-badge">{t("auth.badges.h2a")}</span>
            <span className="auth-badge">{t("auth.badges.h2b")}</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div
        className="auth-panel-right"
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px" }}
      >
        {/* Top bar */}
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <h1 className="auth-logo-text" style={{ fontSize: 22, color: "#111827" }}>
            H2 <span style={{ color: "#0ea5e9" }}>Linker</span>
          </h1>
          <LanguageSwitcher
            value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
            onChange={handleChangeLanguage}
            className="h-9 w-[130px] rounded-xl"
          />
        </div>

        <div className="auth-card" style={{ width: "100%", maxWidth: 420, padding: "36px 40px", margin: "auto 0" }}>
          {/* Tabs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              marginBottom: 32,
              background: "#F3F2EF",
              borderRadius: 12,
              padding: 4,
            }}
          >
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
                <div className="auth-success-notice" style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <CheckCircle2 size={15} style={{ color: "#16a34a", marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#15803D", margin: 0 }}>
                        {t("auth.signup_notice.title")}
                      </p>
                      <p style={{ fontSize: 12, color: "#4ADE80", marginTop: 4 }}>
                        {t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {signinPanel === "signin" && (
                <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label className="auth-label">{t("auth.fields.email")}</label>
                    <Input
                      name="email"
                      type="email"
                      placeholder={t("auth.placeholders.email")}
                      required
                      className="auth-input"
                      style={{ marginTop: 6 }}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <label className="auth-label">{t("auth.fields.password")}</label>
                      <button type="button" onClick={() => setSigninPanel("forgot")} className="auth-link">
                        {t("auth.recovery.link")}
                      </button>
                    </div>
                    <Input name="password" type="password" required className="auth-input" />
                  </div>
                  <button type="submit" disabled={isLoading} className="auth-btn-primary" style={{ marginTop: 4 }}>
                    {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    {t("auth.actions.signin")}
                  </button>
                </form>
              )}

              {signinPanel === "forgot" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
                      {t("auth.recovery.request_title")}
                    </p>
                    <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>{t("auth.recovery.request_desc")}</p>
                  </div>
                  {forgotState.sent && (
                    <div className="auth-success-notice">
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#15803D", margin: 0 }}>
                        {t("auth.recovery.sent_title")}
                      </p>
                      <p style={{ fontSize: 12, color: "#4ADE80", marginTop: 4 }}>
                        {t("auth.recovery.sent_desc", { email: forgotState.email })}
                      </p>
                    </div>
                  )}
                  <form
                    onSubmit={handleRequestPasswordReset}
                    style={{ display: "flex", flexDirection: "column", gap: 14 }}
                  >
                    <div>
                      <label className="auth-label">{t("auth.fields.email")}</label>
                      <Input
                        name="recoveryEmail"
                        type="email"
                        value={forgotState.email}
                        onChange={(e) => setForgotState((p) => ({ ...p, email: e.target.value }))}
                        required
                        className="auth-input"
                        style={{ marginTop: 6 }}
                      />
                    </div>
                    <button type="submit" disabled={isLoading} className="auth-btn-primary">
                      {isLoading && <Loader2 size={15} className="animate-spin" />}
                      {t("auth.recovery.actions.send_link")}
                    </button>
                    <button type="button" onClick={() => setSigninPanel("signin")} className="auth-btn-ghost">
                      {t("auth.recovery.actions.back_to_login")}
                    </button>
                  </form>
                </div>
              )}

              {signinPanel === "reset" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
                      {t("auth.recovery.reset_title")}
                    </p>
                    <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>{t("auth.recovery.reset_desc")}</p>
                  </div>
                  <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label className="auth-label">{t("auth.recovery.fields.new_password")}</label>
                      <Input
                        type="password"
                        value={resetState.password}
                        required
                        minLength={6}
                        onChange={(e) => setResetState((p) => ({ ...p, password: e.target.value }))}
                        className="auth-input"
                        style={{ marginTop: 6 }}
                      />
                    </div>
                    <div>
                      <label className="auth-label">{t("auth.recovery.fields.confirm_new_password")}</label>
                      <Input
                        type="password"
                        value={resetState.confirmPassword}
                        required
                        minLength={6}
                        onChange={(e) => setResetState((p) => ({ ...p, confirmPassword: e.target.value }))}
                        className="auth-input"
                        style={{ marginTop: 6 }}
                      />
                    </div>
                    <button type="submit" disabled={isLoading} className="auth-btn-primary">
                      {isLoading && <Loader2 size={15} className="animate-spin" />}
                      {t("auth.recovery.actions.save_new_password")}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── SIGN UP — Role Picker ── */}
          {tab === "signup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                  {t("auth.role_picker.title", "Choose your account type")}
                </h3>
                <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>
                  {t("auth.role_picker.desc", "Select how you'll use H2 Linker")}
                </p>
              </div>

              <button type="button" onClick={() => setSignupRole("worker")} className="auth-role-card">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "#F0F9FF",
                      border: "1.5px solid #BAE6FD",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <HardHat size={20} style={{ color: "#0284C7" }} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                      {t("auth.roles.worker")}
                    </p>
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>
                      {t("auth.role_picker.worker_desc", "Find H-2A/H-2B jobs and apply directly to employers")}
                    </p>
                  </div>
                  <ArrowRight size={15} style={{ color: "#D1D5DB", flexShrink: 0 }} />
                </div>
              </button>

              <button type="button" onClick={() => setSignupRole("employer")} className="auth-role-card">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "#F0F9FF",
                      border: "1.5px solid #BAE6FD",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={20} style={{ color: "#0284C7" }} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                      {t("auth.roles.employer")}
                    </p>
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>
                      {t("auth.role_picker.employer_desc", "Post jobs and recruit H-2 visa workers")}
                    </p>
                  </div>
                  <ArrowRight size={15} style={{ color: "#D1D5DB", flexShrink: 0 }} />
                </div>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate("/jobs")}
          style={{
            marginTop: 24,
            fontSize: 12,
            color: "#C4C4C0",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.05em",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#9CA3AF")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#C4C4C0")}
        >
          {t("auth.browse_jobs_link")}
        </button>
      </div>
    </div>
  );
}
