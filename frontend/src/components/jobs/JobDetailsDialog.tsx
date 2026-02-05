import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { isMobileNumber, getWhatsAppUrl, getSmsUrl, getPhoneCallUrl } from "@/lib/phone";
import { Bus, Calendar, Home, Mail, MapPin, MessageCircle, Phone, PhoneCall, Plus, Trash2, Wrench, Share2, AlertTriangle } from "lucide-react";
import { Briefcase, Clock, DollarSign, GraduationCap, Car, Utensils, Shield, Weight, FileCheck, Building2, Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
import { getJobShareUrl } from "@/lib/shareUtils";

export type JobDetails = {
  id: string;
  job_id: string;
  visa_type: "H-2B" | "H-2A" | string | null;
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
  crop_activities?: string | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  pay_frequency?: string | null;
  overtime_available?: boolean | null;
  overtime_from?: number | null;
  overtime_to?: number | null;
  transport_min_reimburse?: number | null;
  transport_max_reimburse?: number | null;
  transport_desc?: string | null;
  housing_type?: string | null;
  housing_addr?: string | null;
  housing_city?: string | null;
  housing_state?: string | null;
  housing_zip?: string | null;
  housing_capacity?: number | null;
  is_meal_provision?: boolean | null;
  meal_charge?: number | null;
  training_months?: number | null;
  job_is_lifting?: boolean | null;
  job_lifting_weight?: string | null;
  job_is_drug_screen?: boolean | null;
  job_is_background?: boolean | null;
  job_is_driver?: boolean | null;
  shift_start?: string | null;
  shift_end?: string | null;
};

type PlanSettings = {
  job_db_access: string;
  show_housing_icons: boolean;
};

export function JobDetailsDialog({
  open,
  onOpenChange,
  job,
  planSettings,
  formatSalary,
  onAddToQueue,
  onRemoveFromQueue,
  isInQueue,
  onShare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDetails | null;
  planSettings: PlanSettings;
  formatSalary: (salary: number | null) => string;
  onAddToQueue: (job: JobDetails) => void;
  onRemoveFromQueue?: (job: JobDetails) => void;
  isInQueue?: boolean;
  onShare?: (job: JobDetails) => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const badgeConfig = job ? getVisaBadgeConfig(job.visa_type) : null;

  const handleShare = () => {
    if (!job) return;
    
    if (onShare) {
      onShare(job);
    } else {
      // Use production domain for sharing
      const shareUrl = getJobShareUrl(job.id);
      
      if (navigator.share) {
        navigator.share({
          title: `${job.job_title} - ${job.company}`,
          text: `${t('jobs.shareText')}: ${job.job_title}`,
          url: shareUrl,
        }).catch(() => {
          copyToClipboard(shareUrl);
        });
      } else {
        copyToClipboard(shareUrl);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    const locale = i18n.resolvedLanguage || i18n.language;
    toast({
      title: locale === 'pt' ? 'Link copiado!' : locale === 'es' ? '¡Enlace copiado!' : 'Link copied!',
      description: locale === 'pt' 
        ? 'Link de compartilhamento copiado para área de transferência' 
        : locale === 'es'
        ? 'Enlace copiado al portapapeles'
        : 'Share link copied to clipboard',
    });
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString(i18n.language, { timeZone: "UTC" });
  };

  const yesNo = (v: boolean | null | undefined) => {
    if (v === true) return t("common.yes");
    if (v === false) return t("common.no");
    return "-";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="mr-2">{job?.job_title}</DialogTitle>
              {badgeConfig && (
                <Badge 
                  variant={badgeConfig.variant}
                  className={badgeConfig.className}
                >
                  {badgeConfig.label}
                </Badge>
              )}
              {job?.category && <Badge variant="outline">{job.category}</Badge>}
            </div>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-foreground/90">{job?.company}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job?.city}, {job?.state}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Early Access Disclaimer */}
        {job && isEarlyAccess(job.visa_type) && (
          <Alert variant="destructive" className="bg-purple-50 border-purple-200">
            <AlertTriangle className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-900">
              {getEarlyAccessDisclaimer(i18n.language)}
            </AlertDescription>
          </Alert>
        )}

        {/* Scrollable body */}
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          <div className="space-y-5">
            {/* Two Column Layout for Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Left Column - Core Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  {t("job_details.sections.job_info")}
                </h4>
                <div className="space-y-3 pl-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.openings")}</span>
                    <span className="text-sm font-medium">{job?.openings ?? "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.experience")}</span>
                    <span className="text-sm font-medium">
                      {job?.experience_months != null
                        ? t("job_details.values.months", { count: job.experience_months })
                        : "-"}
                    </span>
                  </div>
                  {job?.training_months != null && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("job_details.fields.training")}</span>
                      <span className="text-sm font-medium">
                        {t("job_details.values.months", { count: job.training_months })}
                      </span>
                    </div>
                  )}
                  {job?.crop_activities && (
                    <div className="flex justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{t("job_details.fields.crop_activities")}</span>
                      <span className="text-sm font-medium text-right">{job.crop_activities}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Schedule & Dates */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {t("job_details.sections.schedule")}
                </h4>
                <div className="space-y-3 pl-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.weekly_hours")}</span>
                    <span className="text-sm font-medium">{job?.weekly_hours ? `${job.weekly_hours}h` : "-"}</span>
                  </div>
                  {(job?.shift_start || job?.shift_end) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("job_details.fields.shift")}</span>
                      <span className="text-sm font-medium">
                        {job?.shift_start || "-"} - {job?.shift_end || "-"}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.start_date")}</span>
                    <span className="text-sm font-medium">{formatDate(job?.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.end_date")}</span>
                    <span className="text-sm font-medium">{formatDate(job?.end_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.posted_date")}</span>
                    <span className="text-sm font-medium">{formatDate(job?.posted_date)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Two Column Layout for Compensation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Left Column - Wages */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  {t("job_details.sections.wages")}
                </h4>
                <div className="space-y-3 pl-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.salary")}</span>
                    <span className="text-sm font-medium">{formatSalary(job?.salary ?? null)}</span>
                  </div>
                  {(job?.wage_from || job?.wage_to) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("job_details.fields.wage_range")}</span>
                      <span className="text-sm font-medium">
                        ${job?.wage_from?.toFixed(2) || "?"} - ${job?.wage_to?.toFixed(2) || "?"}/{job?.wage_unit || "Hour"}
                      </span>
                    </div>
                  )}
                  {job?.pay_frequency && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("job_details.fields.pay_frequency")}</span>
                      <span className="text-sm font-medium">{job.pay_frequency}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Overtime */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {t("job_details.sections.overtime")}
                </h4>
                <div className="space-y-3 pl-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("job_details.fields.overtime_available")}</span>
                    <span className="text-sm font-medium">{yesNo(job?.overtime_available)}</span>
                  </div>
                  {job?.overtime_salary && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("job_details.fields.overtime")}</span>
                      <span className="text-sm font-medium">${Number(job.overtime_salary).toFixed(2)}/h</span>
                    </div>
                  )}
                  {(job?.overtime_from || job?.overtime_to) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("job_details.fields.overtime_range")}</span>
                      <span className="text-sm font-medium">
                        ${job?.overtime_from?.toFixed(2) || "?"} - ${job?.overtime_to?.toFixed(2) || "?"}/h
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("job_details.sections.contact")}</h3>
              <div className="rounded-md border p-3">
                <div className="flex flex-col gap-2">
                  <div className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{job?.email}</span>
                  </div>

                  {job?.phone && (
                    <div className="inline-flex items-center gap-2 flex-wrap">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{job.phone}</span>
                      
                      {/* SMS/iMessage button - works on all phones, uses iMessage on iOS if available */}
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
                            <p>{t("job_details.contact.message")}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Call button */}
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
                            <p>{t("job_details.contact.call")}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {/* WhatsApp icon - only for countries where WhatsApp is common */}
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
                              <svg 
                                viewBox="0 0 24 24" 
                                className="h-3.5 w-3.5 text-white fill-current"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("job_details.contact.whatsapp")}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {t("job_details.fields.job_id")}: <span className="font-mono">{job?.job_id}</span>
                  </p>
                </div>
              </div>
            </section>

            {(job?.worksite_address || job?.worksite_zip) && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.worksite")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {job.worksite_address}
                    {job.worksite_zip ? ` — ${job.worksite_zip}` : ""}
                  </p>
                </section>
              </>
            )}

            {(job?.description || job?.requirements || job?.education_required || job?.job_duties || job?.job_min_special_req) && (
              <>
                <Separator />
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.details")}</h3>

                  {job?.education_required && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.education")}</p>
                      <p className="text-sm">{job.education_required}</p>
                    </div>
                  )}

                  {job?.requirements && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.requirements")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.requirements}</p>
                    </div>
                  )}

                  {job?.job_min_special_req && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.special_requirements")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.job_min_special_req}</p>
                    </div>
                  )}

                  {job?.job_duties && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.job_duties")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.job_duties}</p>
                    </div>
                  )}

                  {job?.description && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.description")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                </section>
              </>
            )}

            {(job?.wage_additional || job?.rec_pay_deductions) && (
              <>
                <Separator />
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("job_details.sections.compensation")}</h3>

                  {job?.wage_additional && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.wage_additional")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.wage_additional}</p>
                    </div>
                  )}

                  {job?.rec_pay_deductions && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("job_details.fields.pay_deductions")}</p>
                      <p className="text-sm whitespace-pre-wrap">{job.rec_pay_deductions}</p>
                    </div>
                  )}
                </section>
              </>
            )}

            {(planSettings.job_db_access === "text_only" ||
              planSettings.job_db_access === "visual_premium") && (
              <>
                <Separator />
                {/* Two Column Layout for Benefits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Left Column - Housing */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      {t("job_details.sections.housing")}
                    </h4>
                    <div className="space-y-3 pl-6">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t("job_details.fields.housing")}</span>
                        <span className="text-sm font-medium">
                          {job?.visa_type === 'H-2A'
                            ? job?.housing_info || t("job_details.values.housing_required_h2a")
                            : job?.housing_info || yesNo(!!job?.housing_type)}
                        </span>
                      </div>
                      {job?.housing_type && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{t("job_details.fields.housing_type")}</span>
                          <span className="text-sm font-medium">{job.housing_type}</span>
                        </div>
                      )}
                      {job?.housing_capacity && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{t("job_details.fields.housing_capacity")}</span>
                          <span className="text-sm font-medium">{job.housing_capacity}</span>
                        </div>
                      )}
                      {(job?.housing_city || job?.housing_state) && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{t("job_details.fields.housing_location")}</span>
                          <span className="text-sm font-medium">
                            {[job?.housing_city, job?.housing_state].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t("job_details.fields.meals")}</span>
                        <span className="text-sm font-medium">
                          {job?.is_meal_provision 
                            ? (job?.meal_charge ? `${t("common.yes")} ($${job.meal_charge})` : t("common.yes"))
                            : t("common.no")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Transport & Tools */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary" />
                      {t("job_details.sections.transport_tools")}
                    </h4>
                    <div className="space-y-3 pl-6">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t("job_details.fields.transport")}</span>
                        <span className="text-sm font-medium">{yesNo(job?.transport_provided)}</span>
                      </div>
                      {job?.transport_desc && (
                        <div className="text-sm text-muted-foreground">{job.transport_desc}</div>
                      )}
                      {(job?.transport_min_reimburse || job?.transport_max_reimburse) && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{t("job_details.fields.transport_reimburse")}</span>
                          <span className="text-sm font-medium">
                            ${job?.transport_min_reimburse || 0} - ${job?.transport_max_reimburse || 0}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t("job_details.fields.tools")}</span>
                        <span className="text-sm font-medium">{yesNo(job?.tools_provided)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Physical Requirements Section */}
                {(job?.job_is_lifting || job?.job_is_drug_screen || job?.job_is_background || job?.job_is_driver) && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {t("job_details.sections.physical_requirements")}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-6">
                        {job?.job_is_lifting && (
                          <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                            <Weight className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-center">{t("job_details.fields.lifting")}</span>
                            {job?.job_lifting_weight && (
                              <span className="text-xs font-medium">{job.job_lifting_weight}</span>
                            )}
                          </div>
                        )}
                        {job?.job_is_drug_screen && (
                          <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                            <FileCheck className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-center">{t("job_details.fields.drug_screen")}</span>
                          </div>
                        )}
                        {job?.job_is_background && (
                          <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-center">{t("job_details.fields.background_check")}</span>
                          </div>
                        )}
                        {job?.job_is_driver && (
                          <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                            <Car className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-center">{t("job_details.fields.driver_required")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-2">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleShare}
              className="flex-1"
            >
              <Share2 className="h-4 w-4 mr-2" />
              {t("common.share")}
            </Button>
            {isInQueue ? (
              <Button 
                className="flex-1" 
                variant="destructive"
                onClick={() => job && onRemoveFromQueue?.(job)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("job_details.actions.remove_from_queue")}
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => job && onAddToQueue(job)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("job_details.actions.add_to_queue")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
