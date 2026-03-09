import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueueStore, type QueueItem } from "@/stores/useQueueStore";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { PLANS_CONFIG } from "@/config/plans.config";
import { useWarmupStatus } from "@/hooks/useWarmupStatus";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Send, Loader2, RefreshCw, History, Lock, FileText, AlertCircle, Mail, Pause, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportJobButton } from "@/components/queue/ReportJobButton";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { parseSmtpError, isSystemicSmtpError } from "@/lib/smtpErrorParser";
import { AddManualJobDialog } from "@/components/queue/AddManualJobDialog";
import { SendHistoryDialog } from "@/components/queue/SendHistoryDialog";
import { MobileQueueCard } from "@/components/queue/MobileQueueCard";
import { useNavigate } from "react-router-dom";
import { format, type Locale } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { formatDateTz } from "@/lib/formatDate";
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

// QueueItem type is now imported from useQueueStore

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

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
  const { queue, setQueue, lastFetchedAt, fetchQueue: storeRefresh, forceFetchQueue, smtpReady, setSmtpReady, checkSmtp, sending, setSending, sendProgress, setSendProgress, sendCancelled, setSendCancelled } = useQueueStore();
  const loading = lastFetchedAt === 0;
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<QueueItem | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const sendingRef = useRef(false);

  const planTier = profile?.plan_tier || "free";
  const isFreeUser = planTier === "free";
  const warmup = useWarmupStatus();
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  // For paid plans, use the effective warm-up limit instead of the plan hard cap
  const dailyLimitTotal = isFreeUser
    ? (PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0) + referralBonus
    : warmup.effectiveLimit;
  const creditsUsedToday = isFreeUser ? (profile?.credits_used_today || 0) : warmup.emailsSentToday;
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
    if (planTier === "gold") return 15_000; // 15s fixo
    if (planTier === "diamond") return 15_000 + Math.floor(Math.random() * 30_001); // 15-45s (synced with backend)
    if (planTier === "black") return 60_000 + Math.floor(Math.random() * 240_001); // 1-5 min
    return 1000;
  };

  // Initial fetch (stale-checked — instant if already cached)
  useEffect(() => {
    storeRefresh();
  }, []);

  // Recompute time-based processing badge display every 30s (UI only, no fetch)
  useEffect(() => {
    const id = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Silent refresh when user returns to tab (replaces polling)
  const handleVisibilityRefresh = useCallback(() => {
    if (!sendingRef.current) storeRefresh();
  }, [storeRefresh]);
  useVisibilityRefresh(handleVisibilityRefresh);

  // SMTP readiness check (via store)
  useEffect(() => {
    if (profile?.id) checkSmtp(profile.id);
  }, [profile?.id, checkSmtp]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled) fetchQueue();
      }, 800);
    };

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      channel = supabase
        .channel("my_queue_realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "my_queue",
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            if (payload.eventType === "UPDATE") {
              const next = payload?.new;
              if (!next?.id) return;
              setQueue((prev) => prev.map((it) => (it.id === next.id ? { ...it, ...next } : it)));
              // Skip full refetch while sending to avoid overwriting optimistic state
              if (!sendingRef.current) debouncedFetch();
            } else {
              // INSERT or DELETE — refetch to get full joined data
              if (!sendingRef.current) debouncedFetch();
            }
          },
        )
        .subscribe();
    };

    run();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const STUCK_PROCESSING_MINUTES = 10;

  // fetchQueue is now handled by the store — this local alias is for realtime/toast usage
  const fetchQueue = forceFetchQueue;

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase.from("my_queue").delete().eq("id", id);
    if (error) {
      toast({
        title: t("queue.toasts.remove_error_title"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      setQueue((prev) => prev.filter((item) => item.id !== id));
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
  // Only show badge for items that started processing recently (< 4 min)
  const activeProcessingItems = useMemo(() => {
    const cutoffMs = clockTick - STUCK_PROCESSING_MINUTES * 60 * 1000;
    return processingItems.filter((q) => {
      const ts = q.processing_started_at || q.created_at;
      return new Date(ts).getTime() > cutoffMs;
    });
  }, [processingItems, clockTick]);
  const failedItems = useMemo(() => queue.filter((q) => q.status === "failed"), [queue]);
  const pausedItems = useMemo(() => queue.filter((q) => q.status === "paused" || q.status === "skipped_invalid_domain"), [queue]);
  const pendingIds = useMemo(() => new Set(pendingItems.map((i) => i.id)), [pendingItems]);
  const selectedPendingIds = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id] && pendingIds.has(id)),
    [selectedIds, pendingIds],
  );
  const allPendingSelected = pendingItems.length > 0 && selectedPendingIds.length === pendingItems.length;

  const filteredQueue = useMemo(() => {
    let items = queue;
    if (statusFilter !== "all") {
      items = items.filter((q) => q.status === statusFilter);
    }
    if (searchText.trim()) {
      const lower = searchText.trim().toLowerCase();
      items = items.filter((q) => {
        const job = q.public_jobs ?? q.manual_jobs;
        if (!job) return false;
        return (
          job.email.toLowerCase().includes(lower) ||
          job.company.toLowerCase().includes(lower) ||
          job.job_title.toLowerCase().includes(lower)
        );
      });
    }
    return items;
  }, [queue, searchText, statusFilter]);

  const ensureCanSend = async () => {
    // --- TRAVA 1: Verificação obrigatória de SMTP ---
    if (!(profile as any)?.smtp_verified) {
      toast({
        title: t("smtp.not_verified_title"),
        description: t("smtp.not_verified_desc"),
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/email")} className="shrink-0">
            {t("smtp.verify_and_activate")}
          </Button>
        ),
      });
      return { ok: false as const };
    }

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

  const resetConsecutiveErrors = async () => {
    if (!profile?.id) return;
    await supabase.from("profiles").update({ consecutive_errors: 0 }).eq("id", profile.id);
  };

  const sendQueueItems = async (items: QueueItem[], lazyActivate = false) => {
    const guard = await ensureCanSend();
    if (!guard.ok) return;

    const { templates } = guard;
    const sentIds: string[] = [];
    const failedIds: string[] = [];
    const failedErrors: string[] = [];
    let creditsRemaining = remainingToday;
    let consecutiveSmtpFailures = 0;

    // Reset stale consecutive_errors before any batch send
    await resetConsecutiveErrors();

    // IMPORTANT: do not pre-mark the whole batch as processing.
    // We activate per-item right before each send to avoid stuck "processing" states on pause/break.

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];

      // Read directly from store to avoid stale closure
      if (useQueueStore.getState().sendCancelled) {
        toast({
          title: t("queue.toasts.paused_title", { defaultValue: "Envio pausado" }),
          description: t("queue.toasts.paused_desc", { count: sentIds.length, defaultValue: "{{count}} email(s) enviado(s) antes da pausa." }),
        });
        break;
      }

      if (creditsRemaining <= 0) {
        toast({
          title: t("queue.toasts.daily_limit_reached_title"),
          description: t("queue.toasts.daily_limit_reached_desc"),
          variant: "destructive",
        });
        break;
      }

      // Mark item as processing right before sending (atomic lock — only if still pending)
      const { data: locked } = await supabase
        .from("my_queue")
        .update({
          status: "processing",
          processing_started_at: new Date().toISOString(),
          last_error: null,
          opened_at: null,
          email_open_count: 0,
          profile_viewed_at: null,
          ...(lazyActivate ? { tracking_id: crypto.randomUUID() } : {}),
        })
        .eq("id", item.id)
        .eq("status", lazyActivate ? item.status : "pending")
        .select("id")
        .maybeSingle();

      if (!locked) {
        // Another process (cron) already grabbed this item — skip it
        console.log(`[Queue] Item ${item.id} lock not acquired, skipping`);
        continue;
      }
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing", processing_started_at: new Date().toISOString() } : q)));

      const job = item.public_jobs ?? item.manual_jobs;
      if (!job?.email) {
        await supabase
          .from("my_queue")
          .update({
            status: "failed",
            last_error: "Email ausente",
            last_attempt_at: new Date().toISOString(),
            processing_started_at: null,
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
            // For paid plans hitting warm-up limit, show informative toast instead of upgrade dialog
            if (!isFreeUser) {
              toast({
                title: t("queue.toasts.warmup_limit_title", { defaultValue: "Limite de aquecimento atingido" }),
                description: t("queue.toasts.warmup_limit_desc", {
                  sent: sentIds.length,
                  limit: dailyLimitTotal,
                  defaultValue: "{{sent}} email(s) enviado(s). Seu limite atual de aquecimento é {{limit}}/dia. Ele aumenta automaticamente com o uso.",
                }),
              });
            } else {
              setUpgradeDialogOpen(true);
            }
            break;
          }
          throw new Error(payload?.error || `Falha ao enviar para ${to}`);
        }

        console.log(`[Queue] Email enviado com sucesso para ${to}`);

        // === sent_at is now set by DB trigger (server time) to avoid clock skew ===
        const newCount = (item.send_count ?? 0) + 1;
        await supabase
          .from("my_queue")
          .update({ status: "sent", send_count: newCount, processing_started_at: null })
          .eq("id", item.id);

        await supabase.from("queue_send_history").insert({
          queue_id: item.id,
          user_id: profile?.id,
          status: "success",
        });

        sentIds.push(item.id);
        creditsRemaining -= 1;
        consecutiveSmtpFailures = 0; // Reset on success
        setSendProgress({ sent: sentIds.length, total: items.length });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : t("common.errors.send_failed");
        console.error(`[Queue] Erro ao processar item ${item.id}:`, e);

        // Only count systemic errors (auth, connection, AI) toward circuit breaker
        const isSystemic = isSystemicSmtpError(message);
        if (isSystemic) {
          consecutiveSmtpFailures += 1;
        }

        const now = new Date().toISOString();
        await supabase
          .from("my_queue")
          .update({
            status: "failed",
            last_error: message,
            last_attempt_at: now,
            processing_started_at: null,
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

        // --- TRAVA 2: Disjuntor automático (Circuit Breaker) — only for systemic errors ---
        if (consecutiveSmtpFailures >= 5 && profile?.id) {
          await supabase
            .from("profiles")
            .update({ smtp_verified: false })
            .eq("id", profile.id);
          await refreshProfile();

          const lastErrorParsed = parseSmtpError(message);

          toast({
            title: t("smtp.circuit_breaker_title"),
            description: t(lastErrorParsed.descriptionKey, { defaultValue: t("smtp.circuit_breaker_desc") }),
            variant: "destructive",
            action: (
              <Button variant="outline" size="sm" onClick={() => navigate("/settings/email")} className="shrink-0">
                {t("smtp.verify_and_activate")}
              </Button>
            ),
          });
          break;
        }
      }

      if (idx < items.length - 1 && sentIds.length > 0) {
        const ms = getDelayMs();
        if (ms > 0) await sleep(ms);
      }
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
    setSendCancelled(false);
    setSending(true);
    sendingRef.current = true;
    setSendProgress({ sent: 0, total: items.length });
    await sendQueueItems(items).finally(() => {
      setSending(false);
      sendingRef.current = false;
      setSendProgress({ sent: 0, total: 0 });
    });
  };

  const handleSendSelected = async () => {
    if (selectedPendingIds.length === 0) return;
    const items = pendingItems.filter((it) => selectedPendingIds.includes(it.id)).slice(0, remainingToday);
    if (items.length === 0) {
      toast({ title: t("queue.toasts.daily_limit_reached_title"), variant: "destructive" });
      return;
    }
    setSendCancelled(false);
    setSending(true);
    sendingRef.current = true;
    setSendProgress({ sent: 0, total: items.length });
    await sendQueueItems(items).finally(() => {
      setSending(false);
      sendingRef.current = false;
      setSendProgress({ sent: 0, total: 0 });
    });
    setSelectedIds({});
  };

  const MAX_SEND_ATTEMPTS = 2;

  const handleSendOne = async (item: QueueItem) => {
    const resendableStatuses = ["pending", "sent", "paused", "skipped_invalid_domain"];
    if (!resendableStatuses.includes(item.status)) return;
    if (sendingIds.has(item.id)) return;

    // Block if max retries reached
    if (item.send_count >= MAX_SEND_ATTEMPTS && item.status !== "pending") {
      toast({
        title: t("queue.toasts.max_retries_title", { defaultValue: "Limite de tentativas atingido" }),
        description: t("queue.toasts.max_retries_desc", { max: MAX_SEND_ATTEMPTS, defaultValue: "Esta vaga já foi enviada {{max}} vezes. Remova e adicione novamente se necessário." }),
        variant: "destructive",
      });
      return;
    }

    setSendingIds((prev) => new Set(prev).add(item.id));
    if (item.status !== "pending") {
      await supabase.from("my_queue").update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        last_error: null,
        opened_at: null,
        email_open_count: 0,
        profile_viewed_at: null,
        tracking_id: crypto.randomUUID(),
      }).eq("id", item.id);
    }
    await sendQueueItems([{ ...item, status: "processing" }]).finally(() => {
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
    const items = failedItems.slice(0, remainingToday);
    setSendCancelled(false);
    setSending(true);
    sendingRef.current = true;
    setSendProgress({ sent: 0, total: items.length });
    await sendQueueItems(items, true).finally(() => {
      setSending(false);
      sendingRef.current = false;
      setSendProgress({ sent: 0, total: 0 });
    });
  };

  const handleRetryAllPaused = async () => {
    const eligible = pausedItems.filter((it) => it.send_count < MAX_SEND_ATTEMPTS);
    if (eligible.length === 0) return;
    const items = eligible.slice(0, remainingToday);
    setSendCancelled(false);
    setSending(true);
    sendingRef.current = true;
    setSendProgress({ sent: 0, total: items.length });
    await sendQueueItems(items, true).finally(() => {
      setSending(false);
      sendingRef.current = false;
      setSendProgress({ sent: 0, total: 0 });
    });
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

  const userTz = profile?.timezone;

  const formatOpenedAt = (openedAt: string) => {
    return formatDateTz(openedAt, i18n.language, userTz);
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

          {pausedItems.length > 0 && (
            <Button variant="outline" onClick={handleRetryAllPaused} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {t("queue.actions.retry_all_paused", { count: pausedItems.length, defaultValue: "Reenviar pausadas ({{count}})" })}
            </Button>
          )}

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

      {/* Show badge when actively sending OR when there are RECENT processing items */}
      {(sending || activeProcessingItems.length > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="text-sm font-medium text-foreground">
            {sending
              ? t("queue.sending_badge.label", {
                  sent: sendProgress.sent,
                  total: sendProgress.total,
                  defaultValue: "Enviando {{sent}}/{{total}} emails...",
                })
              : t("queue.sending_badge.processing", {
                  count: activeProcessingItems.length,
                  defaultValue: "{{count}} email(s) sendo enviado(s)...",
                })
            }
          </span>
          {sending && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs"
              onClick={() => { setSendCancelled(true); }}
            >
              <Pause className="h-3.5 w-3.5 mr-1" />
              {t("queue.sending_badge.pause", { defaultValue: "Pausar" })}
            </Button>
          )}
        </div>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("queue.filters.search_placeholder", { defaultValue: "Buscar email, empresa ou cargo..." })}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t("queue.filters.status_placeholder", { defaultValue: "Filtrar status" })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("queue.filters.all", { defaultValue: "Todos" })}</SelectItem>
            <SelectItem value="pending">{t("queue.status.pending", { defaultValue: "Pendente" })}</SelectItem>
            <SelectItem value="processing">{t("queue.status.processing", { defaultValue: "Processando" })}</SelectItem>
            <SelectItem value="sent">{t("queue.status.sent", { defaultValue: "Enviado" })}</SelectItem>
            <SelectItem value="failed">{t("queue.status.failed", { defaultValue: "Falhou" })}</SelectItem>
            <SelectItem value="paused">{t("queue.status.paused", { defaultValue: "Pausado" })}</SelectItem>
            <SelectItem value="skipped_invalid_domain">{t("queue.status.skipped_invalid_domain", { defaultValue: "DNS inválido" })}</SelectItem>
          </SelectContent>
        </Select>
        {(searchText || statusFilter !== "all") && (
          <span className="text-sm text-muted-foreground self-center">
            {t("queue.filters.results_count", { count: filteredQueue.length, defaultValue: "{{count}} resultado(s)" })}
          </span>
        )}
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
            ) : filteredQueue.length === 0 ? (
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
              filteredQueue.map((item) => (
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
                    <TableHead className="w-24 text-center">{t("queue.table.headers.tracking", "Tracking")}</TableHead>
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
                  ) : filteredQueue.length === 0 ? (
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
                    filteredQueue.map((item) => (
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
                              {item.status === "sent" && item.sent_at ? (
                                <span className="flex items-center gap-1">
                                  {Math.max(item.send_count, 1)}x{" "}
                                  {formatDateTz(item.sent_at, i18n.language, userTz, { short: true })}
                                </span>
                              ) : (
                                statusLabel(item.status)
                              )}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {item.send_count > 0 || item.status === "sent" ? (
                          <div className="flex items-center justify-center gap-2">
                            {/* Email open tracking */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <Mail
                                    className={
                                      item.status === "sent" && item.opened_at
                                        ? "h-4 w-4 text-success"
                                        : "h-4 w-4 text-muted-foreground"
                                    }
                                  />
                                  {item.email_open_count != null && item.email_open_count > 0 && (
                                    <span className={item.opened_at ? "text-success font-semibold" : "text-muted-foreground"}>
                                      {item.email_open_count}x
                                    </span>
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {item.status === "sent" && item.opened_at ? (
                                  <div className="space-y-1">
                                    <p className="font-semibold">{t("queue.email_tracking.opened", { defaultValue: "Email visualizado" })}</p>
                                    <p className="text-xs">{formatOpenedAt(item.opened_at)}</p>
                                    {item.email_open_count != null && item.email_open_count > 0 && (
                                      <p className="text-xs text-muted-foreground">{t("queue.email_tracking.open_count", { count: item.email_open_count, defaultValue: "{{count}} abertura(s) total" })}</p>
                                    )}
                                  </div>
                                ) : (
                                  <p>{t("queue.email_tracking.not_opened", { defaultValue: "Email não visualizado ainda" })}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>

                            {/* CV / Profile view tracking */}
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
                                  <p>{t("queue.resume_tracking.viewed_at", { date: formatOpenedAt(item.profile_viewed_at), defaultValue: "CV visualizado em {{date}}" })}</p>
                                ) : (
                                  <p>{t("queue.resume_tracking.not_viewed", { defaultValue: "CV não visualizado" })}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                                  !["pending", "sent", "paused", "skipped_invalid_domain"].includes(item.status) ||
                                  sending ||
                                  sendingIds.has(item.id)
                                }
                                onClick={() => handleSendOne(item)}
                                title={item.status === "pending" ? undefined : t("queue.actions.resend")}
                              >
                                {sendingIds.has(item.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : item.status === "pending" ? (
                                  <Send className="h-4 w-4" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
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
