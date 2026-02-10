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
  Landmark,
  ShieldAlert,
  Briefcase,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";
import { getJobShareUrl } from "@/lib/shareUtils";

// --- HELPERS ---
const renderPrice = (job: JobDetails) => {
  if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
    return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
  }
  if (job.wage_from) return `$${job.wage_from.toFixed(2)}`;
  if (job.salary) return `$${job.salary.toFixed(2)}`;
  return "-";
};

// --- ONBOARDING MODAL ---
function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

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
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-0 shadow-2xl bg-white rounded-xl">
        <div className="bg-slate-900 px-8 py-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">H2 Linker Platform</h2>
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Official Automation Tool</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border-b border-slate-100 px-8 py-6">
          <div className="flex gap-4 text-slate-700">
            <ShieldAlert className="h-6 w-6 shrink-0 mt-1" />
            <div>
              <h3 className="text-slate-900 font-bold text-base">Service Transparency</h3>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                H2 Linker is a software provider. We automate your outreach, but hiring decisions are made by employers.
              </p>
            </div>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <Button onClick={handleClose} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 shadow-lg">
            I Understand - Let's Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);

  const [visaType, setVisaType] = useState<VisaTypeFilter>((searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get("categories")?.split(",").filter(Boolean) || [],
  );
  const [minSalary, setMinSalary] = useState(searchParams.get("min_salary") ?? "");
  const [maxSalary, setMaxSalary] = useState(searchParams.get("max_salary") ?? "");
  const [sortKey, setSortKey] = useState<string>(searchParams.get("sort") || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as "asc" | "desc") || "desc");
  const [page, setPage] = useState(Number(searchParams.get("page") || "1"));

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false });
    query = query.order("id", { ascending: true });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim())
      query = query.or(
        `job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`,
      );
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (minSalary) query = query.gte("salary", Number(minSalary));
    if (maxSalary) query = query.lte("salary", Number(maxSalary));

    const { data, error, count } = await query.range(from, to);

    if (!error) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
      if (profile?.id && data?.length) {
        const ids = data.map((j) => j.id);
        const { data: qData } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in("job_id", ids);
        setQueuedJobIds(new Set(qData?.map((r) => r.job_id)));

        const { data: rData } = await supabase.from("job_reports").select("job_id, reason").in("job_id", ids);
        const reportsMap: Record<string, { count: number; reasons: ReportReason[] }> = {};
        rData?.forEach((row) => {
          if (!reportsMap[row.job_id]) reportsMap[row.job_id] = { count: 0, reasons: [] };
          reportsMap[row.job_id].count++;
          if (!reportsMap[row.job_id].reasons.includes(row.reason as ReportReason))
            reportsMap[row.job_id].reasons.push(row.reason as ReportReason);
        });
        setJobReports(reportsMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [visaType, searchTerm, stateFilter, cityFilter, selectedCategories, minSalary, maxSalary, sortKey, sortDir, page]);

  // --- LÓGICA DE ADICIONAR À FILA AJUSTADA (REMOVIDO TRIGGER DE ENVIO) ---
  const addToQueue = async (job: Job) => {
    if (!profile) return setShowLoginDialog(true);
    if (planSettings.job_db_blur) return setShowUpgradeDialog(true);
    if (queuedJobIds.has(job.id)) return;

    setProcessingJobIds((p) => new Set(p).add(job.id));

    // ATENÇÃO: Aqui realizamos APENAS a inserção no banco de dados.
    // O envio de e-mail é feito EXCLUSIVAMENTE na página de Fila (/queue).
    const { error } = await supabase.from("my_queue").insert({
      user_id: profile.id,
      job_id: job.id,
      status: "pending", // Forçamos o status para pending para evitar gatilhos automáticos
    });

    if (error) {
      toast({ title: t("common.errors.generic"), description: error.message, variant: "destructive" });
    } else {
      setQueuedJobIds((p) => new Set(p).add(job.id));
      toast({
        title: "Vaga na Fila!",
        description: `${job.job_title} foi salva. Vá para a aba 'Fila' para realizar o envio.`,
      });
    }
    setProcessingJobIds((p) => {
      const n = new Set(p);
      n.delete(job.id);
      return n;
    });
  };

  const handleRowClick = (job: Job) => (planSettings.job_db_blur ? setShowUpgradeDialog(true) : setSelectedJob(job));

  const toggleSort = (key: string) => {
    setSortDir(sortKey === key && sortDir === "asc" ? "desc" : "asc");
    setSortKey(key);
    setPage(1);
  };

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-");

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t("nav.jobs")}</h1>
          {isAdmin && <JobImportDialog />}
        </div>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-4">
            <Select
              value={visaType}
              onValueChange={(v) => {
                setVisaType(v as VisaTypeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Visa" />
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
          </CardHeader>
        </Card>

        {isMobile ? (
          <div className="space-y-3">
            {jobs.map((j) => (
              <MobileJobCard
                key={j.id}
                job={j}
                isQueued={queuedJobIds.has(j.id)}
                onAddToQueue={() => addToQueue(j)}
                onClick={() => handleRowClick(j)}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => toggleSort("job_title")} className="cursor-pointer">
                    Title
                  </TableHead>
                  <TableHead onClick={() => toggleSort("company")} className="cursor-pointer">
                    Company
                  </TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead onClick={() => toggleSort("salary")} className="cursor-pointer">
                    Wage
                  </TableHead>
                  <TableHead>Visa</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleRowClick(j)}>
                      <TableCell className="font-medium">{j.job_title}</TableCell>
                      <TableCell className={cn(planSettings.job_db_blur && "blur-sm")}>{j.company}</TableCell>
                      <TableCell>
                        {j.city}, {j.state}
                      </TableCell>
                      <TableCell>{renderPrice(j)}</TableCell>
                      <TableCell>
                        {(() => {
                          const b = getVisaBadgeConfig(j.visa_type);
                          return (
                            <Badge variant={b.variant} className={b.className}>
                              {b.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={queuedJobIds.has(j.id) ? "secondary" : "default"}
                          disabled={queuedJobIds.has(j.id) || processingJobIds.has(j.id)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        <div className="flex justify-between items-center py-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={planSettings}
          onAddToQueue={addToQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
        />
      </div>
    </TooltipProvider>
  );
}
