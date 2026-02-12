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
  MessageSquare,
  ArrowLeft,
  GraduationCap,
  Info,
  Rocket,
  Zap,
  ChevronDown,
  ChevronUp,
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
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
  source_url?: string | null;
  experience_months?: number | null;
  description?: string | null;
  requirements?: string | null;
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
  transport_provided?: boolean | null;
  housing_info?: string | null;
  job_min_special_req?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
  education_required?: string | null;
  job_is_lifting?: boolean | null;
  job_lifting_weight?: string | null;
  job_is_drug_screen?: boolean | null;
  job_is_background?: boolean | null;
  job_is_driver?: boolean | null;
  weekly_hours?: number | null;
  shift_start?: string | null;
  shift_end?: string | null;
  job_duties?: string | null;
  website?: string | null;
  randomization_group?: string | null;
  was_early_access?: boolean | null;
};

type PlanSettings = {
  job_db_access: string;
  show_housing_icons: boolean;
  job_db_blur?: boolean;
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

  const [isBannerExpanded, setIsBannerExpanded] = useState(true);

  useEffect(() => {
    if (open) setIsBannerExpanded(true);
  }, [open, job?.id]);

  const handleShare = () => {
    if (!job) return;
    if (onShare) onShare(job);
    else {
      const shareUrl = getJobShareUrl(job.id);
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("jobs.details.copied", "Copied!"),
      description: t("jobs.details.copy_success", "Text copied to clipboard."),
    });
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString(i18n.language, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  };

  const renderMainWage = () => {
    if (!job) return "-";
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.wage_from) return `$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.salary) return formatSalary(job.salary);
    return <span className="text-muted-foreground italic">{t("jobs.details.view_details", "View Details")}</span>;
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return t("jobs.details.no_experience", "None");
    if (months < 12) return t("jobs.table.experience_months", { count: months });
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return t("jobs.table.experience_years", { count: years });
    return t("jobs.table.experience_years_months", { years, months: remainingMonths });
  };

  const cleanPhone = (phone: string) => (phone ? phone.replace(/\D/g, "") : "");

  const getMessage = () => {
    if (!job) return "";
    const location = job.city && job.state ? ` in ${job.city}, ${job.state}` : "";
    return `Hello, I am interested in the ${job.job_title} position at ${job.company}${location}. I would like to apply. Please let me know the next steps. Thank you.`;
  };

  const messageText = getMessage();
  const encodedMessage = encodeURIComponent(messageText);

  const getGroupBadgeConfig = (group: string) => {
    const g = group.toUpperCase();
    if (g === "A")
      return {
        className: "bg-emerald-50 text-emerald-800 border-emerald-300",
        shortDesc: t("jobs.groups.a_short"),
        tooltip: t("jobs.groups.a_tooltip"),
      };
    if (g === "B")
      return {
        className: "bg-blue-50 text-blue-800 border-blue-300",
        shortDesc: t("jobs.groups.b_short"),
        tooltip: t("jobs.groups.b_tooltip"),
      };
    if (g === "C" || g === "D")
      return {
        className: "bg-amber-50 text-amber-800 border-amber-300",
        shortDesc: t("jobs.groups.cd_short"),
        tooltip: t("jobs.groups.cd_tooltip"),
      };
    if (["E", "F", "G", "H"].includes(g))
      return {
        className: "bg-slate-50 text-slate-700 border-slate-300",
        shortDesc: t("jobs.groups.risk_short"),
        tooltip: t("jobs.groups.risk_tooltip"),
      };
    return {
      className: "bg-gray-50 text-gray-700 border-gray-300",
      shortDesc: t("jobs.groups.linear_short"),
      tooltip: t("jobs.groups.linear_tooltip"),
    };
  };

  const group = job?.randomization_group;
  const groupConfig = group ? getGroupBadgeConfig(group) : null;

  const Timeline = () => (
    <div className="flex items-center justify-between text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <span className="font-semibold text-slate-700 mb-1 text-[10px] uppercase tracking-wider">
          {t("jobs.details.posted")}
        </span>
        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 text-xs">
          {formatDate(job?.posted_date)}
        </span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-2 relative top-[-10px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-400" />
      </div>
      <div className="flex flex-col items-center text-center">
        <span className="font-semibold text-green-700 mb-1 text-[10px] uppercase tracking-wider">
          {t("jobs.details.start")}
        </span>
        <span className="bg-green-50 px-2 py-0.5 rounded border border-green-200 text-green-800 font-bold text-xs">
          {formatDate(job?.start_date)}
        </span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-2 relative top-[-10px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-400" />
      </div>
      <div className="flex flex-col items-center text-center">
        <span className="font-semibold text-red-700 mb-1 text-[10px] uppercase tracking-wider">
          {t("jobs.details.end")}
        </span>
        <span className="bg-red-50 px-2 py-0.5 rounded border border-red-200 text-red-800 font-medium text-xs">
          {formatDate(job?.end_date)}
        </span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg">
        <DialogHeader className="p-4 sm:p-6 pb-4 bg-white border-b sticky top-0 z-10 shadow-sm">
          <div className="flex sm:hidden items-center mb-4 -mt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="-ml-3 flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-base font-semibold">{t("common.back")}</span>
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1 w-full min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {badgeConfig && (
                    <Badge
                      variant={badgeConfig.variant}
                      className={cn("text-[10px] sm:text-xs", badgeConfig.className)}
                    >
                      {badgeConfig.label}
                    </Badge>
                  )}
                  {job?.was_early_access && (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 flex gap-1 items-center shadow-sm">
                      <Rocket className="h-3 w-3 fill-amber-500 text-amber-500" />
                      <span className="font-bold text-[10px] uppercase">{t("jobs.details.early_match.badge")}</span>
                    </Badge>
                  )}
                  {job?.job_id && (
                    <span className="font-mono text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {job.job_id}
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between w-full pr-8">
                  <DialogTitle className="text-xl sm:text-3xl leading-tight text-primary mt-2 font-bold tracking-tight truncate">
                    {job?.job_title}
                  </DialogTitle>
                </div>
                <DialogDescription className="flex flex-wrap items-center gap-2 text-base sm:text-lg text-slate-600 mt-1">
                  <span className="font-bold text-foreground flex items-center gap-1">
                    <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" /> {job?.company}
                  </span>
                  <span className="hidden sm:inline text-slate-300">|</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" /> {job?.city}, {job?.state}
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
                  <Button onClick={() => job && onAddToQueue(job)} className="px-6 font-bold shadow-sm">
                    <Plus className="h-4 w-4 mr-2" /> {t("jobs.details.save_job")}
                  </Button>
                )}
              </div>
            </div>

            {/* --- BANNER DE MERCHAN RECOLHÍVEL (VERSÃO ULTRA COMPACTA) --- */}
            {job?.was_early_access && (
              <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 overflow-hidden transition-all duration-300">
                <div
                  className="p-2 flex items-center justify-between cursor-pointer hover:bg-amber-100/50"
                  onClick={() => setIsBannerExpanded(!isBannerExpanded)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                      <Zap className="h-3 w-3 text-amber-600 fill-amber-600" />
                    </div>
                    <h4 className="text-[10px] sm:text-xs font-bold text-amber-900 uppercase tracking-tight truncate">
                      {t("jobs.details.early_match.title")}
                    </h4>
                  </div>
                  <div className="flex items-center text-amber-600">
                    {!isBannerExpanded && (
                      <span className="text-[9px] font-bold mr-1 uppercase opacity-70">{t("common.expand")}</span>
                    )}
                    {isBannerExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </div>
                </div>
                {isBannerExpanded && (
                  <div className="px-3 pb-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200 border-t border-amber-100/50">
                    <p className="text-[11px] text-amber-800 leading-relaxed">{t("jobs.details.early_match.desc")}</p>
                  </div>
                )}
              </div>
            )}

            {group && groupConfig && (
              <div className={cn("mt-2 mb-2 p-3 sm:p-4 rounded-xl border bg-opacity-40", groupConfig.className)}>
                <div className="flex items-center gap-3 mb-1 sm:mb-2">
                  <Badge
                    variant="outline"
                    className="bg-white/80 border-current font-bold text-[10px] uppercase tracking-wider"
                  >
                    {t("jobs.groups.group_label")} {group}
                  </Badge>
                  <span className="font-semibold text-[11px] sm:text-sm flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" /> {groupConfig.shortDesc}
                  </span>
                </div>
                <p className="text-[11px] sm:text-sm opacity-90 leading-relaxed">
                  <strong>{t("jobs.groups.dol_draw")}:</strong> {groupConfig.tooltip}
                </p>
              </div>
            )}
          </div>
        </DialogHeader>

        {job && isEarlyAccess(job.visa_type) && (
          <Alert
            variant="destructive"
            className="mx-4 sm:mx-6 mt-4 bg-red-50 border-red-200 text-red-800 flex items-center py-2"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            <AlertDescription className="text-sm font-semibold">
              {getEarlyAccessDisclaimer(i18n.language)}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <Timeline />
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
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold text-sm sm:text-base">{t("jobs.details.available_positions")}</span>
                  </div>
                  <Badge className="text-base sm:text-lg px-3 sm:px-4 py-1 bg-blue-600 hover:bg-blue-700 font-bold shadow-sm">
                    {job?.openings ? job.openings : "N/A"}
                  </Badge>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-green-700 font-bold text-base sm:text-lg mb-2">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" /> <span>{t("jobs.details.remuneration")}</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-green-700 tracking-tight">
                    {renderMainWage()}
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {t("jobs.details.company_contacts")}
                </div>
                <div
                  className="group flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-200 transition-colors"
                  onClick={() => copyToClipboard(job?.email || "")}
                >
                  <div className="bg-white p-2 rounded-full border border-slate-200 text-blue-500">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      {t("jobs.details.email_label")}
                    </span>
                    <span className="truncate font-medium text-slate-700 text-sm sm:text-base">{job?.email}</span>
                  </div>
                </div>
                {job?.phone && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <Button variant="outline" size="sm" className="h-9 text-[11px] sm:text-xs" asChild>
                      <a href={`tel:${job.phone}`}>
                        <Phone className="h-3.5 w-3.5 mr-1" /> {t("jobs.details.call_action")}
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 text-[11px] sm:text-xs" asChild>
                      <a href={`sms:${cleanPhone(job.phone)}?body=${encodedMessage}`}>
                        <MessageSquare className="h-3.5 w-3.5 mr-1" /> SMS
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 text-[11px] sm:text-xs" asChild>
                      <a
                        href={`https://wa.me/${cleanPhone(job.phone)}?text=${encodedMessage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5 mr-1" /> WA
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-8 space-y-8">
              {job?.job_min_special_req && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 sm:p-6 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-amber-900 mb-3 sm:mb-4 text-lg sm:text-xl">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" /> {t("jobs.details.special_reqs")}
                  </h4>
                  <p className="text-sm sm:text-base text-amber-900 leading-relaxed whitespace-pre-wrap">
                    {job.job_min_special_req}
                  </p>
                </div>
              )}
              {job?.job_duties && (
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-slate-800">
                    <Briefcase className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" /> {t("jobs.details.job_description")}
                  </h4>
                  <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-sm sm:text-base text-slate-700 leading-relaxed sm:leading-7 whitespace-pre-wrap">
                      {job.job_duties}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 z-20 shadow-lg">
          <Button className="flex-1 font-bold h-12 text-base" onClick={() => job && onAddToQueue(job)}>
            <Plus className="h-5 w-5 mr-2" /> {t("jobs.details.save_job")}
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleShare}>
            <Share2 className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
