import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send, Clock, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { PlanTier } from "@/config/plans.config";

interface SendingStatusCardProps {
  processingCount: number;
  pendingCount: number;
  planTier: PlanTier;
}

function getDelayDescription(planTier: PlanTier, t: (key: string) => string): string {
  switch (planTier) {
    case "gold":
      return t("queue.sending_status.delay_gold");
    case "diamond":
      return t("queue.sending_status.delay_diamond");
    case "black":
      return t("queue.sending_status.delay_black");
    default:
      return "";
  }
}

export function SendingStatusCard({ processingCount, pendingCount, planTier }: SendingStatusCardProps) {
  const { t } = useTranslation();
  
  const totalToSend = processingCount + pendingCount;
  const progressPercent = totalToSend > 0 ? ((totalToSend - pendingCount) / totalToSend) * 100 : 0;
  const delayDescription = getDelayDescription(planTier, t);

  return (
    <Card className="border-primary/30 bg-primary/5 animate-in fade-in-50 duration-300">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Animated Icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <div className="relative bg-primary rounded-full p-3">
              <Send className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">
                {t("queue.sending_status.title")}
              </h3>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {t("queue.sending_status.description", { 
                processing: processingCount,
                pending: pendingCount,
              })}
            </p>

            {/* Progress Bar */}
            <div className="mb-2">
              <Progress value={progressPercent} className="h-2" />
            </div>

            {/* Delay Info */}
            {delayDescription && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{delayDescription}</span>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>{totalToSend - pendingCount}</span>
              <span className="text-muted-foreground">/ {totalToSend}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t("queue.sending_status.can_close")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
