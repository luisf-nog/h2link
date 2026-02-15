import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Eye,
  Clock,
  Flame,
  ExternalLink,
  Mail,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { AddManualJobDialog } from "@/components/queue/AddManualJobDialog";
import { SendHistoryDialog } from "@/components/queue/SendHistoryDialog";
import { MobileQueueCard } from "@/components/queue/MobileQueueCard";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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

export default function Queue() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
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

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel("rt-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_views" }, () => fetchQueue())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const renderResumeStatus = (item: QueueItem) => {
    const views = Number(item.view_count) || 0;
    const duration = Number(item.total_duration_seconds) || 0;
    const hasViews = views > 0;
    const isHighInterest = views >= 3 || duration > 45;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-block cursor-help">
            <div
              className={cn(
                "p-2 rounded-xl transition-all border",
                hasViews
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                  : "bg-slate-50 border-slate-100 text-slate-200",
              )}
            >
              <FileText className={cn("h-5 w-5", isHighInterest && "animate-pulse")} />
              {hasViews && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[8px] font-bold h-3.5 w-3.5 rounded-full flex items-center justify-center border border-white">
                  {views}
                </span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-0 w-64 bg-slate-900 text-white border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <div className="p-4 space-y-3 text-left text-[10px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-black uppercase tracking-widest text-slate-500">Analytics</span>
              {isHighInterest && <Badge className="bg-orange-500 text-[8px] h-4 font-black">HOT LEAD</Badge>}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Visto:</span>
                <span className="font-bold">{views}x</span>
              </div>
              <div className="flex justify-between">
                <span>Leitura:</span>
                <span className="font-bold">{duration}s</span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full h-8 text-[9px] font-bold bg-slate-800 hover:bg-white hover:text-slate-900 border border-slate-700 uppercase"
              onClick={() => window.open(`/profile/${item.token}?q=${item.id}&s=${Date.now()}`, "_blank")}
            >
              Testar Link
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const pendingItems = useMemo(() => queue.filter((q) => q.status === "pending"), [queue]);
  const pendingCount = pendingItems.length;
  const allPendingSelected = pendingItems.length > 0 && Object.keys(selectedIds).length === pendingCount;

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto p-4 sm:p-0">
      <SendHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        queueId={historyItem?.id ?? ""}
        jobTitle={historyItem?.job_title ?? ""}
        company={historyItem?.company ?? ""}
      />

      {/* HEADER - DESIGN ORIGINAL */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black italic text-[#0F172A] uppercase tracking-tighter">
            MINHA FILA INTELIGENTE
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {pendingCount} PENDING • {creditsUsedToday} SENT
          </p>
        </div>
        <div className="flex gap-2">
          <AddManualJobDialog onAdded={fetchQueue} />
          <Button
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black italic px-8 py-6 rounded-2xl shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] transition-all active:scale-95"
            onClick={() => navigate("/jobs")}
          >
            <Send className="h-4 w-4 mr-2" /> SEND ALL ({pendingCount})
          </Button>
        </div>
      </div>

      {/* STATS CARDS - DESIGN ORIGINAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card className="rounded-[2rem] border-2 shadow-sm p-4">
          <CardHeader className="p-0 mb-1">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
              Prontos para Envio
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-5xl font-black italic tracking-tighter">{pendingCount}</CardContent>
        </Card>
        <Card className="rounded-[2rem] border-2 shadow-sm p-4 border-indigo-100">
          <CardHeader className="p-0 mb-1">
            <CardTitle className="text-[10px] font-bold uppercase text-indigo-400 tracking-widest">
              Disparados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-5xl font-black italic tracking-tighter text-indigo-700">
            {creditsUsedToday}
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-2 shadow-sm p-4">
          <CardHeader className="p-0 mb-1">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
              Limite do Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-5xl font-black italic tracking-tighter">{dailyLimitTotal}</CardContent>
        </Card>
      </div>

      {/* TABLE SECTION */}
      <TooltipProvider>
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-white border-b border-slate-50">
              <TableRow>
                <TableHead className="w-12 px-6 py-8">
                  <Checkbox
                    checked={allPendingSelected}
                    onCheckedChange={(v) => {
                      const next: Record<string, boolean> = {};
                      if (v) pendingItems.forEach((it) => (next[it.id] = true));
                      setSelectedIds(next);
                    }}
                  />
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-6">
                  Oportunidade / Empresa
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-6 text-center">
                  Status de Envio
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-6 text-center">
                  Inteligência (CV)
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-6 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-200" />
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-slate-50/50 transition-colors group border-b border-slate-50"
                  >
                    <TableCell className="px-6 py-8">
                      <Checkbox
                        checked={!!selectedIds[item.id]}
                        onCheckedChange={(v) => setSelectedIds((prev) => ({ ...prev, [item.id]: !!v }))}
                      />
                    </TableCell>
                    <TableCell className="p-6">
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-[#4F46E5] fill-[#4F46E5] opacity-70 shrink-0" />
                        <div className="flex flex-col">
                          <span
                            className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-tight"
                            translate="no"
                          >
                            {item.company}
                          </span>
                          <span
                            className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5"
                            translate="no"
                          >
                            {item.job_title}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-6 text-center">
                      <Badge
                        className={cn(
                          "uppercase text-[9px] font-black px-3 py-1 border-none shadow-none",
                          item.status === "sent" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400",
                        )}
                      >
                        {item.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-6 text-center">{renderResumeStatus(item)}</TableCell>
                    <TableCell className="p-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          className="h-8 w-8 rounded-lg text-red-500"
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
        </Card>
      </TooltipProvider>
    </div>
  );
}
