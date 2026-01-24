import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, type Locale } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface SendHistoryEntry {
  id: string;
  sent_at: string;
  status: string;
  error_message: string | null;
}

interface SendHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueId: string;
  jobTitle: string;
  company: string;
}

const dateLocaleMap: Record<string, Locale> = { pt: ptBR, en: enUS, es: es };

export function SendHistoryDialog({
  open,
  onOpenChange,
  queueId,
  jobTitle,
  company,
}: SendHistoryDialogProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SendHistoryEntry[]>([]);

  useEffect(() => {
    if (!open || !queueId) return;

    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('queue_send_history')
          .select('id, sent_at, status, error_message')
          .eq('queue_id', queueId)
          .order('sent_at', { ascending: false });

        if (error) throw error;
        if (!cancelled) setHistory((data ?? []) as SendHistoryEntry[]);
      } catch (err) {
        console.error('Error fetching send history:', err);
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [open, queueId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const locale = dateLocaleMap[i18n.language] ?? enUS;
    const dateFormat = i18n.language === 'en' ? 'MM/dd/yyyy hh:mm a' : 'dd/MM/yyyy HH:mm';
    return format(date, dateFormat, { locale });
  };

  const getStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'skipped') return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    return null;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'success') return t('queue.history.status_success');
    if (status === 'failed') return t('queue.history.status_failed');
    if (status === 'skipped') return t('queue.history.status_skipped');
    return status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('queue.history.title')}</DialogTitle>
          <DialogDescription>
            {jobTitle} - {company}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('queue.history.empty')}
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <div className="mt-0.5">{getStatusIcon(entry.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {formatDate(entry.sent_at)}
                      </span>
                      <Badge
                        variant={entry.status === 'success' ? 'default' : 'secondary'}
                        className={
                          entry.status === 'success'
                            ? 'bg-success/10 text-success border-success/30'
                            : entry.status === 'failed'
                              ? 'bg-destructive/10 text-destructive border-destructive/30'
                              : 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                        }
                      >
                        {getStatusLabel(entry.status)}
                      </Badge>
                    </div>
                    {entry.error_message && (
                      <p className="mt-1 text-xs text-muted-foreground truncate" title={entry.error_message}>
                        {entry.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
