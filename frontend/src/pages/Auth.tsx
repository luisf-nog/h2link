import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, ArrowRight, ArrowLeft, Building2, User, Briefcase, Shield, HardHat } from "lucide-react";
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

  // Employer field state (held across steps)
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
      einTaxId: z.string().trim().max(30).optional().default("")
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

  // (Worker signup logic moved to handleWorkerFinalSubmit below)

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
          <div className="text-sm text-white/40 leading-relaxed">
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

  // ─── Shared style tokens ───────────────────────────────────────────────
  const labelCls = "text-[11px] font-bold uppercase tracking-[0.08em] text-white/40";
  const inputCls =
    "bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/20 focus:border-white/20 focus:ring-white/10 h-11 rounded-xl";
  const selectCls = `${inputCls} w-full h-11 rounded-xl px-3 text-sm`;
  const btnPrimary =
    "w-full mt-3 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 auth-btn-gradient text-white shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 hover:brightness-110";
  const btnGhost =
    "w-full border border-white/10 text-white/50 hover:text-white hover:border-white/20 font-medium py-2.5 rounded-xl text-sm transition-all bg-transparent cursor-pointer";

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
      if (!wrkFields.age.trim() || Number(wrkFields.age) < 14 || Number(wrkFields.age) > 90) return t("auth.validation.invalid_age");
      if (!wrkFields.phone.trim()) return t("auth.fields.phone") + " is required.";
      if (!wrkFields.contactEmail.trim()) return t("auth.fields.contact_email") + " is required.";
    }
    return null;
  };

  const handleWorkerNext = () => {
    const err = validateWorkerStep(1);
    if (err) { openError("Required field", err); return; }
    setWorkerStep(2);
  };

  const handleWorkerFinalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const err2 = validateWorkerStep(2);
    if (err2) { openError("Required field", err2); setIsLoading(false); return; }
    if (!acceptTerms) { openError(t("auth.toasts.signup_error_title"), t("auth.validation.accept_required")); setIsLoading(false); return; }

    const parsed = workerSignupSchema.safeParse({
      ...wrkFields,
      acceptTerms: true,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = String(first?.path?.[0] ?? "");
      const code = typeof first?.message === "string" ? first.message : "";
      const description =
        field === "age" || code === "invalid_age" ? t("auth.validation.invalid_age")
        : field === "phone" || code === "invalid_phone" ? t("auth.validation.invalid_phone")
        : field === "referralCode" || code === "invalid_referral_code" ? t("auth.validation.invalid_referral_code")
        : field === "confirmPassword" || code === "password_mismatch" ? t("auth.validation.password_mismatch")
        : field === "acceptTerms" || code === "accept_required" ? t("auth.validation.accept_required")
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
      openError(t("auth.toasts.signup_error_title"), isRateLimit ? t("auth.errors.email_rate_limit_desc") : isWeakPassword ? t("auth.errors.weak_password_desc") : error.message);
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
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
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

  // ─── WORKER MULTI-STEP LAYOUT ─────────────────────────────────────────
  if (tab === "signup" && signupRole === "worker") {
    return (
      <>
        <style>{`
          .auth-premium-bg { background: linear-gradient(145deg,#0a0e1a 0%,#0c1929 35%,#0a1628 65%,#080d18 100%); }
          .auth-glass-card { background: linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%); border:1px solid rgba(255,255,255,0.06); border-radius:20px; backdrop-filter:blur(40px); box-shadow:0 0 0 1px rgba(255,255,255,0.03) inset,0 32px 64px -12px rgba(0,0,0,0.5),0 0 120px -40px rgba(14,165,233,0.08); }
          .auth-accent-text { background:linear-gradient(135deg,#0ea5e9,#38bdf8); -webkit-background-clip:text; background-clip:text; color:transparent; }
          .auth-btn-gradient { background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%); }
          .auth-btn-gradient:hover { background:linear-gradient(135deg,#38bdf8 0%,#0ea5e9 100%); }
          .auth-grid-pattern { background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px); background-size:60px 60px; }
          .auth-glow-1 { position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(14,165,233,0.06) 0%,transparent 70%);top:-200px;right:-100px;pointer-events:none; }
          .auth-glow-2 { position:absolute;width:400px;height:400px;background:radial-gradient(circle,rgba(14,165,233,0.04) 0%,transparent 70%);bottom:-150px;left:-100px;pointer-events:none; }
          .emp-step-dot { width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;transition:all 0.25s; }
          .emp-step-done { background:rgba(14,165,233,0.2);border:1px solid rgba(14,165,233,0.4);color:#38bdf8; }
          .emp-step-active { background:linear-gradient(135deg,#0ea5e9,#0284c7);border:1px solid #0ea5e9;color:#fff;box-shadow:0 0 20px rgba(14,165,233,0.3); }
          .emp-step-idle { background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.2); }
          .emp-step-line { flex:1;height:1px;background:rgba(255,255,255,0.06);margin:0 8px; }
          .emp-step-line-done { background:rgba(14,165,233,0.3); }
          .auth-premium-bg input { font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif!important; }
        `}</style>

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

        <div className="auth-premium-bg min-h-screen relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 auth-grid-pattern pointer-events-none" />
          <div className="auth-glow-1" />
          <div className="auth-glow-2" />

          {/* Top nav */}
          <div className="relative z-10 flex items-center justify-between px-8 py-6">
            <h1 className="text-xl font-bold font-brand text-white">
              <span className="auth-accent-text">H2</span> Linker
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setSignupRole(null); setWorkerStep(1); }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
              >
                ← {t("auth.back_to_selection", "Back")}
              </button>
              <button
                onClick={() => { setTab("signin"); setSignupRole(null); setWorkerStep(1); }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
              >
                {t("auth.tabs.signin")}
              </button>
              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
                onChange={handleChangeLanguage}
                className="h-8 w-[120px] border-white/10 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl"
              />
            </div>
          </div>

          {/* Main content */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 text-[10px] font-bold text-sky-400/70 tracking-wider uppercase mb-4">
                <HardHat size={10} /> {t("auth.roles.worker")}
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {workerStep === 1 && t("auth.worker_steps.step1_title", "Create your account")}
                {workerStep === 2 && t("auth.worker_steps.step2_title", "Personal details")}
              </h2>
              <p className="text-sm text-white/30 mt-1.5">
                {workerStep === 1 && t("auth.worker_steps.step1_desc", "Your login credentials")}
                {workerStep === 2 && t("auth.worker_steps.step2_desc", "So employers can reach you")}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center mb-10 w-full max-w-xs">
              {WORKER_STEPS.map((s, i) => (
                <div key={s.n} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`emp-step-dot ${workerStep > s.n ? "emp-step-done" : workerStep === s.n ? "emp-step-active" : "emp-step-idle"}`}>
                      {workerStep > s.n ? <CheckCircle2 size={14} /> : <s.icon size={13} />}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${workerStep >= s.n ? "text-sky-400/70" : "text-white/15"}`}>{s.label}</span>
                  </div>
                  {i < WORKER_STEPS.length - 1 && (
                    <div className={`emp-step-line ${workerStep > s.n ? "emp-step-line-done" : ""}`} style={{ marginBottom: "18px" }} />
                  )}
                </div>
              ))}
            </div>

            {/* Form card */}
            <div className="w-full max-w-lg auth-glass-card p-8 sm:p-10">
              {workerStep === 1 && (
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <label className={labelCls}>{t("auth.fields.full_name")} *</label>
                    <Input value={wrkFields.fullName} onChange={wrkUpd("fullName")} required className={inputCls} placeholder="João Silva" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>{t("auth.fields.email")} *</label>
                    <Input type="email" value={wrkFields.email} onChange={wrkUpd("email")} required className={inputCls} placeholder="you@email.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("auth.fields.password")} *</label>
                      <Input type="password" value={wrkFields.password} onChange={wrkUpd("password")} required minLength={6} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>{t("auth.fields.confirm_password")} *</label>
                      <Input type="password" value={wrkFields.confirmPassword} onChange={wrkUpd("confirmPassword")} required minLength={6} className={inputCls} />
                    </div>
                  </div>
                  <button type="button" onClick={handleWorkerNext} className={btnPrimary} style={{ marginTop: "8px" }}>
                    {t("auth.actions.continue", "Continue")} <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {workerStep === 2 && (
                <form onSubmit={handleWorkerFinalSubmit} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("auth.fields.age")} *</label>
                      <Input type="number" min={14} max={90} value={wrkFields.age} onChange={wrkUpd("age")} required className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>{t("auth.fields.phone")} *</label>
                      <PhoneE164Input id="phone-wrk" name="phone-wrk" defaultCountry="BR" required inputClassName={inputCls}
                        defaultValue={wrkFields.phone}
                        onChange={(val) => setWrkFields((p) => ({ ...p, phone: val }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>{t("auth.fields.contact_email")} *</label>
                    <Input type="email" value={wrkFields.contactEmail} onChange={wrkUpd("contactEmail")} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>{t("auth.fields.referral_code")}</label>
                    <Input value={wrkFields.referralCode} onChange={wrkUpd("referralCode")} maxLength={12} className={inputCls} />
                  </div>

                  {/* Terms */}
                  <div className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.02] space-y-3 mt-1">
                    <p className="text-[10px] text-white/25 leading-relaxed">{t("auth.disclaimer")}</p>
                    <div className="flex gap-2.5 items-start">
                      <Checkbox
                        id="accept-wrk"
                        checked={acceptTerms}
                        onCheckedChange={(v) => setAcceptTerms(v === true)}
                        className="border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500 mt-0.5"
                      />
                      <label htmlFor="accept-wrk" className="text-[11px] text-white/40 leading-snug cursor-pointer">{t("auth.accept_terms")}</label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setWorkerStep(1)} className={`${btnGhost} mt-0`}>
                      <ArrowLeft size={14} style={{ display: "inline", marginRight: 6 }} /> {t("auth.actions.back", "Back")}
                    </button>
                    <button type="submit" disabled={isLoading} className={`${btnPrimary} mt-0`} style={{ marginTop: 0 }}>
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      {t("auth.actions.signup")}
                    </button>
                  </div>
                </form>
              )}
            </div>
            <p className="mt-6 text-[11px] text-white/15">Step {workerStep} of 2</p>
          </div>
        </div>
      </>
    );
  }

  // ─── EMPLOYER MULTI-STEP LAYOUT ────────────────────────────────────────
  if (tab === "signup" && signupRole === "employer") {
    return (
      <>
        <style>{`
          .auth-premium-bg { background: linear-gradient(145deg,#0a0e1a 0%,#0c1929 35%,#0a1628 65%,#080d18 100%); }
          .auth-glass-card { background: linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%); border:1px solid rgba(255,255,255,0.06); border-radius:20px; backdrop-filter:blur(40px); box-shadow:0 0 0 1px rgba(255,255,255,0.03) inset,0 32px 64px -12px rgba(0,0,0,0.5),0 0 120px -40px rgba(14,165,233,0.08); }
          .auth-accent-text { background:linear-gradient(135deg,#0ea5e9,#38bdf8); -webkit-background-clip:text; background-clip:text; color:transparent; }
          .auth-btn-gradient { background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%); }
          .auth-btn-gradient:hover { background:linear-gradient(135deg,#38bdf8 0%,#0ea5e9 100%); }
          .auth-grid-pattern { background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px); background-size:60px 60px; }
          .auth-glow-1 { position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(14,165,233,0.06) 0%,transparent 70%);top:-200px;right:-100px;pointer-events:none; }
          .auth-glow-2 { position:absolute;width:400px;height:400px;background:radial-gradient(circle,rgba(14,165,233,0.04) 0%,transparent 70%);bottom:-150px;left:-100px;pointer-events:none; }
          .emp-step-dot { width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;transition:all 0.25s; }
          .emp-step-done { background:rgba(14,165,233,0.2);border:1px solid rgba(14,165,233,0.4);color:#38bdf8; }
          .emp-step-active { background:linear-gradient(135deg,#0ea5e9,#0284c7);border:1px solid #0ea5e9;color:#fff;box-shadow:0 0 20px rgba(14,165,233,0.3); }
          .emp-step-idle { background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.2); }
          .emp-step-line { flex:1;height:1px;background:rgba(255,255,255,0.06);margin:0 8px; }
          .emp-step-line-done { background:rgba(14,165,233,0.3); }
          .auth-premium-bg input,.auth-premium-bg select { font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif!important; }
          .auth-premium-bg select option { background:#0c1929; color:#fff; }
        `}</style>

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

        <div className="auth-premium-bg min-h-screen relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 auth-grid-pattern pointer-events-none" />
          <div className="auth-glow-1" />
          <div className="auth-glow-2" />

          {/* Top nav */}
          <div className="relative z-10 flex items-center justify-between px-8 py-6">
            <h1 className="text-xl font-bold font-brand text-white">
              <span className="auth-accent-text">H2</span> Linker
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setSignupRole(null); setEmployerStep(1); }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
              >
                ← {t("auth.back_to_selection", "Back")}
              </button>
              <button
                onClick={() => { setTab("signin"); setSignupRole(null); setEmployerStep(1); }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
              >
                {t("auth.tabs.signin")}
              </button>
              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
                onChange={handleChangeLanguage}
                className="h-8 w-[120px] border-white/10 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl"
              />
            </div>
          </div>

          {/* Main content */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 text-[10px] font-bold text-sky-400/70 tracking-wider uppercase mb-4">
                <Building2 size={10} /> Employer Account
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {employerStep === 1 && "Create your account"}
                {employerStep === 2 && "Tell us about your company"}
                {employerStep === 3 && "Hiring details"}
              </h2>
              <p className="text-sm text-white/30 mt-1.5">
                {employerStep === 1 && "Your login credentials"}
                {employerStep === 2 && "So workers know who you are"}
                {employerStep === 3 && "Help us match the right workers"}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center mb-10 w-full max-w-xs">
              {EMPLOYER_STEPS.map((s, i) => (
                <div key={s.n} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`emp-step-dot ${employerStep > s.n ? "emp-step-done" : employerStep === s.n ? "emp-step-active" : "emp-step-idle"}`}
                    >
                      {employerStep > s.n ? <CheckCircle2 size={14} /> : <s.icon size={13} />}
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider ${employerStep >= s.n ? "text-sky-400/70" : "text-white/15"}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < EMPLOYER_STEPS.length - 1 && (
                    <div
                      className={`emp-step-line ${employerStep > s.n ? "emp-step-line-done" : ""}`}
                      style={{ marginBottom: "18px" }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Form card */}
            <div className="w-full max-w-lg auth-glass-card p-8 sm:p-10">
              {/* ── STEP 1: Account ── */}
              {employerStep === 1 && (
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <label className={labelCls}>Full Name *</label>
                    <Input value={empFields.fullName} onChange={upd("fullName")} required className={inputCls} placeholder="Jane Smith" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Work Email *</label>
                    <Input type="email" value={empFields.email} onChange={upd("email")} required className={inputCls} placeholder="you@company.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={labelCls}>Password *</label>
                      <Input type="password" value={empFields.password} onChange={upd("password")} required minLength={6} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Confirm Password *</label>
                      <Input type="password" value={empFields.confirmPassword} onChange={upd("confirmPassword")} required minLength={6} className={inputCls} />
                    </div>
                  </div>
                  <button type="button" onClick={handleEmployerNext} className={btnPrimary} style={{ marginTop: "8px" }}>
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* ── STEP 2: Company ── */}
              {employerStep === 2 && (
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <label className={labelCls}>Company Name *</label>
                    <Input value={empFields.companyName} onChange={upd("companyName")} required className={inputCls} placeholder="Acme Farms LLC" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={labelCls}>Legal Entity Name</label>
                      <Input value={empFields.legalEntityName} onChange={upd("legalEntityName")} className={inputCls} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>EIN / Tax ID</label>
                      <Input value={empFields.einTaxId} onChange={upd("einTaxId")} maxLength={30} className={inputCls} placeholder="XX-XXXXXXX" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={labelCls}>Company Size *</label>
                      <select value={empFields.companySize} onChange={upd("companySize")} required className={selectCls}>
                        <option value="">Select...</option>
                        <option value="1-10">1–10 employees</option>
                        <option value="11-50">11–50 employees</option>
                        <option value="51-200">51–200 employees</option>
                        <option value="201-500">201–500 employees</option>
                        <option value="500+">500+ employees</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Industry *</label>
                      <select value={empFields.industry} onChange={upd("industry")} required className={selectCls}>
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
                  <div className="space-y-2">
                    <label className={labelCls}>Website</label>
                    <Input type="url" value={empFields.website} onChange={upd("website")} className={inputCls} placeholder="https://yourcompany.com (optional)" />
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button type="button" onClick={() => setEmployerStep(1)} className={`${btnGhost} mt-0`}>
                      <ArrowLeft size={14} style={{ display: "inline", marginRight: 6 }} /> Back
                    </button>
                    <button type="button" onClick={handleEmployerNext} className={`${btnPrimary} mt-0`} style={{ marginTop: 0 }}>
                      Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Hiring ── */}
              {employerStep === 3 && (
                <form onSubmit={handleEmployerSubmit} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={labelCls}>Country *</label>
                      <Input value={empFields.country} onChange={upd("country")} required className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>State *</label>
                      <Input value={empFields.state} onChange={upd("state")} required placeholder="e.g. Texas" className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Primary Hiring Location *</label>
                    <Input value={empFields.primaryHiringLocation} onChange={upd("primaryHiringLocation")} required placeholder="City, State" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={labelCls}>Worker Types *</label>
                      <select value={empFields.workerTypes} onChange={upd("workerTypes")} required className={selectCls}>
                        <option value="">Select...</option>
                        <option value="H-2A">H-2A (Agricultural)</option>
                        <option value="H-2B">H-2B (Non-Agricultural)</option>
                        <option value="H-2A,H-2B">Both H-2A & H-2B</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Monthly Volume *</label>
                      <select value={empFields.estimatedMonthlyVolume} onChange={upd("estimatedMonthlyVolume")} required className={selectCls}>
                        <option value="">Select...</option>
                        <option value="1-10">1–10 workers</option>
                        <option value="11-50">11–50 workers</option>
                        <option value="51-100">51–100 workers</option>
                        <option value="100+">100+ workers</option>
                      </select>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.02] space-y-3 mt-1">
                    <p className="text-[10px] text-white/25 leading-relaxed">{t("auth.disclaimer")}</p>
                    <div className="flex gap-2.5 items-start">
                      <Checkbox
                        id="accept-emp"
                        checked={acceptTerms}
                        onCheckedChange={(v) => setAcceptTerms(v === true)}
                        className="border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500 mt-0.5"
                      />
                      <label htmlFor="accept-emp" className="text-[11px] text-white/40 leading-snug cursor-pointer">{t("auth.accept_terms")}</label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEmployerStep(2)} className={`${btnGhost} mt-0`}>
                      <ArrowLeft size={14} style={{ display: "inline", marginRight: 6 }} /> Back
                    </button>
                    <button type="submit" disabled={isLoading} className={`${btnPrimary} mt-0`} style={{ marginTop: 0 }}>
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      Create employer account
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Step hint */}
            <p className="mt-6 text-[11px] text-white/15">Step {employerStep} of 3</p>
          </div>
        </div>
      </>
    );
  }

  // ─── DEFAULT LAYOUT (signin + role picker) ─────────────────────────────
  return (
    <>
      <style>{`
        .auth-premium-bg { background:linear-gradient(145deg,#0a0e1a 0%,#0c1929 35%,#0a1628 65%,#080d18 100%); }
        .auth-glass-card { background:linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%); border:1px solid rgba(255,255,255,0.06); border-radius:20px; backdrop-filter:blur(40px); box-shadow:0 0 0 1px rgba(255,255,255,0.03) inset,0 32px 64px -12px rgba(0,0,0,0.5),0 0 120px -40px rgba(14,165,233,0.08); }
        .auth-accent-text { background:linear-gradient(135deg,#0ea5e9,#38bdf8); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .auth-btn-gradient { background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%); }
        .auth-btn-gradient:hover { background:linear-gradient(135deg,#38bdf8 0%,#0ea5e9 100%); }
        .auth-tab-active { background:linear-gradient(135deg,rgba(14,165,233,0.15) 0%,rgba(14,165,233,0.05) 100%); border:1px solid rgba(14,165,233,0.25); color:#38bdf8; }
        .auth-grid-pattern { background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px); background-size:60px 60px; }
        .auth-glow-1 { position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(14,165,233,0.06) 0%,transparent 70%);top:-200px;right:-100px;pointer-events:none; }
        .auth-glow-2 { position:absolute;width:400px;height:400px;background:radial-gradient(circle,rgba(220,38,38,0.04) 0%,transparent 70%);bottom:-150px;left:-100px;pointer-events:none; }
        .auth-stripe { position:absolute;height:2px;background:linear-gradient(90deg,transparent,rgba(14,165,233,0.15),transparent); }
        .auth-premium-bg input { font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif!important; }
      `}</style>

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

      <div className="auth-premium-bg min-h-screen relative overflow-x-hidden flex">
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
            <p className="mt-5 text-white/30 text-base max-w-sm leading-relaxed">{t("auth.hero_description")}</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-sky-500/40 to-transparent" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-semibold">
                {t("auth.visa_programs_label")}
              </span>
            </div>
          </div>
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-3xl font-bold text-white font-brand">
                  10,000<span className="auth-accent-text">+</span>
                </div>
                <div className="text-xs text-white/30 mt-1">{t("auth.stats.jobs_in_database")}</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white font-brand">
                  100<span className="auth-accent-text">%</span>
                </div>
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
        <div className="flex-1 flex flex-col items-center p-6 sm:p-10 lg:p-16 relative z-10">
          {/* Language switcher - always on top */}
          <div className="w-full max-w-[440px] flex items-center justify-between mb-4 lg:mb-6 shrink-0">
            <div className="lg:hidden">
              <h1 className="text-xl font-bold font-brand text-white">
                <span className="auth-accent-text">H2</span> Linker
              </h1>
            </div>
            <div className="lg:ml-auto">
              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
                onChange={handleChangeLanguage}
                className="h-9 w-[130px] border-white/10 bg-white/5 text-white/60 hover:bg-white/10 rounded-xl"
              />
            </div>
          </div>

          <div className="w-full max-w-[440px] auth-glass-card p-8 sm:p-10 my-auto">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-8">
              <button
                className={`py-2.5 px-4 rounded-xl text-sm font-semibold font-brand transition-all ${tab === "signin" ? "auth-tab-active" : "text-white/30 hover:text-white/50 border border-transparent"}`}
                onClick={() => setTab("signin")}
              >
                {t("auth.tabs.signin")}
              </button>
              <button
                className={`py-2.5 px-4 rounded-xl text-sm font-semibold font-brand transition-all ${tab === "signup" ? "auth-tab-active" : "text-white/30 hover:text-white/50 border border-transparent"}`}
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
                        <p className="text-xs text-emerald-400/60 mt-0.5">
                          {t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {signinPanel === "signin" && (
                  <form onSubmit={handleSignIn} className="flex flex-col gap-5">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("auth.fields.email")}</label>
                      <Input
                        name="email"
                        type="email"
                        placeholder={t("auth.placeholders.email")}
                        required
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className={labelCls}>{t("auth.fields.password")}</label>
                        <button
                          type="button"
                          onClick={() => setSigninPanel("forgot")}
                          className="text-[11px] auth-accent-text hover:brightness-125 font-medium bg-transparent border-none cursor-pointer transition-all"
                        >
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
                        <p className="text-xs text-emerald-400/60 mt-0.5">
                          {t("auth.recovery.sent_desc", { email: forgotState.email })}
                        </p>
                      </div>
                    )}
                    <form onSubmit={handleRequestPasswordReset} className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <label className={labelCls}>{t("auth.fields.email")}</label>
                        <Input
                          name="recoveryEmail"
                          type="email"
                          value={forgotState.email}
                          onChange={(e) => setForgotState((p) => ({ ...p, email: e.target.value }))}
                          required
                          className={inputCls}
                        />
                      </div>
                      <button type="submit" disabled={isLoading} className={btnPrimary}>
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {t("auth.recovery.actions.send_link")}
                      </button>
                      <button type="button" onClick={() => setSigninPanel("signin")} className={btnGhost}>
                        {t("auth.recovery.actions.back_to_login")}
                      </button>
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
                        <Input
                          type="password"
                          value={resetState.password}
                          required
                          minLength={6}
                          onChange={(e) => setResetState((p) => ({ ...p, password: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={labelCls}>{t("auth.recovery.fields.confirm_new_password")}</label>
                        <Input
                          type="password"
                          value={resetState.confirmPassword}
                          required
                          minLength={6}
                          onChange={(e) => setResetState((p) => ({ ...p, confirmPassword: e.target.value }))}
                          className={inputCls}
                        />
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

            {/* ── SIGN UP — Role Picker ── */}
            {tab === "signup" && (
              <div className="flex flex-col gap-5">
                <div className="text-center mb-2">
                  <h3 className="text-lg font-bold text-white">{t("auth.role_picker.title", "Choose your account type")}</h3>
                  <p className="text-sm text-white/30 mt-1">{t("auth.role_picker.desc", "Select how you'll use H2 Linker")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSignupRole("worker")}
                  className="group w-full text-left p-5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-sky-500/30 hover:bg-sky-500/[0.05] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                      <HardHat size={22} className="text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                        {t("auth.roles.worker")}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {t("auth.role_picker.worker_desc", "Find H-2A/H-2B jobs and apply directly to employers")}
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-white/15 group-hover:text-sky-400 transition-colors shrink-0" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSignupRole("employer")}
                  className="group w-full text-left p-5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-sky-500/30 hover:bg-sky-500/[0.05] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                      <Building2 size={22} className="text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                        {t("auth.roles.employer")}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {t("auth.role_picker.employer_desc", "Post jobs and recruit H-2 visa workers")}
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-white/15 group-hover:text-sky-400 transition-colors shrink-0" />
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate("/jobs")}
            className="mt-8 text-[11px] text-white/15 hover:text-white/35 transition-colors bg-transparent border-none cursor-pointer font-brand tracking-wide"
          >
            {t("auth.browse_jobs_link")}
          </button>
        </div>
      </div>
    </>
  );
}
