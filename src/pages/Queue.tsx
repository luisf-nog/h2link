import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG } from '@/config/plans.config';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/number';
import { AddManualJobDialog } from '@/components/queue/AddManualJobDialog';

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

  const planTier = profile?.plan_tier || 'free';

  useEffect(() => {
    fetchQueue();
  }, []);

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
          state,
          visa_type
        ),
        manual_jobs (
          id,
          company,
          job_title,
          email,
          eta_number,
          phone
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

  const applyTemplate = (text: string, vars: Record<string, string>) => {
    let out = text;
    for (const [k, v] of Object.entries(vars)) {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      out = out.replace(re, v);
    }
    return out;
  };

  const sendEmails = async () => {
    setSending(true);

    try {
      const pendingItems = queue.filter((q) => q.status === 'pending');
      if (pendingItems.length === 0) return;

      if (!profile?.full_name || profile?.age == null || !profile?.phone_e164 || !profile?.contact_email) {
        toast({
          title: 'Complete seu Perfil',
          description: 'Preencha nome, idade, telefone e email de contato antes de enviar.',
          variant: 'destructive',
        });
        return;
      }

      // Fetch user's templates and pick automatically based on plan
      const { data: tplData, error: tplError } = await supabase
        .from('email_templates')
        .select('id,name,subject,body')
        .order('created_at', { ascending: false });
      if (tplError) throw tplError;
      const templates = ((tplData as EmailTemplate[]) ?? []).filter(Boolean);

      if (templates.length === 0) {
        toast({
          title: t('queue.toasts.no_template_title'),
          description: t('queue.toasts.no_template_desc'),
          variant: 'destructive',
        });
        return;
      }

      // Gold: use the only template; Diamond: random among all templates (up to 5)
      const tpl = planTier === 'diamond' 
        ? templates[Math.floor(Math.random() * templates.length)]
        : templates[0];

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sem sessão autenticada');

      const sentIds: string[] = [];

      for (const item of pendingItems) {
        const job = item.public_jobs ?? item.manual_jobs;
        if (!job?.email) continue;

        const to = job.email;
        const visaType =
          item.public_jobs?.visa_type === 'H-2A' ? ('H-2A' as const) : ('H-2B' as const);

        const vars: Record<string, string> = {
          name: profile.full_name ?? '',
          age: String(profile.age ?? ''),
          phone: profile.phone_e164 ?? '',
          contact_email: profile.contact_email ?? '',
          company: job.company ?? '',
          position: job.job_title ?? '',
          visa_type: visaType,
          eta_number: item.manual_jobs?.eta_number ?? '',
          company_phone: item.manual_jobs?.phone ?? '',
          job_phone: item.manual_jobs?.phone ?? '',
        };

        const finalSubject = applyTemplate(tpl.subject, vars);
        const finalBody = applyTemplate(tpl.body, vars);

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-custom`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to, subject: finalSubject, body: finalBody }),
        });

        const text = await res.text();
        const payload = (() => {
          try {
            return JSON.parse(text);
          } catch {
            return { error: text };
          }
        })();

        if (!res.ok || payload?.success === false) {
          throw new Error(payload?.error || `Falha ao enviar para ${to} (HTTP ${res.status})`);
        }

        sentIds.push(item.id);
      }

      if (sentIds.length > 0) {
        await supabase
          .from('my_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .in('id', sentIds);
      }

      toast({
        title: t('queue.toasts.sent_title'),
        description: String(
          t('queue.toasts.sent_desc', {
            count: formatNumber(sentIds.length),
          } as any)
        ),
      });

      fetchQueue();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Falha ao enviar';
      toast({ title: 'Erro ao enviar', description: message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
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

        <div className="flex gap-2">
          <AddManualJobDialog onAdded={fetchQueue} />

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
                      {(item.public_jobs ?? item.manual_jobs)?.job_title}
                    </TableCell>
                    <TableCell>{(item.public_jobs ?? item.manual_jobs)?.company}</TableCell>
                    <TableCell>{(item.public_jobs ?? item.manual_jobs)?.email}</TableCell>
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

