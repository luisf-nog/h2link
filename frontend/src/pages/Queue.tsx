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
import {
  Trash2,
  Send,
  Loader2,
  RefreshCw,
  History,
  Lock,
  FileText,
  AlertCircle,
  Eye,
  Clock,
  Flame,
  ExternalLink,
  Mail,
  TrendingUp,
  Zap,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
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
  // V68 Fields
  view_count: number;
  total_duration_seconds: number;
  last_view_at?: string | null;
  token?: string;
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

const EARLY_ACCESS_VARIATIONS = [
  "Attention: I am aware that this job was recently filed and is in initial processing with the Department of Labor (DOL). Understanding that final certification is pending, I am applying proactively.",
  "I understand this job order is currently in initial processing with the DOL. I am submitting my application now to demonstrate my readiness and strong interest once certification is approved.",
  "Acknowledging that this position is currently filed for processing with the Department of Labor, I would like to present my qualifications ahead of the final certification.",
  "I am writing to express my interest in this position, noting that it is currently under review by the DOL. I wanted to ensure my application is on file early in the process.",
  "Please note: I understand this job order is pending final DOL certification. I am reaching out proactively to confirm my availability for this upcoming season.",
  "I noticed this position is in the initial filing stage with the Department of Labor. I am applying now to get a head start and express my enthusiasm for joining your team.",
  "Regarding the current status of this job order with the DOL: I am sending my details to express my desire to be considered as soon as the position is fully certified.",
  "I am applying proactively, understanding that this job order is currently in processing with the Department of Labor. I am highly interested and available.",
  "Although I understand this job is still in the DOL processing phase, I wanted to reach out early to demonstrate my commitment and qualifications.",
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

  // Pick send profile for premium plans
  const pickSendProfile = () => {
    if (planTier === "gold") return { xMailer: "Microsoft Outlook 16.0", userAgent: "Microsoft Outlook 16.0" };
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

  // 1. Fetch initial queue with V68 Stats View
  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from("queue_with_stats")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching queue stats:", error);
      toast({ title: t("queue.toasts.load_error_title"), description: error.message, variant: "destructive" });
    } else {
      setQueue((data as unknown as QueueItem[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();

    // 2. Real-time stats listener
    const channel = supabase
      .channel("queue-stats-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_views" }, () => fetchQueue())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // SMTP Readiness Check
  useEffect(() => {
    let cancelled = false;
    const checkSmtp = async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from("smtp_credentials")
        .select("has_password")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (!cancelled) setSmtpReady(!error && Boolean(data?.has_password));
    };
    checkSmtp();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // --- RENDERING HELPERS ---
  const statusLabel = (status: string) => {
    if (status === "sent") return t("queue.status.sent");
    if (status === "processing") return t("queue.status.processing");
    if (status === "failed") return t("queue.status.failed");
    return t("queue.status.pending");
  };

  const renderResumeStatus = (item: QueueItem) => {
    const views = Number(item.view_count) || 0;
    const duration = Number(item.total_duration_seconds) || 0;
    const hasViews = views > 0;
    const isHighInterest = views >= 3 || duration > 45;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-block cursor-help group">
            <div
              className={cn(
                "p-2.5 rounded-xl transition-all border-2",
                hasViews
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm"
                  : "bg-slate-50 border-slate-100 text-slate-300 opacity-40",
              )}
            >
              <FileText className={cn("h-5 w-5", isHighInterest && "animate-pulse")} />
              {hasViews && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                  {views}
                </span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-0 w-72 bg-slate-900 text-white border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <div className="p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                Tracker de Candidato
              </span>
              {isHighInterest && (
                <Badge className="bg-orange-500 text-[10px] h-5 uppercase font-black border-none animate-bounce">
                  <Flame className="h-3 w-3 mr-1 fill-current" /> Hot Lead
                </Badge>
              )}
            </div>
            {hasViews ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase">
                    <Eye className="h-4 w-4 text-emerald-400" /> Visto
                  </div>
                  <span className="font-black text-base">{views}x</span>
                </div>
                <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase">
                    <Clock className="h-4 w-4 text-blue-400" /> Tempo
                  </div>
                  <span className="font-black text-base">
                    {duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-2">
                <Mail className="h-8 w-8 mx-auto text-slate-700 opacity-50" />
                <p className="text-xs text-slate-400 font-black uppercase tracking-tighter">Aguardando Abertura</p>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full h-10 text-[10px] font-black bg-slate-800 hover:bg-white hover:text-slate-900 border border-slate-700 uppercase tracking-widest"
              onClick={() => window.open(`/profile/${item.token}?q=${item.id}&s=${Date.now()}`, "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-2" /> Simular Acesso
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // --- CORE LOGIC: SENDING ---
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

  const invokeEdgeFunction = async (functionName: string, body: any) => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw error;
    return data;
  };

  const ensureCanSend = async () => {
    if (smtpReady !== true) {
      setSmtpDialogOpen(true);
      return { ok: false as const };
    }
    if (remainingToday <= 0) {
      setUpgradeDialogOpen(true);
      return { ok: false as const };
    }
    if (!profile?.full_name || profile?.age == null || !profile?.phone_e164 || !profile?.contact_email) {
      toast({ title: t("smtp.toasts.profile_incomplete_title"), variant: "destructive" });
      return { ok: false as const };
    }
    const { data: tplData, error: tplError } = await supabase
      .from("email_templates")
      .select("id,name,subject,body")
      .order("created_at", { ascending: false });
    if (tplError) {
      toast({ title: t("common.errors.save_failed"), variant: "destructive" });
      return { ok: false as const };
    }

    const templates = ((tplData as EmailTemplate[]) ?? []).filter(Boolean);
    if (templates.length === 0 && planTier !== "black") {
      toast({ title: t("queue.toasts.no_template_title"), variant: "destructive" });
      return { ok: false as const };
    }
    return { ok: true as const, templates };
  };

  const sendQueueItems = async (items: QueueItem[]) => {
    const guard = await ensureCanSend();
    if (!guard.ok) return;

    const { templates } = guard;
    const sentIds: string[] = [];
    const failedIds: string[] = [];
    let creditsRemaining = remainingToday;

    setQueue((prev) => prev.map((q) => (items.find((i) => i.id === q.id) ? { ...q, status: "processing" } : q)));

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (creditsRemaining <= 0) break;

      const job = item.public_jobs ?? item.manual_jobs;
      if (!job?.email) {
        await supabase.from("my_queue").update({ status: "failed", last_error: "Email ausente" }).eq("id", item.id);
        failedIds.push(item.id);
        continue;
      }

      const visaType = item.public_jobs?.visa_type || "H-2B";
      const vars = {
        name: profile?.full_name ?? "",
        age: String(profile?.age ?? ""),
        phone: profile?.phone_e164 ?? "",
        contact_email: profile?.contact_email ?? "",
        company: job.company ?? "",
        position: job.job_title ?? "",
        visa_type: visaType,
      };

      const fallbackTpl =
        templates.length > 0
          ? (templates[hashToIndex(String(item.tracking_id ?? item.id), templates.length)] ?? templates[0])
          : null;
      let finalSubject = fallbackTpl ? applyTemplate(fallbackTpl.subject, vars) : "";
      let finalBody = fallbackTpl ? applyTemplate(fallbackTpl.body, vars) : "";

      if (visaType?.toLowerCase().includes("early access")) {
        finalBody =
          EARLY_ACCESS_VARIATIONS[Math.floor(Math.random() * EARLY_ACCESS_VARIATIONS.length)] + "\n\n" + finalBody;
      }

      try {
        if (planTier === "black") {
          const payload = await invokeEdgeFunction("generate-job-email", { queueId: item.id });
          if (payload?.success !== false && payload?.subject && payload?.body) {
            finalSubject = String(payload.subject);
            finalBody = String(payload.body);
          }
        }

        const sendProfile = pickSendProfile();
        const payload = await invokeEdgeFunction("send-email-custom", {
          to: job.email,
          subject: finalSubject,
          body: finalBody,
          queueId: item.id,
          ...sendProfile,
          s: Date.now(),
        });

        if (payload?.success === false) throw new Error(payload?.error || "Send failed");

        sentIds.push(item.id);
        creditsRemaining -= 1;
      } catch (e: any) {
        await supabase.from("my_queue").update({ status: "failed", last_error: e.message }).eq("id", item.id);
        failedIds.push(item.id);
      }

      if (idx < items.length - 1 && sentIds.length > 0) await sleep(getDelayMs());
    }

    // Wrap-up updates
    for (const sentId of sentIds) {
      const currentItem = items.find((i) => i.id === sentId);
      await supabase
        .from("my_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          send_count: (currentItem?.send_count ?? 0) + 1,
        })
        .eq("id", sentId);
    }

    await refreshProfile();
    fetchQueue();
  };

  // Event Handlers
  const handleSendAll = () => sendQueueItems(pendingItems.slice(0, remainingToday));
  const handleSendSelected = () => {
    sendQueueItems(pendingItems.filter((it) => selectedPendingIds.includes(it.id)).slice(0, remainingToday));
    setSelectedIds({});
  };
  const handleSendOne = (item: QueueItem) => sendQueueItems([item]);
  const handleRemoveFromQueue = (id: string) => removeFromQueue(id);

  const pendingItems = useMemo(() => queue.filter((q) => q.status === "pending"), [queue]);
  const pendingCount = pendingItems.length;
  const sentCount = creditsUsedToday;
  const pendingIds = useMemo(() => new Set(pendingItems.map((i) => i.id)), [pendingItems]);
  const selectedPendingIds = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id] && pendingIds.has(id)),
    [selectedIds, pendingIds],
  );
  const allPendingSelected = pendingItems.length > 0 && selectedPendingIds.length === pendingItems.length;

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto">
      {/* ALERT DIALOGS */}
      <AlertDialog open={smtpDialogOpen} onOpenChange={setSmtpDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("queue.smtp_required.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("queue.smtp_required.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("queue.smtp_required.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/settings/email")}>
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
            <AlertDialogAction onClick={() => navigate("/plans")}>
              {t("queue.upgrade_required.actions.view_plans")}
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

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
            Minha Fila Inteligente
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">
            {t("queue.subtitle", { pendingCount, sentCount })}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <AddManualJobDialog onAdded={fetchQueue} />
          <Button
            disabled={pendingCount === 0 || sending}
            className="h-14 px-8 font-black bg-indigo-600 hover:bg-indigo-700 text-white uppercase tracking-widest shadow-[0_10px_20px_-10px_rgba(79,70,229,0.5)] active:scale-95 transition-all rounded-2xl"
            onClick={handleSendAll}
          >
            {sending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}
            {t("queue.actions.send", { pendingCount })}
          </Button>
        </div>
      </div>

      {/* STATS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2rem] border-2 shadow-sm border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Prontos para Envio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-black italic tracking-tighter text-slate-900">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-2 shadow-md border-indigo-100 bg-indigo-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
              Disparados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-black italic tracking-tighter text-indigo-700">{formatNumber(sentCount)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-2 shadow-sm border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Limite do Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-black italic tracking-tighter text-slate-900">{dailyLimitTotal}</p>
          </CardContent>
        </Card>
      </div>

      {/* QUEUE LISTING SECTION */}
      <TooltipProvider>
        {isMobile ? (
          <div className="space-y-4">
            {queue.map((item) => (
              <MobileQueueCard
                key={item.id}
                item={item}
                isSelected={!!selectedIds[item.id]}
                onSelectChange={(checked) => setSelectedIds((prev) => ({ ...prev, [item.id]: checked }))}
                onRemove={() => handleRemoveFromQueue(item.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-[2.5rem] border-2 border-slate-100 shadow-2xl overflow-hidden p-2 bg-white">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b-2 border-slate-100">
                  <TableHead className="w-12 p-8">
                    <Checkbox
                      checked={allPendingSelected}
                      onCheckedChange={(v) => {
                        const next: Record<string, boolean> = {};
                        if (v) pendingItems.forEach((it) => (next[it.id] = true));
                        setSelectedIds(next);
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                    Oportunidade / Empresa
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400 text-center">
                    Status de Envio
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400 text-center">
                    Inteligência (CV)
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-32 text-center">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto text-indigo-600" />
                    </TableCell>
                  </TableRow>
                ) : queue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-32 text-center opacity-20">
                      <TrendingUp className="h-16 w-16 mx-auto mb-4" />
                      <p className="font-black uppercase tracking-[0.3em]">Sua Fila está limpa</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  queue.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-all border-b border-slate-50 group"
                    >
                      <TableCell className="p-8">
                        <Checkbox
                          checked={!!selectedIds[item.id]}
                          disabled={item.status !== "pending"}
                          onCheckedChange={(v) => setSelectedIds((prev) => ({ ...prev, [item.id]: !!v }))}
                        />
                      </TableCell>
                      <TableCell className="p-8">
                        <div className="flex flex-col">
                          <span
                            className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-tight mb-1.5 group-hover:text-indigo-600 transition-colors"
                            translate="no"
                          >
                            {(item.public_jobs ?? item.manual_jobs)?.company}
                          </span>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em] flex items-center gap-1.5 italic">
                            <Zap className="h-3 w-3 text-indigo-500 fill-indigo-500" />{" "}
                            {(item.public_jobs ?? item.manual_jobs)?.job_title}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="p-8 text-center">
                        <Badge
                          className={cn(
                            "uppercase text-[10px] font-black px-4 py-1.5 border-none shadow-sm",
                            item.status === "sent" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400",
                          )}
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-8 text-center">{renderResumeStatus(item)}</TableCell>
                      <TableCell className="p-8 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.send_count > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-12 w-12 rounded-2xl bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 shadow-sm"
                              onClick={() => {
                                setHistoryItem(item);
                                setHistoryDialogOpen(true);
                              }}
                            >
                              <History className="h-5 w-5 text-slate-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-12 w-12 rounded-2xl bg-red-50/50 hover:bg-red-50 text-destructive border border-transparent hover:border-red-100 shadow-sm"
                            onClick={() => handleRemoveFromQueue(item.id)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </TooltipProvider>
    </div>
  );
}
