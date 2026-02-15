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
  Zap,
} from "lucide-react";
import { AddManualJobDialog } from "@/components/queue/AddManualJobDialog";
import { SendHistoryDialog } from "@/components/queue/SendHistoryDialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MobileQueueCard } from "@/components/queue/MobileQueueCard"; // Certifique-se que este componente existe ou remova a lógica mobile se preferir

// Interface alinhada com a View corrigida
interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  send_count: number;
  last_error?: string | null;
  job_title: string;
  company: string;
  contact_email?: string;
  visa_type?: string;
  token: string;
  view_count: number;
  total_duration_seconds: number;
  last_view_at: string | null;
  user_id: string;
}

const EARLY_ACCESS_VARIATIONS = [
  "Attention: I am aware that this job was recently filed and is in initial processing with the DOL...",
  "I understand this job order is currently in initial processing with the DOL...",
  "Acknowledging that this position is currently filed for processing with the Department of Labor...",
];

export default function Queue() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
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

  // FETCH CORRIGIDO
  const fetchQueue = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("queue_with_stats")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro SQL:", error);
      toast({ title: "Erro ao carregar fila", variant: "destructive" });
    } else {
      setQueue((data as unknown as QueueItem[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel("queue_fix")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_views" }, () => fetchQueue())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // LÓGICA DE ENVIO REAL (SEM REDIRECT)
  const sendQueueItems = async (items: QueueItem[]) => {
    if (remainingToday <= 0) {
      toast({ title: "Limite diário atingido", description: "Faça upgrade para enviar mais.", variant: "destructive" });
      return;
    }

    setSending(true);
    const { data: templates } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });

    // Loop de envio real
    for (const item of items) {
      if (!item.contact_email) continue;

      const template = templates?.[0] || {
        subject: `Application for ${item.job_title}`,
        body: "Hello, attached is my resume.",
      };
      let finalBody = template.body;

      if (item.visa_type?.toLowerCase().includes("early access")) {
        finalBody =
          EARLY_ACCESS_VARIATIONS[Math.floor(Math.random() * EARLY_ACCESS_VARIATIONS.length)] + "\n\n" + finalBody;
      }

      try {
        await supabase.functions.invoke("send-email-custom", {
          body: {
            to: item.contact_email,
            subject: template.subject,
            body: finalBody,
            queueId: item.id,
            s: Date.now(),
          },
        });

        // Atualização otimista local
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "sent", send_count: q.send_count + 1 } : q)),
        );
      } catch (e) {
        console.error(e);
      }
      // Pequeno delay para não sobrecarregar
      await new Promise((r) => setTimeout(r, 800));
    }

    setSending(false);
    refreshProfile();
    fetchQueue();
    toast({ title: "Envio em massa finalizado!" });
  };

  const handleSendAll = () => {
    const items = queue.filter((q) => q.status === "pending").slice(0, remainingToday);
    if (items.length > 0) sendQueueItems(items);
  };

  const renderAnalytics = (item: QueueItem) => {
    const views = Number(item.view_count) || 0;
    const duration = Number(item.total_duration_seconds) || 0;
    const hasViews = views > 0;
    const isHighInterest = views >= 3 || duration > 45;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex justify-center cursor-help">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all",
                  hasViews ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-300 bg-slate-50",
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
            className="bg-[#0F172A] text-white p-4 rounded-xl border border-slate-800 shadow-2xl"
          >
            <div className="space-y-2 text-[11px]">
              <p className="font-black border-b border-slate-700 pb-2 mb-2 text-slate-400 uppercase tracking-widest">
                RASTREIO DE ACESSO
              </p>
              <div className="flex justify-between gap-8">
                <span>Aberturas:</span>
                <span className="font-bold text-emerald-400">{views}x</span>
              </div>
              <div className="flex justify-between gap-8">
                <span>Tempo:</span>
                <span className="font-bold text-blue-400">{duration}s</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const pendingItems = useMemo(() => queue.filter((q) => q.status === "pending"), [queue]);
  const pendingCount = pendingItems.length;
  const allPendingSelected =
    pendingItems.length > 0 && Object.keys(selectedIds).filter((id) => selectedIds[id]).length === pendingItems.length;

  return (
    <div className="space-y-8 p-4 md:p-0 max-w-7xl mx-auto">
      <SendHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        queueId={historyItem?.id ?? ""}
        jobTitle={historyItem?.job_title ?? ""}
        company={historyItem?.company ?? ""}
      />

      {/* HEADER IDÊNTICO À IMAGEM 1 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1
            className="text-4xl md:text-5xl font-black italic text-[#0F172A] uppercase tracking-tighter"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            MINHA FILA INTELIGENTE
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 ml-1">
            {pendingCount} PENDING • {creditsUsedToday} SENT
          </p>
        </div>
        <div className="flex gap-3">
          <AddManualJobDialog onAdded={fetchQueue} />
          {/* BOTÃO ROXO GRANDE */}
          <Button
            onClick={handleSendAll}
            disabled={pendingCount === 0 || loading || sending}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black italic text-sm px-8 py-6 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider"
          >
            {sending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}
            SEND ALL ({pendingCount})
          </Button>
        </div>
      </div>

      {/* CARDS IDÊNTICOS À IMAGEM 1 (COM NÚMEROS GIGANTES) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2rem] border-none shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-2">
          <CardHeader className="pb-0 pt-6 px-6">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
              Prontos para Envio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <p className="text-6xl font-black italic tracking-tighter text-[#0F172A]">{pendingCount}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 border-[#EEF2FF] bg-[#F5F7FF] shadow-none p-2">
          <CardHeader className="pb-0 pt-6 px-6">
            <CardTitle className="text-[10px] font-bold uppercase text-[#6366F1] tracking-widest">
              Disparados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <p className="text-6xl font-black italic tracking-tighter text-[#4338CA]">{creditsUsedToday}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-2">
          <CardHeader className="pb-0 pt-6 px-6">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
              Limite do Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <p className="text-6xl font-black italic tracking-tighter text-[#0F172A]">{dailyLimitTotal}</p>
          </CardContent>
        </Card>
      </div>

      {/* TABELA IDÊNTICA À IMAGEM 1 */}
      <TooltipProvider>
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden px-4 py-2">
          <Table>
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-12 py-8 pl-8">
                  <Checkbox
                    className="h-5 w-5 rounded-md border-slate-300 data-[state=checked]:bg-[#4F46E5] data-[state=checked]:text-white"
                    checked={allPendingSelected}
                    onCheckedChange={(v) => {
                      const next: Record<string, boolean> = {};
                      if (v) pendingItems.forEach((it) => (next[it.id] = true));
                      setSelectedIds(next);
                    }}
                  />
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] py-8">
                  Oportunidade / Empresa
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] py-8 text-center">
                  Status de Envio
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] py-8 text-center">
                  Inteligência (CV)
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] py-8 text-right pr-8">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-32 text-center text-slate-300">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : queue.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-32 text-center text-slate-300 font-bold uppercase tracking-widest"
                  >
                    Sua fila está vazia
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors border-none group">
                    <TableCell className="py-6 pl-8">
                      <Checkbox
                        className="h-5 w-5 rounded-md border-slate-300 data-[state=checked]:bg-[#4F46E5]"
                        checked={!!selectedIds[item.id]}
                        onCheckedChange={(v) => setSelectedIds((prev) => ({ ...prev, [item.id]: !!v }))}
                      />
                    </TableCell>
                    <TableCell className="py-6">
                      <div className="flex items-center gap-4">
                        {/* ÍCONE DE RAIO ROXO (ZAP) */}
                        <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center">
                          <Zap className="h-4 w-4 text-[#4F46E5] fill-[#4F46E5]" />
                        </div>
                        <div className="flex flex-col">
                          {/* DADOS CORRIGIDOS (SEM BLANK) */}
                          <span className="font-black text-[#0F172A] uppercase tracking-tighter text-base">
                            {item.company || "Empresa Desconhecida"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {item.job_title || "Cargo não informado"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-6">
                      <Badge
                        className={cn(
                          "uppercase text-[10px] font-black px-4 py-1.5 border-none rounded-lg shadow-none",
                          item.status === "sent" ? "bg-[#E0E7FF] text-[#4338CA]" : "bg-[#F1F5F9] text-[#64748B]",
                        )}
                      >
                        {item.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-6">{renderAnalytics(item)}</TableCell>
                    <TableCell className="text-right pr-8 py-6">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 rounded-xl bg-white border border-slate-100 hover:bg-slate-50 text-slate-400"
                          onClick={() => {
                            setHistoryItem(item);
                            setHistoryDialogOpen(true);
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 rounded-xl bg-white border border-slate-100 hover:bg-red-50 text-red-400 hover:text-red-500"
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
        </div>
      </TooltipProvider>
    </div>
  );
}
