import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  DollarSign, 
  Calendar, 
  Briefcase, 
  Home, 
  Bus, 
  Wrench, 
  Clock,
  Mail,
  Phone,
  MessageCircle,
  PhoneCall,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { JobMetaTags } from '@/components/jobs/JobMetaTags';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from '@/lib/visaTypes';
import { isMobileNumber, getWhatsAppUrl, getSmsUrl, getPhoneCallUrl } from '@/lib/phone';

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
        console.error('No jobId provided');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching job with ID:', jobId);
        
        const { data, error } = await supabase
          .from('public_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        console.log('Supabase response:', { data, error });

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }
        
        if (!data) {
          console.error('No data returned');
          setJob(null);
          setLoading(false);
          return;
        }
        
        console.log('Job loaded successfully:', data);
        setJob(data as Job);
      } catch (error) {
        console.error('Error fetching job:', error);
        toast({
          title: locale === 'pt' ? 'Erro' : locale === 'es' ? 'Error' : 'Error',
          description: locale === 'pt' 
            ? 'Não foi possível carregar a vaga' 
            : locale === 'es'
            ? 'No se pudo cargar el trabajo'
            : 'Could not load job',
          variant: 'destructive',
        });
        setJob(null);
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [jobId, locale, toast]);

  const formatSalary = (salary: number | null) => {
    if (!salary) return '-';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(salary) + '/h';
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(locale);
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            {locale === 'pt' ? 'Carregando...' : locale === 'es' ? 'Cargando...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>
              {locale === 'pt' ? 'Vaga não encontrada' : locale === 'es' ? 'Trabajo no encontrado' : 'Job not found'}
            </CardTitle>
            <CardDescription>
              {locale === 'pt' 
                ? 'Esta vaga não existe ou foi removida.' 
                : locale === 'es'
                ? 'Este trabajo no existe o fue eliminado.'
                : 'This job does not exist or has been removed.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/jobs')} className="w-full">
              {locale === 'pt' ? 'Ver Mais Vagas' : locale === 'es' ? 'Ver Más Trabajos' : 'Browse Jobs'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const badgeConfig = getVisaBadgeConfig(job.visa_type);

  return (
    <>
      <JobMetaTags job={job} />
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/jobs')}>
              <BrandLogo className="h-8 w-8" />
              <span className="font-bold text-xl">H2 Linker</span>
            </div>
            <Button onClick={() => navigate('/jobs')} variant="default">
              {locale === 'pt' ? 'Ver Mais Vagas' : locale === 'es' ? 'Ver Más Trabajos' : 'Browse Jobs'}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge 
                      variant={badgeConfig.variant}
                      className={badgeConfig.className}
                    >
                      {badgeConfig.label}
                    </Badge>
                    {job.category && (
                      <Badge variant="outline">{job.category}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl mb-2">
                    {job.job_title}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {job.company}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{job.city}, {job.state}</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* Early Access Disclaimer */}
              {isEarlyAccess(job.visa_type) && (
                <Alert variant="destructive" className="mb-6 bg-purple-50 border-purple-200">
                  <AlertTriangle className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-900">
                    {getEarlyAccessDisclaimer(locale)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-6">
                {/* Key Info Grid */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.openings")}</p>
                    <p className="font-medium">{job.openings ?? "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.salary")}</p>
                    <p className="font-medium">{formatSalary(job.salary)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.overtime")}</p>
                    <p className="font-medium">
                      {job.overtime_salary ? `$${Number(job.overtime_salary).toFixed(2)}/h` : "-"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.weekly_hours")}</p>
                    <p className="font-medium">{job.weekly_hours ? `${job.weekly_hours}h` : "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.posted_date")}</p>
                    <p className="font-medium inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(job.posted_date)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.start_date")}</p>
                    <p className="font-medium inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(job.start_date)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.end_date")}</p>
                    <p className="font-medium inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(job.end_date)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("job_details.fields.experience")}</p>
                    <p className="font-medium">
                      {job.experience_months != null
                        ? t("job_details.values.months", { count: job.experience_months })
                        : "-"}
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Contact Section */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.contact")}</h3>
                  <div className="rounded-md border p-3">
                    <div className="flex flex-col gap-2">
                      <div className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{job.email}</span>
                      </div>

                      {job.phone && (
                        <div className="inline-flex items-center gap-2 flex-wrap">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{job.phone}</span>
                          
                          {getSmsUrl(job.phone) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(getSmsUrl(job.phone!), '_blank')}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("job_details.actions.send_sms")}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {getPhoneCallUrl(job.phone) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(getPhoneCallUrl(job.phone!), '_blank')}
                                >
                                  <PhoneCall className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("job_details.actions.call")}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Additional Details */}
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.details")}</h3>
                  
                  {job.education_required && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.education")}</p>
                      <p className="text-sm">{job.education_required}</p>
                    </div>
                  )}

                  {job.job_min_special_req && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.special_requirements")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.job_min_special_req}</p>
                    </div>
                  )}

                  {job.job_duties && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.job_duties")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.job_duties}</p>
                    </div>
                  )}
                </section>

                {/* Compensation Details */}
                {(job.wage_additional || job.rec_pay_deductions) && (
                  <>
                    <Separator />
                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">{t("job_details.sections.compensation")}</h3>

                      {job.wage_additional && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">{t("job_details.fields.wage_additional")}</p>
                          <p className="text-sm whitespace-pre-wrap">{job.wage_additional}</p>
                        </div>
                      )}

                      {job.rec_pay_deductions && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">{t("job_details.fields.pay_deductions")}</p>
                          <p className="text-sm whitespace-pre-wrap">{job.rec_pay_deductions}</p>
                        </div>
                      )}
                    </section>
                  </>
                )}

                <Separator />

                {/* Benefits Section */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.benefits")}</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-md border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t("job_details.fields.housing")}</p>
                        <p className="text-sm text-muted-foreground">
                          {job.visa_type === 'H-2A'
                            ? job.housing_info || t("job_details.values.housing_required_h2a")
                            : job.housing_info || t("job_details.values.not_provided")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t("job_details.fields.transport")}</p>
                        <p className="text-sm text-muted-foreground">
                          {job.transport_provided 
                            ? t("job_details.values.yes") 
                            : t("job_details.values.no")}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {job.source_url && (
                  <>
                    <Separator />
                    <section>
                      <a 
                        href={job.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {t("job_details.fields.source_link")}
                      </a>
                    </section>
                  </>
                )}

                {/* Call to Action */}
                <div className="pt-4">
                  <Button 
                    onClick={() => window.location.href = `mailto:${job.email}`}
                    className="w-full"
                    size="lg"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {locale === 'pt' ? 'Candidatar-se por Email' : locale === 'es' ? 'Aplicar por Email' : 'Apply via Email'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
