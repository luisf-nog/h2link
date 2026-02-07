import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  DollarSign,
  Calendar,
  Briefcase,
  Home,
  Wrench,
  Clock,
  Mail,
  Phone,
  MessageCircle,
  PhoneCall,
  AlertTriangle,
  Info,
  Loader2, // Garanta que Loader2 está na lista de imports do 'lucide-react'
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { JobMetaTags } from "@/components/jobs/JobMetaTags";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
import { getWhatsAppUrl, getSmsUrl, getPhoneCallUrl } from "@/lib/phone";
import { formatNumber } from "@/lib/number";

interface Job {
  id: string;
  job_title: string;
  company: string;
  email: string;
  city: string;
  state: string;
  visa_type: string | null;
  category?: string | null;
  openings?: number | null;
  salary: number | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  overtime_salary?: number | null;
  weekly_hours?: number | null;
  start_date: string | null;
  end_date: string | null;
  posted_date: string;
  experience_months?: number | null;
  education_required?: string | null;
  housing_info?: string | null;
  transport_provided?: boolean | null;
  job_duties?: string | null;
  phone?: string | null;
  source_url?: string | null;
  worksite_address?: string | null;
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
    // 1. Faixa (H-2B)
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
    }
    // 2. Valor Único (H-2A)
    if (job.wage_from) {
      return `$${job.wage_from.toFixed(2)}`;
    }
    // 3. Legado
    if (job.salary) {
      return `$${job.salary.toFixed(2)}`;
    }
    return "-";
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(locale, { timeZone: "UTC" });
    } catch {
      return "-";
    }
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return "-";
    if (locale === "pt") {
      if (months < 12) return `${months} meses`;
      const years = Math.floor(months / 12);
      const rem = months % 12;
      if (rem === 0) return `${years} anos`;
      return `${years} anos e ${rem} meses`;
    }
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (rem === 0) return `${years} years`;
    return `${years} years, ${rem} months`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {locale === "pt" ? "Carregando detalhes da vaga..." : "Loading job details..."}
          </p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader>
            <CardTitle className="text-center flex flex-col items-center gap-2">
              <AlertTriangle className="h-10 w-10 text-yellow-500" />
              {locale === "pt" ? "Vaga não encontrada" : "Job Not Found"}
            </CardTitle>
            <CardDescription className="text-center">
              {locale === "pt"
                ? "Esta vaga pode ter expirado ou foi removida."
                : "This job post may have expired or been removed."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/jobs")} className="w-full">
              {locale === "pt" ? "Ver Outras Vagas" : "Browse Other Jobs"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const badgeConfig = getVisaBadgeConfig(job.visa_type);

  return (
    <TooltipProvider>
      <JobMetaTags job={job} />

      <div className="min-h-screen bg-gray-50/50 pb-12">
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
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader className="space-y-4">
              {/* Badges Row */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={badgeConfig.variant} className={`${badgeConfig.className} px-3 py-1 text-sm`}>
                  {badgeConfig.label}
                </Badge>
                {job.category && (
                  <Badge variant="outline" className="px-3 py-1 text-sm bg-background">
                    {job.category}
                  </Badge>
                )}
                {isEarlyAccess(job.visa_type) && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                    Early Access
                  </Badge>
                )}
              </div>

              {/* Title & Company */}
              <div className="space-y-2">
                <CardTitle className="text-3xl font-bold leading-tight text-foreground">{job.job_title}</CardTitle>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-muted-foreground text-lg">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Briefcase className="h-5 w-5" />
                    {job.company}
                  </div>
                  <div className="hidden sm:block text-gray-300">•</div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {job.city}, {job.state}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Disclaimer for Early Access */}
              {isEarlyAccess(job.visa_type) && (
                <Alert className="bg-purple-50 border-purple-200 text-purple-900">
                  <Info className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="ml-2">{getEarlyAccessDisclaimer(locale)}</AlertDescription>
                </Alert>
              )}

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">
                    {locale === "pt" ? "Salário" : "Wage"}
                  </p>
                  <p className="font-bold text-lg text-primary flex items-center gap-1">
                    {renderPrice(job)}
                    <span className="text-xs text-muted-foreground font-normal">/{job.wage_unit || "h"}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">
                    {locale === "pt" ? "Vagas" : "Openings"}
                  </p>
                  <p className="font-bold text-lg">{job.openings ? formatNumber(job.openings) : "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">
                    {locale === "pt" ? "Início" : "Start Date"}
                  </p>
                  <p className="font-medium text-lg">{formatDate(job.start_date)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">
                    {locale === "pt" ? "Fim" : "End Date"}
                  </p>
                  <p className="font-medium text-lg">{formatDate(job.end_date)}</p>
                </div>
              </div>

              {/* Detailed Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">{locale === "pt" ? "Carga Horária" : "Weekly Hours"}</span>
                  </div>
                  <p className="text-foreground font-medium pl-6">{job.weekly_hours ? `${job.weekly_hours}h` : "-"}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm font-medium">{locale === "pt" ? "Hora Extra" : "Overtime"}</span>
                  </div>
                  <p className="text-foreground font-medium pl-6">
                    {job.overtime_salary ? `$${Number(job.overtime_salary).toFixed(2)}` : "-"}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-sm font-medium">{locale === "pt" ? "Experiência" : "Experience"}</span>
                  </div>
                  <p className="text-foreground font-medium pl-6">{formatExperience(job.experience_months)}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">{locale === "pt" ? "Publicado em" : "Posted Date"}</span>
                  </div>
                  <p className="text-foreground font-medium pl-6">{formatDate(job.posted_date)}</p>
                </div>
              </div>

              <Separator />

              {/* Description Sections */}
              <div className="space-y-6">
                {job.education_required && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-primary" />
                      {locale === "pt" ? "Educação / Requisitos" : "Education & Requirements"}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed pl-7">{job.education_required}</p>
                  </div>
                )}

                {job.job_duties && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-primary" />
                      {locale === "pt" ? "Deveres do Trabalho" : "Job Duties"}
                    </h3>
                    <div className="text-muted-foreground leading-relaxed pl-7 whitespace-pre-line">
                      {job.job_duties}
                    </div>
                  </div>
                )}

                {job.job_min_special_req && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-primary" />
                      {locale === "pt" ? "Requisitos Especiais" : "Special Requirements"}
                    </h3>
                    <div className="text-muted-foreground leading-relaxed pl-7 whitespace-pre-line">
                      {job.job_min_special_req}
                    </div>
                  </div>
                )}
              </div>

              {/* Compensation & Housing */}
              {(job.wage_additional || job.rec_pay_deductions || job.housing_info) && (
                <>
                  <Separator />
                  <div className="space-y-6">
                    {job.wage_additional && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-primary" />
                          {locale === "pt" ? "Adicionais Salariais" : "Additional Wage Info"}
                        </h3>
                        <p className="text-muted-foreground pl-7">{job.wage_additional}</p>
                      </div>
                    )}

                    {job.rec_pay_deductions && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-primary" />
                          {locale === "pt" ? "Deduções" : "Deductions"}
                        </h3>
                        <p className="text-muted-foreground pl-7">{job.rec_pay_deductions}</p>
                      </div>
                    )}

                    {job.housing_info && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Home className="h-5 w-5 text-primary" />
                          {locale === "pt" ? "Moradia" : "Housing"}
                        </h3>
                        <p className="text-muted-foreground pl-7">{job.housing_info}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Contact Information */}
              <div className="bg-muted/30 p-6 rounded-xl border space-y-4">
                <h3 className="font-semibold text-lg mb-4">
                  {locale === "pt" ? "Contato da Empresa" : "Company Contact"}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm text-muted-foreground font-medium">Email</p>
                      <a
                        href={`mailto:${job.email}`}
                        className="text-foreground hover:text-primary transition-colors truncate block"
                      >
                        {job.email}
                      </a>
                    </div>
                  </div>

                  {job.phone && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">
                          {locale === "pt" ? "Telefone" : "Phone"}
                        </p>
                        <p className="text-foreground">{job.phone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {job.phone && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {getSmsUrl(job.phone) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(getSmsUrl(job.phone!), "_blank")}
                      >
                        <MessageCircle className="h-4 w-4" />
                        SMS
                      </Button>
                    )}
                    {getWhatsAppUrl(job.phone) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(getWhatsAppUrl(job.phone!), "_blank")}
                      >
                        <MessageCircle className="h-4 w-4 text-green-600" />
                        WhatsApp
                      </Button>
                    )}
                    {getPhoneCallUrl(job.phone) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(getPhoneCallUrl(job.phone!), "_blank")}
                      >
                        <PhoneCall className="h-4 w-4" />
                        {locale === "pt" ? "Ligar" : "Call"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Call to Action - Platform Promotion */}
              <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-8 text-center space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-primary">
                    {locale === "pt"
                      ? "Quer se candidatar a esta e outras vagas?"
                      : "Want to apply to this and other jobs?"}
                  </h3>
                  <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                    {locale === "pt"
                      ? "O H2 Linker ajuda você a enviar currículos, gerar emails com IA e conseguir seu visto de trabalho nos EUA."
                      : "H2 Linker helps you send resumes, generate AI emails, and get your US work visa."}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => navigate("/signup")}
                    size="lg"
                    className="text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all"
                  >
                    {locale === "pt" ? "Criar Conta Grátis" : "Create Free Account"}
                  </Button>
                  <Button
                    onClick={() => navigate("/jobs")}
                    variant="outline"
                    size="lg"
                    className="text-lg px-8 py-6 h-auto"
                  >
                    {locale === "pt" ? "Ver Todas as Vagas" : "View All Jobs"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}
