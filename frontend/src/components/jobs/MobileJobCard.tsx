import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/number";
import { Check, Plus, Lock, MapPin, Calendar, DollarSign, Users, Briefcase, Clock, Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { getVisaBadgeConfig } from "@/lib/visaTypes";

// Interface deve bater com o que o Jobs.tsx envia
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

// Named Export obrigatório para o Jobs.tsx funcionar
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
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return t("jobs.table.experience_years", { count: years });
    return t("jobs.table.experience_years_months", { years, months: remainingMonths });
  };

  const badgeConfig = getVisaBadgeConfig(job.visa_type);

  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]" onClick={onClick}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {reportData && <JobWarningBadge reportCount={reportData.count} reasons={reportData.reasons} />}
              <h3 className="font-semibold text-foreground truncate">{job.job_title}</h3>
            </div>
            <p className={cn("text-sm text-muted-foreground truncate", isBlurred && "blur-sm select-none")}>
              {job.company}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={badgeConfig.variant}
              className={cn(
                "text-[10px] sm:text-xs",
                badgeConfig.className,
                job.was_early_access && "border-amber-400 bg-amber-50 text-amber-700 shadow-sm",
              )}
            >
              <div className="flex items-center gap-1">
                {job.was_early_access && <Rocket className="h-3 w-3 text-amber-500 fill-amber-500" />}
                {badgeConfig.label}
              </div>
            </Badge>
            <Button
              size="icon"
              variant={!isBlurred && isQueued ? "default" : "outline"}
              className={cn(
                "h-8 w-8",
                !isBlurred && isQueued && "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
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
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3" /> {job.city}, {job.state}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <DollarSign className="h-3 w-3" /> {formatSalary(job.salary)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
