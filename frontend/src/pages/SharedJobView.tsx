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
  Loader2,
  Users,
  CheckCircle2,
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
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
    }
    if (job.wage_from) {
      return `$${job.wage_from.toFixed(2)}`;
    }
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

      <div className="min-h-screen bg-gray-50/30 pb-12">
        {/* Header Navigation */}
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

        {/* Main Layout */}
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Top Header Card */}
          <Card className="mb-6 border-l-4 border-l-primary shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                      {badgeConfig.label}
                    </Badge>
                    {job.category && (
                      <Badge variant="outline" className="bg-background">
                        {job.category}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">{job.job_title}</h1>
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

                {/* Mobile/Desktop quick action */}
                <div className="flex-shrink-0">
                  <Button size="lg" onClick={() => navigate("/signup")} className="w-full md:w-auto shadow-md">
                    {locale === "pt" ? "Candidatar-se" : "Apply Now"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid Layout: Left (Details) vs Right (Heavy Text) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* === COLUNA DA ESQUERDA: DETALHES (Sidebar) === */}
            <div className="lg:col-span-1 space-y-6">
              {/* Card de Informações Chave */}
              <Card className="shadow-sm border-primary/20 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    {locale === "pt" ? "Detalhes da Vaga" : "Job Details"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Salário */}
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">
                      {locale === "pt" ? "Salário" : "Wage"}
                    </p>
                    <div className="flex items-end gap-1">
                      <p className="text-xl font-bold text-primary">{renderPrice(job)}</p>
                      <span className="text-sm text-muted-foreground mb-1">/{job.wage_unit || "h"}</span>
                    </div>
                    {job.overtime_salary && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {locale === "pt" ? "Hora Extra: " : "Overtime: "}
                        <span className="font-medium">${Number(job.overtime_salary).toFixed(2)}</span>
                      </p>
                    )}
                  </div>

                  {/* Grid de 2 colunas para dados pequenos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 bg-background rounded-lg border">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Users className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{locale === "pt" ? "Vagas" : "Openings"}</span>
                      </div>
                      <p className="font-semibold">{job.openings ?? "-"}</p>
                    </div>
                    <div className="p-2 bg-background rounded-lg border">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{locale === "pt" ? "Horas" : "Hours"}</span>
                      </div>
                      <p className="font-semibold">{job.weekly_hours}h</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Datas */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> {locale === "pt" ? "Início" : "Start"}
                      </span>
                      <span className="font-medium">{formatDate(job.start_date)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> {locale === "pt" ? "Fim" : "End"}
                      </span>
                      <span className="font-medium">{formatDate(job.end_date)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Experiência */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">
                      {locale === "pt" ? "Experiência Necessária" : "Experience Required"}
                    </p>
                    <p className="font-medium">{formatExperience(job.experience_months)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Card de Contato */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    {locale === "pt" ? "Contato" : "Contact"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-md transition-colors">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${job.email}`} className="text-sm font-medium hover:text-primary truncate">
                        {job.email}
                      </a>
                    </div>
                    {job.phone && (
                      <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-md transition-colors">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{job.phone}</span>
                      </div>
                    )}
                  </div>

                  {job.phone && (
                    <div className="grid grid-cols-3 gap-2">
                      {getSmsUrl(job.phone) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => window.open(getSmsUrl(job.phone!), "_blank")}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {getWhatsAppUrl(job.phone) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => window.open(getWhatsAppUrl(job.phone!), "_blank")}
                        >
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {getPhoneCallUrl(job.phone) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => window.open(getPhoneCallUrl(job.phone!), "_blank")}
                        >
                          <PhoneCall className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card Promocional (CTA) */}
              <Card className="bg-primary/5 border-primary/20 shadow-none">
                <CardContent className="p-4 text-center space-y-3">
                  <BrandLogo className="h-8 w-8 mx-auto opacity-80" />
                  <h3 className="font-semibold text-primary">
                    {locale === "pt" ? "Quer essa vaga?" : "Want this job?"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {locale === "pt"
                      ? "Crie sua conta grátis para enviar seu currículo e gerar emails com IA."
                      : "Create a free account to send your resume and generate AI emails."}
                  </p>
                  <Button className="w-full" size="sm" onClick={() => navigate("/signup")}>
                    {locale === "pt" ? "Criar Conta" : "Sign Up"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* === COLUNA DA DIREITA: TEXTO PESADO (Main Content) === */}
            <div className="lg:col-span-2 space-y-6">
              {/* Aviso Early Access (Se existir) */}
              {isEarlyAccess(job.visa_type) && (
                <Alert className="bg-purple-50 border-purple-200 text-purple-900 shadow-sm">
                  <Info className="h-5 w-5 text-purple-600" />
                  <AlertDescription className="ml-3 text-sm font-medium">
                    {getEarlyAccessDisclaimer(locale)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Deveres do Trabalho */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    {locale === "pt" ? "Descrição e Deveres" : "Job Duties & Description"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line leading-relaxed">
                    {job.job_duties || (locale === "pt" ? "Nenhuma descrição fornecida." : "No description provided.")}
                  </div>
                </CardContent>
              </Card>

              {/* Requisitos e Educação */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    {locale === "pt" ? "Requisitos e Educação" : "Requirements & Education"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {job.education_required && (
                    <div>
                      <h4 className="font-medium text-foreground mb-1 text-sm uppercase tracking-wide">
                        {locale === "pt" ? "Educação" : "Education"}
                      </h4>
                      <p className="text-muted-foreground text-sm">{job.education_required}</p>
                    </div>
                  )}

                  {job.job_min_special_req && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium text-foreground mb-1 text-sm uppercase tracking-wide flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {locale === "pt" ? "Requisitos Especiais" : "Special Requirements"}
                        </h4>
                        <p className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed">
                          {job.job_min_special_req}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Informações Adicionais (Moradia, Deduções) */}
              {(job.housing_info || job.rec_pay_deductions || job.wage_additional) && (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Home className="h-5 w-5 text-primary" />
                      {locale === "pt" ? "Moradia e Benefícios" : "Housing & Benefits"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {job.housing_info && (
                      <div>
                        <h4 className="font-medium text-foreground mb-1 text-sm uppercase tracking-wide">
                          {locale === "pt" ? "Informações de Moradia" : "Housing Information"}
                        </h4>
                        <p className="text-muted-foreground text-sm whitespace-pre-line">{job.housing_info}</p>
                      </div>
                    )}

                    {(job.wage_additional || job.rec_pay_deductions) && <Separator />}

                    {job.wage_additional && (
                      <div>
                        <h4 className="font-medium text-foreground mb-1 text-sm uppercase tracking-wide">
                          {locale === "pt" ? "Adicionais Salariais" : "Additional Wage Info"}
                        </h4>
                        <p className="text-muted-foreground text-sm whitespace-pre-line">{job.wage_additional}</p>
                      </div>
                    )}

                    {job.rec_pay_deductions && (
                      <div>
                        <h4 className="font-medium text-foreground mb-1 text-sm uppercase tracking-wide">
                          {locale === "pt" ? "Deduções de Pagamento" : "Payroll Deductions"}
                        </h4>
                        <p className="text-muted-foreground text-sm whitespace-pre-line">{job.rec_pay_deductions}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
