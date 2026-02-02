import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Trash2, Send, Loader2, RefreshCw, History, Mail, Building2, FileText, Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReportJobButton } from "@/components/queue/ReportJobButton";
import { format, type Locale } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";

const dateLocaleMap: Record<string, Locale> = { pt: ptBR, en: enUS, es: es };

interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  opened_at?: string | null;
  profile_viewed_at?: string | null;
  tracking_id?: string;
  created_at: string;
  send_count: number;
  public_jobs: {
    id: string;
    job_title: string;
    company: string;
    email: string;
    city: string;
    state: string;
    visa_type?: string | null;
  } | null;
  manual_jobs: {
    id: string;
    company: string;
    job_title: string;
    email: string;
    eta_number: string | null;
    phone: string | null;
  } | null;
}

interface MobileQueueCardProps {
  item: QueueItem;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onSend: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onViewHistory: () => void;
  isSending: boolean;
  isRetrying: boolean;
  globalSending: boolean;
}

export function MobileQueueCard({
  item,
  isSelected,
  onSelectChange,
  onSend,
  onRetry,
  onRemove,
  onViewHistory,
  isSending,
  isRetrying,
  globalSending,
}: MobileQueueCardProps) {
  const { t, i18n } = useTranslation();
  const job = item.public_jobs ?? item.manual_jobs;

  const statusLabel = (status: string) => {
    if (status === "sent") return t("queue.status.sent");
    if (status === "processing") return t("queue.status.processing");
    if (status === "failed") return t("queue.status.failed");
    if (status === "paused") return t("queue.status.paused");
    if (status === "skipped_invalid_domain") return t("queue.status.skipped_invalid_domain");
    return t("queue.status.pending");
  };

  const formatOpenedAt = (openedAt: string) => {
    try {
      return format(new Date(openedAt), "dd/MM/yyyy HH:mm");
    } catch {
      return openedAt;
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    if (status === "sent") return "bg-success/10 text-success border-success/30";
    if (status === "failed") return "bg-destructive/10 text-destructive border-destructive/30";
    if (status === "paused") return "bg-warning/10 text-warning border-warning/30";
    if (status === "processing") return "bg-primary/10 text-primary border-primary/30";
    if (status === "skipped_invalid_domain") return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    return "";
  };

  return (
    <Card className={cn(
      "transition-colors",
      isSelected && "ring-2 ring-primary"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Checkbox + Title + Status */}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            disabled={item.status !== "pending"}
            onCheckedChange={(v) => onSelectChange(v === true)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{job?.job_title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">{job?.company}</span>
            </div>
          </div>
          <Badge
            variant={item.status === "sent" ? "default" : "secondary"}
            className={cn("shrink-0 text-xs", getStatusBadgeClasses(item.status))}
          >
            {item.status === "sent" && item.sent_at && item.send_count > 0 ? (
              <span className="flex items-center gap-1">
                {item.send_count}x {format(
                  new Date(item.sent_at),
                  i18n.language === "en" ? "MM/dd hh:mm a" : "dd/MM HH:mm",
                  { locale: dateLocaleMap[i18n.language] ?? enUS }
                )}
              </span>
            ) : (
              statusLabel(item.status)
            )}
          </Badge>
        </div>

        {/* Email Row */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{job?.email}</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          {/* Tracking Icons */}
          <div className="flex items-center gap-3">
            {/* Resume/CV View Tracking */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs">
                  <FileText
                    className={cn(
                      "h-4 w-4",
                      item.status === "sent" && item.profile_viewed_at
                        ? "text-success"
                        : "text-muted-foreground"
                    )}
                  />
                  <span className="text-muted-foreground">
                    {item.status === "sent" && item.profile_viewed_at ? "CV ✓" : "CV"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {item.status === "sent" && item.profile_viewed_at ? (
                  <p>
                    {t("queue.resume_tracking.viewed_at", {
                      date: formatOpenedAt(item.profile_viewed_at),
                      defaultValue: "CV visualizado em {{date}}",
                    })}
                  </p>
                ) : (
                  <p>{t("queue.resume_tracking.not_viewed", { defaultValue: "CV não visualizado" })}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Report button - only for public jobs */}
            {item.public_jobs?.id && (
              <ReportJobButton jobId={item.public_jobs.id} />
            )}

            {item.send_count > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onViewHistory}
              >
                <History className="h-4 w-4" />
              </Button>
            )}

            {item.status === "failed" ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={globalSending || isRetrying}
                onClick={onRetry}
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={(item.status !== "pending" && item.status !== "sent") || globalSending || isSending}
                onClick={onSend}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : item.status === "sent" ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
