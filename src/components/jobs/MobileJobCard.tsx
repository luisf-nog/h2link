import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/number";
import { Check, Plus, Lock, Home, Bus, Wrench, MapPin, Calendar, DollarSign, Users, Briefcase } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  housing_info?: string | null;
  transport_provided?: boolean | null;
  tools_provided?: boolean | null;
}

interface MobileJobCardProps {
  job: JobData;
  isBlurred: boolean;
  isQueued: boolean;
  showHousingIcons: boolean;
  onAddToQueue: () => void;
  onClick: () => void;
  formatDate: (date: string | null | undefined) => string;
}

export function MobileJobCard({
  job,
  isBlurred,
  isQueued,
  showHousingIcons,
  onAddToQueue,
  onClick,
  formatDate,
}: MobileJobCardProps) {
  const { t } = useTranslation();

  const formatSalary = (salary: number | null | undefined) => {
    if (!salary) return "-";
    return `$${salary.toFixed(2)}/h`;
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
            <h3 className="font-semibold text-foreground truncate">{job.job_title}</h3>
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
              variant="outline"
              className="h-8 w-8"
              disabled={!isBlurred && isQueued}
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue();
              }}
            >
              {isBlurred ? (
                <Lock className="h-4 w-4" />
              ) : isQueued ? (
                <Check className="h-4 w-4 text-success" />
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
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
          </div>

          {/* Benefits Icons */}
          {showHousingIcons && (
            <div className="flex items-center gap-1">
              {(job.housing_info || job.visa_type === "H-2A") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={job.visa_type === "H-2A" ? "secondary" : "outline"}
                      className="h-6 px-1.5"
                    >
                      <Home className="h-3 w-3" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {job.visa_type === "H-2A"
                        ? t("jobs.benefits.housing_h2a")
                        : t("jobs.benefits.housing_available")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
              {job.transport_provided && (
                <Badge variant="outline" className="h-6 px-1.5">
                  <Bus className="h-3 w-3" />
                </Badge>
              )}
              {job.tools_provided && (
                <Badge variant="outline" className="h-6 px-1.5">
                  <Wrench className="h-3 w-3" />
                </Badge>
              )}
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
