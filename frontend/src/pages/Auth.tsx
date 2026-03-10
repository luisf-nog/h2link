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

// ─── Types & Constants ────────────────────────────────────────────────
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

  const openError = (title: string, description: string) => setErrorDialog({ open: true, title, description });

  // ─── Dynamic UI Colors based on Role ───────────────────────────────────
  const isWorker = signupRole === "worker";
  const primaryColor = isWorker ? "bg-[#D4500A] hover:bg-[#b04207]" : "bg-[#0ea5e9] hover:bg-[#0284c7]";
  const textAccent = isWorker ? "text-[#D4500A]" : "text-[#0ea5e9]";
  const borderAccent = isWorker ? "border-[#D4500A]" : "border-[#0ea5e9]";
  const lightBgAccent = isWorker ? "bg-[#D4500A]/10" : "bg-[#0ea5e9]/10";

  // ─── Validation Schemas (Simplified for brevity, kept your logic) ──────
  const workerSignupSchema = z.object({
    /* Your existing zod schema */
  });
  const employerSignupSchema = z.object({
    /* Your existing zod schema */
  });

  // ─── Handlers (Kept your existing logic) ───────────────────────────────
  const handleChangeLanguage = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    localStorage.setItem("app_language", next);
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    // ... [Seu código existente do handleSignIn]
    setIsLoading(false);
  };

  const handleWorkerNext = () => {
    setWorkerStep(2);
  };
  const handleEmployerNext = () => {
    setEmployerStep((s) => (s + 1) as EmployerStep);
  };

  // ─── Dynamic Left Panel Content ────────────────────────────────────────
  const renderLeftPanelContent = () => {
    if (signupRole === "worker") {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4500A]/20 text-[#D4500A] text-xs font-bold uppercase tracking-wider mb-6">
            <HardHat size={14} /> Worker Portal
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Find your next
            <br />
            US opportunity.
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-md">
            Connect directly with verified employers offering H-2A and H-2B visa sponsorship.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <Briefcase className="text-[#D4500A]" size={24} />
              </div>
              <div>
                <h4 className="text-white font-semibold">10,000+ Active Jobs</h4>
                <p className="text-slate-400 text-sm">Updated daily from the DOL database.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <Send className="text-[#D4500A]" size={24} />
              </div>
              <div>
                <h4 className="text-white font-semibold">1-Click Apply</h4>
                <p className="text-slate-400 text-sm">Send your structured profile instantly.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (signupRole === "employer") {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0ea5e9]/20 text-[#0ea5e9] text-xs font-bold uppercase tracking-wider mb-6">
            <Building2 size={14} /> Employer Portal
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Recruit without
            <br />
            the chaos.
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-md">
            Centralize applications, find verified candidates, and automate your DOL compliance.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <Users className="text-[#0ea5e9]" size={24} />
              </div>
              <div>
                <h4 className="text-white font-semibold">Verified Candidates</h4>
                <p className="text-slate-400 text-sm">Pre-screened workers with structured resumes.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <FileText className="text-[#0ea5e9]" size={24} />
              </div>
              <div>
                <h4 className="text-white font-semibold">Automated DOL Logs</h4>
                <p className="text-slate-400 text-sm">Generate compliance reports automatically.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default (Sign In or No Role Selected)
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
          The central hub for
          <br />
          H-2 recruitment.
        </h2>
        <p className="text-slate-400 text-lg mb-12 max-w-md">
          Bridging the gap between US employers and global talent efficiently and legally.
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-3xl font-bold text-white">
              10k<span className="text-[#D4500A]">+</span>
            </div>
            <div className="text-sm text-slate-400 mt-1">Active Jobs</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">
              100<span className="text-[#0ea5e9]">%</span>
            </div>
            <div className="text-sm text-slate-400 mt-1">DOL Compliant</div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* LEFT PANEL (Dark Corporate) */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#020617] p-16 flex-col justify-between relative overflow-hidden">
        {/* Subtle background decoration */}
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

        <div className="relative z-10 text-slate-500 text-sm font-medium">
          © {new Date().getFullYear()} H2 Linker. All rights reserved.
        </div>
      </div>

      {/* RIGHT PANEL (Light Form) */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">
        {/* Top Nav */}
        <div className="absolute top-0 right-0 w-full p-6 flex justify-between lg:justify-end items-center z-10">
          <div className="lg:hidden">
            <h1 className="text-xl font-bold text-slate-900">
              <span className={textAccent}>H2</span> Linker
            </h1>
          </div>
          <LanguageSwitcher
            value={i18n.language as SupportedLanguage}
            onChange={handleChangeLanguage}
            className="bg-white border-slate-200 text-slate-600 shadow-sm"
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 mt-16 lg:mt-0">
          <div className="w-full max-w-[440px]">
            {/* Tabs */}
            <div className="flex p-1 bg-slate-200/60 rounded-xl mb-8">
              <button
                onClick={() => {
                  setTab("signin");
                  setSignupRole(null);
                }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Sign Up
              </button>
            </div>

            {/* ── SIGN IN ── */}
            {tab === "signin" && (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                  <p className="text-slate-500 text-sm mt-1">Enter your details to access your account.</p>
                </div>
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <Input
                      name="email"
                      type="email"
                      required
                      className="bg-slate-50 border-slate-200 h-12 text-slate-900 focus:border-sky-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                      <button type="button" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      name="password"
                      type="password"
                      required
                      className="bg-slate-50 border-slate-200 h-12 text-slate-900 focus:border-sky-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all ${signupRole === "worker" ? "bg-[#D4500A] hover:bg-[#b04207]" : "bg-[#0ea5e9] hover:bg-[#0284c7]"}`}
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
                  </button>
                </form>
              </div>
            )}

            {/* ── SIGN UP ROLE PICKER ── */}
            {tab === "signup" && !signupRole && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Join H2 Linker</h2>
                  <p className="text-slate-500 text-sm mt-1">Select how you'll use the platform.</p>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => setSignupRole("worker")}
                    className="w-full bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#D4500A] hover:shadow-md transition-all text-left group flex items-center gap-5 cursor-pointer"
                  >
                    <div className="h-14 w-14 rounded-full bg-[#D4500A]/10 flex items-center justify-center shrink-0">
                      <HardHat size={24} className="text-[#D4500A]" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 font-bold text-lg group-hover:text-[#D4500A] transition-colors">
                        I'm a Worker
                      </h3>
                      <p className="text-slate-500 text-sm mt-0.5">Find jobs and apply directly.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSignupRole("employer")}
                    className="w-full bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#0ea5e9] hover:shadow-md transition-all text-left group flex items-center gap-5 cursor-pointer"
                  >
                    <div className="h-14 w-14 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center shrink-0">
                      <Building2 size={24} className="text-[#0ea5e9]" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 font-bold text-lg group-hover:text-[#0ea5e9] transition-colors">
                        I'm an Employer
                      </h3>
                      <p className="text-slate-500 text-sm mt-0.5">Post jobs and recruit workers.</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── SIGN UP FORM (Employer/Worker) ── */}
            {tab === "signup" && signupRole && (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setSignupRole(null)} className="text-slate-400 hover:text-slate-700">
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {isWorker ? "Worker Account" : "Employer Account"}
                    </h2>
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mt-0.5">
                      Step {isWorker ? workerStep : employerStep} of {isWorker ? 2 : 3}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full mb-8 overflow-hidden">
                  <div
                    className={`h-full ${primaryColor} transition-all duration-500`}
                    style={{ width: `${((isWorker ? workerStep : employerStep) / (isWorker ? 2 : 3)) * 100}%` }}
                  />
                </div>

                {/* --- Formulário (Simplificado aqui para o exemplo visual) --- */}
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                    <Input
                      placeholder="John Doe"
                      required
                      className="bg-slate-50 border-slate-200 h-11 text-slate-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      required
                      className="bg-slate-50 border-slate-200 h-11 text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                      <Input type="password" required className="bg-slate-50 border-slate-200 h-11 text-slate-900" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Confirm</label>
                      <Input type="password" required className="bg-slate-50 border-slate-200 h-11 text-slate-900" />
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`w-full h-12 mt-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all ${primaryColor}`}
                  >
                    Continue <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
