import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  DollarSign, 
  Calendar, 
  Briefcase, 
  Home, 
  Bus, 
  Wrench, 
  Clock,
  ArrowRight,
  Mail,
  AlertCircle,
  Share2,
  Phone
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { JobMetaTags } from '@/components/jobs/JobMetaTags';
import { useToast } from '@/hooks/use-toast';

interface Job {
  id: string;
  job_id: string;
  visa_type: string | null;
  company: string;
  email: string;
  phone?: string | null;
  job_title: string;
  category: string | null;
  city: string;
  state: string;
  worksite_address?: string | null;
  worksite_zip?: string | null;
  openings?: number | null;
  salary: number | null;
  overtime_salary?: number | null;
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
  source_url?: string | null;
  experience_months?: number | null;
  description?: string | null;
  requirements?: string | null;
  education_required?: string | null;
  housing_info: string | null;
  transport_provided: boolean | null;
  tools_provided: boolean | null;
  weekly_hours: number | null;
  job_duties?: string | null;
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
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const locale = i18n.resolvedLanguage || i18n.language;

  useEffect(() => {
    async function fetchJob() {
      if (!jobId) return;

      try {
        // Public access - no auth required
        const { data, error } = await supabase
          .from('public_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) throw error;
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
    }).format(salary);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleApply = () => {
    setShowLoginPrompt(true);
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/job/${jobId}`;
    
    // UTM parameters prepared for future activation
    // const shareUrlWithUTM = `${shareUrl}?utm_source=share&utm_medium=social&utm_campaign=job_sharing`;
    
    if (navigator.share) {
      navigator.share({
        title: `${job?.job_title} - ${job?.company}`,
        text: `${t('jobs.shareText')}: ${job?.job_title}`,
        url: shareUrl,
      }).catch(() => {
        copyToClipboard(shareUrl);
      });
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: locale === 'pt' ? 'Link copiado!' : locale === 'es' ? '¡Enlace copiado!' : 'Link copied!',
      description: locale === 'pt' 
        ? 'Link copiado para área de transferência' 
        : locale === 'es'
        ? 'Enlace copiado al portapapeles'
        : 'Link copied to clipboard',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="animate-pulse text-muted-foreground">
          {locale === 'pt' ? 'Carregando...' : locale === 'es' ? 'Cargando...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <BrandLogo className="h-12 w-12" />
            </div>
            <CardTitle className="text-center">
              {locale === 'pt' ? 'Vaga não encontrada' : locale === 'es' ? 'Trabajo no encontrado' : 'Job not found'}
            </CardTitle>
            <CardDescription className="text-center">
              {locale === 'pt' 
                ? 'Esta vaga pode ter sido removida ou não existe.' 
                : locale === 'es'
                ? 'Este trabajo puede haber sido eliminado o no existe.'
                : 'This job may have been removed or does not exist.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/jobs')} className="w-full">
              {locale === 'pt' ? 'Ver todas as vagas' : locale === 'es' ? 'Ver todos los trabajos' : 'View all jobs'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isH2A = job.visa_type === 'H-2A';

  return (
    <>
      <JobMetaTags job={job} />
      
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/jobs')}>
              <BrandLogo className="h-8 w-8" />
              <span className="font-bold text-xl">H2 Linker</span>
            </div>
            <Button onClick={handleShare} variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              {locale === 'pt' ? 'Compartilhar' : locale === 'es' ? 'Compartir' : 'Share'}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Main Content - Same structure as JobDetailsDialog */}
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {job.visa_type}
                  </Badge>
                  {job.category && (
                    <Badge variant="outline" className="text-xs">
                      {job.category}
                    </Badge>
                  )}
                </div>
                
                <div>
                  <CardTitle className="text-2xl mb-2">{job.job_title}</CardTitle>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="h-4 w-4" />
                    <span className="font-medium">{job.company}</span>
                    <MapPin className="h-4 w-4 ml-2" />
                    <span>
                      {job.city}, {job.state}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Grid of key fields - 2 columns */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Openings */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'pt' ? 'Vagas' : locale === 'es' ? 'Vacantes' : 'Openings'}
                  </p>
                  <p className="font-medium">{job.openings ?? "-"}</p>
                </div>

                {/* Salary */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'pt' ? 'Salário' : locale === 'es' ? 'Salario' : 'Salary'}
                  </p>
                  <p className="font-medium">{formatSalary(job.salary)}</p>
                </div>

                {/* Overtime */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'pt' ? 'Hora Extra' : locale === 'es' ? 'Horas extras' : 'Overtime'}
                  </p>
                  <p className="font-medium">
                    {job.overtime_salary ? `${formatSalary(job.overtime_salary)}/h` : "-"}
                  </p>
                </div>

                {/* Weekly Hours */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'pt' ? 'Horas Semanais' : locale === 'es' ? 'Horas semanales' : 'Weekly hours'}
                  </p>
                  <p className="font-medium">{job.weekly_hours ? `${job.weekly_hours}h` : "-"}</p>
                </div>

                {/* Posted Date */}
                {job.posted_date && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {locale === 'pt' ? 'Publicado' : locale === 'es' ? 'Publicado' : 'Posted'}
                    </p>
                    <p className="font-medium inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(job.posted_date)}
                    </p>
                  </div>
                )}

                {/* Start Date */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'pt' ? 'Início' : locale === 'es' ? 'Inicio' : 'Start'}
                  </p>
                  <p className="font-medium inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(job.start_date)}
                  </p>
                </div>

                {/* End Date */}
                {job.end_date && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {locale === 'pt' ? 'Término' : locale === 'es' ? 'Fin' : 'End'}
                    </p>
                    <p className="font-medium inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(job.end_date)}
                    </p>
                  </div>
                )}

                {/* Experience */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'pt' ? 'Experiência' : locale === 'es' ? 'Experiencia' : 'Experience'}
                  </p>
                  <p className="font-medium">
                    {job.experience_months != null
                      ? job.experience_months === 0
                        ? (locale === 'pt' ? 'Nenhuma' : locale === 'es' ? 'Ninguna' : 'None')
                        : job.experience_months === 1
                        ? (locale === 'pt' ? '1 mês' : locale === 'es' ? '1 mes' : '1 month')
                        : locale === 'pt'
                        ? `${job.experience_months} meses`
                        : locale === 'es'
                        ? `${job.experience_months} meses`
                        : `${job.experience_months} months`
                      : "-"}
                  </p>
                </div>
              </section>

              <Separator />

              {/* Contact Section */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {locale === 'pt' ? 'Contato' : locale === 'es' ? 'Contacto' : 'Contact'}
                </h3>
                <div className="rounded-md border p-3">
                  <div className="flex flex-col gap-2">
                    {job.email && (
                      <div className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${job.email}`} className="font-medium hover:underline">
                          {job.email}
                        </a>
                      </div>
                    )}
                    
                    {job.phone && (
                      <div className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${job.phone}`} className="font-medium hover:underline">
                          {job.phone}
                        </a>
                      </div>
                    )}

                    {job.job_id && (
                      <p className="text-xs text-muted-foreground">
                        {locale === 'pt' ? 'ID da Vaga' : locale === 'es' ? 'ID del trabajo' : 'Job ID'}: <span className="font-mono">{job.job_id}</span>
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Worksite Section */}
              {(job.worksite_address || job.worksite_zip) && (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      {locale === 'pt' ? 'Local de Trabalho' : locale === 'es' ? 'Lugar de trabajo' : 'Worksite'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {job.worksite_address}
                      {job.worksite_zip ? ` — ${job.worksite_zip}` : ""}
                    </p>
                  </section>
                </>
              )}

              {/* Details Section */}
              {(job.description || job.requirements || job.education_required || job.job_duties || job.job_min_special_req) && (
                <>
                  <Separator />
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">
                      {locale === 'pt' ? 'Detalhes' : locale === 'es' ? 'Detalles' : 'Details'}
                    </h3>

                    {job.education_required && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {locale === 'pt' ? 'Educação' : locale === 'es' ? 'Educación' : 'Education'}
                        </p>
                        <p className="text-sm">{job.education_required}</p>
                      </div>
                    )}

                    {job.job_min_special_req && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {locale === 'pt' ? 'Requisitos Especiais' : locale === 'es' ? 'Requisitos especiales' : 'Special Requirements'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{job.job_min_special_req}</p>
                      </div>
                    )}

                    {job.job_duties && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {locale === 'pt' ? 'Funções do Trabalho' : locale === 'es' ? 'Funciones del trabajo' : 'Job Duties'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{job.job_duties}</p>
                      </div>
                    )}

                    {job.requirements && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {locale === 'pt' ? 'Requisitos' : locale === 'es' ? 'Requisitos' : 'Requirements'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{job.requirements}</p>
                      </div>
                    )}

                    {job.description && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {locale === 'pt' ? 'Descrição' : locale === 'es' ? 'Descripción' : 'Description'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{job.description}</p>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Compensation Section */}
              {(job.wage_additional || job.rec_pay_deductions) && (
                <>
                  <Separator />
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">
                      {locale === 'pt' ? 'Compensação' : locale === 'es' ? 'Compensación' : 'Compensation'}
                    </h3>

                    {job.wage_additional && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {locale === 'pt' ? 'Informações Adicionais de Salário' : locale === 'es' ? 'Información adicional de salario' : 'Additional Wage Info'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{job.wage_additional}</p>
                      </div>
                    )}

                    {job.rec_pay_deductions && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {locale === 'pt' ? 'Deduções de Pagamento' : locale === 'es' ? 'Deducciones de pago' : 'Pay Deductions'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{job.rec_pay_deductions}</p>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Benefits Section */}
              {(job.housing_info || job.transport_provided !== null || job.tools_provided !== null) && (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">
                      {locale === 'pt' ? 'Benefícios' : locale === 'es' ? 'Beneficios' : 'Benefits'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Housing */}
                      <div className="rounded-md border p-3">
                        <div className="flex items-start gap-2">
                          <Home className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {locale === 'pt' ? 'Moradia' : locale === 'es' ? 'Vivienda' : 'Housing'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {job.visa_type === 'H-2A'
                                ? job.housing_info || (locale === 'pt' ? 'Sim (H-2A Obrigatório)' : locale === 'es' ? 'Sí (H-2A Obligatorio)' : 'Yes (H-2A Mandated)')
                                : job.housing_info || (locale === 'pt' ? 'Não fornecido' : locale === 'es' ? 'No proporcionado' : 'Not provided')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Transport */}
                      <div className="rounded-md border p-3">
                        <div className="flex items-start gap-2">
                          <Bus className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {locale === 'pt' ? 'Transporte' : locale === 'es' ? 'Transporte' : 'Transport'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {job.transport_provided
                                ? (locale === 'pt' ? 'Sim' : locale === 'es' ? 'Sí' : 'Yes')
                                : (locale === 'pt' ? 'Não' : 'No')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Tools */}
                      <div className="rounded-md border p-3 sm:col-span-2">
                        <div className="flex items-start gap-2">
                          <Wrench className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {locale === 'pt' ? 'Ferramentas' : locale === 'es' ? 'Herramientas' : 'Tools'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {job.tools_provided
                                ? (locale === 'pt' ? 'Sim' : locale === 'es' ? 'Sí' : 'Yes')
                                : (locale === 'pt' ? 'Não' : 'No')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </CardContent>
          </Card>

          {/* Apply Section */}
          {!showLoginPrompt ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-semibold">
                    {locale === 'pt' 
                      ? 'Interessado nesta vaga?' 
                      : locale === 'es'
                      ? '¿Interesado en este trabajo?'
                      : 'Interested in this job?'}
                  </h3>
                  <Button onClick={handleApply} size="lg" className="w-full md:w-auto">
                    <Mail className="mr-2 h-4 w-4" />
                    {locale === 'pt' 
                      ? 'Candidatar-se por Email' 
                      : locale === 'es'
                      ? 'Aplicar por correo electrónico'
                      : 'Apply via Email'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                <div className="space-y-3">
                  <p className="font-medium">
                    {locale === 'pt' 
                      ? 'Cadastro necessário para se candidatar' 
                      : locale === 'es'
                      ? 'Registro requerido para aplicar'
                      : 'Registration required to apply'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {locale === 'pt' 
                      ? 'Para se candidatar a esta vaga, você precisa criar uma conta gratuita no H2 Linker. Com sua conta, você poderá se candidatar a múltiplas vagas rapidamente!' 
                      : locale === 'es'
                      ? 'Para aplicar a este trabajo, necesitas crear una cuenta gratuita en H2 Linker. ¡Con tu cuenta, podrás aplicar a múltiples trabajos rápidamente!'
                      : 'To apply for this job, you need to create a free H2 Linker account. With your account, you can apply to multiple jobs quickly!'}
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate('/auth?mode=signup')} size="sm">
                      {locale === 'pt' ? 'Criar Conta' : locale === 'es' ? 'Crear cuenta' : 'Sign Up'}
                    </Button>
                    <Button onClick={() => navigate('/auth')} variant="outline" size="sm">
                      {locale === 'pt' ? 'Fazer Login' : locale === 'es' ? 'Iniciar sesión' : 'Log In'}
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* CTA to browse more jobs */}
          <div className="mt-8 text-center">
            <Button onClick={() => navigate('/jobs')} variant="outline" size="lg">
              {locale === 'pt' 
                ? 'Ver Mais Vagas' 
                : locale === 'es'
                ? 'Ver más trabajos'
                : 'View More Jobs'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-12">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            <p>
              © 2025 H2 Linker • {locale === 'pt' ? 'Conectando talentos a oportunidades' : locale === 'es' ? 'Conectando talentos con oportunidades' : 'Connecting talents with opportunities'}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}