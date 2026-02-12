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
      <DialogContent className="sm:max-w-2xl p-0 border-0 shadow-2xl bg-white rounded-xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full text-left">
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

        <div className="bg-slate-50 border-b border-slate-100 px-6 sm:px-8 py-5 sm:py-6">
          <div className="flex gap-3 sm:gap-4">
            <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700 mt-1 shrink-0" />
            <div>
              <h3 className="text-slate-900 font-bold text-sm sm:text-base">{t("jobs.onboarding.title")}</h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed">
                {t("jobs.onboarding.description")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5 sm:space-y-6">
          <Button
            onClick={handleClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-12 shadow-lg transition-all active:scale-[0.98]"
          >
            {t("jobs.onboarding.cta")}
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

  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
  );
  const [minSalary, setMinSalary] = useState(() => searchParams.get("min_salary") ?? "");
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || "1"));

  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [sortKey, setSortKey] = useState<any>(searchParams.get("sort") || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as any) || "desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);

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
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
    if (minSalary) query = query.gte("salary", Number(minSalary));

    query = query.range(from, to);
    const { data, error, count } = await query;
    if (!error && data) {
      setJobs(data as JobDetails[]);
      setTotalCount(count ?? 0);
      if (profile?.id) {
        const { data: queueRows } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in(
            "job_id",
            data.map((j) => j.id),
          );
        setQueuedJobIds(new Set((queueRows ?? []).map((r) => r.job_id)));
      }
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
    sortKey,
    sortDir,
    page,
  ]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(i18n.language, { timeZone: "UTC" });
  };

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
      toast({ title: t("jobs.toasts.added") });
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("nav.jobs")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("jobs.subtitle", { totalCount: formatNumber(totalCount), visaLabel: visaType })}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImporter(true)}>
                <Database className="mr-2 h-4 w-4" /> {t("jobs.import.admin")}
              </Button>
              <JobImportDialog />
            </div>
          )}
        </div>

        {/* FILTROS */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3 px-4 pt-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <Select
                value={visaType}
                onValueChange={(v: any) => {
                  setVisaType(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full lg:w-[200px] h-10">
                  <SelectValue placeholder={t("jobs.filters.visa.placeholder")} />
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("jobs.search.placeholder")}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10 h-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-0 px-4 pb-4">
            <Input
              placeholder={t("jobs.filters.state")}
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="h-10"
            />
            <Input
              placeholder={t("jobs.filters.city")}
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="h-10"
            />
            <Input
              type="number"
              placeholder={t("jobs.filters.min_salary")}
              value={minSalary}
              onChange={(e) => {
                setMinSalary(e.target.value);
                setPage(1);
              }}
              className="h-10"
            />
            <Select
              value={groupFilter}
              onValueChange={(v) => {
                setGroupFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t("jobs.filters.group")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all_groups")}</SelectItem>
                {["A", "B", "C", "D", "E", "F", "G", "H"].map((g) => (
                  <SelectItem key={g} value={g}>
                    {t("jobs.groups.group_label")} {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* TABELA */}
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
                formatDate={formatDate}
                reportData={jobReports[j.id]}
              />
            ))}
          </div>
        ) : (
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead
                    className="text-xs font-bold uppercase text-slate-500 py-4 cursor-pointer"
                    onClick={() => toggleSort("job_title")}
                  >
                    {t("jobs.table.headers.job_title")} <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500">
                    {t("jobs.table.headers.company")}
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500 text-center">
                    {t("jobs.table.headers.openings")}
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500">
                    {t("jobs.table.headers.salary")}
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500">
                    {t("jobs.table.headers.posted")}
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500">Group</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500 text-right pr-6">
                    {t("jobs.table.headers.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <Loader2 className="animate-spin inline mr-2 h-4 w-4" /> {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow
                      key={j.id}
                      onClick={() => setSelectedJob(j)}
                      className="cursor-pointer hover:bg-slate-50/80 transition-all border-slate-100"
                    >
                      <TableCell className="text-sm font-semibold text-slate-900 py-4">
                        <span translate="no">{j.job_title}</span>
                      </TableCell>
                      <TableCell className={cn("text-sm text-slate-600", planSettings.job_db_blur && "blur-sm")}>
                        <span translate="no">{j.company}</span>
                      </TableCell>
                      <TableCell className="text-sm text-center text-slate-600" translate="no">
                        {j.openings}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-green-700" translate="no">
                        {j.salary ? `$${j.salary.toFixed(2)}/h` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 font-medium" translate="no">
                        {formatDate(j.posted_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold py-0 h-5" translate="no">
                          G-{j.randomization_group || "?"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm"
                          variant={queuedJobIds.has(j.id) ? "secondary" : "outline"}
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(j);
                          }}
                        >
                          {queuedJobIds.has(j.id) ? (
                            <Check className="h-4 w-4 text-green-600" />
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

        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-slate-500 font-medium">{t("jobs.pagination.page_of", { page, totalPages })}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o: boolean) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={profile}
          formatSalary={(s: any) => `$${Number(s).toFixed(2)}/h`}
          onAddToQueue={addToQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
        />
      </div>
    </TooltipProvider>
  );
}
