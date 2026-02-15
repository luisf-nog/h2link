import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Send, Loader2, RefreshCw, History, Lock, FileText, AlertCircle } from "lucide-react";
import { ReportJobButton } from "@/components/queue/ReportJobButton";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { parseSmtpError } from "@/lib/smtpErrorParser";
import { AddManualJobDialog } from "@/components/queue/AddManualJobDialog";
import { SendHistoryDialog } from "@/components/queue/SendHistoryDialog";
import { MobileQueueCard } from "@/components/queue/MobileQueueCard";
import { SendingStatusCard } from "@/components/queue/SendingStatusCard";
import { useNavigate } from "react-router-dom";
import { format, type Locale } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  opened_at?: string | null;
  profile_viewed_at?: string | null;
  tracking_id?: string;
  created_at: string;
  send_count: number;
  last_error?: string | null;
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

const dateLocaleMap: Record<string, Locale> = { pt: ptBR, en: enUS, es: es };

// --- VARIAÇÕES DE TEXTO SOBRE DOL PROCESSING (ANTI-SPAM) ---
// Focadas no processo do Departamento de Trabalho (DOL), sem usar termos internos.
const EARLY_ACCESS_VARIATIONS = [
  // 1. Padrão Sugerido (Variação A)
  "Attention: I am aware that this job was recently filed and is in initial processing with the Department of Labor (DOL). Understanding that final certification is pending, I am applying proactively.",

  // 2. Foco na Prontidão
  "I understand this job order is currently in initial processing with the DOL. I am submitting my application now to demonstrate my readiness and strong interest once certification is approved.",

  // 3. Profissional e Ciente
  "Acknowledging that this position is currently filed for processing with the Department of Labor, I would like to present my qualifications ahead of the final certification.",

  // 4. Interesse Antecipado
  "I am writing to express my interest in this position, noting that it is currently under review by the DOL. I wanted to ensure my application is on file early in the process.",

  // 5. Disponibilidade
  "Please note: I understand this job order is pending final DOL certification. I am reaching out proactively to confirm my availability for this upcoming season.",

  // 6. Head Start
  "I noticed this position is in the initial filing stage with the Department of Labor. I am applying now to get a head start and express my enthusiasm for joining your team.",

  // 7. Formal
  "Regarding the current status of this job order with the DOL: I am sending my details to express my desire to be considered as soon as the position is fully certified.",

  // 8. Proativo
  "I am applying proactively, understanding that this job order is currently in processing with the Department of Labor. I am highly interested and available.",

  // 9. Comprometimento
  "Although I understand this job is still in the DOL processing phase, I wanted to reach out early to demonstrate my commitment and qualifications.",

  // 10. Directo
  "I am aware that this opportunity is pending final DOL approval. Please accept my application as an expression of my strong interest in this future opening.",
];

export default function Queue() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [smtpReady, setSmtpReady] = useState<boolean | null>(null);
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<QueueItem | null>(null);

  const planTier = profile?.plan_tier || "free";
  const isFreeUser = planTier === "free";
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  const dailyLimitTotal = (PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0) + referralBonus;
  const creditsUsedToday = profile?.credits_used_today || 0;
  const remainingToday = Math.max(0, dailyLimitTotal - creditsUsedToday);

  const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  const pickSendProfile = () => {
    if (planTier === "gold") {
      return { xMailer: "Microsoft Outlook 16.0", userAgent: "Microsoft Outlook 16.0" };
    }
    if (planTier === "diamond") {
      const pool = [
        { xMailer: "iPhone Mail (20A362)", userAgent: "iPhone Mail (20A362)" },
        { xMailer: "Android Mail", userAgent: "Android Mail" },
        { xMailer: "Mozilla Thunderbird", userAgent: "Mozilla Thunderbird" },
        { xMailer: "Microsoft Outlook 16.0", userAgent: "Microsoft Outlook 16.0" },
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return {};
  };

  const getDelayMs = () => {
    if (planTier === "gold") return 5000;
    if (planTier === "diamond") return 5000 + Math.floor(Math.random() * 10000);
    return 1000;
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from("smtp_credentials")
        .select("has_password")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
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
        .channel("my_queue_open_tracking")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "my_queue",
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
      .from("my_queue")
      .select(
        `
        id, status, sent_at, opened_at, profile_viewed_at, tracking_id, created_at, send_count, last_error,
        public_jobs (id, job_title, company, email, city, state, visa_type),
        manual_jobs (id, company, job_title, email, eta_number, phone)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching queue:", error);
      toast({
        title: t("queue.toasts.load_error_title"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      setQueue((data as unknown as QueueItem[]) || []);
    }
    setLoading(false);
  };

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase.from("my_queue").delete().eq("id", id);
    if (error) {
      toast({
        title: t("queue.toasts.remove_error_title"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      setQueue(queue.filter((item) => item.id !== id));
      toast({
        title: t("queue.toasts.remove_success_title"),
        description: t("queue.toasts.remove_success_desc"),
      });
    }
  };

  const applyTemplate = (text: string, vars: Record<string, string>) => {
    let out = text;
    for (const [k, v] of Object.entries(vars)) {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
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

  const pendingItems = useMemo(() => queue.filter((q) => q.status === "pending"), [queue]);
  const processingItems = useMemo(() => queue.filter((q) => q.status === "processing"), [queue]);
  const failedItems = useMemo(() => queue.filter((q) => q.status === "failed"), [queue]);
  const pendingIds = useMemo(() => new Set(pendingItems.map((i) => i.id)), [pendingItems]);
  const selectedPendingIds = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id] && pendingIds.has(id)),
    [selectedIds, pendingIds],
  );
  const allPendingSelected = pendingItems.length > 0 && selectedPendingIds.length === pendingItems.length;

  const ensureCanSend = async () => {
    if (smtpReady !== true) {
      if (profile?.id) {
        const { data, error } = await supabase
          .from("smtp_credentials")
          .select("has_password")
          .eq("user_id", profile.id)
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
      setUpgradeDialogOpen(true);
      return { ok: false as const };
    }

    if (!profile?.full_name || profile?.age == null || !profile?.phone_e164 || !profile?.contact_email) {
      toast({
        title: t("smtp.toasts.profile_incomplete_title"),
        description: t("smtp.toasts.profile_incomplete_desc"),
        variant: "destructive",
      });
      return { ok: false as const };
    }

    const { data: tplData, error: tplError } = await supabase
      .from("email_templates")
      .select("id,name,subject,body")
      .order("created_at", { ascending: false });
    if (tplError) {
      toast({ title: t("common.errors.save_failed"), description: tplError.message, variant: "destructive" });
      return { ok: false as const };
    }

    const templates = ((tplData as EmailTemplate[]) ?? []).filter(Boolean);
    if (templates.length === 0 && planTier !== "black") {
      toast({
        title: t("queue.toasts.no_template_title"),
        description: t("queue.toasts.no_template_desc"),
        variant: "destructive",
      });
      return { ok: false as const };
    }

    return { ok: true as const, templates };
  };

  useEffect(() => {
    setSelectedIds((prev) => {
      const next: Record<string, boolean> = {};
      for (const [id, checked] of Object.entries(prev)) {
        if (checked && pendingIds.has(id)) next[id] = true;
      }
      return next;
    });
  }, [pendingIds]);

  const invokeEdgeFunction = async (functionName: string, body: any) => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw error;
    return data;
  };

  const sendQueueItems = async (items: QueueItem[]) => {
    const guard = await ensureCanSend();
    if (!guard.ok) return;

    const { templates } = guard;
    const sentIds: string[] = [];
    const failedIds: string[] = [];
    const failedErrors: string[] = [];
    let creditsRemaining = remainingToday;

    setQueue((prev) => prev.map((q) => (items.find((i) => i.id === q.id) ? { ...q, status: "processing" } : q)));

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];

      if (creditsRemaining <= 0) {
        toast({
          title: t("queue.toasts.daily_limit_reached_title"),
          description: t("queue.toasts.daily_limit_reached_desc"),
          variant: "destructive",
        });
        break;
      }

      const job = item.public_jobs ?? item.manual_jobs;
      if (!job?.email) {
        await supabase
          .from("my_queue")
          .update({
            status: "failed",
            last_error: "Email ausente",
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failedIds.push(item.id);
        failedErrors.push("Email ausente");
        continue;
      }

      const to = job.email;
      const visaType = item.public_jobs?.visa_type || "H-2B";

      const vars: Record<string, string> = {
        name: profile?.full_name ?? "",
        age: String(profile?.age ?? ""),
        phone: profile?.phone_e164 ?? "",
        contact_email: profile?.contact_email ?? "",
        company: job.company ?? "",
        position: job.job_title ?? "",
        visa_type: visaType,
        eta_number: item.manual_jobs?.eta_number ?? "",
        company_phone: item.manual_jobs?.phone ?? "",
        job_phone: item.manual_jobs?.phone ?? "",
      };

      const fallbackTpl =
        templates.length > 0
          ? (templates[hashToIndex(String(item.tracking_id ?? item.id), templates.length)] ?? templates[0])
          : null;

      let finalSubject = fallbackTpl ? applyTemplate(fallbackTpl.subject, vars) : "";
      let finalBody = fallbackTpl ? applyTemplate(fallbackTpl.body, vars) : "";

      // --- LOGICA DE EARLY ACCESS (DOL CONTEXT) ---
      // Se a vaga for marcada internamente como "Early Access",
      // adiciona um aviso sobre o processamento no DOL.
      if (visaType?.toLowerCase().includes("early access")) {
        const randomIndex = Math.floor(Math.random() * EARLY_ACCESS_VARIATIONS.length);
        const randomIntro = EARLY_ACCESS_VARIATIONS[randomIndex];
        finalBody = randomIntro + "\n\n" + finalBody;
      }
      // --------------------------------------------

      try {
        if (planTier === "black") {
          try {
            const payload = await invokeEdgeFunction("generate-job-email", { queueId: item.id });
            if (payload?.success !== false && payload?.subject && payload?.body) {
              finalSubject = String(payload.subject);
              finalBody = String(payload.body);

              // Garante que o texto de early access seja mantido com variação, se a IA não colocou
              if (
                visaType?.toLowerCase().includes("early access") &&
                !finalBody.toLowerCase().includes("department of labor")
              ) {
                const randomIndex = Math.floor(Math.random() * EARLY_ACCESS_VARIATIONS.length);
                const randomIntro = EARLY_ACCESS_VARIATIONS[randomIndex];
                finalBody = randomIntro + "\n\n" + finalBody;
              }
            } else if (payload?.error === "resume_data_missing") {
              throw new Error("resume_data_missing");
            }
          } catch (e) {
            if (e.message === "resume_data_missing") {
              toast({
                title: t("queue.toasts.resume_required_title"),
                description: t("queue.toasts.resume_required_desc"),
                variant: "destructive",
              });
              navigate("/settings?tab=resume");
              throw e;
            }
            if (!finalSubject.trim() || !finalBody.trim()) {
              throw new Error(t("queue.toasts.black_ai_failed_no_fallback"));
            }
          }
        }

        const sendProfile = pickSendProfile();
        const dedupeId = planTier === "black" ? crypto.randomUUID() : undefined;

        console.log(`[Queue] Enviando email para ${to}, queueId: ${item.id}`);

        const payload = await invokeEdgeFunction("send-email-custom", {
          to,
          subject: finalSubject,
          body: finalBody,
          queueId: item.id,
          ...sendProfile,
          dedupeId,
        });

        if (payload?.success === false) {
          if (payload?.error === "daily_limit_reached") {
            setUpgradeDialogOpen(true);
            break;
          }
          throw new Error(payload?.error || `Falha ao enviar para ${to}`);
        }

        console.log(`[Queue] Email enviado com sucesso para ${to}`);
        sentIds.push(item.id);
        creditsRemaining -= 1;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : t("common.errors.send_failed");
        console.error(`[Queue] Erro ao processar item ${item.id}:`, e);

        const now = new Date().toISOString();
        await supabase
          .from("my_queue")
          .update({
            status: "failed",
            last_error: message,
            last_attempt_at: now,
          })
          .eq("id", item.id);

        await supabase.from("queue_send_history").insert({
          queue_id: item.id,
          user_id: profile?.id,
          sent_at: now,
          status: "failed",
          error_message: message,
        });

        failedIds.push(item.id);
        failedErrors.push(message);
      }

      if (idx < items.length - 1 && sentIds.length > 0) {
        const ms = getDelayMs();
        if (ms > 0) await sleep(ms);
      }
    }

    for (const sentId of sentIds) {
      const currentItem = items.find((i) => i.id === sentId);
      const newCount = (currentItem?.send_count ?? 0) + 1;
      const now = new Date().toISOString();
      await supabase.from("my_queue").update({ status: "sent", sent_at: now, send_count: newCount }).eq("id", sentId);

      await supabase.from("queue_send_history").insert({
        queue_id: sentId,
        user_id: profile?.id,
        sent_at: now,
        status: "success",
      });
    }

    if (sentIds.length > 0 && failedIds.length === 0) {
      toast({
        title: t("queue.toasts.sent_title"),
        description: String(t("queue.toasts.sent_desc", { count: formatNumber(sentIds.length) } as any)),
      });
    } else if (sentIds.length > 0 && failedIds.length > 0) {
      toast({
        title: String(t("queue.toasts.partial_success_title")),
        description: `Enviados: ${sentIds.length}, Falharam: ${failedIds.length}`,
        variant: "default",
      });
    } else if (sentIds.length === 0 && failedIds.length > 0) {
      toast({
        title: "Falha no envio",
        description: "Verifique as mensagens de erro nos itens.",
        variant: "destructive",
      });
    }

    await refreshProfile();
    fetchQueue();
  };

  const handleSendAll = async () => {
    if (pendingItems.length === 0) return;
    const items = pendingItems.slice(0, remainingToday);
    if (items.length === 0) {
      toast({ title: t("queue.toasts.daily_limit_reached_title"), variant: "destructive" });
      return;
    }
    setSending(true);
    await sendQueueItems(items).finally(() => setSending(false));
  };

  const handleSendSelected = async () => {
    if (selectedPendingIds.length === 0) return;
    const items = pendingItems.filter((it) => selectedPendingIds.includes(it.id)).slice(0, remainingToday);
    if (items.length === 0) {
      toast({ title: t("queue.toasts.daily_limit_reached_title"), variant: "destructive" });
      return;
    }
    setSending(true);
    await sendQueueItems(items).finally(() => setSending(false));
    setSelectedIds({});
  };

  const handleSendOne = async (item: QueueItem) => {
    if (item.status !== "pending" && item.status !== "sent") return;
    if (sendingIds.has(item.id)) return;
    setSendingIds((prev) => new Set(prev).add(item.id));
    if (item.status === "sent") {
      await supabase.from("my_queue").update({ status: "pending", last_error: null }).eq("id", item.id);
    }
    await sendQueueItems([item]).finally(() => {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    });
  };

  const handleRetryOne = async (item: QueueItem) => {
    if (item.status !== "failed") return;
    setRetryingId(item.id);
    await supabase.from("my_queue").update({ status: "pending", last_error: null }).eq("id", item.id);
    const updatedItem = { ...item, status: "pending" };
    await sendQueueItems([updatedItem]).finally(() => setRetryingId(null));
  };

  const handleRetryAllFailed = async () => {
    if (failedItems.length === 0) return;
    const failedIds = failedItems.map((it) => it.id);
    await supabase.from("my_queue").update({ status: "pending", last_error: null }).in("id", failedIds);
    const updatedItems = failedItems.map((it) => ({ ...it, status: "pending" }));
    setSending(true);
    await sendQueueItems(updatedItems.slice(0, remainingToday)).finally(() => setSending(false));
  };

  const pendingCount = pendingItems.length;
  const sentCount = creditsUsedToday;

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

  return (
    <div className="space-y-6">
      <AlertDialog open={smtpDialogOpen} onOpenChange={setSmtpDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("queue.smtp_required.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("queue.smtp_required.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("queue.smtp_required.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSmtpDialogOpen(false);
                navigate("/settings/email");
              }}
            >
              {t("queue.smtp_required.actions.go_settings")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("queue.upgrade_required.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("queue.upgrade_required.description", { limit: dailyLimitTotal })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("queue.upgrade_required.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUpgradeDialogOpen(false);
                navigate("/plans");
              }}
            >
              {t("queue.upgrade_required.actions.view_plans")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={premiumDialogOpen} onOpenChange={setPremiumDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("queue.toasts.bulk_premium_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("queue.toasts.bulk_premium_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("queue.upgrade_required.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPremiumDialogOpen(false);
                navigate("/plans");
              }}
            >
              {t("queue.toasts.bulk_premium_cta")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        queueId={historyItem?.id ?? ""}
        jobTitle={(historyItem?.public_jobs ?? historyItem?.manual_jobs)?.job_title ?? ""}
        company={(historyItem?.public_jobs ?? historyItem?.manual_jobs)?.company ?? ""}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("queue.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("queue.subtitle", { pendingCount, sentCount })}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <AddManualJobDialog onAdded={fetchQueue} />

          {failedItems.length > 0 && (
            <Button variant="outline" onClick={handleRetryAllFailed} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {t("queue.actions.retry_all_failed", { count: failedItems.length })}
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={handleSendSelected}
            disabled={selectedPendingIds.length === 0 || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {t("queue.actions.send_selected", { count: selectedPendingIds.length })}
          </Button>

          <Button onClick={handleSendAll} disabled={pendingCount === 0 || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {t("queue.actions.send", { pendingCount })}
          </Button>
        </div>
      </div>

      {(processingItems.length > 0 || (sending && pendingItems.length > 0)) && (
        <SendingStatusCard
          processingCount={processingItems.length}
          pendingCount={pendingItems.length}
          planTier={planTier}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("queue.stats.in_queue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("queue.stats.sent_today")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(sentCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("queue.stats.daily_limit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dailyLimitTotal}</p>
          </CardContent>
        </Card>
      </div>

      <TooltipProvider>
        {isMobile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("queue.table.title")}</h2>
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
                aria-label={t("queue.table.headers.select_all")}
              />
            </div>
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">{t("queue.table.loading")}</CardContent>
              </Card>
            ) : queue.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="space-y-2">
                    <p className="text-muted-foreground">{t("queue.table.empty")}</p>
                    <Button variant="outline" onClick={() => navigate("/jobs")}>
                      {t("queue.table.go_jobs")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              queue.map((item) => (
                <MobileQueueCard
                  key={item.id}
                  item={item}
                  isSelected={!!selectedIds[item.id]}
                  onSelectChange={(checked) => setSelectedIds((prev) => ({ ...prev, [item.id]: checked }))}
                  onSend={() => handleSendOne(item)}
                  onRetry={() => handleRetryOne(item)}
                  onRemove={() => removeFromQueue(item.id)}
                  onViewHistory={() => {
                    setHistoryItem(item);
                    setHistoryDialogOpen(true);
                  }}
                  isSending={sendingIds.has(item.id)}
                  isRetrying={retryingId === item.id}
                  globalSending={sending}
                />
              ))
            )}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("queue.table.title")}</CardTitle>
              <CardDescription>{t("queue.table.description")}</CardDescription>
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
                        aria-label={t("queue.table.headers.select_all")}
                      />
                    </TableHead>
                    <TableHead>{t("queue.table.headers.job_title")}</TableHead>
                    <TableHead>{t("queue.table.headers.company")}</TableHead>
                    <TableHead>{t("queue.table.headers.email")}</TableHead>
                    <TableHead>{t("queue.table.headers.status")}</TableHead>
                    <TableHead className="w-14 text-center">{t("queue.table.headers.resume_view", "CV")}</TableHead>
                    <TableHead className="text-right">{t("queue.table.headers.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        {t("queue.table.loading")}
                      </TableCell>
                    </TableRow>
                  ) : queue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="space-y-2">
                          <p className="text-muted-foreground">{t("queue.table.empty")}</p>
                          <Button variant="outline" onClick={() => (window.location.href = "/jobs")}>
                            {t("queue.table.go_jobs")}
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
                            disabled={item.status !== "pending"}
                            onCheckedChange={(v) => {
                              const checked = v === true;
                              setSelectedIds((prev) => ({ ...prev, [item.id]: checked }));
                            }}
                            aria-label={t("queue.table.headers.select_row")}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {(item.public_jobs ?? item.manual_jobs)?.job_title}
                        </TableCell>
                        <TableCell>{(item.public_jobs ?? item.manual_jobs)?.company}</TableCell>
                        <TableCell>{(item.public_jobs ?? item.manual_jobs)?.email}</TableCell>
                        <TableCell>
                          {item.status === "failed" && item.last_error ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="bg-destructive/10 text-destructive border-destructive/30 cursor-help"
                                >
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {(() => {
                                    const parsed = parseSmtpError(item.last_error ?? "");
                                    return t(parsed.titleKey);
                                  })()}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-destructive text-xs">
                                    {(() => {
                                      const parsed = parseSmtpError(item.last_error ?? "");
                                      return t(parsed.titleKey);
                                    })()}
                                  </p>
                                  <p className="text-xs">
                                    {(() => {
                                      const parsed = parseSmtpError(item.last_error ?? "");
                                      return t(parsed.descriptionKey);
                                    })()}
                                  </p>
                                  {(() => {
                                    const parsed = parseSmtpError(item.last_error ?? "");
                                    return parsed.category === "unknown" ? (
                                      <p className="text-[10px] text-muted-foreground mt-1 font-mono break-all">
                                        {item.last_error}
                                      </p>
                                    ) : null;
                                  })()}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge
                              variant={item.status === "sent" ? "default" : "secondary"}
                              className={
                                item.status === "sent"
                                  ? "bg-success/10 text-success border-success/30"
                                  : item.status === "failed"
                                    ? "bg-destructive/10 text-destructive border-destructive/30"
                                    : item.status === "paused"
                                      ? "bg-warning/10 text-warning border-warning/30"
                                      : item.status === "processing"
                                        ? "bg-primary/10 text-primary border-primary/30"
                                        : item.status === "skipped_invalid_domain"
                                          ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                                          : ""
                              }
                            >
                              {item.status === "sent" && item.sent_at && item.send_count > 0 ? (
                                <span className="flex items-center gap-1">
                                  {item.send_count}x{" "}
                                  {format(
                                    new Date(item.sent_at),
                                    i18n.language === "en" ? "MM/dd hh:mm a" : "dd/MM HH:mm",
                                    { locale: dateLocaleMap[i18n.language] ?? enUS },
                                  )}
                                </span>
                              ) : (
                                statusLabel(item.status)
                              )}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center">
                                <FileText
                                  className={
                                    item.status === "sent" && item.profile_viewed_at
                                      ? "h-4 w-4 text-success"
                                      : "h-4 w-4 text-muted-foreground"
                                  }
                                />
                              </span>
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
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {item.public_jobs?.id && <ReportJobButton jobId={item.public_jobs.id} />}

                            {item.send_count > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setHistoryItem(item);
                                  setHistoryDialogOpen(true);
                                }}
                                title={t("queue.actions.view_history")}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            )}

                            {item.status === "failed" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={sending || retryingId != null}
                                onClick={() => handleRetryOne(item)}
                                title={t("queue.actions.retry")}
                              >
                                {retryingId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={
                                  (item.status !== "pending" && item.status !== "sent") ||
                                  sending ||
                                  sendingIds.has(item.id)
                                }
                                onClick={() => handleSendOne(item)}
                                title={item.status === "sent" ? t("queue.actions.resend") : undefined}
                              >
                                {sendingIds.has(item.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : item.status === "sent" ? (
                                  <RefreshCw className="h-4 w-4" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}

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
        )}
      </TooltipProvider>
    </div>
  );
}
