import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ReportReason } from '@/components/queue/ReportJobButton';

interface JobWarningBadgeProps {
  reportCount: number;
  reasons: ReportReason[];
  className?: string;
}

export function JobWarningBadge({ reportCount, reasons, className }: JobWarningBadgeProps) {
  const { t } = useTranslation();

  if (reportCount === 0) return null;

  const reasonLabels = reasons.map((r) => t(`reports.reasons.${r}`)).join(', ');
  const tooltipText = t('reports.warning_tooltip', { count: reportCount, reasons: reasonLabels });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-warning cursor-help',
            className
          )}
        >
          <AlertTriangle className="h-4 w-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-sm">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
