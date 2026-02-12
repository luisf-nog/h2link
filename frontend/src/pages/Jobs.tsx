import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { JobDetailsDialog, type JobDetails } from "@/components/jobs/JobDetailsDialog";
import { JobImportDialog } from "@/components/jobs/JobImportDialog";
import { MultiJsonImporter } from "@/components/admin/MultiJsonImporter";
import { MobileJobCard } from "@/components/jobs/MobileJobCard";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Info,
  Search,
  Plus,
  Check,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Zap,
  Clock,
  Loader2,
  Database,
  ChevronsUpDown,
  X,
  ShieldAlert,
  Briefcase,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

export default function Jobs() {
  const { profile } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // --- LÓGICA DE SINCRONIZAÇÃO EM TEMPO REAL ---
  const fetchQueuedIds = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id).eq("status", "pending"); // Pega exatamente o que está "In Queue" como na aba Queue

    setQueuedJobIds(new Set((data ?? []).map((r) => r.job_id)));
  };

  useEffect(() => {
    if (!profile?.id) return;
    fetchQueuedIds();

    const channel = supabase
      .channel("sync-queue-status")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "my_queue",
          filter: `user_id=eq.${profile.id}`,
        },
        () => fetchQueuedIds(), // Atualiza contagem instantaneamente sem refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // ... Restante das funções (fetchJobs, addToQueue, etc) mantidas conforme o padrão premium

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("nav.jobs")}</h1>
            <p className="text-muted-foreground mt-1">{t("jobs.subtitle", { totalCount: formatNumber(totalCount) })}</p>
          </div>
        </div>

        {/* CENTRAL DE COMANDO LIGHT MINIMALISTA */}
        {queuedJobIds.size > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 sm:p-4 mb-6 flex items-center justify-between gap-4 shadow-sm group transition-all hover:bg-blue-50 hover:border-blue-200">
              <div className="flex items-center gap-3 overflow-hidden text-left">
                <div className="relative shrink-0">
                  <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
                    <Zap className="h-5 w-5 text-white fill-white/20" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {queuedJobIds.size}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-blue-900 font-bold text-sm sm:text-base leading-tight tracking-tight">
                    Vagas aguardando envio
                  </h3>
                  <p className="text-blue-700/60 text-xs truncate font-medium">
                    Você tem{" "}
                    <span className="text-blue-700 font-bold">
                      {queuedJobIds.size} {queuedJobIds.size === 1 ? "vaga" : "vagas"}
                    </span>{" "}
                    prontas na fila. Envie agora!
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/queue")}
                size="sm"
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-5 sm:px-8 rounded-lg shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
              >
                <span className="hidden sm:inline">ENVIAR AGORA</span>
                <span className="sm:hidden">ENVIAR</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ... Restante do Grid de Filtros e Tabela mantidos exatamente no padrão premium linear */}
      </div>
    </TooltipProvider>
  );
}
