import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { JobImportDialog } from "@/components/jobs/JobImportDialog";
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
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Database,
  ChevronsUpDown,
  Briefcase,
  Rocket,
  ArrowRight,
  X,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

// Interface robusta para o Job
interface Job {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  city: string;
  state: string;
  email: string;
  visa_type: string | null;
  salary: number | null;
  wage_from: number | null;
  wage_to: number | null;
  wage_unit: string | null;
  openings: number | null;
  posted_date: string | null;
  start_date: string | null;
  end_date: string | null;
  experience_months: number | null;
  randomization_group: string | null;
  was_early_access: boolean | null;
  category: string | null;
}

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

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();

  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});
  const [showImporter, setShowImporter] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => searchParams.get("categories")?.split(",") || [],
  );
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [page, setPage] = useState(1);

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
  const [sortKey, setSortKey] = useState<SortKey>(() => (searchParams.get("sort") as SortKey) || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as any) || "desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);

  // DEFINE tableColSpan AQUI PARA EVITAR O ERRO DE RUNTIME
  const tableColSpan = 11;

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(i18n.language === "pt" ? "pt-BR" : "en-US", { timeZone: "UTC" });
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return "-";
    return months < 12 ? `${months}m` : `${Math.floor(months / 12)}y`;
  };

  const renderPrice = (job: Job) => {
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      return <span translate="no">{`$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`}</span>;
    }
    if (job.wage_from) return <span translate="no">{`$${job.wage_from.toFixed(2)}`}</span>;
    if (job.salary) return <span translate="no">{`$${job.salary.toFixed(2)}`}</span>;
    return "-";
  };

  const syncQueue = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id).eq("status", "pending");
    setQueuedJobIds(new Set((data ?? []).map((r) => r.job_id)));
  };

  useEffect(() => {
    if (!profile?.id) return;
    syncQueue();
    const channel = supabase
      .channel("sync-queue-realtime-final")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "my_queue", filter: `user_id=eq.${profile.id}` },
        () => syncQueue(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);
    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    const term = searchTerm.replace(/[()\[\]{}|\\^$*+?.<>]/g, "").trim();
    if (term)
      query = query.or(`job_title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%,job_id.ilike.%${term}%`);
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
    if (minSalary) query = query.gte("salary", Number(minSalary));
    if (maxSalary) query = query.lte("salary", Number(maxSalary));

    query = query.range(from, to);
    const { data, error, count } = await query;
    if (!error && data) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
      const ids = data.map((j) => j.id);
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

  const addToQueue = async (job: Job) => {
    if (!profile) return;
    if (planSettings.job_db_blur) return;
    setProcessingJobIds((prev) => new Set(prev).add(job.id));
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) {
      syncQueue();
      toast({
        title: t("jobs.toasts.add_success_title"),
        description: t("jobs.toasts.add_success_desc", { jobTitle: job.job_title }),
      });
    }
    setProcessingJobIds((prev) => {
      const n = new Set(prev);
      n.delete(job.id);
      return n;
    });
  };

  const removeFromQueue = async (job: Job) => {
    if (!profile) return;
    setProcessingJobIds((prev) => new Set(prev).add(job.id));
    const { error } = await supabase
      .from("my_queue")
      .delete()
      .eq("user_id", profile.id)
      .eq("job_id", job.id)
      .eq("status", "pending");
    if (!error) {
      syncQueue();
      toast({ title: t("queue.toasts.remove_success_title"), description: t("queue.toasts.remove_success_desc") });
    }
    setProcessingJobIds((prev) => {
      const n = new Set(prev);
      n.delete(job.id);
      return n;
    });
  };

  const toggleSort = (key: SortKey) => {
    setPage(1);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const getGroupBadgeConfig = (group: string) => {
    const g = group.toUpperCase();
    if (g === "A") return { className: "bg-emerald-50 text-emerald-800 border-emerald-300" };
    if (g === "B") return { className: "bg-blue-50 text-blue-800 border-blue-300" };
    if (g === "C" || g === "D") return { className: "bg-amber-50 text-amber-800 border-amber-300" };
    return { className: "bg-slate-50 text-slate-700 border-slate-300" };
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
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

        {/* CENTRAL DE COMANDO MODERNA */}
        {queuedJobIds.size > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500 overflow-visible">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-center justify-between gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-l-4 border-l-blue-600 transition-all hover:shadow-[0_8px_30px_rgba(37,99,235,0.08)]">
              <div className="flex items-center gap-4 overflow-visible text-left">
                <div className="relative shrink-0 p-1">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Zap className="h-6 w-6 text-white fill-white/20" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[11px] font-black h-6 w-6 rounded-full flex items-center justify-center border-[3px] border-white shadow-md animate-in zoom-in duration-300">
                    {queuedJobIds.size}
                  </div>
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base leading-tight">{t("jobs.queue_banner.title")}</h3>
                  <p className="text-slate-500 text-sm truncate">
                    {t("jobs.queue_banner.subtitle", { count: queuedJobIds.size })}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/queue")}
                className="shrink-0 bg-slate-900 hover:bg-blue-600 text-white font-bold h-11 px-6 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 group"
              >
                {t("jobs.queue_banner.cta")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 px-4 pt-4 text-left">
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("jobs.filters.visa.h2a_info")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                          <CommandItem
                            key={c}
                            onSelect={() => {
                              setSelectedCategories((prev) =>
                                prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                              );
                              setPage(1);
                            }}
                          >
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
          <div className="space-y-3 text-left">
            {jobs.map((j) => (
              <MobileJobCard
                key={j.id}
                job={j}
                isBlurred={planSettings.job_db_blur}
                isQueued={queuedJobIds.has(j.id)}
                onAddToQueue={() => (queuedJobIds.has(j.id) ? removeFromQueue(j) : addToQueue(j))}
                onClick={() => setSelectedJob(j)}
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
                  <TableRow className="whitespace-nowrap bg-slate-50/80 text-left">
                    <TableHead className="text-left py-4">
                      <button onClick={() => toggleSort("job_title")}>
                        {t("jobs.table.headers.job_title")} <SortIcon active={sortKey === "job_title"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-left">
                      <button onClick={() => toggleSort("company")}>
                        {t("jobs.table.headers.company")} <SortIcon active={sortKey === "company"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-left">
                      <button onClick={() => toggleSort("city")}>
                        {t("jobs.table.headers.location")} <SortIcon active={sortKey === "city"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button onClick={() => toggleSort("openings")}>
                        {t("jobs.table.headers.openings")} <SortIcon active={sortKey === "openings"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-left">
                      <button onClick={() => toggleSort("salary")}>
                        {t("jobs.table.headers.salary")} <SortIcon active={sortKey === "salary"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-left">
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
                        onClick={() => (planSettings.job_db_blur ? null : setSelectedJob(j))}
                        className="cursor-pointer hover:bg-slate-50/80 transition-all border-slate-100 text-left"
                      >
                        <TableCell className="font-semibold text-slate-900 py-4 text-sm text-left">
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
                            className={cn("text-sm text-slate-600", planSettings.job_db_blur && "blur-sm select-none")}
                            translate="no"
                          >
                            {j.company}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 uppercase" translate="no">
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
                            const wasEarly = j.was_early_access;
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
                            const group = j.randomization_group;
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
                          {/* BOTÃO ADAPTÁVEL - CORRIGIDO */}
                          <Button
                            size="sm"
                            variant={!planSettings.job_db_blur && queuedJobIds.has(j.id) ? "default" : "outline"}
                            className={cn(
                              "h-8 w-8 p-0 rounded-full transition-all",
                              !planSettings.job_db_blur &&
                                queuedJobIds.has(j.id) &&
                                "bg-red-600 border-red-600 hover:bg-red-700 text-white shadow-md",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              queuedJobIds.has(j.id) ? removeFromQueue(j) : addToQueue(j);
                            }}
                            disabled={planSettings.job_db_blur || processingJobIds.has(j.id)}
                          >
                            {planSettings.job_db_blur ? (
                              <Lock className="h-4 w-4" />
                            ) : processingJobIds.has(j.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : queuedJobIds.has(j.id) ? (
                              <X className="h-4 w-4 text-white" />
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

        <div className="flex items-center justify-between py-2 text-left">
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

        {selectedJob && (
          <JobDetailsDialog
            open={!!selectedJob}
            onOpenChange={(o) => !o && setSelectedJob(null)}
            job={selectedJob}
            planSettings={profile}
            formatSalary={(s: any) => `$${Number(s).toFixed(2)}/h`}
            onAddToQueue={addToQueue}
            isInQueue={queuedJobIds.has(selectedJob.id)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
