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
              <h3 className="text-slate-900 font-bold text-sm sm:text-base">
                {t("jobs.onboarding.transparency_title")}
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed">
                {t("jobs.onboarding.transparency_text")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5 sm:space-y-6 text-left">
          <div className="pt-5 border-t border-slate-100 mt-2">
            <Button
              onClick={handleClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-12 shadow-lg transition-all active:scale-[0.98]"
            >
              {t("jobs.onboarding.cta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const renderPrice = (job: JobDetails) => {
  if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
    return <span translate="no">{`$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`}</span>;
  }
  if (job.wage_from) {
    return <span translate="no">{`$${job.wage_from.toFixed(2)}`}</span>;
  }
  if (job.salary) {
    return <span translate="no">{`$${job.salary.toFixed(2)}`}</span>;
  }
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
  const locale = i18n.resolvedLanguage || i18n.language;
  const currency = getCurrencyForLanguage(locale);
  const formatPlanPrice = (tier: "gold" | "diamond") => {
    const amount = getPlanAmountForCurrency(PLANS_CONFIG[tier], currency);
    return formatCurrency(amount, currency, locale);
  };

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
  const [categoriesLoading, setCategoriesLoading] = useState(false);
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

  type SortKey =
    | "job_title"
    | "company"
    | "state"
    | "city"
    | "openings"
    | "salary"
    | "visa_type"
    | "posted_date"
    | "start_date"
    | "end_date";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>(() => (searchParams.get("sort") as SortKey) || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as any) || "desc");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || "1"));
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);
  const tableColSpan = 12;

  const sanitizeSearchTerm = (term: string) => {
    return term.replace(/[()\[\]{}|\\^$*+?.<>]/g, "").trim();
  };

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false });

    if (visaType !== "all") query = query.eq("visa_type", visaType);

    const term = sanitizeSearchTerm(searchTerm);
    if (term) {
      query = query.or(`job_title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%,job_id.ilike.%${term}%`);
    }

    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);

    if (minSalary && !isNaN(Number(minSalary))) query = query.gte("salary", Number(minSalary));
    if (maxSalary && !isNaN(Number(maxSalary))) query = query.lte("salary", Number(maxSalary));

    query = query.range(from, to);
    const { data, error, count } = await query;
    if (!error && data) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
      if (profile?.id) {
        const ids = data.map((j) => j.id);
        const { data: qRows } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in("job_id", ids);
        setQueuedJobIds(new Set((qRows ?? []).map((r) => r.job_id)));
        const { data: reportRows } = await supabase.from("job_reports").select("job_id, reason").in("job_id", ids);
        const reportsMap: Record<string, { count: number; reasons: ReportReason[] }> = {};
        for (const row of reportRows ?? []) {
          if (!reportsMap[row.job_id]) reportsMap[row.job_id] = { count: 0, reasons: [] };
          reportsMap[row.job_id].count++;
          if (!reportsMap[row.job_id].reasons.includes(row.reason as ReportReason))
            reportsMap[row.job_id].reasons.push(row.reason as ReportReason);
        }
        setJobReports(reportsMap);
      }
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    const { data } = await supabase
      .from("public_jobs")
      .select("category")
      .not("category", "is", null)
      .neq("category", "")
      .limit(2000);
    if (data)
      setCategories(Array.from(new Set(data.map((r) => r.category?.trim()).filter(Boolean) as string[])).sort());
    setCategoriesLoading(false);
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
  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleCategory = (category: string) => {
    setPage(1);
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const clearCategories = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCategories([]);
    setPage(1);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return "-";
    return months < 12 ? `${months}m` : `${Math.floor(months / 12)}y`;
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
    setProcessingJobIds((prev) => new Set(prev).add(job.id));
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) {
      setQueuedJobIds((prev) => new Set(prev).add(job.id));
      toast({ title: t("jobs.toasts.added") });
    }
    setProcessingJobIds((prev) => {
      const n = new Set(prev);
      n.delete(job.id);
      return n;
    });
  };

  const handleRowClick = (job: Job) => (planSettings.job_db_blur ? setShowUpgradeDialog(true) : setSelectedJob(job));

  const toggleSort = (key: SortKey) => {
    setPage(1);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("nav.jobs")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("jobs.subtitle", { totalCount: formatNumber(totalCount), visaLabel: visaType })}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImporter(true)}>
                <Database className="mr-2 h-4 w-4" /> Admin
              </Button>
              <JobImportDialog />
            </div>
          )}
        </div>

        {/* FILTROS: RESTAURADO PARA LG:GRID-COLS-6 PARA MANTER LINEARIDADE */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 px-4 pt-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Select
                  value={visaType}
                  onValueChange={(v: any) => {
                    setVisaType(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("jobs.filters.visa.h2a_info")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("jobs.search.placeholder")}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-0 text-left">
              <Input
                placeholder={t("jobs.filters.state")}
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                placeholder={t("jobs.filters.city")}
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between text-muted-foreground font-normal h-10 text-sm">
                    {selectedCategories.length > 0
                      ? t("jobs.filters.selected", { count: selectedCategories.length })
                      : t("jobs.filters.category")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[250px]" align="start">
                  <Command>
                    <CommandInput placeholder={t("jobs.filters.search_cat")} />
                    <CommandList>
                      <CommandEmpty>{t("common.empty")}</CommandEmpty>
                      <CommandGroup>
                        {categories.map((c) => (
                          <CommandItem key={c} onSelect={() => toggleCategory(c)}>
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedCategories.includes(c)
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </div>
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Select
                value={groupFilter}
                onValueChange={(v) => {
                  setGroupFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Group" />
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
              <div className="relative w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                  $ Min
                </span>
                <Input
                  type="number"
                  placeholder=""
                  className="pl-12 h-10 text-xs"
                  value={minSalary}
                  onChange={(e) => {
                    setMinSalary(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="relative w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                  $ Max
                </span>
                <Input
                  type="number"
                  placeholder=""
                  className="pl-12 h-10 text-xs"
                  value={maxSalary}
                  onChange={(e) => {
                    setMaxSalary(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isMobile ? (
          <div className="space-y-3">
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
        ) : (
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardContent className="p-0 overflow-x-auto text-left">
              <Table>
                <TableHeader>
                  <TableRow className="whitespace-nowrap bg-slate-50/80">
                    <TableHead>
                      <button onClick={() => toggleSort("job_title")}>
                        {t("jobs.table.headers.job_title")} <SortIcon active={sortKey === "job_title"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("company")}>
                        {t("jobs.table.headers.company")} <SortIcon active={sortKey === "company"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("city")}>
                        {t("jobs.table.headers.location")} <SortIcon active={sortKey === "city"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("openings")}>
                        {t("jobs.table.headers.openings")} <SortIcon active={sortKey === "openings"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("salary")}>
                        {t("jobs.table.headers.salary")} <SortIcon active={sortKey === "salary"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("visa_type")}>
                        {t("jobs.table.headers.visa")} <SortIcon active={sortKey === "visa_type"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("posted_date")}>
                        {t("jobs.table.headers.posted")} <SortIcon active={sortKey === "posted_date"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("start_date")}>
                        {t("jobs.table.headers.start")} <SortIcon active={sortKey === "start_date"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("end_date")}>
                        {t("jobs.table.headers.end")} <SortIcon active={sortKey === "end_date"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>{t("jobs.table.headers.experience")}</TableHead>
                    <TableHead className="text-right sticky right-0 bg-white shadow-[-10px_0_15_px_-3px_rgba(0,0,0,0.05)] z-10">
                      {t("jobs.table.headers.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={tableColSpan} className="text-center py-20">
                        <Loader2 className="animate-spin inline mr-2 h-4 w-4" /> {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((j) => (
                      <TableRow
                        key={j.id}
                        onClick={() => handleRowClick(j)}
                        className="cursor-pointer hover:bg-slate-50/80 transition-all border-slate-100"
                      >
                        <TableCell className="font-semibold text-slate-900 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {jobReports[j.id] && (
                              <JobWarningBadge
                                reportCount={jobReports[j.id].count}
                                reasons={jobReports[j.id].reasons}
                              />
                            )}
                            <span translate="no">{j.job_title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "line-clamp-1 text-slate-600",
                              planSettings.job_db_blur && "blur-sm select-none",
                            )}
                            translate="no"
                          >
                            {j.company}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600" translate="no">
                          {j.city}, {j.state}
                        </TableCell>
                        <TableCell className="text-center text-slate-600" translate="no">
                          {j.openings ?? "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-green-700" translate="no">
                              {renderPrice(j)}
                            </span>
                            <span className="text-[10px] uppercase text-slate-400">/{j.wage_unit || "h"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const b = getVisaBadgeConfig(j.visa_type);
                            const wasEarly = (j as any).was_early_access;
                            return (
                              <Badge
                                variant={b.variant}
                                className={cn(
                                  b.className,
                                  "text-[10px]",
                                  wasEarly && "border-2 border-amber-400 bg-amber-50 shadow-sm",
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  {wasEarly && <Rocket className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                  <span translate="no">{b.label}</span>
                                </div>
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const group = (j as any).randomization_group;
                            if (!group) return "-";
                            const config = getGroupBadgeConfig(group);
                            return (
                              <Badge
                                variant="outline"
                                className={cn("font-bold text-[10px] py-0 h-5", config.className)}
                                translate="no"
                              >
                                G-{group}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap" translate="no">
                          {formatDate(j.posted_date)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap" translate="no">
                          {formatDate(j.start_date)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap" translate="no">
                          {formatDate(j.end_date)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap" translate="no">
                          {formatExperience(j.experience_months)}
                        </TableCell>
                        <TableCell className="text-right sticky right-0 bg-white shadow-[-10px_0_15_px_-3px_rgba(0,0,0,0.05)] z-10">
                          <Button
                            size="sm"
                            variant={!planSettings.job_db_blur && queuedJobIds.has(j.id) ? "default" : "outline"}
                            className={cn(
                              "h-8 w-8 p-0",
                              !planSettings.job_db_blur &&
                                queuedJobIds.has(j.id) &&
                                "bg-primary text-primary-foreground border-primary",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue(j);
                            }}
                          >
                            {planSettings.job_db_blur ? (
                              <Lock className="h-4 w-4" />
                            ) : processingJobIds.has(j.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : queuedJobIds.has(j.id) ? (
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
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-slate-500 font-medium">{t("jobs.pagination.page_of", { page, totalPages })}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold"
              disabled={page <= 1 || loading}
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
          onShare={(j: any) => navigate(`/job/${j.id}`)}
          setShowLoginDialog={setShowLoginDialog}
        />
      </div>
    </TooltipProvider>
  );
}
