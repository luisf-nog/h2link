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
  AlertTriangle,
  Loader2,
  Users,
  ArrowRight,
  Globe,
  GraduationCap,
  BookOpen,
  Search,
  Info,
  Zap,
  Plus,
  Minus,
  Database,
  ListPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { JobMetaTags } from "@/components/jobs/JobMetaTags";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  website?: string | null;
  randomization_group?: string | null;
  job_min_special_req?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
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
    if (!months || months <= 0) return t("jobs.details.no_experience", "Sem experiência necessária");
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
          <h2 className="text-xl font-bold text-slate-800">{t("jobs.details.not_found", "Vaga não encontrada")}</h2>
          <Button onClick={() => navigate("/jobs")} className="w-full">
            {t("jobs.details.browse_others", "Ver outras vagas")}
          </Button>
        </Card>
      </div>
    );
  }

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
        {/* HEADER */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/jobs")}>
              <BrandLogo className="h-8 w-8" />
              <span className="font-bold text-xl hidden sm:inline-block tracking-tighter">H2 Linker</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                {t("nav.login")}
              </Button>
              <Button size="sm" onClick={() => navigate("/auth")}>
                {t("nav.signup")}
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="shadow-xl border-t-4 border-t-primary overflow-hidden border-none sm:border bg-white">
            {/* Header Interno */}
            <div className="p-6 border-b">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "text-[10px] uppercase font-black border px-2 py-0.5 shadow-sm",
                      job.visa_type === "H-2A" && !job.was_early_access && "bg-green-600 border-green-600 text-white",
                      job.visa_type === "H-2B" && !job.was_early_access && "bg-blue-600 border-blue-600 text-white",
                      isCurrentlyEarlyAccess && "bg-amber-50 border-amber-400 text-amber-900",
                    )}
                    translate="no"
                  >
                    {isCurrentlyEarlyAccess && <Zap className="h-3 w-3 mr-1 text-amber-600 fill-amber-600" />}
                    {job.visa_type}
                  </Badge>
                  {job.job_id && (
                    <span
                      className="font-mono text-[10px] text-muted-foreground bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                      translate="no"
                    >
                      {job.job_id.split("-GHOST")[0]}
                    </span>
                  )}
                </div>

                <div>
                  <h1
                    className="text-2xl sm:text-5xl leading-tight text-slate-900 font-black tracking-tighter uppercase sm:normal-case"
                    translate="no"
                  >
                    {job.job_title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-lg text-slate-500 mt-2 font-medium">
                    <span className="flex items-center gap-1.5 text-slate-900" translate="no">
                      <Briefcase className="h-5 w-5 text-indigo-500" /> {job.company}
                    </span>
                    <span className="flex items-center gap-1.5" translate="no">
                      <MapPin className="h-5 w-5 text-slate-400" /> {job.city}, {job.state}
                    </span>
                  </div>
                </div>

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

            <div className="p-6 bg-slate-50/40">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* SIDEBAR */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Timeline de Datas */}
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
                      <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">
                        {t("jobs.details.available_positions")}
                      </span>
                      <Badge className="bg-slate-900 text-base font-black px-3">{job.openings || "N/A"}</Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                        <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                      </div>
                      <p className="text-4xl font-black text-green-700 tracking-tighter" translate="no">
                        {renderPrice(job)}
                      </p>
                    </div>

                    {job.wage_additional && (
                      <div className="bg-green-50/50 p-3 rounded-lg border border-green-100">
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-green-700 mb-1">
                          <Plus className="h-3 w-3" /> {t("jobs.details.wage_extra_label", "Bónus & Extras")}
                        </span>
                        <p className="text-sm text-green-900 leading-snug font-medium">{job.wage_additional}</p>
                      </div>
                    )}

                    {job.rec_pay_deductions && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 mb-1">
                          <Minus className="h-3 w-3" /> {t("jobs.details.deductions_label", "Deduções")}
                        </span>
                        <p className="text-xs text-slate-500 leading-snug">{job.rec_pay_deductions}</p>
                      </div>
                    )}
                  </div>

                  {/* CARD DE ORGANIZAÇÃO (O "ANTI-AGÊNCIA") */}
                  <div className="bg-slate-900 rounded-2xl p-6 text-center text-white space-y-4 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                      <Database className="h-20 w-20" />
                    </div>
                    <div className="bg-indigo-500/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2">
                      <ListPlus className="h-7 w-7 text-indigo-400" />
                    </div>
                    <h3 className="font-black text-xl leading-tight">
                      {locale === "pt" ? "Organize seus envios" : "Organize your apps"}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {locale === "pt"
                        ? "Crie sua conta para adicionar esta vaga à sua fila e aceder aos dados diretos do empregador."
                        : "Create your account to add this job to your queue and unlock direct employer contacts."}
                    </p>
                    <Button
                      className="w-full font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-12"
                      onClick={() => navigate("/auth")}
                    >
                      {locale === "pt" ? "Adicionar à Minha Fila" : "Add to My Queue"}
                    </Button>
                  </div>
                </div>

                {/* CONTEÚDO PRINCIPAL */}
                <div className="lg:col-span-8 space-y-6">
                  {job.job_min_special_req && (
                    <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-200 shadow-sm">
                      <h4 className="flex items-center gap-2 font-black text-slate-900 mb-4 uppercase text-xs tracking-widest">
                        <AlertTriangle className="h-5 w-5 text-amber-500" /> {t("jobs.details.special_reqs")}
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                        {job.job_min_special_req}
                      </p>
                    </div>
                  )}

                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="flex items-center gap-2 font-black text-slate-900 mb-6 border-b pb-4 uppercase text-xs tracking-widest">
                      <Briefcase className="h-5 w-5 text-indigo-600" /> {t("jobs.details.job_description")}
                    </h4>
                    <p className="text-base text-slate-700 leading-8 whitespace-pre-wrap" translate="yes">
                      {job.job_duties}
                    </p>
                  </div>

                  {/* Requisitos de Entrada */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                      <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                        <GraduationCap className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {t("jobs.details.experience")}
                        </span>
                        <span className="font-bold text-lg text-slate-900">
                          {formatExperience(job.experience_months)}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                      <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {t("jobs.details.education", "Escolaridade")}
                        </span>
                        <span className="font-bold text-lg text-slate-900">{job.education_required || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer Mobile - Versão "Organizador" */}
            <div className="sm:hidden p-4 border-t bg-white flex flex-col gap-3 sticky bottom-0 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
              <Button
                className="w-full font-black h-14 text-base shadow-xl bg-indigo-600 hover:bg-indigo-700 uppercase tracking-tighter"
                onClick={() => navigate("/auth")}
              >
                <Plus className="h-5 w-5 mr-2" />
                {locale === "pt" ? "Adicionar à Fila de Envio" : "Add to My Queue"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest"
                onClick={() => navigate("/jobs")}
              >
                <Search className="h-3 w-3 mr-1" /> {t("jobs.details.browse_others")}
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}
