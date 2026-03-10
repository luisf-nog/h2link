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

type EmployerStep = 1 | 2 | 3;

const EMPLOYER_STEPS = [
  { n: 1, icon: User, label: "Account" },
  { n: 2, icon: Building2, label: "Company" },
  { n: 3, icon: Briefcase, label: "Hiring" },
] as const;

// ─── Shared design tokens ──────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

  .auth-root {
    min-height: 100vh;
    background: #F4F3F0;
    font-family: 'DM Sans', ui-sans-serif, sans-serif;
    position: relative;
  }

  .auth-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      radial-gradient(circle at 20% 50%, rgba(14,165,233,0.06) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(99,102,241,0.04) 0%, transparent 40%),
      url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23000' fill-opacity='0.04'/%3E%3C/svg%3E");
    background-size: 100% 100%, 100% 100%, 60px 60px;
    pointer-events: none;
    z-index: 0;
  }

  .auth-split {
    display: flex;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  /* ── Left panel ── */
  .auth-left {
    display: none;
    width: 44%;
    flex-direction: column;
    justify-content: space-between;
    padding: 3rem 3.5rem;
    border-right: 1px solid rgba(0,0,0,0.07);
    background: #FFFFFF;
    position: relative;
    overflow: hidden;
  }

  @media (min-width: 1024px) {
    .auth-left { display: flex; }
  }

  .auth-left::after {
    content: '';
    position: absolute;
    bottom: -80px;
    right: -80px;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .auth-left-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }

  .auth-brand {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 2rem;
    color: #0F172A;
    letter-spacing: -0.02em;
    position: relative;
    z-index: 1;
  }

  .auth-brand-accent {
    color: #0EA5E9;
  }

  .auth-tagline {
    font-size: 0.9rem;
    color: #64748B;
    line-height: 1.7;
    max-width: 280px;
    margin-top: 1rem;
    position: relative;
    z-index: 1;
  }

  .auth-divider-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    position: relative;
    z-index: 1;
  }

  .auth-divider-line {
    height: 1px;
    width: 40px;
    background: linear-gradient(to right, #CBD5E1, transparent);
  }

  .auth-divider-text {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #94A3B8;
  }

  .auth-stats {
    position: relative;
    z-index: 1;
  }

  .auth-stat-number {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 2.25rem;
    color: #0F172A;
    letter-spacing: -0.02em;
  }

  .auth-stat-label {
    font-size: 0.7rem;
    color: #94A3B8;
    margin-top: 2px;
    font-weight: 500;
  }

  .auth-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: 100px;
    border: 1px solid rgba(14,165,233,0.2);
    background: rgba(14,165,233,0.06);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #0284C7;
  }

  /* ── Right panel ── */
  .auth-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.25rem;
    position: relative;
    z-index: 1;
  }

  @media (min-width: 640px) {
    .auth-right { padding: 2.5rem 2rem; }
  }

  @media (min-width: 1024px) {
    .auth-right { padding: 3rem 4rem; }
  }

  .auth-right-topbar {
    width: 100%;
    max-width: 420px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .auth-mobile-brand {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 1.4rem;
    color: #0F172A;
    letter-spacing: -0.02em;
  }

  /* ── Card ── */
  .auth-card {
    width: 100%;
    max-width: 420px;
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px;
    padding: 2rem 1.75rem;
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 8px 32px rgba(0,0,0,0.06),
      0 0 0 1px rgba(255,255,255,0.8) inset;
    margin: auto 0;
  }

  @media (min-width: 640px) {
    .auth-card { padding: 2.25rem 2rem; }
  }

  /* ── Tabs ── */
  .auth-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.375rem;
    background: #F1F5F9;
    padding: 0.25rem;
    border-radius: 10px;
    margin-bottom: 1.75rem;
  }

  .auth-tab {
    padding: 0.55rem 1rem;
    border-radius: 7px;
    font-size: 0.8rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #94A3B8;
    background: transparent;
    font-family: 'DM Sans', sans-serif;
  }

  .auth-tab:hover { color: #475569; }

  .auth-tab.active {
    background: #FFFFFF;
    color: #0F172A;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04);
  }

  /* ── Labels ── */
  .auth-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #94A3B8;
    display: block;
    margin-bottom: 0.4rem;
  }

  /* ── Inputs ── */
  .auth-input {
    background: #F8FAFC !important;
    border: 1px solid #E2E8F0 !important;
    color: #0F172A !important;
    border-radius: 8px !important;
    height: 2.75rem !important;
    font-size: 0.875rem !important;
    transition: border-color 0.15s, box-shadow 0.15s !important;
    font-family: 'DM Sans', sans-serif !important;
  }

  .auth-input::placeholder { color: #CBD5E1 !important; }

  .auth-input:focus {
    border-color: #0EA5E9 !important;
    box-shadow: 0 0 0 3px rgba(14,165,233,0.1) !important;
    background: #FFFFFF !important;
    outline: none !important;
  }

  .auth-select {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    color: #0F172A;
    border-radius: 8px;
    height: 2.75rem;
    font-size: 0.875rem;
    width: 100%;
    padding: 0 0.75rem;
    font-family: 'DM Sans', sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
  }

  .auth-select:focus {
    border-color: #0EA5E9;
    box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
    outline: none;
  }

  .auth-select option { background: #fff; color: #0F172A; }

  /* ── Buttons ── */
  .auth-btn-primary {
    width: 100%;
    height: 2.75rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    border: none;
    background: #0F172A;
    color: #FFFFFF;
    transition: all 0.15s ease;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.01em;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15), 0 4px 12px rgba(15,23,42,0.15);
  }

  .auth-btn-primary:hover {
    background: #1E293B;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2), 0 8px 20px rgba(15,23,42,0.2);
    transform: translateY(-1px);
  }

  .auth-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .auth-btn-accent {
    width: 100%;
    height: 2.75rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    border: none;
    background: linear-gradient(135deg, #0EA5E9, #0284C7);
    color: #FFFFFF;
    transition: all 0.15s ease;
    font-family: 'DM Sans', sans-serif;
    box-shadow: 0 1px 3px rgba(14,165,233,0.3), 0 4px 12px rgba(14,165,233,0.2);
  }

  .auth-btn-accent:hover {
    filter: brightness(1.08);
    box-shadow: 0 2px 6px rgba(14,165,233,0.4), 0 8px 20px rgba(14,165,233,0.25);
    transform: translateY(-1px);
  }

  .auth-btn-accent:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .auth-btn-ghost {
    width: 100%;
    height: 2.75rem;
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    background: transparent;
    border: 1px solid #E2E8F0;
    color: #64748B;
    transition: all 0.15s ease;
    font-family: 'DM Sans', sans-serif;
  }

  .auth-btn-ghost:hover {
    border-color: #CBD5E1;
    color: #0F172A;
    background: #F8FAFC;
  }

  /* ── Role cards ── */
  .auth-role-card {
    width: 100%;
    text-align: left;
    padding: 1rem 1.125rem;
    border-radius: 10px;
    border: 1px solid #E2E8F0;
    background: #FAFAFA;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .auth-role-card:hover {
    border-color: #BAE6FD;
    background: #F0F9FF;
    box-shadow: 0 2px 8px rgba(14,165,233,0.08);
  }

  .auth-role-icon {
    height: 2.5rem;
    width: 2.5rem;
    border-radius: 8px;
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #0284C7;
  }

  .auth-role-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0F172A;
  }

  .auth-role-desc {
    font-size: 0.75rem;
    color: #94A3B8;
    margin-top: 0.15rem;
  }

  /* ── Success notice ── */
  .auth-notice {
    padding: 0.875rem 1rem;
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    border-radius: 8px;
    margin-bottom: 1.25rem;
  }

  /* ── Step indicators ── */
  .auth-steps {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 280px;
    margin-bottom: 2.5rem;
  }

  .auth-step-dot {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .auth-step-done {
    background: #DCFCE7;
    border: 1px solid #86EFAC;
    color: #16A34A;
  }

  .auth-step-active {
    background: #0F172A;
    border: 1px solid #0F172A;
    color: #FFFFFF;
    box-shadow: 0 0 0 3px rgba(15,23,42,0.1);
  }

  .auth-step-idle {
    background: #F1F5F9;
    border: 1px solid #E2E8F0;
    color: #CBD5E1;
  }

  .auth-step-line {
    flex: 1;
    height: 1px;
    background: #E2E8F0;
    margin: 0 0.5rem;
  }

  .auth-step-line-done {
    background: #86EFAC;
  }

  .auth-step-label {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 0.35rem;
  }

  /* ── Terms box ── */
  .auth-terms {
    border: 1px solid #F1F5F9;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    background: #FAFAFA;
  }

  /* ── Fullscreen flows ── */
  .auth-flow-root {
    min-height: 100vh;
    background: #F4F3F0;
    font-family: 'DM Sans', ui-sans-serif, sans-serif;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .auth-flow-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23000' fill-opacity='0.03'/%3E%3C/svg%3E");
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
  }

  .auth-flow-nav {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 2rem;
    background: rgba(255,255,255,0.8);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }

  .auth-flow-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
    position: relative;
    z-index: 1;
  }

  .auth-flow-card {
    width: 100%;
    max-width: 480px;
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px;
    padding: 2rem 1.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06);
  }

  @media (min-width: 640px) {
    .auth-flow-card { padding: 2.25rem 2.25rem; }
    .auth-flow-nav { padding: 1.25rem 2.5rem; }
  }

  .auth-role-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    border-radius: 100px;
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #0284C7;
    margin-bottom: 0.75rem;
  }

  .auth-flow-title {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 1.6rem;
    color: #0F172A;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .auth-flow-subtitle {
    font-size: 0.85rem;
    color: #94A3B8;
  }

  /* ── Confirmation overlay ── */
  .auth-overlay {
    position: fixed;
    inset: 0;
    background: #F4F3F0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    font-family: 'DM Sans', sans-serif;
  }

  .auth-overlay-card {
    width: 100%;
    max-width: 360px;
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px;
    padding: 2.5rem 2rem;
    box-shadow: 0 8px 40px rgba(0,0,0,0.08);
    text-align: center;
  }

  /* ── Forgot password link ── */
  .auth-link {
    font-size: 0.72rem;
    font-weight: 600;
    color: #0EA5E9;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
    font-family: 'DM Sans', sans-serif;
  }

  .auth-link:hover { color: #0284C7; }

  /* ── Browse jobs ── */
  .auth-browse {
    margin-top: 1.5rem;
    font-size: 0.72rem;
    color: #CBD5E1;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.05em;
  }

  .auth-browse:hover { color: #94A3B8; }

  /* ── Form gap ── */
  .auth-form { display: flex; flex-direction: column; gap: 1.1rem; }
  .auth-field { display: flex; flex-direction: column; }
  .auth-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
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
    const l = t("common.ok");
    return l === "common.ok" ? "OK" : l;
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
      } else navigate("/dashboard");
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
            ? t("auth.validation.invalid_ein", "EIN must follow the format XX-XXXXXXX")
            : field === "acceptTerms" || code === "accept_required"
              ? t("auth.validation.accept_required")
              : `Please fill in: ${field}`;
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
        await supabase
          .from("employer_profiles")
          .insert({
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
      <div className="auth-overlay">
        <style>{STYLES}</style>
        <div className="auth-overlay-card">
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "1.5rem",
              color: "#0F172A",
              marginBottom: "1.5rem",
            }}
          >
            <span style={{ color: "#0EA5E9" }}>H2</span> Linker
          </div>
          <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}>
            {confirmFlow.state === "processing" && (
              <Loader2 size={22} style={{ color: "#0EA5E9" }} className="animate-spin" />
            )}
            {confirmFlow.state === "success" && <CheckCircle2 size={22} style={{ color: "#16A34A" }} />}
            {confirmFlow.state === "error" && <AlertTriangle size={22} style={{ color: "#DC2626" }} />}
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.5rem" }}>
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
          <div style={{ fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.6 }}>
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

  const ErrorDialog = () => (
    <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((p) => ({ ...p, open }))}>
      <AlertDialogContent className="border-destructive/20 shadow-2xl">
        <AlertDialogHeader className="space-y-0 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <AlertDialogTitle className="text-sm font-semibold text-gray-900">{errorDialog.title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-sm text-gray-500">
                {errorDialog.description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction style={{ background: "#0F172A", color: "#fff", fontSize: "0.8rem", borderRadius: "7px" }}>
            {okLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const StepIndicator = ({
    steps,
    current,
  }: {
    steps: readonly { n: number; icon: any; label: string }[];
    current: number;
  }) => (
    <div className="auth-steps">
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
            <div
              className={`auth-step-dot ${current > s.n ? "auth-step-done" : current === s.n ? "auth-step-active" : "auth-step-idle"}`}
            >
              {current > s.n ? <CheckCircle2 size={13} /> : <s.icon size={12} />}
            </div>
            <span className="auth-step-label" style={{ color: current >= s.n ? "#0EA5E9" : "#CBD5E1" }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`auth-step-line ${current > s.n ? "auth-step-line-done" : ""}`}
              style={{ marginBottom: "16px" }}
            />
          )}
        </div>
      ))}
    </div>
  );

  // ─── WORKER MULTI-STEP ────────────────────────────────────────────────
  if (tab === "signup" && signupRole === "worker") {
    return (
      <>
        <style>{STYLES}</style>
        <ErrorDialog />
        <div className="auth-flow-root">
          <nav className="auth-flow-nav">
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "1.2rem", color: "#0F172A" }}>
              <span style={{ color: "#0EA5E9" }}>H2</span> Linker
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                onClick={() => {
                  setSignupRole(null);
                  setWorkerStep(1);
                }}
                style={{
                  fontSize: "0.75rem",
                  color: "#94A3B8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ← {t("auth.back_to_selection", "Back")}
              </button>
              <button
                onClick={() => {
                  setTab("signin");
                  setSignupRole(null);
                  setWorkerStep(1);
                }}
                style={{
                  fontSize: "0.75rem",
                  color: "#94A3B8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {t("auth.tabs.signin")}
              </button>
              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
                onChange={handleChangeLanguage}
                className="h-8 w-[120px]"
              />
            </div>
          </nav>

          <div className="auth-flow-content">
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div className="auth-role-pill">
                <HardHat size={10} /> {t("auth.roles.worker")}
              </div>
              <div className="auth-flow-title">
                {workerStep === 1 && t("auth.worker_steps.step1_title", "Create your account")}
                {workerStep === 2 && t("auth.worker_steps.step2_title", "Personal details")}
              </div>
              <div className="auth-flow-subtitle">
                {workerStep === 1 && t("auth.worker_steps.step1_desc", "Your login credentials")}
                {workerStep === 2 && t("auth.worker_steps.step2_desc", "So employers can reach you")}
              </div>
            </div>

            <StepIndicator steps={WORKER_STEPS} current={workerStep} />

            <div className="auth-flow-card">
              {workerStep === 1 && (
                <div className="auth-form">
                  <div className="auth-field">
                    <label className="auth-label">{t("auth.fields.full_name")} *</label>
                    <Input
                      value={wrkFields.fullName}
                      onChange={wrkUpd("fullName")}
                      required
                      className="auth-input"
                      placeholder="João Silva"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">{t("auth.fields.email")} *</label>
                    <Input
                      type="email"
                      value={wrkFields.email}
                      onChange={wrkUpd("email")}
                      required
                      className="auth-input"
                      placeholder="you@email.com"
                    />
                  </div>
                  <div className="auth-grid-2">
                    <div className="auth-field">
                      <label className="auth-label">{t("auth.fields.password")} *</label>
                      <Input
                        type="password"
                        value={wrkFields.password}
                        onChange={wrkUpd("password")}
                        required
                        minLength={6}
                        className="auth-input"
                      />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">{t("auth.fields.confirm_password")} *</label>
                      <Input
                        type="password"
                        value={wrkFields.confirmPassword}
                        onChange={wrkUpd("confirmPassword")}
                        required
                        minLength={6}
                        className="auth-input"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleWorkerNext}
                    className="auth-btn-primary"
                    style={{ marginTop: "0.25rem" }}
                  >
                    {t("auth.actions.continue", "Continue")} <ArrowRight size={15} />
                  </button>
                </div>
              )}

              {workerStep === 2 && (
                <form onSubmit={handleWorkerFinalSubmit} className="auth-form">
                  <div className="auth-grid-2">
                    <div className="auth-field">
                      <label className="auth-label">{t("auth.fields.age")} *</label>
                      <Input
                        type="number"
                        min={14}
                        max={90}
                        value={wrkFields.age}
                        onChange={wrkUpd("age")}
                        required
                        className="auth-input"
                      />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">{t("auth.fields.phone")} *</label>
                      <PhoneE164Input
                        id="phone-wrk"
                        name="phone-wrk"
                        defaultCountry="BR"
                        required
                        inputClassName="auth-input"
                        defaultValue={wrkFields.phone}
                        onChange={(val) => setWrkFields((p) => ({ ...p, phone: val }))}
                      />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">{t("auth.fields.contact_email")} *</label>
                    <Input
                      type="email"
                      value={wrkFields.contactEmail}
                      onChange={wrkUpd("contactEmail")}
                      required
                      className="auth-input"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">{t("auth.fields.referral_code")}</label>
                    <Input
                      value={wrkFields.referralCode}
                      onChange={wrkUpd("referralCode")}
                      maxLength={12}
                      className="auth-input"
                    />
                  </div>
                  <div className="auth-terms">
                    <p style={{ fontSize: "0.7rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                      {t("auth.disclaimer")}
                    </p>
                    <div style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
                      <Checkbox
                        id="accept-wrk"
                        checked={acceptTerms}
                        onCheckedChange={(v) => setAcceptTerms(v === true)}
                        className="border-slate-300 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500 mt-0.5"
                      />
                      <label
                        htmlFor="accept-wrk"
                        style={{ fontSize: "0.72rem", color: "#64748B", lineHeight: 1.5, cursor: "pointer" }}
                      >
                        {t("auth.accept_terms")}
                      </label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.625rem" }}>
                    <button type="button" onClick={() => setWorkerStep(1)} className="auth-btn-ghost">
                      <ArrowLeft size={13} /> {t("auth.actions.back", "Back")}
                    </button>
                    <button type="submit" disabled={isLoading} className="auth-btn-accent">
                      {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                      {t("auth.actions.signup")}
                    </button>
                  </div>
                </form>
              )}
            </div>
            <p style={{ marginTop: "1rem", fontSize: "0.7rem", color: "#CBD5E1", fontFamily: "'DM Sans', sans-serif" }}>
              Step {workerStep} of 2
            </p>
          </div>
        </div>
      </>
    );
  }

  // ─── EMPLOYER MULTI-STEP ──────────────────────────────────────────────
  if (tab === "signup" && signupRole === "employer") {
    return (
      <>
        <style>{STYLES}</style>
        <ErrorDialog />
        <div className="auth-flow-root">
          <nav className="auth-flow-nav">
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "1.2rem", color: "#0F172A" }}>
              <span style={{ color: "#0EA5E9" }}>H2</span> Linker
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                onClick={() => {
                  setSignupRole(null);
                  setEmployerStep(1);
                }}
                style={{
                  fontSize: "0.75rem",
                  color: "#94A3B8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ← {t("auth.back_to_selection", "Back")}
              </button>
              <button
                onClick={() => {
                  setTab("signin");
                  setSignupRole(null);
                  setEmployerStep(1);
                }}
                style={{
                  fontSize: "0.75rem",
                  color: "#94A3B8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {t("auth.tabs.signin")}
              </button>
              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
                onChange={handleChangeLanguage}
                className="h-8 w-[120px]"
              />
            </div>
          </nav>

          <div className="auth-flow-content">
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div className="auth-role-pill">
                <Building2 size={10} /> Employer Account
              </div>
              <div className="auth-flow-title">
                {employerStep === 1 && "Create your account"}
                {employerStep === 2 && "Tell us about your company"}
                {employerStep === 3 && "Hiring details"}
              </div>
              <div className="auth-flow-subtitle">
                {employerStep === 1 && "Your login credentials"}
                {employerStep === 2 && "So workers know who you are"}
                {employerStep === 3 && "Help us match the right workers"}
              </div>
            </div>

            <StepIndicator steps={EMPLOYER_STEPS} current={employerStep} />

            <div className="auth-flow-card">
              {employerStep === 1 && (
                <div className="auth-form">
                  <div className="auth-field">
                    <label className="auth-label">Full Name *</label>
                    <Input
                      value={empFields.fullName}
                      onChange={upd("fullName")}
                      required
                      className="auth-input"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Work Email *</label>
                    <Input
                      type="email"
                      value={empFields.email}
                      onChange={upd("email")}
                      required
                      className="auth-input"
                      placeholder="you@company.com"
                    />
                  </div>
                  <div className="auth-grid-2">
                    <div className="auth-field">
                      <label className="auth-label">Password *</label>
                      <Input
                        type="password"
                        value={empFields.password}
                        onChange={upd("password")}
                        required
                        minLength={6}
                        className="auth-input"
                      />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">Confirm Password *</label>
                      <Input
                        type="password"
                        value={empFields.confirmPassword}
                        onChange={upd("confirmPassword")}
                        required
                        minLength={6}
                        className="auth-input"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEmployerNext}
                    className="auth-btn-primary"
                    style={{ marginTop: "0.25rem" }}
                  >
                    Continue <ArrowRight size={15} />
                  </button>
                </div>
              )}

              {employerStep === 2 && (
                <div className="auth-form">
                  <div className="auth-field">
                    <label className="auth-label">Company Name *</label>
                    <Input
                      value={empFields.companyName}
                      onChange={upd("companyName")}
                      required
                      className="auth-input"
                      placeholder="Acme Farms LLC"
                    />
                  </div>
                  <div className="auth-grid-2">
                    <div className="auth-field">
                      <label className="auth-label">Legal Entity Name</label>
                      <Input
                        value={empFields.legalEntityName}
                        onChange={upd("legalEntityName")}
                        className="auth-input"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">EIN / Tax ID</label>
                      <Input
                        value={empFields.einTaxId}
                        onChange={upd("einTaxId")}
                        maxLength={30}
                        className="auth-input"
                        placeholder="XX-XXXXXXX"
                      />
                    </div>
                  </div>
                  <div className="auth-grid-2">
                    <div className="auth-field">
                      <label className="auth-label">Company Size *</label>
                      <select
                        value={empFields.companySize}
                        onChange={upd("companySize")}
                        required
                        className="auth-select"
                      >
                        <option value="">Select...</option>
                        <option value="1-10">1–10 employees</option>
                        <option value="11-50">11–50 employees</option>
                        <option value="51-200">51–200 employees</option>
                        <option value="201-500">201–500 employees</option>
                        <option value="500+">500+ employees</option>
                      </select>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">Industry *</label>
                      <select value={empFields.industry} onChange={upd("industry")} required className="auth-select">
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
                  <div className="auth-field">
                    <label className="auth-label">Website</label>
                    <Input
                      type="url"
                      value={empFields.website}
                      onChange={upd("website")}
                      className="auth-input"
                      placeholder="https://yourcompany.com (optional)"
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.625rem" }}>
                    <button type="button" onClick={() => setEmployerStep(1)} className="auth-btn-ghost">
                      <ArrowLeft size={13} /> Back
                    </button>
                    <button type="button" onClick={handleEmployerNext} className="auth-btn-primary">
                      Continue <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {employerStep === 3 && (
                <form onSubmit={handleEmployerSubmit} className="auth-form">
                  <div className="auth-grid-2">
                    <div className="auth-field">
                      <label className="auth-label">Country *</label>
                      <Input value={empFields.country} onChange={upd("country")} required className="auth-input" />
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">State *</label>
                      <Input
                        value={empFields.state}
                        onChange={upd("state")}
                        required
                        placeholder="e.g. Texas"
                        className="auth-input"
                      />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Primary Hiring Location *</label>
                    <Input
                      value={empFields.primaryHiringLocation}
                      onChange={upd("primaryHiringLocation")}
                      required
                      placeholder="City, State"
                      className="auth-input"
                    />
                  </div>
                  <div className="auth-grid-2">
                    <div className="auth-field">
                      <label className="auth-label">Worker Types *</label>
                      <select
                        value={empFields.workerTypes}
                        onChange={upd("workerTypes")}
                        required
                        className="auth-select"
                      >
                        <option value="">Select...</option>
                        <option value="H-2A">H-2A (Agricultural)</option>
                        <option value="H-2B">H-2B (Non-Agricultural)</option>
                        <option value="H-2A,H-2B">Both H-2A & H-2B</option>
                      </select>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">Monthly Volume *</label>
                      <select
                        value={empFields.estimatedMonthlyVolume}
                        onChange={upd("estimatedMonthlyVolume")}
                        required
                        className="auth-select"
                      >
                        <option value="">Select...</option>
                        <option value="1-10">1–10 workers</option>
                        <option value="11-50">11–50 workers</option>
                        <option value="51-100">51–100 workers</option>
                        <option value="100+">100+ workers</option>
                      </select>
                    </div>
                  </div>
                  <div className="auth-terms">
                    <p style={{ fontSize: "0.7rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                      {t("auth.disclaimer")}
                    </p>
                    <div style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
                      <Checkbox
                        id="accept-emp"
                        checked={acceptTerms}
                        onCheckedChange={(v) => setAcceptTerms(v === true)}
                        className="border-slate-300 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500 mt-0.5"
                      />
                      <label
                        htmlFor="accept-emp"
                        style={{ fontSize: "0.72rem", color: "#64748B", lineHeight: 1.5, cursor: "pointer" }}
                      >
                        {t("auth.accept_terms")}
                      </label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.625rem" }}>
                    <button type="button" onClick={() => setEmployerStep(2)} className="auth-btn-ghost">
                      <ArrowLeft size={13} /> Back
                    </button>
                    <button type="submit" disabled={isLoading} className="auth-btn-accent">
                      {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                      Create employer account
                    </button>
                  </div>
                </form>
              )}
            </div>
            <p style={{ marginTop: "1rem", fontSize: "0.7rem", color: "#CBD5E1", fontFamily: "'DM Sans', sans-serif" }}>
              Step {employerStep} of 3
            </p>
          </div>
        </div>
      </>
    );
  }

  // ─── DEFAULT LAYOUT ────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <ErrorDialog />
      <div className="auth-root">
        <div className="auth-split">
          {/* Left panel */}
          <div className="auth-left">
            <div className="auth-left-grid" />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="auth-brand">
                <span className="auth-brand-accent">H2</span> Linker
              </div>
              <p className="auth-tagline">{t("auth.hero_description")}</p>
              <div className="auth-divider-label">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">{t("auth.visa_programs_label")}</span>
              </div>
            </div>
            <div className="auth-stats" style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
                <div>
                  <div className="auth-stat-number">
                    10,000<span style={{ color: "#0EA5E9" }}>+</span>
                  </div>
                  <div className="auth-stat-label">{t("auth.stats.jobs_in_database")}</div>
                </div>
                <div>
                  <div className="auth-stat-number">
                    100<span style={{ color: "#0EA5E9" }}>%</span>
                  </div>
                  <div className="auth-stat-label">{t("auth.stats.free_to_start")}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <span className="auth-badge">{t("auth.badges.h2a")}</span>
                <span className="auth-badge">{t("auth.badges.h2b")}</span>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="auth-right">
            <div className="auth-right-topbar">
              <div className="auth-mobile-brand" style={{ display: "block" }}>
                <span style={{ color: "#0EA5E9" }}>H2</span> Linker
              </div>
              <LanguageSwitcher
                value={isSupportedLanguage(i18n.language) ? (i18n.language as SupportedLanguage) : "en"}
                onChange={handleChangeLanguage}
                className="h-9 w-[130px]"
              />
            </div>

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

              {/* Sign in */}
              {tab === "signin" && (
                <div>
                  {signupNotice.visible && (
                    <div className="auth-notice">
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <CheckCircle2 size={14} style={{ color: "#16A34A", marginTop: "1px", flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#15803D" }}>
                            {t("auth.signup_notice.title")}
                          </p>
                          <p style={{ fontSize: "0.72rem", color: "#4ADE80", marginTop: "0.15rem" }}>
                            {t("auth.signup_notice.desc", { email: signupNotice.email ?? "" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {signinPanel === "signin" && (
                    <form onSubmit={handleSignIn} className="auth-form">
                      <div className="auth-field">
                        <label className="auth-label">{t("auth.fields.email")}</label>
                        <Input
                          name="email"
                          type="email"
                          placeholder={t("auth.placeholders.email")}
                          required
                          className="auth-input"
                        />
                      </div>
                      <div className="auth-field">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.4rem",
                          }}
                        >
                          <label className="auth-label" style={{ marginBottom: 0 }}>
                            {t("auth.fields.password")}
                          </label>
                          <button type="button" onClick={() => setSigninPanel("forgot")} className="auth-link">
                            {t("auth.recovery.link")}
                          </button>
                        </div>
                        <Input name="password" type="password" required className="auth-input" />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="auth-btn-primary"
                        style={{ marginTop: "0.25rem" }}
                      >
                        {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                        {t("auth.actions.signin")}
                      </button>
                    </form>
                  )}
                  {signinPanel === "forgot" && (
                    <div className="auth-form">
                      <div>
                        <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0F172A" }}>
                          {t("auth.recovery.request_title")}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "#94A3B8", marginTop: "0.25rem" }}>
                          {t("auth.recovery.request_desc")}
                        </p>
                      </div>
                      {forgotState.sent && (
                        <div className="auth-notice">
                          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#15803D" }}>
                            {t("auth.recovery.sent_title")}
                          </p>
                          <p style={{ fontSize: "0.72rem", color: "#4ADE80", marginTop: "0.15rem" }}>
                            {t("auth.recovery.sent_desc", { email: forgotState.email })}
                          </p>
                        </div>
                      )}
                      <form onSubmit={handleRequestPasswordReset} className="auth-form" style={{ gap: "0.875rem" }}>
                        <div className="auth-field">
                          <label className="auth-label">{t("auth.fields.email")}</label>
                          <Input
                            name="recoveryEmail"
                            type="email"
                            value={forgotState.email}
                            onChange={(e) => setForgotState((p) => ({ ...p, email: e.target.value }))}
                            required
                            className="auth-input"
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
                    <div className="auth-form">
                      <div>
                        <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0F172A" }}>
                          {t("auth.recovery.reset_title")}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "#94A3B8", marginTop: "0.25rem" }}>
                          {t("auth.recovery.reset_desc")}
                        </p>
                      </div>
                      <form onSubmit={handleUpdatePassword} className="auth-form" style={{ gap: "0.875rem" }}>
                        <div className="auth-field">
                          <label className="auth-label">{t("auth.recovery.fields.new_password")}</label>
                          <Input
                            type="password"
                            value={resetState.password}
                            required
                            minLength={6}
                            onChange={(e) => setResetState((p) => ({ ...p, password: e.target.value }))}
                            className="auth-input"
                          />
                        </div>
                        <div className="auth-field">
                          <label className="auth-label">{t("auth.recovery.fields.confirm_new_password")}</label>
                          <Input
                            type="password"
                            value={resetState.confirmPassword}
                            required
                            minLength={6}
                            onChange={(e) => setResetState((p) => ({ ...p, confirmPassword: e.target.value }))}
                            className="auth-input"
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

              {/* Sign up — role picker */}
              {tab === "signup" && (
                <div className="auth-form">
                  <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0F172A" }}>
                      {t("auth.role_picker.title", "Choose your account type")}
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "#94A3B8", marginTop: "0.25rem" }}>
                      {t("auth.role_picker.desc", "Select how you'll use H2 Linker")}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSignupRole("worker")} className="auth-role-card">
                    <div className="auth-role-icon">
                      <HardHat size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="auth-role-title">{t("auth.roles.worker")}</div>
                      <div className="auth-role-desc">
                        {t("auth.role_picker.worker_desc", "Find H-2A/H-2B jobs and apply directly to employers")}
                      </div>
                    </div>
                    <ArrowRight size={15} style={{ color: "#CBD5E1", flexShrink: 0 }} />
                  </button>
                  <button type="button" onClick={() => setSignupRole("employer")} className="auth-role-card">
                    <div className="auth-role-icon">
                      <Building2 size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="auth-role-title">{t("auth.roles.employer")}</div>
                      <div className="auth-role-desc">
                        {t("auth.role_picker.employer_desc", "Post jobs and recruit H-2 visa workers")}
                      </div>
                    </div>
                    <ArrowRight size={15} style={{ color: "#CBD5E1", flexShrink: 0 }} />
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => navigate("/jobs")} className="auth-browse">
              {t("auth.browse_jobs_link")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
