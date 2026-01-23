import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, canAccessFeature } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Send, Wand2, Lock, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/number';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  public_jobs: {
    id: string;
    job_title: string;
    company: string;
    email: string;
    city: string;
    state: string;
  };
}

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export default function Queue() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');

  const planTier = profile?.plan_tier || 'free';
  const hasMagicPaste = canAccessFeature(planTier, 'magic_paste');

  useEffect(() => {
    fetchQueue();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('id,name,subject,body')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching templates:', error);
      return;
    }
    setTemplates(((data as EmailTemplate[]) ?? []).filter(Boolean));
  };

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('my_queue')
      .select(`
        id,
        status,
        sent_at,
        created_at,
        public_jobs (
          id,
          job_title,
          company,
          email,
          city,
          state
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching queue:', error);
      toast({
        title: t('queue.toasts.load_error_title'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setQueue((data as unknown as QueueItem[]) || []);
    }
    setLoading(false);
  };

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase.from('my_queue').delete().eq('id', id);

    if (error) {
      toast({
        title: t('queue.toasts.remove_error_title'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setQueue(queue.filter((item) => item.id !== id));
      toast({
        title: t('queue.toasts.remove_success_title'),
        description: t('queue.toasts.remove_success_desc'),
      });
    }
  };

  const sendEmails = async () => {
    setSending(true);

    // Simulate sending for demo purposes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast({
      title: t('queue.toasts.sent_title'),
      description: String(
        t('queue.toasts.sent_desc', {
          count: formatNumber(queue.filter((q) => q.status === 'pending').length),
          template: selectedTemplateId === 'none' ? '' : ' (template aplicado)',
        } as any)
      ),
    });

    // Update queue status
    const pendingIds = queue.filter((q) => q.status === 'pending').map((q) => q.id);
    if (pendingIds.length > 0) {
      await supabase
        .from('my_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', pendingIds);
    }

    fetchQueue();
    setSending(false);
  };

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const sentCount = queue.filter((q) => q.status === 'sent').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('queue.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('queue.subtitle', { pendingCount, sentCount })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="min-w-[220px]">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem template</SelectItem>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                disabled={!hasMagicPaste}
                className={!hasMagicPaste ? 'opacity-50' : ''}
              >
                {hasMagicPaste ? (
                  <Wand2 className="h-4 w-4 mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {t('queue.actions.magic_paste')}
              </Button>
            </TooltipTrigger>
            {!hasMagicPaste && (
              <TooltipContent>
                <p>{t('queue.magic_paste_locked')}</p>
              </TooltipContent>
            )}
          </Tooltip>

          <Button
            onClick={sendEmails}
            disabled={pendingCount === 0 || sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {t('queue.actions.send', { pendingCount })}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t('queue.stats.in_queue')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t('queue.stats.sent_today')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(sentCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t('queue.stats.daily_limit')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{PLANS_CONFIG[planTier].limits.daily_emails}</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('queue.table.title')}</CardTitle>
          <CardDescription>
            {t('queue.table.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                  <TableHead>{t('queue.table.headers.job_title')}</TableHead>
                  <TableHead>{t('queue.table.headers.company')}</TableHead>
                  <TableHead>{t('queue.table.headers.email')}</TableHead>
                  <TableHead>{t('queue.table.headers.status')}</TableHead>
                  <TableHead className="text-right">{t('queue.table.headers.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                      {t('queue.table.loading')}
                  </TableCell>
                </TableRow>
              ) : queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="space-y-2">
                        <p className="text-muted-foreground">{t('queue.table.empty')}</p>
                      <Button variant="outline" onClick={() => (window.location.href = '/jobs')}>
                          {t('queue.table.go_jobs')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.public_jobs.job_title}
                    </TableCell>
                    <TableCell>{item.public_jobs.company}</TableCell>
                    <TableCell>{item.public_jobs.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={item.status === 'sent' ? 'default' : 'secondary'}
                        className={
                          item.status === 'sent'
                            ? 'bg-success/10 text-success border-success/30'
                            : ''
                        }
                      >
                        {item.status === 'sent' ? t('queue.status.sent') : t('queue.status.pending')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeFromQueue(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
