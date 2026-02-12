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
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";
import { getJobShareUrl } from "@/lib/shareUtils";

// --- ONBOARDING MODAL ---
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
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 border-b border-slate-100 p-4 rounded-lg flex gap-3">
            <ShieldAlert className="h-5 w-5 text-slate-700 shrink-0" />
            <p className="text-slate-600 text-sm leading-relaxed">
              H2 Linker is a software provider. We automate your outreach to US employers.
            </p>
          </div>
          <Button
            onClick={handleClose}
            className="w-full bg-slate-900 hover:bg-slate-800 h-12 shadow-lg transition-all active:scale-[0.98]"
          >
            I Understand - Let's Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- FUNÇÕES AUXILIARES RECUPERADAS ---
const renderPrice = (job: JobDetails) => {
  if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
    return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
  if (job.wage_from) return `$${job.wage_from.toFixed(2)}`;
  if (job.salary) return `$${job.salary.toFixed(2)}`;
  return "-";
};

const formatSalary = (salary: number | null) => (salary ? `$${salary.toFixed(2)}/h` : "-");

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

  // Estados de Dados
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});

  // Estados de UI
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Filtros
  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
  );
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "");
  const [minSalary, setMinSalary] = useState(() => searchParams.get("min_salary") ?? "");
  const [maxSalary, setMaxSalary] = useState(() => searchParams.get("max_salary") ?? "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || "1"));
  const [sortKey, setSortKey] = useState<any>(() => searchParams.get("sort") || "posted_date");
  const [sortDir, setSortDir] = useState<any>(() => searchParams.get("dir") || "desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // --- COMPARTILHAMENTO ---
  const handleShareJob = (job: Job) => {
    const shareUrl = getJobShareUrl(job.id);
    if (navigator.share) {
      navigator
        .share({
          title: `${job.job_title} - ${job.company}`,
          text: `Job opportunity: ${job.job_title} in ${job.city}, ${job.state}`,
          url: shareUrl,
        })
        .catch(() => {
          navigator.clipboard.writeText(shareUrl);
          toast({ title: "Link copiado!" });
        });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copiado!" });
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim())
      query = query.or(`job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
    if (minSalary) query = query.gte("salary", Number(minSalary));
    if (maxSalary) query = query.lte("salary", Number(maxSalary));

    const { data, error, count } = await query.range(from, to);

    if (!error) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
      if (profile?.id && data?.length) {
        const ids = data.map((j) => j.id);
        const { data: queueRows } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in("job_id", ids);
        setQueuedJobIds(new Set(queueRows?.map((r) => r.job_id)));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [
    page,
    visaType,
    searchTerm,
    stateFilter,
    cityFilter,
    selectedCategories,
    groupFilter,
    minSalary,
    maxSalary,
    sortKey,
    sortDir,
  ]);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    const d = new Date(date);
    return isNaN(d.getTime()) ? date : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return "-";
    return months < 12 ? `${months}mo` : `${Math.floor(months / 12)}yr`;
  };

  const addToQueue = async (job: Job) => {
    if (!profile) {
      setShowLoginDialog(true);
      return;
    }
    if (planSettings.job_db_blur) {
      setShowUpgradeDialog(true);
      return;
    }
    if (queuedJobIds.has(job.id)) return;
    setQueuedJobIds((prev) => new Set(prev).add(job.id));
    await supabase.from("my_queue").insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    toast({ title: "✓ Vaga adicionada!" });
  };

  const handleRowClick = (job: Job) => (planSettings.job_db_blur ? setShowUpgradeDialog(true) : setSelectedJob(job));

  const SortIcon = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Vagas</h1>
            <p className="text-muted-foreground">{formatNumber(totalCount)} resultados encontrados</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button onClick={() => setShowImporter(true)} variant="outline">
                <Database className="h-4 w-4 mr-2" /> Importar JSON
              </Button>
              <JobImportDialog />
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <Select
              value={visaType}
              onValueChange={(v: any) => {
                setVisaType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Visto" />
              </SelectTrigger>
              <SelectContent>
                {VISA_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-0">
            <Input placeholder="Estado" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
            <Input placeholder="Cidade" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            <Select value={groupFilter} onValueChange={(v) => setGroupFilter(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {["A", "B", "C", "D", "E", "F", "G", "H"].map((g) => (
                  <SelectItem key={g} value={g}>
                    Grupo {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Min $" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} />
            <Input type="number" placeholder="Max $" value={maxSalary} onChange={(e) => setMaxSalary(e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="whitespace-nowrap">
                  <TableHead>
                    <button onClick={() => setSortKey("job_title")}>
                      Cargo <SortIcon active={sortKey === "job_title"} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => setSortKey("company")}>
                      Empresa <SortIcon active={sortKey === "company"} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>Cidade/Estado</TableHead>
                  <TableHead>Vagas</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Visto</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>
                    <button onClick={() => setSortKey("posted_date")}>
                      Postada <SortIcon active={sortKey === "posted_date"} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Exp.</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow
                      key={j.id}
                      onClick={() => handleRowClick(j)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <TableCell className="font-medium">{j.job_title}</TableCell>
                      <TableCell className={cn(planSettings.job_db_blur && "blur-sm")}>{j.company}</TableCell>
                      <TableCell>
                        {j.city}, {j.state}
                      </TableCell>
                      <TableCell className="text-center">{j.openings || "-"}</TableCell>
                      <TableCell className="font-semibold text-slate-700">{renderPrice(j)}/h</TableCell>

                      {/* COLUNA VISTO - BADGE DOURADO EARLY MATCH */}
                      <TableCell>
                        {(() => {
                          const b = getVisaBadgeConfig(j.visa_type);
                          const wasEarly = (j as any).was_early_access;
                          return (
                            <Badge
                              variant={b.variant}
                              className={cn(
                                b.className,
                                wasEarly && "border-amber-400 bg-amber-50 text-amber-700 shadow-sm",
                              )}
                            >
                              <div className="flex items-center gap-1">
                                {wasEarly && <Rocket className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                {b.label}
                              </div>
                            </Badge>
                          );
                        })()}
                      </TableCell>

                      <TableCell>
                        {(() => {
                          const g = (j as any).randomization_group;
                          return g ? <Badge variant="outline">{g}</Badge> : "-";
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(j.posted_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(j.start_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(j.end_date)}</TableCell>
                      <TableCell className="text-sm">{formatExperience(j.experience_months)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={queuedJobIds.has(j.id) ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(j);
                          }}
                        >
                          {queuedJobIds.has(j.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>

        {/* DIALOGS INTEGRADOS COM AS FUNÇÕES FORMATSALARY E HANDLESHAREJOB */}
        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={planSettings}
          formatSalary={formatSalary}
          onAddToQueue={addToQueue}
          onRemoveFromQueue={removeFromQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
          onShare={handleShareJob}
        />

        <Dialog open={showImporter} onOpenChange={setShowImporter}>
          <DialogContent className="max-w-4xl p-0">
            <MultiJsonImporter />
          </DialogContent>
        </Dialog>
        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upgrade Necessário</DialogTitle>
            </DialogHeader>
            <Button onClick={() => navigate("/plans")}>Ver Planos</Button>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
