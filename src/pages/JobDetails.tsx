import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthRequiredDialog } from '@/components/auth/AuthRequiredDialog';
import { 
  ArrowLeft, 
  MapPin, 
  Building2, 
  DollarSign, 
  Calendar, 
  Users, 
  Clock,
  Mail,
  Phone,
  Share2,
  Plus,
  Check,
  ExternalLink
} from 'lucide-react';

interface JobDetails {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  city: string;
  state: string;
  email: string;
  phone: string | null;
  salary: number | null;
  openings: number | null;
  visa_type: string | null;
  category: string | null;
  posted_date: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  requirements: string | null;
  job_duties: string | null;
  experience_months: number | null;
  housing_info: string | null;
  transport_provided: boolean | null;
  tools_provided: boolean | null;
  source_url: string | null;
  worksite_address: string | null;
  worksite_zip: string | null;
}

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isQueued, setIsQueued] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      
      setLoading(true);
      const { data, error } = await supabase
        .from('public_jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching job:', error);
        navigate('/404');
        return;
      }

      setJob(data as JobDetails);
      setLoading(false);

      // Check if already in queue (only for authenticated users)
      if (profile?.id) {
        const { data: queueData } = await supabase
          .from('my_queue')
          .select('id')
          .eq('user_id', profile.id)
          .eq('job_id', id)
          .maybeSingle();

        setIsQueued(!!queueData);
      }
    };

    fetchJob();
  }, [id, profile?.id, navigate]);

  const handleAddToQueue = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    if (!job || !profile?.id || isQueued) return;

    setAddingToQueue(true);
    const { error } = await supabase.from('my_queue').insert({
      user_id: profile.id,
      job_id: job.id,
    });

    if (error) {
      if (error.code === '23505') {
        setIsQueued(true);
        toast({
          title: t('jobs.toasts.already_in_queue_title'),
          description: t('jobs.toasts.already_in_queue_desc'),
        });
      } else {
        toast({
          title: t('jobs.toasts.add_error_title'),
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      setIsQueued(true);
      toast({
        title: t('jobs.toasts.add_success_title'),
        description: t('jobs.toasts.add_success_desc', { jobTitle: job.job_title }),
      });
    }
    setAddingToQueue(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t('jobs.share.copied_title'),
        description: t('jobs.share.copied_desc'),
      });
    } catch {
      toast({
        title: t('jobs.share.error_title'),
        description: t('jobs.share.error_desc'),
        variant: 'destructive',
      });
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    const d = new Date(`${date}T00:00:00Z`);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const formatExperience = (months: number | null) => {
    if (!months || months <= 0) return t('jobs.details.no_experience');
    if (months < 12) return t('jobs.table.experience_months', { count: months });
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return t('jobs.table.experience_years', { count: years });
    return t('jobs.table.experience_years_months', { years, months: remainingMonths });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!job) return null;

  const metaTitle = `${job.job_title} em ${job.city}/${job.state} | Visto ${job.visa_type || 'H-2'} - H2 Linker`;
  const metaDescription = `Confira os detalhes desta vaga para ${job.job_title} na empresa ${job.company}. Automatize sua candidatura com IA através do H2 Linker.`;

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/jobs')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('jobs.details.back')}
            </Button>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {job.visa_type && (
                    <Badge variant="secondary">{job.visa_type}</Badge>
                  )}
                  {job.category && (
                    <Badge variant="outline">{job.category}</Badge>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{job.job_title}</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{job.company}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{job.city}, {job.state}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  {t('jobs.details.share')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddToQueue}
                  disabled={isQueued || addingToQueue}
                >
                  {isQueued ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {t('jobs.details.added')}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('jobs.details.add_to_queue')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">{t('jobs.details.salary')}</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {job.salary ? `$${job.salary.toFixed(2)}/h` : '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">{t('jobs.details.openings')}</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {job.openings ?? '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">{t('jobs.details.start_date')}</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {formatDate(job.start_date)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">{t('jobs.details.experience')}</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {formatExperience(job.experience_months)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('jobs.details.contact')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{job.email}</span>
              </div>
              {job.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{job.phone}</span>
                </div>
              )}
              {job.worksite_address && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{job.worksite_address}{job.worksite_zip ? `, ${job.worksite_zip}` : ''}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {job.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('jobs.details.description')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{job.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Job Duties */}
          {job.job_duties && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('jobs.details.duties')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{job.job_duties}</p>
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          {job.requirements && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('jobs.details.requirements')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{job.requirements}</p>
              </CardContent>
            </Card>
          )}

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('jobs.details.benefits')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {job.housing_info && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-foreground">{t('jobs.details.housing')}</p>
                    <p className="text-sm text-muted-foreground">{job.housing_info}</p>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-foreground">{t('jobs.details.transport')}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.transport_provided ? t('common.yes') : t('common.no')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-foreground">{t('jobs.details.tools')}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.tools_provided ? t('common.yes') : t('common.no')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source */}
          {job.source_url && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('jobs.details.source')}</span>
                  <Button variant="link" size="sm" asChild>
                    <a href={job.source_url} target="_blank" rel="noopener noreferrer">
                      {t('jobs.details.view_original')}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Posted Date */}
          <p className="text-center text-sm text-muted-foreground">
            {t('jobs.details.posted_on', { date: formatDate(job.posted_date) })}
          </p>
        </div>
      </div>

      <AuthRequiredDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
        action="queue"
      />
    </>
  );
}
