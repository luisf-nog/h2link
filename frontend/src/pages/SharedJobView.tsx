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
  Search, // Ícone para "Buscar Vagas"
  Info, // Ícone importado para o banner de prioridade
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
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
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
  visa_type: "H-2B" | "H-2A" | string | null;
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

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

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

        if (!data) {
          setJob(null);
          setLoading(false);
          return;
        }

        setJob(data as unknown as Job);
      } catch (error) {
        console.error("Error fetching job:", error);
        toast({
          title: locale === "pt" ? "Erro" : "Error",
          description: locale === "pt" ? "Não foi possível carregar a vaga" : "Could not load job details",
          variant: "destructive",
        });
        setJob(null);
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [jobId, locale, toast]);

  const renderPrice = (job: Job) => {
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`;
    }
    if (job.wage_from) {
      return `$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`;
    }
    if (job.salary) {
      return `$${job.salary.toFixed(2)}/h`;
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
    if (!months || months <= 0) return t("jobs.details.no_experience", "None");
    if (months < 12) return t("jobs.table.experience_months", { count: months, defaultValue: `${months} months` });
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0)
      return t("jobs.table.experience_years", { count: years, defaultValue: `${years} years` });
    return t("jobs.table.experience_years_months", {
      years,
      months: remainingMonths,
      defaultValue: `${years} years ${remainingMonths} months`,
    });
  };

  const cleanPhone = (phone: string) => (phone ? phone.replace(/\D/g, "") : "");

  const getMessage = () => {
    if (!job) return "";
    const location = job.city && job.state ? ` in ${job.city}, ${job.state}` : "";
    return `Hello, I am interested in the ${job.job_title} position at ${job.company}${location}. I would like to apply. Please let me know the next steps. Thank you.`;
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-6">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {locale === "pt" ? "Vaga não encontrada" : "Job Not Found"}
          </h2>
          <Button onClick={() => navigate("/jobs")} className="mt-4">
            {locale === "pt" ? "Ver Outras Vagas" : "Browse Other Jobs"}
          </Button>
        </Card>
      </div>
    );
  }

  const badgeConfig = getVisaBadgeConfig(job.visa_type);
  const encodedMessage = encodeURIComponent(getMessage());

  // --- FUNÇÃO DO BANNER DO GOVERNO PARA A TELA PUBLICA ---
  const getGroupBadgeConfig = (group: string) => {
    const g = group.toUpperCase();
    if (g === "A")
      return {
        className: "bg-emerald-50 text-emerald-800 border-emerald-300",
        shortDesc: t("jobs.groups.a_short"),
        tooltip: t("jobs.groups.a_tooltip"),
      };
    if (g === "B")
      return {
        className: "bg-blue-50 text-blue-800 border-blue-300",
        shortDesc: t("jobs.groups.b_short"),
        tooltip: t("jobs.groups.b_tooltip"),
      };
    if (g === "C" || g === "D")
      return {
        className: "bg-amber-50 text-amber-800 border-amber-300",
        shortDesc: t("jobs.groups.cd_short"),
        tooltip: t("jobs.groups.cd_tooltip"),
      };
    if (["E", "F", "G", "H"].includes(g))
      return {
        className: "bg-slate-50 text-slate-700 border-slate-300",
        shortDesc: t("jobs.groups.risk_short"),
        tooltip: t("jobs.groups.risk_tooltip"),
      };
    return {
      className: "bg-gray-50 text-gray-700 border-gray-300",
      shortDesc: t("jobs.groups.linear_short"),
      tooltip: t("jobs.groups.linear_tooltip"),
    };
  };

  const group = job?.randomization_group;
  const groupConfig = group ? getGroupBadgeConfig(group) : null;

  const Timeline = () => (
    <div className="flex items-center justify-between text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center">
        <span className="font-semibold text-slate-700 mb-1 text-xs uppercase tracking-wider">
          {t("jobs.details.posted", "Posted")}
        </span>
        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
          {formatDate(job?.posted_date)}
        </span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-3 relative top-[-10px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-400" />
      </div>
      <div className="flex flex-col items-center">
        <span className="font-semibold text-green-700 mb-1 text-xs uppercase tracking-wider">
          {t("jobs.details.start", "Start")}
        </span>
        <span className="bg-green-50 px-2 py-0.5 rounded border border-green-200 text-green-800 font-bold">
          {formatDate(job?.start_date)}
        </span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-3 relative top-[-10px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-400" />
      </div>
      <div className="flex flex-col items-center">
        <span className="font-semibold text-red-700 mb-1 text-xs uppercase tracking-wider">
          {t("jobs.details.end", "End")}
        </span>
        <span className="bg-red-50 px-2 py-0.5 rounded border border-red-200 text-red-800 font-medium">
          {formatDate(job?.end_date)}
        </span>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <JobMetaTags job={job} />

      <div className="min-h-screen bg-slate-50/50 pb-12">
        {/* HEADER GLOBAL - LINK CORRIGIDO PARA /auth */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate("/jobs")}
            >
              <BrandLogo className="h-8 w-8" />
              <span className="font-bold text-xl hidden sm:inline-block">H2 Linker</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate("/auth")}>
                {locale === "pt" ? "Entrar" : "Login"}
              </Button>
              <Button onClick={() => navigate("/auth")}>{locale === "pt" ? "Criar Conta" : "Sign Up"}</Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="shadow-lg border-t-4 border-t-primary overflow-hidden">
            {/* Header Interno do Job */}
            <div className="p-6 bg-white border-b">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                        {badgeConfig.label}
                      </Badge>
                      {job.category && <Badge variant="outline">{job.category}</Badge>}
                      {job.job_id && (
                        <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {job.job_id}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between w-full pr-8">
                      <h1 className="text-2xl sm:text-3xl leading-tight text-primary mt-2 font-bold tracking-tight">
                        {job.job_title}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-lg text-slate-600 mt-1">
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Briefcase className="h-5 w-5 text-slate-400" /> {job.company}
                      </span>
                      <span className="hidden sm:inline text-slate-300">|</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-5 w-5 text-slate-400" /> {job.city}, {job.state}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BANNER DE INTELIGÊNCIA DO GOVERNO (Sorteio DOL) */}
                {group && groupConfig && (
                  <div className={cn("mt-4 mb-2 p-4 rounded-xl border bg-opacity-40", groupConfig.className)}>
                    <div className="flex items-center gap-3 mb-2">
                      <Badge
                        variant="outline"
                        className="bg-white/80 border-current font-bold uppercase tracking-wider"
                      >
                        {t("jobs.groups.group_label", "Grupo")} {group}
                      </Badge>
                      <span className="font-semibold text-sm flex items-center gap-1">
                        <Info className="h-4 w-4" />
                        {groupConfig.shortDesc}
                      </span>
                    </div>
                    <p className="text-sm opacity-90 leading-relaxed">
                      <strong>{t("jobs.groups.dol_draw", "Sorteio Oficial (DOL)")}:</strong> {groupConfig.tooltip}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Aviso Early Access */}
            {isEarlyAccess(job.visa_type) && (
              <Alert variant="destructive" className="m-6 bg-red-50 border-red-200 text-red-800 flex items-center py-2">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <AlertDescription className="text-sm font-semibold">
                  {getEarlyAccessDisclaimer(locale)}
                </AlertDescription>
              </Alert>
            )}

            {/* GRID LAYOUT PRINCIPAL */}
            <div className="p-6 bg-slate-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* --- COLUNA ESQUERDA (SIDEBAR) --- */}
                <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
                  <Timeline />

                  {/* 2. EXPERIÊNCIA NECESSÁRIA */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {t("jobs.details.experience", "Experience Required")}
                      </span>
                      <span className="text-xl font-bold text-slate-800">
                        {formatExperience(job?.experience_months)}
                      </span>
                    </div>
                  </div>

                  {/* Card de Salário e Vagas */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="h-5 w-5 text-blue-500" />
                        <span className="font-semibold text-base">
                          {t("jobs.details.available_positions", "Available Positions")}
                        </span>
                      </div>
                      <Badge className="text-lg px-4 py-1 bg-blue-600 hover:bg-blue-700 font-bold shadow-sm">
                        {job.openings ? formatNumber(job.openings) : "N/A"}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-bold text-lg mb-2">
                        <DollarSign className="h-6 w-6" /> <span>{t("jobs.details.remuneration", "Compensation")}</span>
                      </div>
                      <p className="text-3xl font-extrabold text-green-700 tracking-tight">{renderPrice(job)}</p>
                      {job.pay_frequency && (
                        <p className="text-sm text-slate-500 font-medium capitalize mt-1">
                          {t("jobs.details.pay_frequency", { frequency: job.pay_frequency })}
                        </p>
                      )}
                    </div>

                    {job.wage_additional && (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <span className="text-xs font-bold uppercase text-green-800 block mb-1">
                          {t("jobs.details.bonus", "Bonus / Additional")}
                        </span>
                        <p className="text-base text-green-900 leading-snug">{job.wage_additional}</p>
                      </div>
                    )}

                    {job.rec_pay_deductions && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="font-semibold text-slate-600 text-sm block mb-1">
                          {t("jobs.details.deductions", "Planned Deductions:")}
                        </span>
                        <span className="text-sm text-slate-500 leading-relaxed">{job.rec_pay_deductions}</span>
                      </div>
                    )}
                  </div>

                  {/* Card de Horário */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-4">
                      <Clock className="h-6 w-6 text-slate-500" />{" "}
                      <span>{t("jobs.details.schedule", "Work Schedule")}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-medium text-base">
                        {t("jobs.details.weekly_hours", "Weekly Hours:")}
                      </span>
                      <span className="font-bold text-slate-900 text-xl">
                        {job.weekly_hours ? `${job.weekly_hours}h` : "-"}
                      </span>
                    </div>
                  </div>

                  {/* NOVO: CARD DE CONVITE PARA O HUB */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                        <Search className="h-8 w-8" />
                      </div>
                    </div>
                    <h3 className="font-bold text-blue-900 text-lg">
                      {locale === "pt" ? "Não é o que procura?" : "Not what you're looking for?"}
                    </h3>
                    <p className="text-sm text-blue-700">
                      {locale === "pt"
                        ? "Temos milhares de outras vagas H-2A e H-2B disponíveis. Navegue pelo nosso Hub e encontre a ideal."
                        : "We have thousands of other H-2A and H-2B jobs available. Browse our Hub to find the perfect one."}
                    </p>
                    <Button
                      className="w-full shadow-md bg-blue-600 hover:bg-blue-700 text-white font-bold"
                      size="lg"
                      onClick={() => navigate("/jobs")}
                    >
                      {locale === "pt" ? "Ver Todas as Vagas" : "View All Jobs"}
                    </Button>
                  </div>
                </div>

                {/* --- COLUNA DIREITA (CONTEÚDO PRINCIPAL) --- */}
                <div className="lg:col-span-8 space-y-8 order-1 lg:order-2">
                  {/* Requisitos Especiais */}
                  {job.job_min_special_req && (
                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 shadow-sm">
                      <h4 className="flex items-center gap-2 font-bold text-amber-900 mb-4 text-xl">
                        <AlertTriangle className="h-6 w-6" />{" "}
                        {t("jobs.details.special_reqs", "Special Requirements & Conditions")}
                      </h4>
                      <div className="prose prose-amber max-w-none">
                        <p className="text-base text-amber-900 leading-relaxed whitespace-pre-wrap">
                          {job.job_min_special_req}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Descrição da Vaga */}
                  {job.job_duties && (
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 font-bold text-2xl text-slate-800">
                        <Briefcase className="h-7 w-7 text-blue-600" />{" "}
                        {t("jobs.details.job_description", "Job Description")}
                      </h4>
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-base text-slate-700 leading-7 whitespace-pre-wrap">{job.job_duties}</p>
                      </div>
                    </div>
                  )}

                  {/* NOVA SEÇÃO: REQUISITOS (Experiência + Escolaridade) */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-lg border-b border-slate-100 pb-2 mb-2">
                      <BookOpen className="h-6 w-6 text-slate-500" />{" "}
                      <span>{t("jobs.details.requirements", "Requirements")}</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-50 p-2 rounded-full text-blue-600 mt-0.5">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-slate-500 uppercase tracking-wide">
                            {t("jobs.details.experience", "Experience Required")}
                          </span>
                          <span className="text-lg font-medium text-slate-800">
                            {formatExperience(job.experience_months)}
                          </span>
                        </div>
                      </div>

                      {job.education_required && (
                        <div className="flex items-start gap-3 pt-2 border-t border-slate-50">
                          <div className="bg-purple-50 p-2 rounded-full text-purple-600 mt-0.5">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="block text-sm font-semibold text-slate-500 uppercase tracking-wide">
                              {t("jobs.details.education", "Education")}
                            </span>
                            <span className="text-lg font-medium text-slate-800 capitalize">
                              {job.education_required === "None"
                                ? t("jobs.details.no_education", "Not required")
                                : job.education_required}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informações de Moradia */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                    <h4 className="font-bold flex items-center gap-2 text-slate-700 text-xl border-b border-slate-100 pb-3">
                      <Home className="h-6 w-6 text-indigo-500" />{" "}
                      {t("jobs.details.housing_info", "Housing Information")}
                    </h4>

                    <div className="flex flex-wrap gap-4 items-center">
                      <span className="text-slate-600 font-medium text-base">
                        {t("jobs.details.housing_type", "Housing Type:")}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-base py-1 px-4 bg-slate-50 text-slate-800 font-medium border-slate-300"
                      >
                        {job.housing_type || t("jobs.details.not_specified", "Not specified")}
                      </Badge>
                    </div>

                    {job.housing_info && (
                      <div className="bg-slate-50 p-5 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold uppercase text-slate-400 block mb-2">
                          {t("jobs.details.additional_details", "Additional Details")}
                        </span>
                        <p className="text-base text-slate-700 leading-relaxed">{job.housing_info}</p>
                      </div>
                    )}

                    {job.housing_addr && (
                      <div className="flex gap-2 text-base text-slate-600 items-start pt-2 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                        <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-indigo-500" />
                        <span className="font-medium">
                          {job.housing_addr}, {job.housing_city}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contatos */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {t("jobs.details.company_contacts", "Company Contacts")}
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Email */}
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="bg-white p-2 rounded-full border border-slate-200 text-blue-500">
                          <Mail className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs text-slate-400 font-bold">
                            {t("jobs.details.email_label", "EMAIL")}
                          </span>
                          <span className="truncate font-medium text-slate-700 text-base">{job.email}</span>
                        </div>
                      </div>

                      {/* Phone */}
                      {job.phone && (
                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div className="bg-white p-2 rounded-full border border-slate-200 text-green-500">
                            <Phone className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-xs text-slate-400 font-bold">
                              {t("jobs.details.phone_label", "PHONE")}
                            </span>
                            <span className="truncate font-medium text-slate-700 text-base">{job.phone}</span>
                          </div>
                        </div>
                      )}

                      {/* Website */}
                      {job.website && (
                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div className="bg-white p-2 rounded-full border border-slate-200 text-purple-500">
                            <Globe className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-xs text-slate-400 font-bold">
                              {t("jobs.details.website_label", "WEBSITE")}
                            </span>
                            <a
                              href={job.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate font-medium text-purple-700 hover:underline text-base"
                            >
                              {t("jobs.details.visit_site", "Visit Official Site")}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Sticky CTA */}
            <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
              <Button className="flex-1 font-bold h-12 text-base shadow-md" onClick={() => navigate("/auth")}>
                <CheckCircle2 className="h-5 w-5 mr-2" /> {locale === "pt" ? "Candidatar-se" : "Apply Now"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-base border-slate-300"
                onClick={() => navigate("/jobs")}
              >
                <Search className="h-5 w-5 mr-2" /> {locale === "pt" ? "Ver Mais Vagas" : "View More Jobs"}
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}
