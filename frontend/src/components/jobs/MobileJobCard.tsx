import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/number";
import { Check, Plus, Lock, MapPin, DollarSign, Users, Briefcase, Clock, Calendar, Rocket, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { getVisaBadgeConfig } from "@/lib/visaTypes";

interface JobData {
  id: string;
  job_title: string;
  company: string;
  city: string;
  state: string;
  email: string;
  visa_type?: string | null;
  salary?: number | null;
  openings?: number | null;
  posted_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  experience_months?: number | null;
  randomization_group?: string | null;
  was_early_access?: boolean | null;
}

interface MobileJobCardProps {
  job: JobData;
  isBlurred: boolean;
  isQueued: boolean;
  onAddToQueue: () => void;
  onClick: () => void;
  formatDate: (date: string | null | undefined) => string;
  reportData?: { count: number; reasons: ReportReason[] };
}

export function MobileJobCard({
  job,
  isBlurred,
  isQueued,
  onAddToQueue,
  onClick,
  formatDate,
  reportData,
}: MobileJobCardProps) {
  const { t } = useTranslation();

  const formatSalary = (salary: number | null | undefined) => {
    if (!salary) return "-";
    return `$${salary.toFixed(2)}/h`;
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return null;
    if (months < 12) return t("jobs.table.experience_months", { count: months });
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem === 0
      ? t("jobs.table.experience_years", { count: years })
      : t("jobs.table.experience_years_months", { years, months: rem });
  };

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

  const badgeConfig = getVisaBadgeConfig(job.visa_type);
  const groupConfig = job.randomization_group ? getGroupBadgeConfig(job.randomization_group) : null;

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98] border-slate-200 shadow-sm overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3 text-left">
        {/* HEADER: Título, Empresa e Badge de Visto */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {reportData && <JobWarningBadge reportCount={reportData.count} reasons={reportData.reasons} />}
              <h3 className="font-bold text-slate-900 truncate uppercase text-sm" translate="no">
                {job.job_title}
              </h3>
            </div>
            <p
              className={cn("text-xs font-medium text-slate-500 truncate", isBlurred && "blur-sm select-none")}
              translate="no"
            >
              {job.company}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={badgeConfig.variant}
              className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0",
                badgeConfig.className,
                job.was_early_access && "border-amber-400 bg-amber-50 text-amber-700 shadow-sm",
              )}
              translate="no"
            >
              <div className="flex items-center gap-1">
                {job.was_early_access && <Rocket className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />}
                {badgeConfig.label}
              </div>
            </Badge>
            <Button
              size="icon"
              variant={!isBlurred && isQueued ? "default" : "outline"}
              className={cn(
                "h-8 w-8 rounded-full shadow-sm",
                !isBlurred && isQueued && "bg-emerald-500 border-emerald-500 hover:bg-emerald-600",
              )}
              disabled={!isBlurred && isQueued}
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue();
              }}
            >
              {isBlurred ? (
                <Lock className="h-3.5 w-3.5" />
              ) : isQueued ? (
                <Check className="h-3.5 w-3.5 text-white" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* INFO PRINCIPAL: Localização e Salário */}
        <div className="flex items-center gap-3 text-xs text-slate-600 font-medium bg-slate-50/50 p-2 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate" translate="no">
              {job.city}, {job.state}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-green-700 font-bold">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span translate="no">{formatSalary(job.salary)}</span>
          </div>
        </div>

        {/* GROUP BADGE (Se existir) */}
        {groupConfig && (
          <div
            className={cn("p-2 rounded border text-[10px] leading-tight flex items-start gap-2", groupConfig.className)}
          >
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold mb-0.5 uppercase tracking-wide" translate="no">
                {t("jobs.groups.group_label")} {job.randomization_group}: {groupConfig.shortDesc}
              </div>
              <p className="opacity-80 line-clamp-2">{groupConfig.tooltip}</p>
            </div>
          </div>
        )}

        {/* FOOTER DO CARD: Vagas, Data de Início e Experiência */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-500 font-semibold uppercase tracking-tight pt-1">
          {typeof job.openings === "number" && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" />
              <span translate="no">
                {formatNumber(job.openings)} {t("jobs.table.headers.openings")}
              </span>
            </div>
          )}
          {job.start_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span translate="no">{formatDate(job.start_date)}</span>
            </div>
          )}
          {formatExperience(job.experience_months) && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-400" />
              <span translate="no">{formatExperience(job.experience_months)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
