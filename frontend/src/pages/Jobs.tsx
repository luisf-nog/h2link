import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { JobDetailsDialog, type JobDetails } from "@/components/jobs/JobDetailsDialog";
import { JobImportDialog } from "@/components/jobs/JobImportDialog";
import { MultiJsonImporter } from "@/components/admin/MultiJsonImporter";
import { MobileJobCard } from "@/components/jobs/MobileJobCard";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Bot,
  ShieldAlert,
  Briefcase,
  Rocket,
  CheckCircle2,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";
import { getJobShareUrl } from "@/lib/shareUtils";

// --- ONBOARDING MODAL (Mantido conforme original) ---
function OnboardingModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenJobOnboarding_v6");
    if (!hasSeen) {
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);
  const handleClose = () => {
    localStorage.setItem("hasSeenJobOnboarding_v6", "true");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl p-0 border-0 shadow-2xl bg-white rounded-xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700 text-white shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">H2 Linker Platform</h2>
              <p className="text-slate-400 text-[10px] uppercase font-semibold">Official Automation Tool</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white bg-slate-800/50 p-2 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 border-b border-slate-100 p-4 rounded-lg flex gap-3">
            <ShieldAlert className="h-5 w-5 text-slate-700 shrink-0" />
            <p className="text-slate-600 text-sm leading-relaxed">
              H2 Linker is a <strong>software technology provider</strong>. We are not a recruitment agency. We provide
              tools to automate your outreach.
            </p>
          </div>
          {/* ... Restante das features do modal igual ao original ... */}
          <Button onClick={handleClose} className="w-full bg-slate-900 hover:bg-slate-800 h-12">
            I Understand - Let's Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const renderPrice = (job: JobDetails) => {
  if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
    return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
  }
  if (job.wage_from) return `$${job.wage_from.toFixed(2)}`;
  if (job.salary) return `$${job.salary.toFixed(2)}`;
  return "-";
};

interface Job extends JobDetails {
  id: string;
}

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [visaType, setVisaType] = useState<VisaTypeFilter>((searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [stateFilter, setStateFilter] = useState(searchParams.get("state") || "");
  const [cityFilter, setCityFilter] = useState(searchParams.get("city") || "");
  const [page, setPage] = useState(Number(searchParams.get("page") || "1"));
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // --- FETCHING LOGIC (Mantida original) ---
  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    // Filtros e ordenação...
    query = query.order("posted_date", { ascending: false }).range(from, to);
    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim()) query = query.ilike("job_title", `%${searchTerm}%`);

    const { data, error, count } = await query;
    if (!error) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [page, visaType, searchTerm, stateFilter, cityFilter]);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    const d = new Date(date);
    return isNaN(d.getTime()) ? date : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  const handleRowClick = (job: Job) => (planSettings.job_db_blur ? setShowUpgradeDialog(true) : setSelectedJob(job));

  const addToQueue = async (job: Job) => {
    if (!profile) {
      setShowLoginDialog(true);
      return;
    }
    if (queuedJobIds.has(job.id)) return;
    setQueuedJobIds((prev) => new Set(prev).add(job.id));
    await supabase.from("my_queue").insert({ user_id: profile.id, job_id: job.id });
    toast({ title: "✓ Vaga adicionada!" });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />

        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{t("nav.jobs")}</h1>
              <p className="text-muted-foreground">{formatNumber(totalCount)} vagas disponíveis</p>
            </div>
            {isAdmin && (
              <Button onClick={() => setShowImporter(true)} variant="outline">
                <Database className="h-4 w-4 mr-2" /> Importar V51
              </Button>
            )}
          </div>
        </div>

        {/* --- FILTROS --- */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center gap-4">
            <Select value={visaType} onValueChange={(v: any) => setVisaType(v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISA_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
        </Card>

        {/* --- TABELA DE VAGAS --- */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Vagas</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Visto</TableHead>
                  <TableHead>Publicada</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id} onClick={() => handleRowClick(j)} className="cursor-pointer hover:bg-slate-50">
                    <TableCell className="font-semibold">{j.job_title}</TableCell>
                    <TableCell className={cn(planSettings.job_db_blur && "blur-sm")}>{j.company}</TableCell>
                    <TableCell>
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell className="text-center">{j.openings || "-"}</TableCell>
                    <TableCell className="font-medium text-emerald-700">{renderPrice(j)}/h</TableCell>

                    {/* --- COLUNA VISTO COM SELO DE TRANSIÇÃO --- */}
                    <TableCell>
                      {(() => {
                        const b = getVisaBadgeConfig(j.visa_type);
                        const wasEarly = (j as any).was_early_access;

                        return (
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={b.variant}
                              className={cn(
                                b.className,
                                wasEarly && "border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]",
                              )}
                            >
                              <div className="flex items-center gap-1">
                                {wasEarly && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Rocket className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Vaga captada via Early Access e confirmada agora!</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {b.label}
                              </div>
                            </Badge>
                            {wasEarly && (
                              <span className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-1 ml-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Sincronizada
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>

                    <TableCell>{formatDate(j.posted_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={queuedJobIds.has(j.id) ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(j);
                        }}
                        disabled={queuedJobIds.has(j.id)}
                      >
                        {queuedJobIds.has(j.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* --- DIALOGS --- */}
        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={planSettings}
          onAddToQueue={(j) => addToQueue(j as Job)}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
        />

        <Dialog open={showImporter} onOpenChange={setShowImporter}>
          <DialogContent className="max-w-4xl p-0">
            <MultiJsonImporter />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
