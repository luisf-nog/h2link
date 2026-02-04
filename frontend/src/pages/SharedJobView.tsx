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
  Share2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { JobMetaTags } from '@/components/jobs/JobMetaTags';
import { useToast } from '@/hooks/use-toast';
import { getVisaBadgeConfig } from '@/lib/visaTypes';
import { getJobShareUrl, getShortShareUrl } from '@/lib/shareUtils';

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
    if (!jobId) return;
    
    // Use friendly share URL
    const shareUrl = getJobShareUrl(jobId);
    
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

  const badgeConfig = getVisaBadgeConfig(job.visa_type);

  return (
    <>
      <JobMetaTags job={job} />
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header */}
        <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/jobs')}>
              <BrandLogo className="h-10 w-10" />
              <div>
                <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  H2 Linker
                </span>
                <p className="text-xs text-muted-foreground hidden sm:block">Job Opportunities Platform</p>
              </div>
            </div>
            <Button onClick={handleShare} variant="outline" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {locale === 'pt' ? 'Compartilhar' : locale === 'es' ? 'Compartir' : 'Share'}
              </span>
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Hero Card */}
          <Card className="mb-6 overflow-hidden border-none shadow-xl bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/20 dark:bg-purple-900/10 rounded-full blur-3xl -z-0" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-3xl -z-0" />
            
            <CardHeader className="relative z-10 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge 
                      variant={badgeConfig.variant}
                      className={`${badgeConfig.className} text-sm px-3 py-1`}
                    >
                      {badgeConfig.label}
                    </Badge>
                    {job.category && (
                      <Badge variant="outline" className="text-sm">{job.category}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    {job.job_title}
                  </CardTitle>
                  <CardDescription className="text-xl font-medium text-gray-700 dark:text-gray-300">
                    {job.company}
                  </CardDescription>
                </div>
              </div>
              
              {/* Share URL Display */}
              <div className="mt-4 flex items-center gap-2 p-3 bg-white/60 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs text-muted-foreground mb-1">
                    {locale === 'pt' ? 'Link de compartilhamento' : locale === 'es' ? 'Enlace para compartir' : 'Share link'}
                  </p>
                  <p className="text-sm font-mono text-blue-600 dark:text-blue-400 truncate">
                    {getShortShareUrl(jobId || '')}
                  </p>
                </div>
                <Button 
                  onClick={() => copyToClipboard(getJobShareUrl(jobId || ''))} 
                  size="sm" 
                  variant="ghost"
                  className="shrink-0"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              {/* Key Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {locale === 'pt' ? 'Localização' : locale === 'es' ? 'Ubicación' : 'Location'}
                    </div>
                    <div className="font-medium">{job.city}, {job.state}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {locale === 'pt' ? 'Salário' : locale === 'es' ? 'Salario' : 'Salary'}
                    </div>
                    <div className="font-medium">{formatSalary(job.salary)}/hr</div>
                  </div>
                </div>

                {job.start_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {locale === 'pt' ? 'Data de Início' : locale === 'es' ? 'Fecha de inicio' : 'Start Date'}
                      </div>
                      <div className="font-medium">{formatDate(job.start_date)}</div>
                    </div>
                  </div>
                )}

                {job.openings && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {locale === 'pt' ? 'Vagas' : locale === 'es' ? 'Vacantes' : 'Openings'}
                      </div>
                      <div className="font-medium">{job.openings}</div>
                    </div>
                  </div>
                )}

                {job.weekly_hours && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {locale === 'pt' ? 'Horas/Semana' : locale === 'es' ? 'Horas/Semana' : 'Hours/Week'}
                      </div>
                      <div className="font-medium">{job.weekly_hours}h</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Benefits Icons */}
              {(job.housing_info || job.transport_provided || job.tools_provided) && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-4">
                    {job.housing_info && (
                      <div className="flex items-center gap-2 text-sm">
                        <Home className="h-4 w-4 text-green-600" />
                        <span>{locale === 'pt' ? 'Moradia' : locale === 'es' ? 'Vivienda' : 'Housing'}</span>
                      </div>
                    )}
                    {job.transport_provided && (
                      <div className="flex items-center gap-2 text-sm">
                        <Bus className="h-4 w-4 text-blue-600" />
                        <span>{locale === 'pt' ? 'Transporte' : locale === 'es' ? 'Transporte' : 'Transport'}</span>
                      </div>
                    )}
                    {job.tools_provided && (
                      <div className="flex items-center gap-2 text-sm">
                        <Wrench className="h-4 w-4 text-orange-600" />
                        <span>{locale === 'pt' ? 'Ferramentas' : locale === 'es' ? 'Herramientas' : 'Tools'}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Description */}
              {job.description && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">
                      {locale === 'pt' ? 'Descrição' : locale === 'es' ? 'Descripción' : 'Description'}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {job.description}
                    </p>
                  </div>
                </>
              )}

              {/* Requirements */}
              {job.requirements && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">
                      {locale === 'pt' ? 'Requisitos' : locale === 'es' ? 'Requisitos' : 'Requirements'}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {job.requirements}
                    </p>
                  </div>
                </>
              )}

              {/* Housing Info Detail */}
              {job.housing_info && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">
                      {locale === 'pt' ? 'Informações de Moradia' : locale === 'es' ? 'Información de vivienda' : 'Housing Information'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {job.housing_info}
                    </p>
                  </div>
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