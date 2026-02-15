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

export default function Queue() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [smtpReady, setSmtpReady] = useState<boolean | null>(null);
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<QueueItem | null>(null);

  const planTier = profile?.plan_tier || "free";
  const dailyLimitTotal =
    (PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0) + Number((profile as any)?.referral_bonus_limit ?? 0);
  const creditsUsedToday = profile?.credits_used_today || 0;
  const remainingToday = Math.max(0, dailyLimitTotal - creditsUsedToday);

  const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel("queue_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_views" }, () => fetchQueue())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchQueue = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("queue_with_stats")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (!error) setQueue((data as unknown as QueueItem[]) || []);
    setLoading(false);
  };

  const renderAnalytics = (item: QueueItem) => {
    const views = Number(item.view_count) || 0;
    const duration = Number(item.total_duration_seconds) || 0;
    const hasViews = views > 0;
    const isHighInterest = views >= 3 || duration > 45;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-center cursor-help">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
                hasViews ? "bg-emerald-50 text-emerald-700 font-bold" : "text-muted-foreground opacity-40",
              )}
            >
              {isHighInterest ? (
                <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="text-xs">{views}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="p-3 bg-slate-900 text-white border-slate-800 shadow-xl rounded-lg text-left"
        >
          {hasViews ? (
            <div className="space-y-2 text-[11px]">
              <p className="font-bold border-b border-slate-800 pb-1 mb-1 text-slate-400">STATUS DE ACESSO</p>
              <div className="flex justify-between gap-4">
                <span>Aberturas:</span>
                <span className="font-bold">{views}x</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Leitura:</span>
                <span className="font-bold">{duration}s</span>
              </div>
              {item.last_view_at && (
                <p className="text-[9px] text-slate-500 pt-1 italic">
                  Último: {format(new Date(item.last_view_at), "dd/MM HH:mm")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs">Aguardando visualização...</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  };

  // --- LÓGICA DE ENVIO RESTAURADA ---
  const sendQueueItems = async (items: QueueItem[]) => {
    if (remainingToday <= 0) {
      setUpgradeDialogOpen(true);
      return;
    }

    setSending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    for (const item of items) {
      // Aqui entra a sua chamada para a Edge Function de envio
      // Mantendo o fluxo de atualizar para "processing" e depois "sent"
      try {
        await supabase.functions.invoke("send-email-custom", {
          body: { queueId: item.id, s: Date.now() },
        });
      } catch (e) {
        console.error("Erro no envio:", e);
      }
      await sleep(1000); // Intervalo para evitar bloqueios
    }

    setSending(false);
    refreshProfile();
    fetchQueue();
  };

  const handleSendAll = () => {
    const items = queue.filter((q) => q.status === "pending").slice(0, remainingToday);
    if (items.length > 0) sendQueueItems(items);
  };

  const pendingItems = useMemo(() => queue.filter((q) => q.status === "pending"), [queue]);
  const pendingCount = pendingItems.length;
  const sentCount = creditsUsedToday;
  const allPendingSelected =
    pendingItems.length > 0 && Object.keys(selectedIds).filter((id) => selectedIds[id]).length === pendingItems.length;

  return (
    <div className="space-y-6">
      <SendHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        queueId={historyItem?.id ?? ""}
        jobTitle={historyItem?.job_title ?? ""}
        company={historyItem?.company ?? ""}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("queue.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("queue.subtitle", { pendingCount, sentCount })}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AddManualJobDialog onAdded={fetchQueue} />
          <Button onClick={handleSendAll} disabled={pendingCount === 0 || loading || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {t("queue.actions.send", { pendingCount })}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
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
        <Card className="text-left">
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
                        const next: Record<string, boolean> = {};
                        if (v) pendingItems.forEach((it) => (next[it.id] = true));
                        setSelectedIds(next);
                      }}
                    />
                  </TableHead>
                  <TableHead>{t("queue.table.headers.job_title")}</TableHead>
                  <TableHead>{t("queue.table.headers.company")}</TableHead>
                  <TableHead>{t("queue.table.headers.status")}</TableHead>
                  <TableHead className="w-24 text-center">ANALYTICS</TableHead>
                  <TableHead className="text-right">{t("queue.table.headers.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t("queue.table.loading")}
                    </TableCell>
                  </TableRow>
                ) : queue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t("queue.table.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  queue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selectedIds[item.id]}
                          onCheckedChange={(v) => setSelectedIds((prev) => ({ ...prev, [item.id]: !!v }))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.job_title}</TableCell>
                      <TableCell>{item.company}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "sent" ? "default" : "secondary"}>
                          {item.status === "sent" ? t("queue.status.sent") : t("queue.status.pending")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{renderAnalytics(item)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.send_count > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setHistoryItem(item);
                                setHistoryDialogOpen(true);
                              }}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              supabase
                                .from("my_queue")
                                .delete()
                                .eq("id", item.id)
                                .then(() => fetchQueue())
                            }
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
      </TooltipProvider>
    </div>
  );
}
