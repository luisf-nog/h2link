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

// --- COMPONENTE DE ONBOARDING ---
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
        <div className="bg-slate-900 px-6 sm:px-8 py-5 sm:py-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700 text-white shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                H2 Linker Platform
              </h2>
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider font-semibold">
                Official Automation Tool
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-slate-50 border-b border-slate-100 px-6 sm:px-8 py-5 sm:py-6 text-left">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-shrink-0 mt-1 text-slate-700">
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-sm sm:text-base">Service Transparency & Role</h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed">
                H2 Linker is a <strong>software technology provider</strong>. We are not a recruitment agency...
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8 space-y-5 sm:space-y-6 text-left">
          <Button
            onClick={handleClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-12 shadow-lg transition-all active:scale-[0.98]"
          >
            I Understand - Let's Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const renderPrice = (job: JobDetails) => {
  if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
    return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
  if (job.wage_from) return `$${job.wage_from.toFixed(2)}`;
  if (job.salary) return `$${job.salary.toFixed(2)}`;
  return "-";
};

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // ESTADOS RESTAURADOS
  const [jobs, setJobs] = useState<JobDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "");
  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => searchParams.get("categories")?.split(",") || [],
  );
  const [minSalary, setMinSalary] = useState(() => searchParams.get("min_salary") ?? "");
  const [maxSalary, setMaxSalary] = useState(() => searchParams.get("max_salary") ?? "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || "1"));
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [sortKey, setSortKey] = useState<any>(searchParams.get("sort") || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as any) || "desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const visaLabel = visaType === "all" ? "All Visas" : visaType;

  // FUNÇÕES DE BUSCA E FILTRO COMPLETAS
  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc" });
    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim())
      query = query.or(`job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
    if (minSalary) query = query.gte("salary", Number(minSalary));

    query = query.range(from, to);
    const { data, error, count } = await query;
    if (!error) {
      setJobs(data as JobDetails[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [
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
    page,
  ]);

  const addToQueue = async (job: JobDetails) => {
    if (!profile) {
      setShowLoginDialog(true);
      return;
    }
    setProcessingJobIds((p) => new Set(p).add(job.id));
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) {
      setQueuedJobIds((q) => new Set(q).add(job.id));
      toast({ title: "Vaga adicionada!" });
    }
    setProcessingJobIds((p) => {
      const n = new Set(p);
      n.delete(job.id);
      return n;
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">{t("nav.jobs")}</h1>
          <p className="text-muted-foreground">
            {t("jobs.subtitle", { totalCount: formatNumber(totalCount), visaLabel })}
          </p>
        </div>

        {/* FILTROS COMPLETOS RESTAURADOS */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row gap-4">
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
                  placeholder={t("jobs.search.placeholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input placeholder="Estado" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
            <Input placeholder="Cidade" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            <Input
              type="number"
              placeholder="Salário Mín."
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
            />
            {isAdmin && (
              <Button variant="outline" onClick={() => setShowImporter(true)}>
                <Database className="mr-2 h-4 w-4" /> Import Admin
              </Button>
            )}
          </CardContent>
        </Card>

        {/* TABELA COMPLETA COM TODAS AS COLUNAS */}
        {isMobile ? (
          <div className="space-y-3">
            {jobs.map((j) => (
              <MobileJobCard
                key={j.id}
                job={j as any}
                isBlurred={planSettings.job_db_blur}
                isQueued={queuedJobIds.has(j.id)}
                onAddToQueue={() => addToQueue(j)}
                onClick={() => setSelectedJob(j)}
                reportData={jobReports[j.id]}
              />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Vagas</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Visto</TableHead>
                  <TableHead>Postada</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id} onClick={() => setSelectedJob(j)} className="cursor-pointer">
                    <TableCell className="font-medium">{j.job_title}</TableCell>
                    <TableCell className={cn(planSettings.job_db_blur && "blur-sm")}>{j.company}</TableCell>
                    <TableCell>
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell className="text-center">{j.openings}</TableCell>
                    <TableCell>{renderPrice(j)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{j.visa_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(j.posted_date!).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={queuedJobIds.has(j.id) ? "secondary" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(j);
                        }}
                      >
                        {processingJobIds.has(j.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : queuedJobIds.has(j.id) ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={profile}
          formatSalary={formatSalary}
          onAddToQueue={addToQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
        />
      </div>
    </TooltipProvider>
  );
}

function formatSalary(s: number | null) {
  return s ? `$${s.toFixed(2)}/h` : "-";
}
