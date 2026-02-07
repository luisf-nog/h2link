import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  DollarSign,
  Calendar,
  Briefcase,
  Home,
  Clock,
  Mail,
  Phone,
  MessageCircle,
  PhoneCall,
  AlertTriangle,
  Info,
  Loader2,
  Users,
  ArrowRight,
  Share2,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { JobMetaTags } from "@/components/jobs/JobMetaTags";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
import { getWhatsAppUrl, getSmsUrl, getPhoneCallUrl, isMobileNumber } from "@/lib/phone";
import { formatNumber } from "@/lib/number";
import { getJobShareUrl } from "@/lib/shareUtils";

// Interface expandida para bater com os dados do JobDetails
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
        console.error("No jobId provided");
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

  const cleanPhone = (phone: string) => (phone ? phone.replace(/\D/g, "") : "");

  // Mensagem padrão para contato
  const getMessage = () => {
    if (!job) return "";
    const location = job.city && job.state ? ` in ${job.city}, ${job.state}` : "";
    return `Hello, I am interested in the ${job.job_title} position at ${job.company}${location}. I would like to apply. Please let me know the next steps. Thank you.`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("jobs.details.copied", "Copiado!"),
      description: t("jobs.details.copy_success", "Texto copiado para a área de transferência."),
    });
  };

  const handleShare = () => {
    if (!job) return;
    const shareUrl = getJobShareUrl(job.id);
    if (navigator.share) {
      navigator
        .share({
          title: job.job_title,
          text: `Check out this job at ${job.company}`,
          url: shareUrl,
        })
        .catch(() => copyToClipboard(shareUrl));
    } else {
      copyToClipboard(shareUrl);
    }
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

  const Timeline = () => (
    <div className="flex items-center justify-between text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center">
        <span className="font-semibold text-slate-700 mb-1 text-xs uppercase tracking-wider">
          {t("jobs.details.posted", "Postada")}
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
          {t("jobs.details.start", "Início")}
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
          {t("jobs.details.end", "Fim")}
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
        {/* Header */}
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
              <Button variant="ghost" onClick={() => navigate("/login")}>
                {locale === "pt" ? "Entrar" : "Login"}
              </Button>
              <Button onClick={() => navigate("/signup")}>{locale === "pt" ? "Criar Conta" : "Sign Up"}</Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="shadow-lg border-t-4 border-t-primary overflow-hidden">
            {/* Header Interno do Job (Igual ao Modal) */}
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

                  {/* Botão de Share no Desktop */}
                  <div className="hidden sm:flex shrink-0">
                    <Button variant="outline" onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" /> {t("jobs.details.share", "Compartilhar")}
                    </Button>
                  </div>
                </div>
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

            {/* GRID LAYOUT PRINCIPAL (1/3 ESQUERDA, 2/3 DIREITA) */}
            <div className="p-6 bg-slate-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* --- COLUNA ESQUERDA (SIDEBAR) --- */}
                <div className="lg:col-span-4 space-y-6">
                  <Timeline />

                  {/* Card de Salário e Vagas */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="h-5 w-5 text-blue-500" />
                        <span className="font-semibold text-base">
                          {t("jobs.details.available_positions", "Vagas Disponíveis")}
                        </span>
                      </div>
                      <Badge className="text-lg px-4 py-1 bg-blue-600 hover:bg-blue-700 font-bold shadow-sm">
                        {job.openings ? formatNumber(job.openings) : "N/A"}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-bold text-lg mb-2">
                        <DollarSign className="h-6 w-6" /> <span>{t("jobs.details.remuneration", "Remuneração")}</span>
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
                          {t("jobs.details.bonus", "Bônus / Adicional")}
                        </span>
                        <p className="text-base text-green-900 leading-snug">{job.wage_additional}</p>
                      </div>
                    )}

                    {job.rec_pay_deductions && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="font-semibold text-slate-600 text-sm block mb-1">
                          {t("jobs.details.deductions", "Deduções Previstas:")}
                        </span>
                        <span className="text-sm text-slate-500 leading-relaxed">{job.rec_pay_deductions}</span>
                      </div>
                    )}
                  </div>

                  {/* Card de Horário */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-4">
                      <Clock className="h-6 w-6 text-slate-500" />{" "}
                      <span>{t("jobs.details.schedule", "Jornada de Trabalho")}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-medium text-base">
                        {t("jobs.details.weekly_hours", "Carga Horária Semanal:")}
                      </span>
                      <span className="font-bold text-slate-900 text-xl">
                        {job.weekly_hours ? `${job.weekly_hours}h` : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Card de Contato */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {t("jobs.details.company_contacts", "Contatos da Empresa")}
                    </div>

                    <div
                      className="group flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer"
                      onClick={() => copyToClipboard(job.email)}
                    >
                      <div className="bg-white p-2 rounded-full border border-slate-200 text-blue-500">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs text-slate-400 font-bold">
                          {t("jobs.details.email_label", "EMAIL")}
                        </span>
                        <span className="truncate font-medium text-slate-700 text-base select-all">{job.email}</span>
                      </div>
                    </div>

                    {job.phone && (
                      <div className="space-y-2">
                        <div
                          className="group flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-green-200 transition-colors cursor-pointer"
                          onClick={() => copyToClipboard(job.phone!)}
                        >
                          <div className="bg-white p-2 rounded-full border border-slate-200 text-green-500">
                            <Phone className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-xs text-slate-400 font-bold">
                              {t("jobs.details.phone_label", "TELEFONE")}
                            </span>
                            <span className="truncate font-medium text-slate-700 text-base select-all">
                              {job.phone}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex gap-1 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                            asChild
                          >
                            <a href={`tel:${job.phone}`}>
                              <Phone className="h-4 w-4" /> {t("jobs.details.call_action", "Ligar")}
                            </a>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex gap-1 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                            asChild
                          >
                            <a href={`sms:${cleanPhone(job.phone)}?body=${encodedMessage}`}>
                              <MessageCircle className="h-4 w-4" /> {t("jobs.details.sms_action", "SMS")}
                            </a>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex gap-1 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                            asChild
                          >
                            <a
                              href={`https://wa.me/${cleanPhone(job.phone)}?text=${encodedMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <WhatsAppIcon className="h-4 w-4" /> {t("jobs.details.whatsapp_action", "WhatsApp")}
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}

                    {job.website && (
                      <a
                        href={job.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-purple-200 transition-colors hover:bg-purple-50"
                      >
                        <div className="bg-white p-2 rounded-full border border-slate-200 text-purple-500">
                          <Globe className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs text-slate-400 font-bold">
                            {t("jobs.details.website_label", "WEBSITE")}
                          </span>
                          <span className="truncate font-medium text-purple-700 text-base">
                            {t("jobs.details.visit_site", "Visitar site")}
                          </span>
                        </div>
                      </a>
                    )}
                  </div>

                  {/* Card Promocional (CTA) Sidebar */}
                  <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-6 text-center space-y-4">
                    <h3 className="font-bold text-primary text-lg">
                      {locale === "pt" ? "Quer se candidatar?" : "Want to apply?"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {locale === "pt"
                        ? "Crie sua conta grátis para enviar seu currículo."
                        : "Create a free account to send your resume."}
                    </p>
                    <Button className="w-full shadow-md" size="lg" onClick={() => navigate("/signup")}>
                      {locale === "pt" ? "Criar Conta" : "Sign Up"}
                    </Button>
                  </div>
                </div>

                {/* --- COLUNA DIREITA (CONTEÚDO PRINCIPAL) --- */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Requisitos Especiais */}
                  {job.job_min_special_req && (
                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 shadow-sm">
                      <h4 className="flex items-center gap-2 font-bold text-amber-900 mb-4 text-xl">
                        <AlertTriangle className="h-6 w-6" />{" "}
                        {t("jobs.details.special_reqs", "Requisitos Especiais & Condições")}
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
                        {t("jobs.details.job_description", "Descrição da Vaga")}
                      </h4>
                      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-base text-slate-700 leading-7 whitespace-pre-wrap">{job.job_duties}</p>
                      </div>
                    </div>
                  )}

                  {/* Informações de Moradia */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                    <h4 className="font-bold flex items-center gap-2 text-slate-700 text-xl border-b border-slate-100 pb-3">
                      <Home className="h-6 w-6 text-indigo-500" />{" "}
                      {t("jobs.details.housing_info", "Informações de Moradia")}
                    </h4>

                    <div className="flex flex-wrap gap-4 items-center">
                      <span className="text-slate-600 font-medium text-base">
                        {t("jobs.details.housing_type", "Tipo de Acomodação:")}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-base py-1 px-4 bg-slate-50 text-slate-800 font-medium border-slate-300"
                      >
                        {job.housing_type || t("jobs.details.not_specified", "Não especificado")}
                      </Badge>
                    </div>

                    {job.housing_info && (
                      <div className="bg-slate-50 p-5 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold uppercase text-slate-400 block mb-2">
                          {t("jobs.details.additional_details", "Detalhes Adicionais")}
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
                </div>
              </div>
            </div>

            {/* Mobile Sticky CTA */}
            <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
              <Button className="flex-1 font-bold h-12 text-base shadow-md" onClick={() => navigate("/signup")}>
                <CheckCircle2 className="h-5 w-5 mr-2" /> {locale === "pt" ? "Candidatar-se" : "Apply Now"}
              </Button>
              <Button variant="outline" size="icon" className="h-12 w-12 border-slate-300" onClick={handleShare}>
                <Share2 className="h-5 w-5 text-slate-600" />
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}
