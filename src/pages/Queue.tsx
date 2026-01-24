import { useMemo, useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Send, Loader2, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/number';
import { AddManualJobDialog } from '@/components/queue/AddManualJobDialog';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  opened_at?: string | null;
  tracking_id?: string;
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
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingOneId, setSendingOneId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [smtpReady, setSmtpReady] = useState<boolean | null>(null);
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false);

  const planTier = profile?.plan_tier || 'free';
  const referralBonus = Number((profile as any)?.referral_bonus_limit ?? 0);
  const dailyLimitTotal = (PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0) + referralBonus;
  const creditsUsedToday = profile?.credits_used_today || 0;
  const remainingToday = Math.max(0, dailyLimitTotal - creditsUsedToday);

  const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  const pickSendProfile = () => {
    if (planTier === 'gold') {
      return { xMailer: 'Microsoft Outlook 16.0', userAgent: 'Microsoft Outlook 16.0' };
    }

    if (planTier === 'diamond') {
      const pool = [
        { xMailer: 'iPhone Mail (20A362)', userAgent: 'iPhone Mail (20A362)' },
        { xMailer: 'Android Mail', userAgent: 'Android Mail' },
        { xMailer: 'Mozilla Thunderbird', userAgent: 'Mozilla Thunderbird' },
        { xMailer: 'Microsoft Outlook 16.0', userAgent: 'Microsoft Outlook 16.0' },
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    return {};
  };

  const getDelayMs = () => {
    if (planTier === 'gold') return 15_000;
    if (planTier === 'diamond') return 15_000 + Math.floor(Math.random() * 30_001); // 15s..45s
    return 0;
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('smtp_credentials')
        .select('has_password')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // Best-effort: if we can't read it, don't block UI here.
        setSmtpReady(null);
        return;
      }
      setSmtpReady(Boolean(data?.has_password));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      channel = supabase
        .channel('my_queue_open_tracking')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'my_queue',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            const next = payload?.new;
            if (!next?.id) return;
            setQueue((prev) => prev.map((it) => (it.id === next.id ? { ...it, ...next } : it)));
          },
        )
        .subscribe();
    };

    run();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('my_queue')
      .select(`
        id,
        status,
        sent_at,
         opened_at,
         tracking_id,
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

  const hashToIndex = (s: string, mod: number) => {
    if (mod <= 1) return 0;
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % mod;
  };

  const isFree = planTier === 'free';
  const pendingItems = useMemo(() => queue.filter((q) => q.status === 'pending'), [queue]);
  const pendingIds = useMemo(() => new Set(pendingItems.map((i) => i.id)), [pendingItems]);
  const selectedPendingIds = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id] && pendingIds.has(id)),
    [selectedIds, pendingIds],
  );
  const allPendingSelected = pendingItems.length > 0 && selectedPendingIds.length === pendingItems.length;

  const ensureCanSend = async () => {
    if (smtpReady !== true) {
      // If we don't know yet, verify now (best-effort) so we can show the correct popup.
      if (profile?.id) {
        const { data, error } = await supabase
          .from('smtp_credentials')
          .select('has_password')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (!error) {
          const ready = Boolean(data?.has_password);
          setSmtpReady(ready);
          if (!ready) {
            setSmtpDialogOpen(true);
            return { ok: false as const };
          }
        }
      }

      if (smtpReady === false) {
        setSmtpDialogOpen(true);
        return { ok: false as const };
      }
    }

    if (remainingToday <= 0) {
      toast({
        title: t('queue.toasts.daily_limit_reached_title'),
        description: t('queue.toasts.daily_limit_reached_desc'),
        variant: 'destructive',
      });
      return { ok: false as const };
    }

    if (!profile?.full_name || profile?.age == null || !profile?.phone_e164 || !profile?.contact_email) {
      toast({
        title: t('smtp.toasts.profile_incomplete_title'),
        description: t('smtp.toasts.profile_incomplete_desc'),
        variant: 'destructive',
      });
      return { ok: false as const };
    }

    const { data: tplData, error: tplError } = await supabase
      .from('email_templates')
      .select('id,name,subject,body')
      .order('created_at', { ascending: false });
    if (tplError) {
      toast({ title: t('common.errors.save_failed'), description: tplError.message, variant: 'destructive' });
      return { ok: false as const };
    }

    const templates = ((tplData as EmailTemplate[]) ?? []).filter(Boolean);
    if (templates.length === 0) {
      toast({
        title: t('queue.toasts.no_template_title'),
        description: t('queue.toasts.no_template_desc'),
        variant: 'destructive',
      });
      return { ok: false as const };
    }

    // Free/Gold: rotate templates (if >1). Diamond: fallback uses rotation too.

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      toast({ title: t('common.errors.no_session'), description: sessionError.message, variant: 'destructive' });
      return { ok: false as const };
    }
    const token = sessionData.session?.access_token;
    if (!token) {
      toast({ title: t('common.errors.no_session'), description: t('common.errors.no_session'), variant: 'destructive' });
      return { ok: false as const };
    }

    return { ok: true as const, templates, token };
  };

  useEffect(() => {
    // Keep selection in sync: only keep ids that are still pending
    setSelectedIds((prev) => {
      const next: Record<string, boolean> = {};
      for (const [id, checked] of Object.entries(prev)) {
        if (checked && pendingIds.has(id)) next[id] = true;
      }
      return next;
    });
  }, [pendingIds]);

  const sendQueueItems = async (items: QueueItem[]) => {
    const guard = await ensureCanSend();
    if (!guard.ok) return;

    const { templates, token } = guard;
    const sentIds: string[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const job = item.public_jobs ?? item.manual_jobs;
      if (!job?.email) continue;

      const to = job.email;
      const visaType = item.public_jobs?.visa_type === 'H-2A' ? ('H-2A' as const) : ('H-2B' as const);

      const vars: Record<string, string> = {
        name: profile?.full_name ?? '',
        age: String(profile?.age ?? ''),
        phone: profile?.phone_e164 ?? '',
        contact_email: profile?.contact_email ?? '',
        company: job.company ?? '',
        position: job.job_title ?? '',
        visa_type: visaType,
        eta_number: item.manual_jobs?.eta_number ?? '',
        company_phone: item.manual_jobs?.phone ?? '',
        job_phone: item.manual_jobs?.phone ?? '',
      };

      const fallbackTpl = templates[hashToIndex(String(item.tracking_id ?? item.id), templates.length)] ?? templates[0];

      let finalSubject = applyTemplate(fallbackTpl.subject, vars);
      let finalBody = applyTemplate(fallbackTpl.body, vars);

      // Diamond: dynamic generation per job (subject+body). Fallback to template if AI fails.
      if (planTier === 'diamond') {
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-job-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ queueId: item.id }),
          });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload?.success !== false && payload?.subject && payload?.body) {
            finalSubject = String(payload.subject);
            finalBody = String(payload.body);
          }
        } catch {
          // ignore
        }
      }

      const sendProfile = pickSendProfile();
      const dedupeId = planTier === 'diamond' ? crypto.randomUUID() : undefined;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to,
          subject: finalSubject,
          body: finalBody,
          queueId: item.id,
          ...sendProfile,
          dedupeId,
        }),
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

      // Throttling by tier (FREE = 0s, GOLD = 15s fixed, DIAMOND = jitter 15-45s)
      if (idx < items.length - 1) {
        const ms = getDelayMs();
        if (ms > 0) await sleep(ms);
      }
    }

    if (sentIds.length > 0) {
      await supabase.from('my_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', sentIds);
    }

    toast({
      title: t('queue.toasts.sent_title'),
      description: String(t('queue.toasts.sent_desc', { count: formatNumber(sentIds.length) } as any)),
    });

    fetchQueue();
  };

  const handleSendAll = async () => {
    if (pendingItems.length === 0) return;

    // FREE: foreground sending (respects daily limit)
    if (isFree) {
      const slice = pendingItems.slice(0, remainingToday);
      if (slice.length === 0) {
        toast({
          title: t('queue.toasts.daily_limit_reached_title'),
          description: t('queue.toasts.daily_limit_reached_desc'),
          variant: 'destructive',
        });
        return;
      }
      setSending(true);
      try {
        await sendQueueItems(slice);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : t('common.errors.send_failed');
        toast({ title: t('common.errors.send_failed'), description: message, variant: 'destructive' });
      } finally {
        setSending(false);
      }
      return;
    }

    // Premium: start background processing in backend (doesn't require keeping browser open)
    setSending(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t('common.errors.no_session'));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      toast({
        title: t('queue.toasts.bg_started_title'),
        description: t('queue.toasts.bg_started_desc'),
      });
      fetchQueue();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.errors.send_failed');
      toast({ title: t('common.errors.send_failed'), description: message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSendSelected = async () => {
    if (selectedPendingIds.length === 0) return;

    // FREE: foreground sending (respects daily limit)
    if (isFree) {
      const items = pendingItems.filter((it) => selectedPendingIds.includes(it.id)).slice(0, remainingToday);
      if (items.length === 0) {
        toast({
          title: t('queue.toasts.daily_limit_reached_title'),
          description: t('queue.toasts.daily_limit_reached_desc'),
          variant: 'destructive',
        });
        return;
      }

      setSending(true);
      try {
        await sendQueueItems(items);
        setSelectedIds({});
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : t('common.errors.send_failed');
        toast({ title: t('common.errors.send_failed'), description: message, variant: 'destructive' });
      } finally {
        setSending(false);
      }
      return;
    }

    // Premium: background processing
    setSending(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t('common.errors.no_session'));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: selectedPendingIds }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      toast({
        title: t('queue.toasts.bg_started_selected_title'),
        description: t('queue.toasts.bg_started_selected_desc', { count: selectedPendingIds.length }),
      });

      setSelectedIds({});
      fetchQueue();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.errors.send_failed');
      toast({ title: t('common.errors.send_failed'), description: message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSendOne = async (item: QueueItem) => {
    if (item.status !== 'pending') return;
    setSendingOneId(item.id);
    try {
      await sendQueueItems([item]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.errors.send_failed');
      toast({ title: t('common.errors.send_failed'), description: message, variant: 'destructive' });
    } finally {
      setSendingOneId(null);
    }
  };

  const pendingCount = pendingItems.length;
  const sentCount = queue.filter((q) => q.status === 'sent').length;

  const statusLabel = (status: string) => {
    if (status === 'sent') return t('queue.status.sent');
    if (status === 'processing') return t('queue.status.processing');
    if (status === 'failed') return t('queue.status.failed');
    if (status === 'paused') return t('queue.status.paused');
    return t('queue.status.pending');
  };

  const formatOpenedAt = (openedAt: string) => {
    try {
      return format(new Date(openedAt), 'dd/MM/yyyy HH:mm');
    } catch {
      return openedAt;
    }
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={smtpDialogOpen} onOpenChange={setSmtpDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('queue.smtp_required.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('queue.smtp_required.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('queue.smtp_required.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSmtpDialogOpen(false);
                navigate('/settings/email');
              }}
            >
              {t('queue.smtp_required.actions.go_settings')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('queue.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('queue.subtitle', { pendingCount, sentCount })}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <AddManualJobDialog onAdded={fetchQueue} />

          <Button variant="secondary" onClick={handleSendSelected} disabled={selectedPendingIds.length === 0 || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {t('queue.actions.send_selected', { count: selectedPendingIds.length })}
          </Button>

          <Button
            onClick={handleSendAll}
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
            <p className="text-3xl font-bold">{dailyLimitTotal}</p>
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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPendingSelected}
                      onCheckedChange={(v) => {
                        const checked = v === true;
                        if (!checked) {
                          setSelectedIds({});
                          return;
                        }
                        const next: Record<string, boolean> = {};
                        for (const it of pendingItems) next[it.id] = true;
                        setSelectedIds(next);
                      }}
                      aria-label={t('queue.table.headers.select_all')}
                    />
                  </TableHead>
                  <TableHead>{t('queue.table.headers.job_title')}</TableHead>
                  <TableHead>{t('queue.table.headers.company')}</TableHead>
                  <TableHead>{t('queue.table.headers.email')}</TableHead>
                  <TableHead>{t('queue.table.headers.status')}</TableHead>
                  <TableHead className="w-14 text-center">{t('queue.table.headers.open_tracking')}</TableHead>
                  <TableHead className="text-right">{t('queue.table.headers.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                      {t('queue.table.loading')}
                  </TableCell>
                </TableRow>
              ) : queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
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
                    <TableCell className="w-10">
                      <Checkbox
                        checked={!!selectedIds[item.id]}
                        disabled={item.status !== 'pending'}
                        onCheckedChange={(v) => {
                          const checked = v === true;
                          setSelectedIds((prev) => ({ ...prev, [item.id]: checked }));
                        }}
                        aria-label={t('queue.table.headers.select_row')}
                      />
                    </TableCell>
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
                            : item.status === 'failed'
                              ? 'bg-destructive/10 text-destructive border-destructive/30'
                              : item.status === 'paused'
                                ? 'bg-warning/10 text-warning border-warning/30'
                                : item.status === 'processing'
                                  ? 'bg-primary/10 text-primary border-primary/30'
                                  : ''
                        }
                      >
                        {statusLabel(item.status)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center">
                            <Eye
                              className={
                                item.status === 'sent' && item.opened_at
                                  ? 'h-4 w-4 text-success'
                                  : 'h-4 w-4 text-muted-foreground'
                              }
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.status === 'sent' && item.opened_at ? (
                            <div className="space-y-1">
                              <p>
                                {t('queue.open_tracking.opened_at', {
                                  date: formatOpenedAt(item.opened_at),
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">{t('queue.open_tracking.disclaimer')}</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p>{t('queue.open_tracking.waiting')}</p>
                              <p className="text-xs text-muted-foreground">{t('queue.open_tracking.disclaimer')}</p>
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={item.status !== 'pending' || sending || sendingOneId != null}
                          onClick={() => handleSendOne(item)}
                        >
                          {sendingOneId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeFromQueue(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

