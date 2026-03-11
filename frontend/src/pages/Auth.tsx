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
  Users,
  FileText,
  Send,
  Eye,
  EyeOff,
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
import { useActiveJobCount, formatJobCount } from "@/hooks/useActiveJobCount";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Tipos e Constantes ──────────────────────────────────────────────────
type Role = "worker" | "employer" | null;
type EmployerStep = 1 | 2 | 3;
type WorkerStep = 1 | 2;

const EMPLOYER_STEPS = [
  { n: 1, icon: User, label: "Account" },
  { n: 2, icon: Building2, label: "Company" },
  { n: 3, icon: Briefcase, label: "Hiring" },
] as const;

const WORKER_STEPS = [
  { n: 1, icon: User, label: "Account" },
  { n: 2, icon: Shield, label: "Details" },
] as const;

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [signupRole, setSignupRole] = useState<Role>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [employerStep, setEmployerStep] = useState<EmployerStep>(1);
  const [workerStep, setWorkerStep] = useState<WorkerStep>(1);

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
  const liveJobCount = useActiveJobCount();
  const jobCountLabel = formatJobCount(liveJobCount, i18n.language);

  const openError = (title: string, description: string) => setErrorDialog({ open: true, title, description });

  const okLabel = useMemo(() => {
    const label = t("common.ok");
    return label === "common.ok" ? "OK" : label;
  }, [t]);

  // ─── Helpers de Atualização ──────────────────────────────────────────────
  const upd = (k: keyof typeof empFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEmpFields((p) => ({ ...p, [k]: e.target.value }));

  const wrkUpd = (k: keyof typeof wrkFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setWrkFields((p) => ({ ...p, [k]: e.target.value }));

  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

  // ─── Estilos Dinâmicos e Classes ─────────────────────────────────────────
  const isWorker = signupRole === "worker";
  const primaryColor = isWorker ? "bg-[#D4500A] hover:bg-[#b04207]" : "bg-[#0ea5e9] hover:bg-[#0284c7]";
  const textAccent = isWorker ? "text-[#D4500A]" : "text-[#0ea5e9]";

  const labelCls = "text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block";
  const inputCls =
    "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-0 h-11 rounded-xl w-full px-3 text-sm transition-all";
  const selectCls = `${inputCls} appearance-none cursor-pointer`;
  const btnPrimary = `w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all mt-6 shadow-md ${primaryColor}`;
  const btnGhost =
    "w-full text-slate-500 hover:text-slate-900 font-medium py-2.5 rounded-xl text-sm transition-all bg-transparent cursor-pointer mt-3 flex items-center justify-center gap-2";

  // ─── Validações Zod (Mantidas exatamente como no original) ───────────────
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

  // ─── Efeito de Recuperação e Confirmação de Email ────────────────────────
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

  // ─── Handlers de Submissão ───────────────────────────────────────────────
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

  // ─── Painel Esquerdo Dinâmico ───────────────────────────────────────────
  const renderLeftPanelContent = () => {
    if (signupRole === "worker") {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
          <p className="text-[#D4500A] text-xs font-bold uppercase tracking-[0.2em] mb-6">
            Smart connections. Real opportunities.
          </p>
          <h2 className="text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
            Find your next
            <br />
            US opportunity.
          </h2>
          <p className="text-slate-400 text-lg mb-12 max-w-md">
            Connect directly with verified employers offering H-2A and H-2B visa sponsorship.
          </p>
          <div className="space-y-8 pt-10 border-t border-white/10">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <Briefcase className="text-[#D4500A]" size={24} />
              </div>
              <div>
                <h4 className="text-white text-lg font-semibold">{jobCountLabel} Active Jobs</h4>
                <p className="text-slate-400 text-sm mt-1">Updated daily from the DOL database.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <Send className="text-[#D4500A]" size={24} />
              </div>
              <div>
                <h4 className="text-white text-lg font-semibold">1-Click Apply</h4>
                <p className="text-slate-400 text-sm mt-1">Send your structured profile instantly.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (signupRole === "employer") {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
          <p className="text-[#0ea5e9] text-xs font-bold uppercase tracking-[0.2em] mb-6">
            Smart connections. Real opportunities.
          </p>
          <h2 className="text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
            Recruit without
            <br />
            the chaos.
          </h2>
          <p className="text-slate-400 text-lg mb-12 max-w-md">
            Centralize applications, find verified candidates, and automate your DOL compliance.
          </p>
          <div className="space-y-8 pt-10 border-t border-white/10">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <Users className="text-[#0ea5e9]" size={24} />
              </div>
              <div>
                <h4 className="text-white text-lg font-semibold">Verified Candidates</h4>
                <p className="text-slate-400 text-sm mt-1">Pre-screened workers with structured resumes.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <FileText className="text-[#0ea5e9]" size={24} />
              </div>
              <div>
                <h4 className="text-white text-lg font-semibold">Automated DOL Logs</h4>
                <p className="text-slate-400 text-sm mt-1">Generate compliance reports automatically.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        <p className="text-[#0ea5e9] text-xs font-bold uppercase tracking-[0.2em] mb-6">
          Smart connections. Real opportunities.
        </p>
        <h2 className="text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          The central hub for
          <br />
          H-2 recruitment.
        </h2>
        <p className="text-slate-400 text-lg leading-relaxed mb-12 max-w-md">
          Bridging the gap between US employers and global talent efficiently and legally.
        </p>
        <div className="grid grid-cols-2 gap-10 pt-10 border-t border-white/10">
          <div>
            <div className="text-5xl font-bold text-white tracking-tight">
              10k<span className="text-[#D4500A]">+</span>
            </div>
            <div className="text-sm text-slate-400 mt-3 font-semibold uppercase tracking-wider">Active Jobs</div>
          </div>
          <div>
            <div className="text-5xl font-bold text-white tracking-tight">
              100<span className="text-[#0ea5e9]">%</span>
            </div>
            <div className="text-sm text-slate-400 mt-3 font-semibold uppercase tracking-wider">DOL Compliant</div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Principal ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-sky-500/30">
      {/* OVERLAY DE CONFIRMAÇÃO */}
      {confirmFlow.active && (
        <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm z-50">
          <div className="w-full max-w-sm bg-white p-10 rounded-3xl shadow-2xl text-center border border-slate-100">
            <h1 className="text-2xl font-bold font-brand text-slate-900">
              <span className="text-sky-500">H2</span> Linker
            </h1>
            <div className="mt-8 mb-4 flex justify-center">
              {confirmFlow.state === "processing" && <Loader2 size={32} className="text-sky-500 animate-spin" />}
              {confirmFlow.state === "success" && <CheckCircle2 size={32} className="text-emerald-500" />}
              {confirmFlow.state === "error" && <AlertTriangle size={32} className="text-red-500" />}
            </div>
            <div className="text-lg font-bold text-slate-900 mb-2">
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
            <div className="text-sm text-slate-500 leading-relaxed">
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
      )}

      {/* MODAL DE ERROS */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((p) => ({ ...p, open }))}>
        <AlertDialogContent className="bg-white rounded-[2rem] border-slate-100 p-8">
          <AlertDialogHeader className="flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle size={28} />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">{errorDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center mt-6">
            <AlertDialogAction className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-10 h-11 font-bold">
              {okLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PAINEL ESQUERDO (Dark Corporate) */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#020617] p-16 flex-col justify-between relative overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, rgba(14, 165, 233, 0.15) 0%, transparent 50%)",
          }}
        ></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className={textAccent}>H2</span> Linker
          </h1>
        </div>
        <div className="relative z-10 flex-1 flex items-center">{renderLeftPanelContent()}</div>
        <div className="relative z-10 text-slate-600 text-sm font-medium">
          © {new Date().getFullYear()} H2 Linker. All rights reserved.
        </div>
      </div>

      {/* PAINEL DIREITO (Light Form) */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">
        <div className="absolute top-0 right-0 w-full p-6 flex justify-between lg:justify-end items-center z-10">
          <div className="lg:hidden">
            <h1 className="text-xl font-bold text-slate-900">
              <span className="text-sky-500">H2</span> Linker
            </h1>
          </div>
          <LanguageSwitcher
            value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
            onChange={handleChangeLanguage}
            className="bg-white border-slate-200 text-slate-600 shadow-sm rounded-xl h-10 px-3"
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 mt-16 lg:mt-0">
          <div className="w-full max-w-[440px] bg-white p-8 sm:p-10 rounded-[2.5rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
              <button
                onClick={() => {
                  setTab("signin");
                  setSignupRole(null);
                }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Sign Up
              </button>
            </div>

            {/* ── TELA DE LOGIN ── */}
            {tab === "signin" && (
              <div className="animate-in fade-in zoom-in-95 duration-300">
                {signupNotice.visible && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
                    <div className="flex gap-3 items-start">
                      <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-emerald-800">{t("auth.signup_notice.title")}</p>
                        <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed">
                          {t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {signinPanel === "signin" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
                      <p className="text-slate-500 text-sm mt-1">Enter your details to access your account.</p>
                    </div>
                    <form onSubmit={handleSignIn} className="space-y-5">
                      <div>
                        <label className={labelCls}>{t("auth.fields.email")}</label>
                        <Input name="email" type="email" required className={inputCls} placeholder="you@company.com" />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className={labelCls}>Password</label>
                          <button
                            type="button"
                            onClick={() => setSigninPanel("forgot")}
                            className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            className={inputCls}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all mt-6 shadow-md bg-[#0ea5e9] hover:bg-[#0284c7]`}
                      >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : t("auth.actions.signin")}
                      </button>
                    </form>
                  </>
                )}

                {signinPanel === "forgot" && (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-slate-900">{t("auth.recovery.request_title")}</h2>
                      <p className="text-slate-500 text-sm mt-1">{t("auth.recovery.request_desc")}</p>
                    </div>
                    {forgotState.sent && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
                        <p className="text-sm font-bold text-emerald-800">{t("auth.recovery.sent_title")}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          {t("auth.recovery.sent_desc", { email: forgotState.email })}
                        </p>
                      </div>
                    )}
                    <form onSubmit={handleRequestPasswordReset} className="space-y-5">
                      <div>
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
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md bg-[#0ea5e9] hover:bg-[#0284c7]`}
                      >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}{" "}
                        {t("auth.recovery.actions.send_link")}
                      </button>
                      <button type="button" onClick={() => setSigninPanel("signin")} className={btnGhost}>
                        <ArrowLeft size={16} /> {t("auth.recovery.actions.back_to_login")}
                      </button>
                    </form>
                  </div>
                )}

                {signinPanel === "reset" && (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-slate-900">{t("auth.recovery.reset_title")}</h2>
                      <p className="text-slate-500 text-sm mt-1">{t("auth.recovery.reset_desc")}</p>
                    </div>
                    <form onSubmit={handleUpdatePassword} className="space-y-5">
                      <div>
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
                      <div>
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
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md bg-[#0ea5e9] hover:bg-[#0284c7]`}
                      >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}{" "}
                        {t("auth.recovery.actions.save_new_password")}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── TELA DE CADASTRO (ROLE PICKER) ── */}
            {tab === "signup" && !signupRole && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Join H2 Linker</h2>
                  <p className="text-slate-500 text-sm mt-1">Select your account type to continue.</p>
                </div>
                <div className="space-y-4">
                  <button
                    onClick={() => setSignupRole("worker")}
                    className="w-full bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#D4500A] hover:shadow-lg transition-all text-left group flex items-center gap-5 cursor-pointer"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-[#D4500A]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <HardHat size={24} className="text-[#D4500A]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-slate-900 font-bold text-lg group-hover:text-[#D4500A] transition-colors">
                        {t("auth.roles.worker")}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">I want to find visa-sponsored jobs.</p>
                    </div>
                    <ArrowRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-all" />
                  </button>
                  <button
                    onClick={() => setSignupRole("employer")}
                    className="w-full bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#0ea5e9] hover:shadow-lg transition-all text-left group flex items-center gap-5 cursor-pointer"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-[#0ea5e9]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Building2 size={24} className="text-[#0ea5e9]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-slate-900 font-bold text-lg group-hover:text-[#0ea5e9] transition-colors">
                        {t("auth.roles.employer")}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">I want to hire global talent.</p>
                    </div>
                    <ArrowRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              </div>
            )}

            {/* ── TELA DE CADASTRO (FORMULÁRIOS) ── */}
            {tab === "signup" && signupRole && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4 mb-8">
                  <button
                    onClick={() => setSignupRole(null)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer border-none"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {isWorker ? "Worker Account" : "Employer Account"}
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">
                      Step {isWorker ? workerStep : employerStep} of {isWorker ? 2 : 3}
                    </p>
                  </div>
                </div>

                {/* INDICADOR DE PASSOS */}
                <div className="flex items-center justify-between mb-10 px-2">
                  {(isWorker ? WORKER_STEPS : EMPLOYER_STEPS).map((s, i, arr) => {
                    const active = (isWorker ? workerStep : employerStep) === s.n;
                    const done = (isWorker ? workerStep : employerStep) > s.n;
                    return (
                      <div key={s.n} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${done ? "bg-emerald-500 text-white" : active ? primaryColor + " text-white scale-110 shadow-lg" : "bg-slate-100 text-slate-400"}`}
                          >
                            {done ? <CheckCircle2 size={16} /> : <s.icon size={14} />}
                          </div>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-tighter ${active || done ? "text-slate-900" : "text-slate-300"}`}
                          >
                            {s.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`flex-1 h-[2px] mx-2 mb-6 ${done ? "bg-emerald-500" : "bg-slate-100"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* FORMULÁRIO DO WORKER */}
                {isWorker && (
                  <div className="space-y-5">
                    {workerStep === 1 ? (
                      <>
                        <div>
                          <label className={labelCls}>{t("auth.fields.full_name")} *</label>
                          <Input
                            value={wrkFields.fullName}
                            onChange={wrkUpd("fullName")}
                            required
                            className={inputCls}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>{t("auth.fields.email")} *</label>
                          <Input
                            type="email"
                            value={wrkFields.email}
                            onChange={wrkUpd("email")}
                            required
                            className={inputCls}
                            placeholder="you@email.com"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Password</label>
                            <Input
                              type="password"
                              value={wrkFields.password}
                              onChange={wrkUpd("password")}
                              required
                              minLength={6}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Confirm</label>
                            <Input
                              type="password"
                              value={wrkFields.confirmPassword}
                              onChange={wrkUpd("confirmPassword")}
                              required
                              minLength={6}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <button type="button" onClick={handleWorkerNext} className={btnPrimary}>
                          Continue <ArrowRight size={18} />
                        </button>
                      </>
                    ) : (
                      <form onSubmit={handleWorkerFinalSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Age *</label>
                            <Input
                              type="number"
                              min={14}
                              max={90}
                              value={wrkFields.age}
                              onChange={wrkUpd("age")}
                              required
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Phone *</label>
                            <PhoneE164Input
                              id="p-wrk"
                              name="p-wrk"
                              defaultCountry="BR"
                              required
                              inputClassName={inputCls}
                              defaultValue={wrkFields.phone}
                              onChange={(val) => setWrkFields((p) => ({ ...p, phone: val }))}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Contact Email *</label>
                          <Input
                            type="email"
                            value={wrkFields.contactEmail}
                            onChange={wrkUpd("contactEmail")}
                            required
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Referral Code</label>
                          <Input
                            value={wrkFields.referralCode}
                            onChange={wrkUpd("referralCode")}
                            maxLength={12}
                            className={inputCls}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50">
                          <div className="flex gap-3 items-start">
                            <Checkbox
                              id="acc-wrk"
                              checked={acceptTerms}
                              onCheckedChange={(v) => setAcceptTerms(v === true)}
                              className="mt-1 border-slate-300 data-[state=checked]:bg-[#D4500A] data-[state=checked]:border-[#D4500A]"
                            />
                            <label htmlFor="acc-wrk" className="text-[10px] text-slate-500 leading-relaxed font-medium">
                              I agree to the Terms of Service and Privacy Policy.
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setWorkerStep(1)} className={btnGhost}>
                            <ArrowLeft size={16} /> Back
                          </button>
                          <button type="submit" disabled={isLoading} className={btnPrimary}>
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* FORMULÁRIO DO EMPLOYER */}
                {signupRole === "employer" && (
                  <div className="space-y-5">
                    {employerStep === 1 && (
                      <>
                        <div>
                          <label className={labelCls}>Full Name *</label>
                          <Input
                            value={empFields.fullName}
                            onChange={upd("fullName")}
                            required
                            className={inputCls}
                            placeholder="Jane Smith"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Work Email *</label>
                          <Input
                            type="email"
                            value={empFields.email}
                            onChange={upd("email")}
                            required
                            className={inputCls}
                            placeholder="jane@company.com"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Password</label>
                            <Input
                              type="password"
                              value={empFields.password}
                              onChange={upd("password")}
                              required
                              minLength={6}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Confirm</label>
                            <Input
                              type="password"
                              value={empFields.confirmPassword}
                              onChange={upd("confirmPassword")}
                              required
                              minLength={6}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <button type="button" onClick={handleEmployerNext} className={btnPrimary}>
                          Continue <ArrowRight size={18} />
                        </button>
                      </>
                    )}

                    {employerStep === 2 && (
                      <>
                        <div>
                          <label className={labelCls}>Company Name *</label>
                          <Input
                            value={empFields.companyName}
                            onChange={upd("companyName")}
                            required
                            className={inputCls}
                            placeholder="Acme Farms LLC"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Legal Entity</label>
                            <Input
                              value={empFields.legalEntityName}
                              onChange={upd("legalEntityName")}
                              className={inputCls}
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <label className={labelCls}>EIN / Tax ID</label>
                            <Input
                              value={empFields.einTaxId}
                              onChange={upd("einTaxId")}
                              maxLength={30}
                              className={inputCls}
                              placeholder="XX-XXXXXXX"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Company Size *</label>
                            <select
                              value={empFields.companySize}
                              onChange={upd("companySize")}
                              required
                              className={selectCls}
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
                            <label className={labelCls}>Industry *</label>
                            <select
                              value={empFields.industry}
                              onChange={upd("industry")}
                              required
                              className={selectCls}
                            >
                              <option value="">Select...</option>
                              <option value="Agriculture">Agriculture</option>
                              <option value="Construction">Construction</option>
                              <option value="Hospitality">Hospitality</option>
                              <option value="Landscaping">Landscaping</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setEmployerStep(1)} className={btnGhost}>
                            <ArrowLeft size={16} /> Back
                          </button>
                          <button type="button" onClick={handleEmployerNext} className={btnPrimary}>
                            Continue <ArrowRight size={18} />
                          </button>
                        </div>
                      </>
                    )}

                    {employerStep === 3 && (
                      <form onSubmit={handleEmployerSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Country *</label>
                            <Input value={empFields.country} onChange={upd("country")} required className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>State *</label>
                            <Input
                              value={empFields.state}
                              onChange={upd("state")}
                              required
                              placeholder="e.g. Texas"
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Primary Hiring Location *</label>
                          <Input
                            value={empFields.primaryHiringLocation}
                            onChange={upd("primaryHiringLocation")}
                            required
                            placeholder="City, State"
                            className={inputCls}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Worker Types *</label>
                            <select
                              value={empFields.workerTypes}
                              onChange={upd("workerTypes")}
                              required
                              className={selectCls}
                            >
                              <option value="">Select...</option>
                              <option value="H-2A">H-2A</option>
                              <option value="H-2B">H-2B</option>
                              <option value="H-2A,H-2B">Both H-2A & H-2B</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Monthly Volume *</label>
                            <select
                              value={empFields.estimatedMonthlyVolume}
                              onChange={upd("estimatedMonthlyVolume")}
                              required
                              className={selectCls}
                            >
                              <option value="">Select...</option>
                              <option value="1-10">1–10 workers</option>
                              <option value="11-50">11–50 workers</option>
                              <option value="51-100">51–100 workers</option>
                              <option value="100+">100+ workers</option>
                            </select>
                          </div>
                        </div>
                        <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50">
                          <div className="flex gap-3 items-start">
                            <Checkbox
                              id="acc-emp"
                              checked={acceptTerms}
                              onCheckedChange={(v) => setAcceptTerms(v === true)}
                              className="mt-1 border-slate-300 data-[state=checked]:bg-[#0ea5e9] data-[state=checked]:border-[#0ea5e9]"
                            />
                            <label htmlFor="acc-emp" className="text-[10px] text-slate-500 leading-relaxed font-medium">
                              I agree to the Terms of Service and Privacy Policy.
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setEmployerStep(2)} className={btnGhost}>
                            <ArrowLeft size={16} /> Back
                          </button>
                          <button type="submit" disabled={isLoading} className={btnPrimary}>
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => navigate("/jobs")}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 uppercase tracking-wider transition-colors bg-transparent border-none cursor-pointer"
              >
                Explore available jobs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
