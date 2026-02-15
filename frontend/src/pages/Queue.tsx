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
import { Trash2, Send, Loader2, RefreshCw, History, Eye, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { AddManualJobDialog } from "@/components/queue/AddManualJobDialog";
import { SendHistoryDialog } from "@/components/queue/SendHistoryDialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileQueueCard } from "@/components/queue/MobileQueueCard";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  send_count: number;
  last_error?: string | null;
  // Campos vindos da View (Garantidos pela sua base)
  job_title: string;
  company: string;
  contact_email: string;
  visa_type?: string;
  token?: string;
  view_count: number;
  total_duration_seconds: number;
  last_view_at: string | null;
  user_id: string;
}

const EARLY_ACCESS_VARIATIONS = [
  "Attention: I am aware that this job was recently filed and is in initial processing with the Department of Labor (DOL)...",
  "I understand this job order is currently in initial processing with the DOL...",
  "Acknowledging that this position is currently filed for processing with the Department of Labor...",
];

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
  const remainingToday = Math.max(0, dailyLimitTotal - creditsUsedToday);

  const fetchQueue = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("queue_with_stats")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setQueue((data as unknown as QueueItem[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel("queue_std_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_views" }, () => fetchQueue())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const sendQueueItems = async (items: QueueItem[]) => {
    if (remainingToday <= 0) {
      toast({ title: "Limite diário atingido", variant: "destructive" });
      return;
    }

    setSending(true);
    const { data: templates } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });

    for (const item of items) {
      // Como a base é limpa, confiamos que o email existe.
      const template = templates?.[0] || {
        subject: `Application for ${item.job_title}`,
        body: "Hello, please find my resume attached.",
      };
      let finalBody = template.body;

      if (item.visa_type?.toLowerCase().includes("early access")) {
        finalBody =
          EARLY_ACCESS_VARIATIONS[Math.floor(Math.random() * EARLY_ACCESS_VARIATIONS.length)] + "\n\n" + finalBody;
      }

      try {
        const { error } = await supabase.functions.invoke("send-email-custom", {
          body: {
            to: item.contact_email, // Campo garantido pela View
            subject: template.subject,
            body: finalBody,
            queueId: item.id,
            s: Date.now(),
          },
        });

        if (error) throw error;

        // Atualiza visualmente para dar feedback rápido
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "sent", send_count: q.send_count + 1 } : q)),
        );
      } catch (e) {
        console.error(`Erro envio item ${item.id}:`, e);
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    setSending(false);
    refreshProfile();
    fetchQueue();
    toast({ title: "Envio em massa finalizado!" });
  };

  const handleSendAll = () => {
    const items = queue.filter((q) => q.status === "pending").slice(0, remainingToday);
    if (items.length > 0) {
      sendQueueItems(items);
    } else {
      toast({ title: "Nada para enviar", description: "Fila vazia ou limite atingido." });
    }
  };

  const removeFromQueue = async (id: string) => {
    await supabase.from("my_queue").delete().eq("id", id);
    fetchQueue();
    toast({ title: "Item removido" });
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
            <div className="flex items-center gap-2 cursor-help text-muted-foreground hover:text-foreground transition-colors">
              {isHighInterest ? (
                <Flame className="h-4 w-4 text-orange-500" />
              ) : (
                <Eye className={cn("h-4 w-4", hasViews ? "text-blue-500" : "opacity-30")} />
              )}
              <span className={cn("text-xs font-medium", hasViews && "text-foreground")}>{views}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {hasViews ? (
              <div className="text-xs space-y-1">
                <p>
                  <strong>Visto:</strong> {views} vezes
                </p>
                <p>
                  <strong>Tempo:</strong> {duration}s
                </p>
                {item.last_view_at && (
                  <p className="opacity-70">Último: {format(new Date(item.last_view_at), "dd/MM HH:mm")}</p>
                )}
              </div>
            ) : (
              <p className="text-xs">Aguardando visualização</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Queue</h1>
          <p className="text-muted-foreground">Gerencie seus envios ({pendingCount} pendentes)</p>
        </div>
        <div className="flex gap-2">
          <AddManualJobDialog onAdded={fetchQueue} />
          <Button onClick={handleSendAll} disabled={pendingCount === 0 || loading || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? "Enviando..." : "Enviar Todos"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Na Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(pendingCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enviados Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(sentCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Limite Diário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyLimitTotal}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allPendingSelected}
                    onCheckedChange={(v) => {
                      const next: Record<string, boolean> = {};
                      if (v) pendingItems.forEach((it) => (next[it.id] = true));
                      setSelectedIds(next);
                    }}
                  />
                </TableHead>
                <TableHead>Vaga / Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Analytics</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Fila vazia
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
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.job_title}</span>
                        <span className="text-xs text-muted-foreground">{item.company}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "sent" ? "default" : "secondary"}>
                        {item.status === "sent" ? "Enviado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>{renderAnalytics(item)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {item.send_count > 0 && (
                          <Button
                            size="icon"
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
                          size="icon"
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
        </div>
      </Card>

      {isMobile && (
        <div className="space-y-4 md:hidden">
          {queue.map((item) => (
            <MobileQueueCard
              key={item.id}
              item={item}
              isSelected={!!selectedIds[item.id]}
              onSelectChange={() => {}}
              onRemove={() => removeFromQueue(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
