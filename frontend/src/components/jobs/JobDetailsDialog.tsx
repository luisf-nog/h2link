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
  Copy,
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
  openings?: number | null;
  salary: number | null;
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
  experience_months?: number | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  job_min_special_req?: string | null;
  job_duties?: string | null;
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
  const [isBannerExpanded, setIsBannerExpanded] = useState(true);

  const badgeConfig = job ? getVisaBadgeConfig(job.visa_type) : null;

  useEffect(() => {
    if (open) setIsBannerExpanded(true);
  }, [open, job?.id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("jobs.details.copied"), description: t("jobs.details.copy_success") });
  };

  const handleShare = () => {
    if (!job) return;
    if (onShare) onShare(job);
    else {
      const shareUrl = getJobShareUrl(job.id);
      copyToClipboard(shareUrl);
    }
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
    return {
      className: "bg-slate-50 text-slate-700 border-slate-300",
      shortDesc: t("jobs.groups.risk_short"),
      tooltip: t("jobs.groups.risk_tooltip"),
    };
  };

  const groupConfig = job?.randomization_group ? getGroupBadgeConfig(job.randomization_group) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-screen sm:h-auto max-h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg border-0 sm:border">
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
            <div className="flex flex-col gap-1 w-full min-w-0 text-left">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {badgeConfig && (
                  <Badge variant={badgeConfig.variant} className={cn("text-[10px] sm:text-xs", badgeConfig.className)}>
                    {badgeConfig.label}
                  </Badge>
                )}
                {job?.job_id && (
                  <span className="font-mono text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {job.job_id.split("-GHOST")[0]}
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
                <Button onClick={() => job && onAddToQueue(job)} className="px-6 font-bold shadow-sm">
                  <Plus className="h-4 w-4 mr-2" /> {t("jobs.details.save_job")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* CONTEÚDO ROLÁVEL */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 touch-auto">
          <div className="p-4 sm:p-6 space-y-5 pb-32 sm:pb-6 text-left">
            {/* EARLY MATCH CARD */}
            {job?.was_early_access && (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50/80 overflow-hidden cursor-pointer shadow-sm"
                onClick={() => setIsBannerExpanded(!isBannerExpanded)}
              >
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-amber-600 fill-amber-600" />
                    <div>
                      <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest">
                        {t("jobs.details.early_match.badge")}
                      </span>
                      <h4 className="text-sm font-bold text-amber-900">{t("jobs.details.early_match.title")}</h4>
                    </div>
                  </div>
                  {isBannerExpanded ? (
                    <ChevronUp className="h-4 w-4 text-amber-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                {isBannerExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-amber-200/50 text-sm text-amber-800 leading-relaxed">
                    {t("jobs.details.early_match.desc")}
                  </div>
                )}
              </div>
            )}

            {/* GRID PRINCIPAL */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                {/* TIMELINE */}
                <div className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{t("jobs.details.posted")}</span>
                    <span className="text-xs font-semibold">{formatDate(job?.posted_date)}</span>
                  </div>
                  <div className="h-px bg-slate-200 flex-1 mx-2"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase text-green-600">{t("jobs.details.start")}</span>
                    <span className="text-xs font-bold text-green-700">{formatDate(job?.start_date)}</span>
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

                {/* SALÁRIO */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                    <span className="font-semibold text-sm text-slate-600">
                      {t("jobs.details.available_positions")}
                    </span>
                    <Badge className="bg-blue-600 font-bold px-3">{job?.openings || "N/A"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                    <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-green-700 tracking-tight">{renderMainWage()}</p>
                </div>

                {/* CONTATOS DA EMPRESA (O que estava faltando) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-xs tracking-widest">
                    <Mail className="h-4 w-4 text-blue-500" /> {t("jobs.details.company_contacts")}
                  </h4>

                  <div className="space-y-4">
                    {/* Email */}
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {t("jobs.details.email_label")}
                      </span>
                      <div className="flex items-center gap-2 group">
                        <div
                          className={cn(
                            "flex-1 font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 break-all",
                            planSettings?.job_db_blur && "blur-sm select-none",
                          )}
                        >
                          {job?.email}
                        </div>
                        {!planSettings?.job_db_blur && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => job?.email && copyToClipboard(job.email)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Telefone */}
                    {job?.phone && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          {t("jobs.details.phone_label")}
                        </span>
                        <div className="space-y-2">
                          <div
                            className={cn(
                              "font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100",
                              planSettings?.job_db_blur && "blur-sm select-none",
                            )}
                          >
                            {job.phone}
                          </div>
                          {!planSettings?.job_db_blur && (
                            <div className="flex gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-9 gap-2 text-xs font-bold"
                                asChild
                              >
                                <a href={`tel:${cleanPhone(job.phone)}`}>
                                  <Phone className="h-3.5 w-3.5" /> {t("jobs.details.call_action")}
                                </a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-9 gap-2 text-xs font-bold border-green-200 hover:bg-green-50 text-green-700"
                                asChild
                              >
                                <a href={`https://wa.me/${cleanPhone(job.phone)}`} target="_blank" rel="noreferrer">
                                  <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Banner de Upgrade (se estiver borrado) */}
                    {planSettings?.job_db_blur && (
                      <div className="pt-2">
                        <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2 shadow-md h-10 text-xs">
                          <Rocket className="h-4 w-4 mr-2" /> {t("jobs.upgrade.cta")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* COLUNA DA DIREITA (DESCRIÇÕES) */}
              <div className="lg:col-span-8 space-y-8">
                {job?.job_min_special_req && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 shadow-sm">
                    <h4 className="flex items-center gap-2 font-bold text-amber-900 mb-3 text-lg">
                      <AlertTriangle className="h-5 w-5" /> {t("jobs.details.special_reqs")}
                    </h4>
                    <p className="text-sm sm:text-base text-amber-900 leading-relaxed whitespace-pre-wrap">
                      {job.job_min_special_req}
                    </p>
                  </div>
                )}
                {job?.job_duties && (
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800">
                      <Briefcase className="h-6 w-6 text-blue-600" /> {t("jobs.details.job_description")}
                    </h4>
                    <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {job.job_duties}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER FIXO MOBILE */}
        <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
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
