import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
            <Briefcase className="h-5 w-5" />
            <h2 className="text-xl font-bold tracking-tight">{t("onboarding.title")}</h2>
          </div>
        </div>
        <div className="bg-slate-50 border-b border-slate-100 px-8 py-6">
          <div className="flex gap-4">
            <ShieldAlert className="h-6 w-6 text-slate-700 shrink-0 mt-1" />
            <div>
              <h3 className="text-slate-900 font-bold text-base">{t("onboarding.transparency_title")}</h3>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">{t("onboarding.transparency_body")}</p>
            </div>
          </div>
        </div>
        <div className="p-8">
          <Button
            onClick={handleClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-12 shadow-lg"
          >
            {t("onboarding.cta")}
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

  // --- LÓGICA DE FILA CORRIGIDA (APENAS INSERT) ---
  const addToQueue = async (job: Job) => {
    if (!profile) return setShowLoginDialog(true);
    if (planSettings.job_db_blur) return setShowUpgradeDialog(true);
    if (queuedJobIds.has(job.id)) return;

    setProcessingJobIds((p) => new Set(p).add(job.id));
    const { error } = await supabase.from("my_queue").insert({
      user_id: profile.id,
      job_id: job.id,
      status: "pending",
    });

    if (error) {
      toast({ title: t("common.errors.generic"), description: error.message, variant: "destructive" });
    } else {
      setQueuedJobIds((p) => new Set(p).add(job.id));
      // MENSAGEM TRADUZIDA AJUSTADA
      toast({
        title: t("jobs.toasts.added_title", "Vaga inserida na fila!"),
        description: t("jobs.toasts.added_desc", "Vá para a aba Fila e faça o envio em massa."),
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

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(i18n.language === "pt" ? "pt-BR" : "en-US", { timeZone: "UTC" }) : "-";
  const formatExperience = (m: number | null) =>
    !m || m <= 0 ? "-" : m < 12 ? `${m}m` : `${Math.floor(m / 12)}y ${m % 12}m`;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t("nav.jobs")}</h1>
          {isAdmin && <JobImportDialog />}
        </div>

        {/* TABELA DESKTOP COM TODAS AS COLUNAS E BLUR */}
        <Card className="overflow-hidden">
          {!isMobile ? (
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
                  <TableHead onClick={() => toggleSort("posted_date")} className="cursor-pointer">
                    Posted
                  </TableHead>
                  <TableHead onClick={() => toggleSort("start_date")} className="cursor-pointer">
                    Start
                  </TableHead>
                  <TableHead onClick={() => toggleSort("end_date")} className="cursor-pointer">
                    End
                  </TableHead>
                  <TableHead>Exp.</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleRowClick(j)}>
                      <TableCell className="font-medium text-xs">
                        <div className="flex items-center gap-1">
                          {jobReports[j.id] && (
                            <JobWarningBadge reportCount={jobReports[j.id].count} reasons={jobReports[j.id].reasons} />
                          )}
                          <span className="truncate max-w-[120px]">{j.job_title}</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-xs", planSettings.job_db_blur && "blur-sm")}>
                        <span className="truncate max-w-[100px] block">{j.company}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {j.city}, {j.state}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{renderPrice(j)}</TableCell>
                      <TableCell>
                        {(() => {
                          const b = getVisaBadgeConfig(j.visa_type);
                          return (
                            <Badge variant={b.variant} className={cn("text-[10px] px-1 shadow-none", b.className)}>
                              {b.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-[10px] whitespace-nowrap">{formatDate(j.posted_date)}</TableCell>
                      <TableCell className="text-[10px] whitespace-nowrap">{formatDate(j.start_date)}</TableCell>
                      <TableCell className="text-[10px] whitespace-nowrap">{formatDate(j.end_date)}</TableCell>
                      <TableCell className="text-[10px]">{formatExperience(j.experience_months)}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-[10px] truncate max-w-[80px] block",
                            planSettings.job_db_blur && "blur-sm",
                          )}
                        >
                          {j.email}
                        </span>
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
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4 space-y-3">
              {jobs.map((j) => (
                <MobileJobCard
                  key={j.id}
                  job={j}
                  isBlurred={planSettings.job_db_blur}
                  isQueued={queuedJobIds.has(j.id)}
                  onAddToQueue={() => addToQueue(j)}
                  onClick={() => handleRowClick(j)}
                  formatDate={formatDate}
                  reportData={jobReports[j.id]}
                />
              ))}
            </div>
          )}
        </Card>

        {/* PAGINAÇÃO */}
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
