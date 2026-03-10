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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

  const openError = (title: string, description: string) => setErrorDialog({ open: true, title, description });

  // Helpers de Atualização (O QUE ESTAVA FALTANDO)
  const upd = (k: keyof typeof empFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEmpFields((p) => ({ ...p, [k]: e.target.value }));

  const wrkUpd = (k: keyof typeof wrkFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setWrkFields((p) => ({ ...p, [k]: e.target.value }));

  const okLabel = useMemo(() => {
    const label = t("common.ok");
    return label === "common.ok" ? "OK" : label;
  }, [t]);

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

  // ... (Efeito de confirmação de URL omitido para brevidade, mas mantido no seu arquivo local)

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
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

  const handleWorkerNext = () => {
    setWorkerStep(2);
  };
  const handleEmployerNext = () => {
    setEmployerStep((s) => (s + 1) as EmployerStep);
  };

  const handleWorkerFinalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    // ... (Sua lógica de worker signup completa deve estar aqui)
    setIsLoading(false);
  };

  const handleEmployerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    // ... (Sua lógica de employer signup completa deve estar aqui)
    setIsLoading(false);
  };

  const renderLeftPanelContent = () => {
    // ... (Sua lógica de renderLeftPanelContent idêntica ao que mandei antes)
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        <p
          className={`${signupRole === "worker" ? "text-[#D4500A]" : "text-[#0ea5e9]"} text-xs font-bold uppercase tracking-[0.2em] mb-6`}
        >
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-sky-500/30">
      {/* PAINEL ESQUERDO */}
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

      {/* PAINEL DIREITO */}
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

            {tab === "signin" && (
              <div className="animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
                  <p className="text-slate-500 text-sm mt-1">Access your account to manage your applications.</p>
                </div>
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div>
                    <label className={labelCls}>Email</label>
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
                      <Input name="password" type={showPassword ? "text" : "password"} required className={inputCls} />
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
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
                  </button>
                </form>
              </div>
            )}

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
                        I'm a Worker
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
                        I'm an Employer
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">I want to hire global talent.</p>
                    </div>
                    <ArrowRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              </div>
            )}

            {tab === "signup" && signupRole && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {/* ... (Seu formulário de multi-passos corrigido aqui) ... */}
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

                {/* Exemplo de campo corrigido usando wrkUpd */}
                {isWorker && workerStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Full Name *</label>
                      <Input
                        value={wrkFields.fullName}
                        onChange={wrkUpd("fullName")}
                        required
                        className={inputCls}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Email *</label>
                      <Input value={wrkFields.email} onChange={wrkUpd("email")} required className={inputCls} />
                    </div>
                    <button onClick={handleWorkerNext} className={btnPrimary}>
                      Continue <ArrowRight size={18} />
                    </button>
                  </div>
                )}

                {signupRole === "employer" && employerStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Company Name *</label>
                      <Input
                        value={empFields.companyName}
                        onChange={upd("companyName")}
                        required
                        className={inputCls}
                      />
                    </div>
                    <button onClick={handleEmployerNext} className={btnPrimary}>
                      Continue <ArrowRight size={18} />
                    </button>
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
      {/* ... (Alert Dialog omitido, mas mantido conforme seu original) */}
    </div>
  );
}
