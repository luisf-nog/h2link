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
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
  Loader2,
  Database,
  ChevronsUpDown,
  Bot,
  ShieldAlert,
  Briefcase,
  Rocket,
  X,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // ESTADOS
  const [jobs, setJobs] = useState<JobDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  // FILTROS
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
  const [sortKey, setSortKey] = useState(searchParams.get("sort") || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as any) || "desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc" });
    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim()) query = query.or(`job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`);
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
        const { data: qData } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in(
            "job_id",
            data.map((j) => j.id),
          );
        setQueuedJobIds(new Set((qData ?? []).map((q) => q.job_id)));
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
      navigate("/auth");
      return;
    }
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) {
      setQueuedJobIds(new Set([...Array.from(queuedJobIds), job.id]));
      toast({ title: t("jobs.toasts.added") });
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">{t("nav.jobs")}</h1>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowImporter(true)}>
              <Database className="mr-2 h-4 w-4" /> Admin
            </Button>
          )}
        </div>

        {/* FILTROS LINEARES */}
        <Card className="border-slate-200">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("jobs.search.placeholder")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10 text-sm h-10"
              />
            </div>
            <Input
              placeholder={t("jobs.filters.state")}
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm h-10"
            />
            <Select
              value={visaType}
              onValueChange={(v: any) => {
                setVisaType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="text-sm h-10">
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
            <Select
              value={groupFilter}
              onValueChange={(v) => {
                setGroupFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="text-sm h-10">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all_groups")}</SelectItem>
                {["A", "B", "C", "D", "E", "F", "G"].map((g) => (
                  <SelectItem key={g} value={g}>
                    Group {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* TABELA COM TODAS AS COLUNAS E FONTES LINEARES */}
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
              />
            ))}
          </div>
        ) : (
          <Card className="border-slate-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="text-xs font-bold uppercase text-slate-500 cursor-pointer"
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
                    {t("jobs.table.headers.start")}
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500">
                    {t("jobs.table.headers.end")}
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500">Group</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-slate-500 text-right">
                    {t("jobs.table.headers.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <Loader2 className="animate-spin inline mr-2 h-4 w-4" /> {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow
                      key={j.id}
                      onClick={() => setSelectedJob(j)}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                    >
                      <TableCell className="text-sm font-medium text-slate-900 py-3">{j.job_title}</TableCell>
                      <TableCell className={cn("text-sm text-slate-600", planSettings.job_db_blur && "blur-sm")}>
                        {j.company}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 text-center">{j.openings}</TableCell>
                      <TableCell className="text-sm font-semibold text-green-700">
                        {j.salary ? `$${j.salary.toFixed(2)}/h` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(j.start_date)}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(j.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          G-{j.randomization_group || "?"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
          <p className="text-xs text-slate-500">{t("jobs.pagination.page_of", { page, totalPages })}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
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

        {showImporter && (
          <Dialog open={showImporter} onOpenChange={setShowImporter}>
            <DialogContent className="max-w-4xl p-0">
              <MultiJsonImporter />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
}
