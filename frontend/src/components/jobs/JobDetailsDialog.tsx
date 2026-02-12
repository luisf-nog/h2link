import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getJobShareUrl } from "@/lib/shareUtils";
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
import {
  Mail,
  MapPin,
  Share2,
  AlertTriangle,
  Briefcase,
  DollarSign,
  ArrowRight,
  Phone,
  Plus,
  Trash2,
  Users,
  ArrowLeft,
  GraduationCap,
  Info,
  Rocket,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  Clock,
  Lock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

export type JobDetails = {
  id: string;
  job_id: string;
  visa_type: string | null;
  company: string;
  email: string;
  phone?: string | null;
  job_title: string;
  city: string;
  state: string;
  openings?: number | null;
  salary: number | null;
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
  experience_months?: number | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  pay_frequency?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
  weekly_hours?: number | null;
  job_min_special_req?: string | null;
  job_duties?: string | null;
  randomization_group?: string | null;
  was_early_access?: boolean | null;
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
  planSettings?: any;
  formatSalary: (salary: number | null) => string;
  onAddToQueue: (job: JobDetails) => void;
  onRemoveFromQueue?: (job: JobDetails) => void;
  isInQueue?: boolean;
  onShare?: (job: JobDetails) => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isBannerExpanded, setIsBannerExpanded] = useState(true);

  // BLOQUEIO SEGURO: Visitantes ou plano FREE
  const isBlurred = !planSettings || planSettings.job_db_blur === true;

  useEffect(() => {
    if (open) setIsBannerExpanded(true);
  }, [open, job?.id]);

  const badgeConfig = job ? getVisaBadgeConfig(job.visa_type) : null;

  const copyToClipboard = (text: string) => {
    if (isBlurred) return;
    navigator.clipboard.writeText(text);
    toast({ title: t("jobs.details.copied"), description: t("jobs.details.copy_success") });
  };

  const handleShare = () => {
    if (!job) return;
    const shareUrl = getJobShareUrl(job.id);
    navigator.clipboard.writeText(shareUrl);
    toast({ title: t("jobs.details.copied"), description: t("jobs.details.copy_success") });
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString(i18n.language, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  };

  // FUNÇÃO RESTAURADA
  const renderMainWage = () => {
    if (!job) return "-";
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.wage_from) return `$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.salary) return formatSalary(job.salary);
    return <span className="text-muted-foreground italic">{t("jobs.details.view_details")}</span>;
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return t("jobs.details.no_experience");
    if (months < 12) return t("jobs.table.experience_months", { count: months });
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem === 0
      ? t("jobs.table.experience_years", { count: years })
      : t("jobs.table.experience_years_months", { years, months: rem });
  };

  const cleanPhone = (phone: string) => (phone ? phone.replace(/\D/g, "") : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-screen sm:h-auto max-h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg border-0 sm:border text-left">
        {/* HEADER FIXO */}
        <div className="p-4 sm:p-6 bg-white border-b sticky top-0 z-40 shadow-sm shrink-0">
          <div className="flex sm:hidden items-center mb-3 -mt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="-ml-3 flex items-center gap-2 text-slate-600"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-base font-semibold">{t("common.back")}</span>
            </Button>
          </div>

          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {badgeConfig && (
                  <Badge variant={badgeConfig.variant} className={cn("text-[10px] sm:text-xs", badgeConfig.className)}>
                    {badgeConfig.label}
                  </Badge>
                )}
                {job?.job_id && (
                  <span className="font-mono text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {isBlurred ? `${job.job_id.substring(0, 10)}...` : job.job_id.split("-GHOST")[0]}
                    {isBlurred && <span className="ml-1 blur-[3px] select-none opacity-40">XXXXX</span>}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl sm:text-3xl leading-tight text-primary font-bold tracking-tight truncate uppercase sm:normal-case">
                {job?.job_title}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-lg text-slate-600 font-medium">
                <span className="flex items-center gap-1 text-slate-900">
                  <Briefcase className="h-4 w-4 text-slate-400" /> {job?.company}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-slate-400" /> {job?.city}, {job?.state}
                </span>
              </DialogDescription>
            </div>
            <div className="hidden sm:flex gap-2 shrink-0">
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" /> {t("jobs.details.share")}
              </Button>
              {isInQueue ? (
                <Button variant="destructive" onClick={() => job && onRemoveFromQueue?.(job)}>
                  <Trash2 className="h-4 w-4 mr-2" /> {t("jobs.details.remove")}
                </Button>
              ) : (
                <Button
                  onClick={() => job && onAddToQueue(job)}
                  className="px-6 font-bold shadow-sm"
                  disabled={isBlurred}
                >
                  {isBlurred && <Lock className="h-4 w-4 mr-2" />} {t("jobs.details.save_job")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ÁREA DE SCROLL */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 touch-auto">
          <div className="p-4 sm:p-6 space-y-6 pb-32 sm:pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                {/* TIMELINE RESTAURADA (3 DATAS) */}
                <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-center">
                    <span className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                      {t("jobs.details.posted")}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">{formatDate(job?.posted_date)}</span>
                  </div>
                  <div className="text-center border-x border-slate-100">
                    <span className="block text-[9px] font-bold uppercase text-green-600 mb-1">
                      {t("jobs.details.start")}
                    </span>
                    <span className="text-[11px] font-bold text-green-700">{formatDate(job?.start_date)}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[9px] font-bold uppercase text-red-600 mb-1">
                      {t("jobs.details.end")}
                    </span>
                    <span className="text-[11px] font-semibold text-red-700">{formatDate(job?.end_date)}</span>
                  </div>
                </div>

                {/* EXPERIÊNCIA */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t("jobs.details.experience")}
                    </span>
                    <span className="text-xl font-bold text-slate-800">{formatExperience(job?.experience_months)}</span>
                  </div>
                </div>

                {/* SALÁRIO / DEDUÇÕES / ADICIONAIS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <span className="font-semibold text-sm text-slate-600">
                        {t("jobs.details.available_positions")}
                      </span>
                      <Badge className="bg-blue-600 font-bold px-3">{job?.openings || "N/A"}</Badge>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                        <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                      </div>
                      <p className="text-3xl font-extrabold text-green-700 tracking-tight">{renderMainWage()}</p>
                      {job?.pay_frequency && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {t("jobs.details.pay_frequency", { frequency: job.pay_frequency })}
                        </span>
                      )}
                    </div>
                    {job?.wage_additional && (
                      <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-green-800 text-xs font-medium">
                        {job.wage_additional}
                      </div>
                    )}
                  </div>
                  {job?.rec_pay_deductions && (
                    <div className="bg-red-50 border-t border-red-100 p-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase mb-1">
                        <AlertTriangle className="h-3 w-3" /> {t("jobs.details.deductions")}
                      </span>
                      <p className="text-xs text-red-800 font-medium">{job.rec_pay_deductions}</p>
                    </div>
                  )}
                </div>

                {/* CARGA HORÁRIA */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="bg-amber-50 p-3 rounded-full text-amber-600">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t("jobs.details.weekly_hours")}
                    </span>
                    <span className="text-xl font-bold text-slate-800">
                      {job?.weekly_hours ? `${job.weekly_hours}h` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* CONTATOS COM BLUR AGRESSIVO */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest">
                    <Mail className="h-4 w-4 text-blue-500" /> {t("jobs.details.company_contacts")}
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {t("jobs.details.email_label")}
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex-1 font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 select-none",
                            isBlurred && "blur-[12px] opacity-20 pointer-events-none",
                          )}
                        >
                          {isBlurred ? "protected@employer-info.com" : job?.email}
                        </div>
                        {!isBlurred && (
                          <Button variant="ghost" size="icon" onClick={() => job?.email && copyToClipboard(job.email)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {job?.phone && (
                      <div className="space-y-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          {t("jobs.details.phone_label")}
                        </span>
                        <div
                          className={cn(
                            "font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 select-none",
                            isBlurred && "blur-[12px] opacity-20 pointer-events-none",
                          )}
                        >
                          {isBlurred ? "+1 (XXX) XXX-XXXX" : job.phone}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 gap-2 font-bold"
                            disabled={isBlurred}
                            asChild={!isBlurred}
                          >
                            {isBlurred ? (
                              <>
                                <Lock className="h-3.5 w-3.5 text-amber-500" /> {t("jobs.details.call_action")}
                              </>
                            ) : (
                              <a href={`tel:${job.phone}`}>
                                <Phone className="h-3.5 w-3.5" /> {t("jobs.details.call_action")}
                              </a>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 gap-2 font-bold border-green-200 text-green-700"
                            disabled={isBlurred}
                            asChild={!isBlurred}
                          >
                            {isBlurred ? (
                              <>
                                <Lock className="h-3.5 w-3.5 text-amber-500" /> WhatsApp
                              </>
                            ) : (
                              <a href={`https://wa.me/${job.phone}`} target="_blank">
                                <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                              </a>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    {isBlurred && (
                      <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold py-5 h-auto text-xs animate-pulse">
                        <Rocket className="h-4 w-4 mr-2" /> {t("jobs.upgrade.cta")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA (DESCRIÇÕES BLOQUEADAS PARA VISITANTES) */}
              <div className="lg:col-span-8 space-y-6">
                {job?.job_min_special_req && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 shadow-sm">
                    <h4 className="flex items-center gap-2 font-bold text-amber-900 mb-3 text-lg">
                      <AlertTriangle className="h-5 w-5" /> {t("jobs.details.special_reqs")}
                    </h4>
                    <div
                      className={cn("relative", isBlurred && "blur-[15px] select-none pointer-events-none opacity-20")}
                    >
                      <p className="text-sm sm:text-base text-amber-900 leading-relaxed whitespace-pre-wrap text-left">
                        {isBlurred
                          ? "This information is protected to prevent unauthorized access. Please upgrade your plan to Gold or Diamond to view the specific requirements for this employer."
                          : job.job_min_special_req}
                      </p>
                    </div>
                  </div>
                )}

                {job?.job_duties && (
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 px-1">
                      <Briefcase className="h-6 w-6 text-blue-600" /> {t("jobs.details.job_description")}
                    </h4>
                    <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                      <div
                        className={cn(
                          "transition-all duration-700",
                          isBlurred && "blur-[20px] select-none pointer-events-none opacity-10",
                        )}
                      >
                        <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap text-left">
                          {isBlurred
                            ? "The full job description and duties are currently hidden. Gold members have full access to employer intelligence and verified job descriptions. Subscribe now to unlock and start applying."
                            : job.job_duties}
                        </p>
                      </div>
                      {isBlurred && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                          <div className="text-center">
                            <Lock className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-600">{t("jobs.upgrade.title")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER FIXO MOBILE */}
        <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 z-50 shadow-lg">
          <Button
            className="flex-1 font-bold h-12 text-base"
            onClick={() => job && onAddToQueue(job)}
            disabled={isBlurred}
          >
            {isBlurred && <Lock className="h-4 w-4 mr-2" />} {t("jobs.details.save_job")}
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleShare}>
            <Share2 className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
