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
  FileText,
  AlertCircle,
  Eye,
  Clock,
  Flame,
  ExternalLink,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { parseSmtpError } from "@/lib/smtpErrorParser";
import { AddManualJobDialog } from "@/components/queue/AddManualJobDialog";
import { SendHistoryDialog } from "@/components/queue/SendHistoryDialog";
import { MobileQueueCard } from "@/components/queue/MobileQueueCard";
import { useNavigate } from "react-router-dom";
import { format, type Locale } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  send_count: number;
  last_error?: string | null;
  job_title: string;
  company: string;
  token: string;
  view_count: number;
  total_duration_seconds: number;
  last_view_at: string | null;
  user_id: string;
}

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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<QueueItem | null>(null);

  const planTier = profile?.plan_tier || "free";
  const dailyLimitTotal =
    (PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0) + Number((profile as any)?.referral_bonus_limit ?? 0);
  const creditsUsedToday = profile?.credits_used_today || 0;
  const remainingToday = Math.max(0, dailyLimitTotal - creditsUsedToday);

  // 1. Busca os dados da VIEW inteligente (Rastreio + Segurança)
  const fetchQueue = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("queue_with_stats")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar fila:", error);
    } else {
      setQueue((data as unknown as QueueItem[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    // Real-time: atualiza se o patrão abrir o currículo
    const channel = supabase
      .channel("queue_stats_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_views" }, () => fetchQueue())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // 2. Coluna de Analytics de Rastreio
  const renderAnalytics = (item: QueueItem) => {
    const views = Number(item.view_count) || 0;
    const duration = Number(item.total_duration_seconds) || 0;
    const hasViews = views > 0;
    const isHighInterest = views >= 3 || duration > 45;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center justify-center cursor-help">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
                hasViews
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-100"
                  : "text-muted-foreground opacity-30",
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
        <TooltipContent side="left" className="p-3 bg-slate-900 text-white border-slate-800 shadow-xl rounded-lg">
          {hasViews ? (
            <div className="space-y-2 text-[11px] text-left">
              <p className="font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-1 mb-2">
                Engajamento do Currículo
              </p>
              <div className="flex justify-between gap-6">
                <span>Vezes aberto:</span>
                <span className="font-bold text-emerald-400">{views}x</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Tempo lendo:</span>
                <span className="font-bold text-blue-400">
                  {duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
                </span>
              </div>
              {item.last_view_at && (
                <p className="text-[9px] text-slate-500 pt-1">
                  Último acesso: {format(new Date(item.last_view_at), "dd/MM HH:mm")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs">E-mail enviado, aguardando abertura...</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
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

      {/* HEADER CLÁSSICO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h1 className="text-3xl font-bold text-foreground italic uppercase tracking-tighter">
            Minha Fila Inteligente
          </h1>
          <p className="text-muted-foreground mt-1">{t("queue.subtitle", { pendingCount, sentCount })}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <AddManualJobDialog onAdded={fetchQueue} />
          <Button
            className="font-bold uppercase tracking-widest shadow-lg"
            onClick={() => navigate("/jobs")}
            disabled={pendingCount === 0 || loading}
          >
            <Send className="h-4 w-4 mr-2" />
            {t("queue.actions.send", { pendingCount })}
          </Button>
        </div>
      </div>

      {/* CARDS DE STATS CLÁSSICOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-400 tracking-widest">Na Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black italic">{formatNumber(pendingCount)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-indigo-100 bg-indigo-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-indigo-400 tracking-widest">Enviados Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black italic text-indigo-700">{formatNumber(sentCount)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-400 tracking-widest">Limite Diário</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black italic">{dailyLimitTotal}</p>
          </CardContent>
        </Card>
      </div>

      {/* TABELA CLÁSSICA COM ANALYTICS */}
      <TooltipProvider>
        <Card className="text-left shadow-xl border-none rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-lg font-bold">Fila de Disparos</CardTitle>
            <CardDescription>Acompanhe em tempo real quem está lendo seu currículo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="w-10 px-6">
                    <Checkbox
                      checked={allPendingSelected}
                      onCheckedChange={(v) => {
                        const next: Record<string, boolean> = {};
                        if (v) pendingItems.forEach((it) => (next[it.id] = true));
                        setSelectedIds(next);
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-slate-400">
                    Vaga / Empresa
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-slate-400 text-center">
                    Status
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-slate-400 text-center">
                    Abertura CV
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-slate-400 text-right pr-6">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-300">
                      <Loader2 className="h-10 w-10 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : queue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      Sua fila está vazia.
                    </TableCell>
                  </TableRow>
                ) : (
                  queue.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <TableCell className="px-6">
                        <Checkbox
                          checked={!!selectedIds[item.id]}
                          onCheckedChange={(v) => setSelectedIds((prev) => ({ ...prev, [item.id]: !!v }))}
                        />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3 w-3 text-indigo-500 fill-indigo-500 opacity-50" />
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 uppercase tracking-tight" translate="no">
                              {item.company}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{item.job_title}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={item.status === "sent" ? "default" : "secondary"}
                          className={cn(
                            "uppercase text-[10px] font-black border-none px-2",
                            item.status === "sent" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400",
                          )}
                        >
                          {item.status === "sent" ? "Enviado" : "Pendente"}
                        </Badge>
                      </TableCell>

                      {/* COLUNA DE ANALYTICS V68 */}
                      <TableCell className="text-center border-x border-slate-50">{renderAnalytics(item)}</TableCell>

                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.send_count > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg"
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
                            className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50"
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
