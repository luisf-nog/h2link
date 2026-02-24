import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { JobImportDialog } from "@/components/jobs/JobImportDialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Database,
  Briefcase,
  Rocket,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Check,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

const JOB_CATEGORIES_LIST = [
  "Farmworkers and Laborers, Crop, Nursery, and Greenhouse",
  "Agricultural Equipment Operators",
  "Landscaping and Groundskeeping Workers",
  "Farmworkers, Farm, Ranch, and Aquacultural Animals",
  "Construction Laborers",
  "Maids and Housekeeping Cleaners",
  "Cooks, Restaurant",
  "Heavy and Tractor-Trailer Truck Drivers",
  "Waiters and Waitresses",
  "Food Preparation Workers",
  "Farm Equipment Mechanics and Service Technicians",
  "Janitors and Cleaners, Except Maids and Housekeeping Cleaners",
  "Laborers and Freight, Stock, and Material Movers, Hand",
  "Cement Masons and Concrete Finishers",
  "Dishwashers",
  "Fast Food and Counter Workers",
  "Amusement and Recreation Attendants",
  "Hotel, Motel, and Resort Desk Clerks",
  "Animal Caretakers",
];

type Job = Tables<"public_jobs">;

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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [categoryFilter, setCategoryFilter] = useState("");
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

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(i18n.language === "pt" ? "pt-BR" : "en-US", { timeZone: "UTC" });
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return "-";
    return months < 12 ? `${months}m` : `${Math.floor(months / 12)}y`;
  };

  const renderPrice = (job: Job) => {
    if (job.wage_from) return <span translate="no">{`$${job.wage_from.toFixed(2)}`}</span>;
    if (job.salary) return <span translate="no">{`$${job.salary.toFixed(2)}`}</span>;
    return "-";
  };

  const syncQueue = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id);
    if (data) setQueuedJobIds(new Set(data.map((r) => r.job_id)));
  };

  useEffect(() => {
    if (profile?.id) {
      syncQueue();
      const hasSeenWelcome = localStorage.getItem("h2linker_hub_welcome_seen");
      if (!hasSeenWelcome) setShowWelcome(true);
    }
  }, [profile?.id]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("h2linker_hub_welcome_seen", "true");
  };

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("public_jobs")
      .select("*", { count: "exact" })
      .eq("is_banned", false)
      .eq("is_active", true);
    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim())
      query = query.or(`job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (categoryFilter.trim()) query = query.ilike("category", `%${categoryFilter.trim()}%`);
    if (minSalary) query = query.gte("salary", Number(minSalary));
    if (maxSalary) query = query.lte("salary", Number(maxSalary));

    const { data, count } = await query.range(from, to);
    if (data) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [visaType, searchTerm, stateFilter, cityFilter, categoryFilter, minSalary, maxSalary, sortKey, sortDir, page]);

  const addToQueue = async (job: Job) => {
    if (!profile?.id || planSettings.job_db_blur) {
      toast({ title: t("jobs.restricted_title"), description: t("jobs.restricted_desc"), variant: "destructive" });
      return;
    }
    setProcessingJobIds((prev) => new Set(prev).add(job.id));
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) {
      await syncQueue();
      toast({
        title: t("jobs.toasts.add_success_title"),
        description: t("jobs.toasts.add_success_queue_hint"),
        action: (
          <ToastAction altText={t("jobs.toasts.go_to_queue")} onClick={() => navigate("/queue")}>
            {t("jobs.toasts.go_to_queue")}
          </ToastAction>
        ),
      });
    }
    setProcessingJobIds((prev) => {
      const n = new Set(prev);
      n.delete(job.id);
      return n;
    });
  };

  const removeFromQueue = async (job: Job) => {
    if (!profile?.id) return;
    setProcessingJobIds((prev) => new Set(prev).add(job.id));
    const { error } = await supabase.from("my_queue").delete().eq("user_id", profile.id).eq("job_id", job.id);
    if (!error) {
      await syncQueue();
      toast({ title: t("jobs.toasts.remove_success_title") });
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
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50 ml-1 inline" />;
    return dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1 inline" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1 inline" />
    );
  };

  const getGroupBadgeConfig = (group: string) => {
    const g = group.toUpperCase();
    if (g === "A")
      return {
        label: t("jobs.group_label", { group: "A" }),
        className: "bg-emerald-50 text-emerald-800 border-emerald-300",
      };
    if (g === "B")
      return { label: t("jobs.group_label", { group: "B" }), className: "bg-blue-50 text-blue-800 border-blue-300" };
    if (g === "C" || g === "D")
      return { label: t("jobs.group_label", { group: g }), className: "bg-amber-50 text-amber-800 border-amber-300" };
    return { label: t("jobs.group_label", { group: g }), className: "bg-slate-50 text-slate-700 border-slate-300" };
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 text-left px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("nav.jobs")}</h1>
            <p className="text-muted-foreground mt-1">{t("jobs.jobs_found", { count: totalCount })}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/importer")}
                className="w-full sm:w-auto"
              >
                <Database className="mr-2 h-4 w-4" /> {t("common.menu")}
              </Button>
              <JobImportDialog />
            </div>
          )}
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                value={visaType}
                onValueChange={(v: any) => {
                  setVisaType(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="bg-white">
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("jobs.search.placeholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
              <Input
                placeholder={t("jobs.filters.state")}
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="h-10"
              />
              <Input
                placeholder={t("jobs.filters.city")}
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
                <SelectTrigger className="bg-white h-10">
                  <SelectValue placeholder={t("jobs.filters.category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("jobs.filters.category_all")}</SelectItem>
                  {JOB_CATEGORIES_LIST.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder={t("jobs.filters.min_salary")}
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
                className="h-10"
              />
              <Input
                type="number"
                placeholder={t("jobs.filters.max_salary")}
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
                className="h-10"
              />
            </div>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : isMobile ? (
          <div className="space-y-4">
            {jobs.map((j) => (
              <Card
                key={j.id}
                onClick={() => setSelectedJob(j)}
                className="active:scale-[0.98] transition-transform cursor-pointer"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-slate-900 leading-tight flex-1">{j.job_title}</h3>
                    <span className="font-bold text-green-700 shrink-0">{renderPrice(j)}/h</span>
                  </div>
                  <div className="flex flex-wrap gap-y-2 gap-x-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" /> {j.company}
                    </span>
                    <span className="flex items-center gap-1 uppercase">
                      <MapPin className="h-3.5 w-3.5" /> {j.city}, {j.state}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Badge
                      className={cn(
                        "text-[10px] font-black",
                        !j.was_early_access && j.visa_type === "H-2A" && "bg-green-600 text-white",
                        !j.was_early_access && j.visa_type === "H-2B" && "bg-blue-600 text-white",
                        (j.visa_type.includes("Early Access") || j.was_early_access) &&
                          "bg-amber-50 border-amber-400 text-amber-900",
                      )}
                    >
                      {j.visa_type}
                    </Badge>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatDate(j.posted_date)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 whitespace-nowrap">
                  <TableHead onClick={() => toggleSort("job_title")} className="cursor-pointer py-4">
                    {t("jobs.table.headers.job_title")} <SortIcon active={sortKey === "job_title"} dir={sortDir} />
                  </TableHead>
                  <TableHead onClick={() => toggleSort("company")} className="cursor-pointer">
                    {t("jobs.table.headers.company")} <SortIcon active={sortKey === "company"} dir={sortDir} />
                  </TableHead>
                  <TableHead onClick={() => toggleSort("city")} className="cursor-pointer">
                    {t("jobs.table.headers.location")} <SortIcon active={sortKey === "city"} dir={sortDir} />
                  </TableHead>
                  <TableHead onClick={() => toggleSort("openings")} className="text-center cursor-pointer">
                    {t("jobs.table.headers.openings")} <SortIcon active={sortKey === "openings"} dir={sortDir} />
                  </TableHead>
                  <TableHead onClick={() => toggleSort("salary")} className="cursor-pointer">
                    {t("jobs.table.headers.salary")} <SortIcon active={sortKey === "salary"} dir={sortDir} />
                  </TableHead>
                  <TableHead onClick={() => toggleSort("visa_type")} className="cursor-pointer">
                    {t("jobs.table.headers.visa")} <SortIcon active={sortKey === "visa_type"} dir={sortDir} />
                  </TableHead>
                  <TableHead>{t("jobs.groups.group_label")}</TableHead>
                  <TableHead onClick={() => toggleSort("posted_date")} className="cursor-pointer">
                    {t("jobs.table.headers.posted")} <SortIcon active={sortKey === "posted_date"} dir={sortDir} />
                  </TableHead>
                  <TableHead onClick={() => toggleSort("start_date")} className="cursor-pointer">
                    {t("jobs.table.headers.start")} <SortIcon active={sortKey === "start_date"} dir={sortDir} />
                  </TableHead>
                  <TableHead onClick={() => toggleSort("end_date")} className="cursor-pointer">
                    {t("jobs.table.headers.end")} <SortIcon active={sortKey === "end_date"} dir={sortDir} />
                  </TableHead>
                  <TableHead>{t("jobs.table.headers.experience")}</TableHead>
                  <TableHead className="text-right">{t("jobs.table.headers.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="font-semibold text-sm">{j.job_title}</TableCell>
                    <TableCell className="text-sm text-slate-600">{j.company}</TableCell>
                    <TableCell className="text-sm uppercase">
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell className="text-center text-sm">{j.openings ?? "-"}</TableCell>
                    <TableCell className="font-bold text-green-700 text-sm">{renderPrice(j)}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10px] font-black border-2",
                          !j.was_early_access && j.visa_type === "H-2A" && "bg-green-600 text-white border-green-600",
                          !j.was_early_access && j.visa_type === "H-2B" && "bg-blue-600 text-white border-blue-600",
                          (j.visa_type.includes("Early Access") || j.was_early_access) &&
                            "bg-amber-50 border-amber-400 text-amber-900",
                        )}
                      >
                        {j.visa_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {j.randomization_group && (
                        <Badge
                          variant="outline"
                          className={cn("font-bold text-[10px]", getGroupBadgeConfig(j.randomization_group).className)}
                        >
                          {getGroupBadgeConfig(j.randomization_group).label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(j.posted_date)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(j.start_date)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">{formatDate(j.end_date)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{formatExperience(j.experience_months)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={queuedJobIds.has(j.id) ? "default" : "outline"}
                        className={cn(
                          "rounded-full h-8 w-8 p-0",
                          queuedJobIds.has(j.id) &&
                            "bg-green-600 border-green-600 text-white hover:bg-red-500 hover:border-red-500",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          queuedJobIds.has(j.id) ? removeFromQueue(j) : addToQueue(j);
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

        <div className="flex items-center justify-between py-6">
          <div className="hidden sm:block text-sm text-muted-foreground">
            {t("jobs.pagination.page_of_total", { page, totalPages, total: formatNumber(totalCount) })}
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> {t("common.previous")}
            </Button>
            <span className="sm:hidden text-sm font-medium">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              {t("common.next")} <ChevronRight className="h-4 w-4 ml-1" />
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
        />

        {/* Dialog Explicativo Reativado */}
        <Dialog open={showWelcome} onOpenChange={handleCloseWelcome}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                <Rocket className="h-6 w-6 text-primary" /> {t("onboarding.welcome.title")}
              </DialogTitle>
              <DialogDescription className="pt-4 space-y-4 text-slate-700">
                <p>{t("onboarding.welcome.description")}</p>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                  <div className="flex gap-3">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <p className="text-sm">{t("jobs.shared.add_to_queue")}</p>
                  </div>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 flex gap-3">
                  <Send className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm font-semibold text-amber-900">{t("onboarding.complete.next_steps")}</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button onClick={handleCloseWelcome} className="w-full font-bold">
                {t("common.ok")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
