import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/number";
import { Check, Plus, Lock, MapPin, Calendar, DollarSign, Users, Briefcase, Clock, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";

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
}

interface MobileJobCardProps {
  job: JobData;
  isBlurred: boolean;
  isQueued: boolean;
  onAddToQueue: () => void;
  onShare: () => void;
  onClick: () => void;
  formatDate: (date: string | null | undefined) => string;
  reportData?: { count: number; reasons: ReportReason[] };
}

export function MobileJobCard({
  job,
  isBlurred,
  isQueued,
  onAddToQueue,
  onShare,
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
    if (months < 12) return t('jobs.table.experience_months', { count: months });
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return t('jobs.table.experience_years', { count: years });
    return t('jobs.table.experience_years_months', { years, months: remainingMonths });
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: Title + Visa Badge + Action */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {reportData && (
                <JobWarningBadge
                  reportCount={reportData.count}
                  reasons={reportData.reasons}
                />
              )}
              <h3 className="font-semibold text-foreground truncate">{job.job_title}</h3>
            </div>
            <p className={cn(
              "text-sm text-muted-foreground truncate",
              isBlurred && "blur-sm select-none"
            )}>
              {job.company}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={job.visa_type === "H-2A" ? "secondary" : "default"} className="text-xs">
              {job.visa_type === "H-2A" ? "H-2A" : "H-2B"}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={!isBlurred && isQueued ? "default" : "outline"}
              className={cn(
                "h-8 w-8",
                !isBlurred && isQueued && "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500"
              )}
              disabled={!isBlurred && isQueued}
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue();
              }}
            >
              {isBlurred ? (
                <Lock className="h-4 w-4" />
              ) : isQueued ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Location & Salary Row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.city}, {job.state}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span>{formatSalary(job.salary)}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
          {typeof job.openings === "number" && (
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{formatNumber(job.openings)} {t("jobs.table.headers.openings")}</span>
            </div>
          )}
          {job.start_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(job.start_date)}</span>
            </div>
          )}
          {formatExperience(job.experience_months) && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatExperience(job.experience_months)}</span>
            </div>
          )}
        </div>

        {/* Email (blurred for free) */}
        <div className="flex items-center gap-1.5 text-xs">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn(
            "text-muted-foreground truncate",
            isBlurred && "blur-sm select-none"
          )}>
            {job.email}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
