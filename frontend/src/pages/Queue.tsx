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
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { AddManualJobDialog } from "@/components/queue/AddManualJobDialog";
import { SendHistoryDialog } from "@/components/queue/SendHistoryDialog";
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
  // Campos originais para remontar o email
  public_jobs?: { email: string; visa_type?: string } | null;
  manual_jobs?: { email: string } | null;
}

const EARLY_ACCESS_VARIATIONS = [
  "Attention: I am aware that this job was recently filed and is in initial processing with the Department of Labor (DOL)...",
  "I understand this job order is currently in initial processing with the DOL...",
  "Acknowledging that this position is currently filed for processing with the Department of Labor...",
];

export default function Queue() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  const fetchQueue = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("queue_with_stats")
      .select(
        `
        *,
        public_jobs (email, visa_type),
        manual_jobs (email)
      `,
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (!error) setQueue((data as unknown as QueueItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel("queue_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_views" }, () => fetchQueue())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // --- LÓGICA DE ENVIO CORRIGIDA (Preparando campos to, subject, body) ---
  const sendQueueItems = async (items: QueueItem[]) => {
    if (remainingToday <= 0) {
      toast({ title: "Limite diário atingido", variant: "destructive" });
      return;
    }

    setSending(true);

    // Busca templates para montar o e-mail
    const { data: templates } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });

    for (const item of items) {
      const jobEmail = item.public_jobs?.email || item.manual_jobs?.email;
      if (!jobEmail) continue;

      // Monta o e-mail (Exemplo simplificado da sua lógica original)
      const template = templates?.[0] || {
        subject: "Job Application",
        body: "Hello, I am interested in the position.",
      };
      let finalBody = template.body;

      // Aplica variação de Early Access se necessário
      if (item.public_jobs?.visa_type?.toLowerCase().includes("early access")) {
        const randomIntro = EARLY_ACCESS_VARIATIONS[Math.floor(Math.random() * EARLY_ACCESS_VARIATIONS.length)];
        finalBody = randomIntro + "\n\n" + finalBody;
      }

      try {
        const { error } = await supabase.functions.invoke("send-email-custom", {
          body: {
            to: jobEmail,
            subject: template.subject,
            body: finalBody,
            queueId: item.id,
            s: Date.now(), // Carimbo para trava de 60s
          },
        });

        if (error) throw error;
      } catch (e) {
        console.error("Erro ao disparar Edge Function:", e);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    setSending(false);
    refreshProfile();
    fetchQueue();
    toast({ title: "Processamento de envios finalizado" });
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
                  "flex items-center gap-1.5 px-2 py-1 rounded-md",
                  hasViews ? "bg-emerald-50 text-emerald-700 font-bold" : "text-muted-foreground opacity-30",
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
          <TooltipContent side="left" className="bg-slate-900 text-white p-3 rounded-lg shadow-xl">
            <div className="text-[11px] space-y-1">
              <p className="font-bold border-b border-slate-700 pb-1">ANALYTICS</p>
              <p>Aberturas: {views}x</p>
              <p>Tempo: {duration}s</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const pendingItems = useMemo(() => queue.filter((q) => q.status === "pending"), [queue]);
  const allPendingSelected =
    pendingItems.length > 0 && Object.keys(selectedIds).filter((id) => selectedIds[id]).length === pendingItems.length;

  return (
    <div className="space-y-6 text-left">
      <SendHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        queueId={historyItem?.id ?? ""}
        jobTitle={historyItem?.job_title ?? ""}
        company={historyItem?.company ?? ""}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold italic uppercase tracking-tighter">Minha Fila Inteligente</h1>
          <p className="text-muted-foreground mt-1">
            {t("queue.subtitle", { pendingCount: pendingItems.length, sentCount: creditsUsedToday })}
          </p>
        </div>
        <div className="flex gap-2">
          <AddManualJobDialog onAdded={fetchQueue} />
          <Button
            onClick={() => sendQueueItems(pendingItems.slice(0, remainingToday))}
            disabled={pendingItems.length === 0 || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {t("queue.actions.send", { pendingCount: pendingItems.length })}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 text-xs font-bold uppercase text-slate-400">Na Fila</CardHeader>
          <CardContent className="text-3xl font-black">{pendingItems.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-xs font-bold uppercase text-indigo-400">Enviados Hoje</CardHeader>
          <CardContent className="text-3xl font-black text-indigo-600">{creditsUsedToday}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-xs font-bold uppercase text-slate-400">Limite Diário</CardHeader>
          <CardContent className="text-3xl font-black">{dailyLimitTotal}</CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border-none overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
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
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Vaga / Empresa
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                Status
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                Analytics
              </TableHead>
              <TableHead className="text-right pr-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center text-slate-300">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (
              queue.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6">
                    <Checkbox
                      checked={!!selectedIds[item.id]}
                      onCheckedChange={(v) => setSelectedIds((prev) => ({ ...prev, [item.id]: !!v }))}
                    />
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 uppercase tracking-tight">{item.company}</span>
                      <span className="text-[10px] text-slate-400">{item.job_title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.status === "sent" ? "default" : "secondary"}>
                      {item.status === "sent" ? "Enviado" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell>{renderAnalytics(item)}</TableCell>
                  <TableCell className="text-right pr-6">
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
                        className="text-red-500"
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
    </div>
  );
}
