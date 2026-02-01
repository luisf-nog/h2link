import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isMobileNumber, getWhatsAppUrl, getSmsUrl, getPhoneCallUrl } from '@/lib/phone';
import { 
  ArrowLeft,
  Bus, 
  Calendar, 
  Home, 
  Mail, 
  MapPin, 
  MessageCircle, 
  Phone, 
  PhoneCall, 
  Plus, 
  Trash2, 
  Wrench,
  Share2,
  Check,
  DollarSign,
  Users,
  Clock,
  ExternalLink,
  Building2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import type { JobDetails } from './JobDetailsDialog';

interface JobDetailsContentProps {
  job: JobDetails;
  formatSalary: (salary: number | null) => string;
  onAddToQueue: (job: JobDetails) => void;
  onRemoveFromQueue?: (job: JobDetails) => void;
  isInQueue?: boolean;
  showBackButton?: boolean;
  showSeoMeta?: boolean;
}

export function JobDetailsContent({
  job,
  formatSalary,
  onAddToQueue,
  onRemoveFromQueue,
  isInQueue,
  showBackButton = true,
  showSeoMeta = false,
}: JobDetailsContentProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isH2A = job.visa_type === 'H-2A';

  const formatDate = (v: string | null | undefined) => {
    if (!v) return '-';
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString(i18n.language, { timeZone: 'UTC' });
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return t('jobs.details.no_experience');
    if (months < 12) return t('jobs.table.experience_months', { count: months });
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return t('jobs.table.experience_years', { count: years });
    return t('jobs.table.experience_years_months', { years, months: remainingMonths });
  };

  const yesNo = (v: boolean | null | undefined) => {
    if (v === true) return t('common.yes');
    if (v === false) return t('common.no');
    return '-';
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/vaga/${job.id}`;
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

  const metaTitle = `${job.job_title} em ${job.city}/${job.state} | Visto ${job.visa_type || 'H-2'} - H2 Linker`;
  const metaDescription = `Confira os detalhes desta vaga para ${job.job_title} na empresa ${job.company}. Automatize sua candidatura com IA através do H2 Linker.`;

  return (
    <>
      {showSeoMeta && (
        <Helmet>
          <title>{metaTitle}</title>
          <meta name="description" content={metaDescription} />
          <meta property="og:title" content={metaTitle} />
          <meta property="og:description" content={metaDescription} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`${window.location.origin}/vaga/${job.id}`} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={metaTitle} />
          <meta name="twitter:description" content={metaDescription} />
        </Helmet>
      )}

      <div className="space-y-6">
        {/* Header with back button */}
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/jobs')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('jobs.details.back')}
          </Button>
        )}

        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {job.visa_type && (
                <Badge variant={isH2A ? 'secondary' : 'outline'}>{job.visa_type}</Badge>
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
            {isInQueue ? (
              onRemoveFromQueue && (
                <Button variant="destructive" size="sm" onClick={() => onRemoveFromQueue(job)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('job_details.actions.remove_from_queue')}
                </Button>
              )
            ) : (
              <Button size="sm" onClick={() => onAddToQueue(job)}>
                {isInQueue ? (
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
            )}
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">{t('jobs.details.salary')}</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {formatSalary(job.salary)}
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
            <CardTitle className="text-base">{t('job_details.sections.contact')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{job.email}</span>
            </div>
            
            {job.phone && (
              <div className="flex items-center gap-2 flex-wrap">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{job.phone}</span>
                
                {getSmsUrl(job.phone) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={getSmsUrl(job.phone)!}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary hover:bg-primary/80 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('job_details.contact.message')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {getPhoneCallUrl(job.phone) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={getPhoneCallUrl(job.phone)!}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('job_details.contact.call')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {isMobileNumber(job.phone) && getWhatsAppUrl(job.phone) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={getWhatsAppUrl(job.phone)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#25D366] hover:bg-[#128C7E] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white fill-current">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('job_details.contact.whatsapp')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}

            {(job.worksite_address || job.worksite_zip) && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">
                  {job.worksite_address}
                  {job.worksite_zip ? `, ${job.worksite_zip}` : ''}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {t('job_details.fields.job_id')}: <span className="font-mono">{job.job_id}</span>
            </p>
          </CardContent>
        </Card>

        {/* Description & Requirements */}
        {(job.description || job.requirements || job.education_required || job.job_duties || job.job_min_special_req) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('job_details.sections.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.education_required && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('job_details.fields.education')}</p>
                  <p className="text-sm">{job.education_required}</p>
                </div>
              )}

              {job.requirements && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('job_details.fields.requirements')}</p>
                  <p className="text-sm whitespace-pre-wrap">{job.requirements}</p>
                </div>
              )}

              {job.job_min_special_req && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('job_details.fields.special_requirements')}</p>
                  <p className="text-sm whitespace-pre-wrap">{job.job_min_special_req}</p>
                </div>
              )}

              {job.job_duties && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('job_details.fields.job_duties')}</p>
                  <p className="text-sm whitespace-pre-wrap">{job.job_duties}</p>
                </div>
              )}

              {job.description && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('job_details.fields.description')}</p>
                  <p className="text-sm whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Compensation */}
        {(job.wage_additional || job.rec_pay_deductions) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('job_details.sections.compensation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.wage_additional && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('job_details.fields.wage_additional')}</p>
                  <p className="text-sm whitespace-pre-wrap">{job.wage_additional}</p>
                </div>
              )}

              {job.rec_pay_deductions && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('job_details.fields.pay_deductions')}</p>
                  <p className="text-sm whitespace-pre-wrap">{job.rec_pay_deductions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('job_details.sections.benefits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-start gap-2">
                  <Home className={cn("h-4 w-4 mt-0.5", isH2A ? "text-secondary-foreground" : "text-muted-foreground")} />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('job_details.fields.housing')}</p>
                    <p className="text-sm text-muted-foreground">
                      {isH2A
                        ? job.housing_info || t('job_details.values.housing_required_h2a')
                        : job.housing_info || t('job_details.values.not_provided')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-start gap-2">
                  <Bus className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('job_details.fields.transport')}</p>
                    <p className="text-sm text-muted-foreground">{yesNo(job.transport_provided)}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 sm:col-span-2">
                <div className="flex items-start gap-2">
                  <Wrench className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('job_details.fields.tools')}</p>
                    <p className="text-sm text-muted-foreground">{yesNo(job.tools_provided)}</p>
                  </div>
                </div>
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
    </>
  );
}
