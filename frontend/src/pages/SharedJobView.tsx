import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  DollarSign,
  Briefcase,
  Home,
  Clock,
  Mail,
  Phone,
  MessageCircle,
  AlertTriangle,
  Loader2,
  Users,
  ArrowRight,
  Globe,
  CheckCircle2,
  GraduationCap,
  BookOpen,
  Search,
  Info,
  Zap,
  Plus,
  Minus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { JobMetaTags } from "@/components/jobs/JobMetaTags";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
import { formatNumber } from "@/lib/number";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  email: string;
  city: string;
  state: string;
  visa_type: string;
  was_early_access?: boolean | null;
  category?: string | null;
  openings?: number | null;
  salary: number | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  pay_frequency?: string | null;
  overtime_salary?: number | null;
  weekly_hours?: number | null;
  start_date: string | null;
  end_date: string | null;
  posted_date: string;
  experience_months?: number | null;
  education_required?: string | null;
  housing_info?: string | null;
  housing_type?: string | null;
  housing_addr?: string | null;
  housing_city?: string | null;
  transport_provided?: boolean | null;
  job_duties?: string | null;
  phone?: string | null;
  source_url?: string | null;
  worksite_address?: string | null;
  job_min_special_req?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
  website?: string | null;
  randomization_group?: string | null;
}

export default function SharedJobView() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const locale = i18n.resolvedLanguage || i18n.language;

  useEffect(() => {
    async function fetchJob() {
      if (!jobId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from("public_jobs").select("*").eq("id", jobId).single();
        if (error) throw error;
        setJob(data as unknown as Job);
      } catch (error) {
        console.error("Error fetching job:", error);
        setJob(null);
      } finally {
        setLoading(false);
      }
    }
    fetchJob();
  }, [jobId]);

  const renderPrice = (j: Job) => {
    if (j.wage_from && j.wage_to && j.wage_from !== j.wage_to) {
      return (
        <span translate="no">{`$${j.wage_from.toFixed(2)} - $${j.wage_to.toFixed(2)} / ${j.wage_unit || "hr"}`}</span>
      );
    }
    if (j.wage_from) {
      return <span translate="no">{`$${j.wage_from.toFixed(2)} / ${j.wage_unit || "hr"}`}</span>;
    }
    if (j.salary) {
      return <span translate="no">{`$${j.salary.toFixed(2)}/h`}</span>;
    }
    return "-";
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString(locale, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return t("jobs.details.no_experience", "No experience required");
    if (months < 12) return t("jobs.table.experience_months", { count: months });
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem === 0
      ? t("jobs.table.experience_years", { count: years })
      : t("jobs.table.experience_years_months", { years, months: rem });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-left">
        <Card className="max-w-md w-full text-center p-8 space-y-4">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">{t("jobs.details.not_found", "Job Not Found")}</h2>
          <Button onClick={() => navigate("/jobs")} className="w-full">
            {t("jobs.details.browse_others", "Browse Other Jobs")}
          </Button>
        </Card>
      </div>
    );
  }

  // --- CONFIGURAÇÕES DE BADGE ---
  const isCurrentlyEarlyAccess = job.visa_type.includes("Early Access") || job.was_early_access;

  const getGroupBadgeConfig = (group: string) => {
    const g = group.toUpperCase();
    if (g === "A") return { label: `GRUPO - A`, className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    if (g === "B") return { label: `GRUPO - B`, className: "bg-blue-50 text-blue-800 border-blue-200" };
    if (g === "C" || g === "D")
      return { label: `GRUPO - ${g}`, className: "bg-amber-50 text-amber-800 border-amber-200" };
    return { label: `GRUPO - ${g}`, className: "bg-slate-50 text-slate-700 border-slate-200" };
  };

  return (
    <TooltipProvider>
      <JobMetaTags job={job} />

      <div className="min-h-screen bg-slate-50/50 pb-12 text-left">
        {/* HEADER GLOBAL */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/jobs")}>
              <BrandLogo className="h-8 w-8" />
              <span className="font-bold text-xl hidden sm:inline-block">H2 Linker</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate("/auth")}>
                {t("nav.login")}
              </Button>
              <Button onClick={() => navigate("/auth")}>{t("nav.signup")}</Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="shadow-lg border-t-4 border-t-primary overflow-hidden border-none sm:border">
            {/* Header Interno */}
            <div className="p-6 bg-white border-b">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "text-[10px] uppercase font-bold border px-2 py-0.5",
                      job.visa_type === "H-2A" && !job.was_early_access && "bg-green-600 border-green-600 text-white",
                      job.visa_type === "H-2B" && !job.was_early_access && "bg-blue-600 border-blue-600 text-white",
                      isCurrentlyEarlyAccess && "bg-amber-50 border-amber-400 text-amber-900",
                    )}
                    translate="no"
                  >
                    {isCurrentlyEarlyAccess && (
                      <Zap className="h-3 w-3 mr-1 text-amber-600 fill-amber-600 animate-pulse" />
                    )}
                    {job.visa_type}
                  </Badge>
                  {job.job_id && (
                    <span
                      className="font-mono text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                      translate="no"
                    >
                      {job.job_id.split("-GHOST")[0]}
                    </span>
                  )}
                </div>

                <div>
                  <h1
                    className="text-2xl sm:text-4xl leading-tight text-primary font-bold tracking-tight uppercase sm:normal-case"
                    translate="no"
                  >
                    {job.job_title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-lg text-slate-600 mt-2">
                    <span className="flex items-center gap-1.5 text-slate-900 font-semibold" translate="no">
                      <Briefcase className="h-5 w-5 text-slate-400" /> {job.company}
                    </span>
                    <span className="flex items-center gap-1.5" translate="no">
                      <MapPin className="h-5 w-5 text-slate-400" /> {job.city}, {job.state}
                    </span>
                  </div>
                </div>

                {/* Banner de Grupo */}
                {job.randomization_group && (
                  <div
                    className={cn(
                      "p-4 rounded-xl border flex gap-3 items-center",
                      getGroupBadgeConfig(job.randomization_group).className,
                    )}
                  >
                    <Info className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold uppercase tracking-tight">
                        {t("jobs.details.group_title", { group: job.randomization_group })}
                      </p>
                      <p className="text-xs opacity-90 leading-tight mt-0.5">
                        {job.randomization_group === "A"
                          ? t("jobs.details.group_a_desc")
                          : t("jobs.details.group_general_desc")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Aviso Early Access */}
            {isCurrentlyEarlyAccess && (
              <div className="m-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3">
                <Zap className="h-5 w-5 text-amber-600 fill-amber-600" />
                <p className="text-sm font-bold leading-tight">{t("jobs.details.active_early_desc")}</p>
              </div>
            )}

            <div className="p-6 bg-slate-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* SIDEBAR */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Datas */}
                  <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        {t("jobs.details.posted")}
                      </span>
                      <span className="text-sm font-bold text-slate-700">{formatDate(job.posted_date)}</span>
                    </div>
                    <div className="border-x border-slate-100">
                      <span className="block text-[10px] font-bold uppercase text-green-600 mb-1">
                        {t("jobs.details.start")}
                      </span>
                      <span className="text-sm font-bold text-green-700">{formatDate(job.start_date)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-red-600 mb-1">
                        {t("jobs.details.end")}
                      </span>
                      <span className="text-sm font-bold text-red-700">{formatDate(job.end_date)}</span>
                    </div>
                  </div>

                  {/* Financeiro */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                      <span className="font-bold text-sm text-slate-600 uppercase tracking-wider">
                        {t("jobs.details.available_positions")}
                      </span>
                      <Badge className="bg-blue-600 text-base font-bold px-3">{job.openings || "N/A"}</Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                        <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                      </div>
                      <p className="text-3xl font-black text-green-700 tracking-tighter" translate="no">
                        {renderPrice(job)}
                      </p>
                    </div>

                    {job.wage_additional && (
                      <div className="bg-green-50/50 p-3 rounded-lg border border-green-100">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-green-700 mb-1">
                          <Plus className="h-3 w-3" /> {t("jobs.details.wage_extra_label", "Bonus & Extras")}
                        </span>
                        <p className="text-sm text-green-900 leading-snug">{job.wage_additional}</p>
                      </div>
                    )}

                    {job.rec_pay_deductions && (
                      <div className="bg-red-50/30 p-3 rounded-lg border border-red-100">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-700 mb-1">
                          <Minus className="h-3 w-3" /> {t("jobs.details.deductions_label", "Deductions")}
                        </span>
                        <p className="text-sm text-red-900/70 leading-snug">{job.rec_pay_deductions}</p>
                      </div>
                    )}
                  </div>

                  {/* Convite Hub */}
                  <div className="bg-blue-600 rounded-xl p-6 text-center text-white space-y-4 shadow-lg">
                    <Search className="h-8 w-8 mx-auto opacity-50" />
                    <h3 className="font-bold text-lg leading-tight">
                      {locale === "pt" ? "Quer ver mais vagas?" : "Looking for more?"}
                    </h3>
                    <p className="text-xs text-blue-100">
                      {locale === "pt"
                        ? "Crie sua conta gratuita e tenha acesso a milhares de vagas H-2 exclusivas."
                        : "Create your free account and get access to thousands of exclusive H-2 jobs."}
                    </p>
                    <Button variant="secondary" className="w-full font-bold" onClick={() => navigate("/auth")}>
                      {t("nav.signup")}
                    </Button>
                  </div>
                </div>

                {/* CONTEÚDO */}
                <div className="lg:col-span-8 space-y-6">
                  {job.job_min_special_req && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 mb-4 border-b pb-3 uppercase text-sm tracking-widest">
                        <AlertTriangle className="h-5 w-5 text-amber-500" /> {t("jobs.details.special_reqs")}
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {job.job_min_special_req}
                      </p>
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 mb-4 border-b pb-3 uppercase text-sm tracking-widest">
                      <Briefcase className="h-5 w-5 text-blue-600" /> {t("jobs.details.job_description")}
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap" translate="yes">
                      {job.job_duties}
                    </p>
                  </div>

                  {/* Requisitos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          {t("jobs.details.experience")}
                        </span>
                        <span className="font-bold text-slate-800">{formatExperience(job.experience_months)}</span>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                      <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          {t("jobs.details.education", "Education")}
                        </span>
                        <span className="font-bold text-slate-800">{job.education_required || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer Mobile */}
            <div className="sm:hidden p-4 border-t bg-white flex flex-col gap-3 sticky bottom-0 z-50 shadow-2xl">
              <Button className="w-full font-bold h-12 text-base shadow-lg" onClick={() => navigate("/auth")}>
                <Rocket className="h-5 w-5 mr-2" /> {locale === "pt" ? "Candidatar-se Agora" : "Apply Now"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-slate-500 text-xs font-bold"
                onClick={() => navigate("/jobs")}
              >
                <ArrowRight className="h-3 w-3 mr-1" /> {t("jobs.details.browse_others")}
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}
