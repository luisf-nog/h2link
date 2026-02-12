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
import { JobDetailsDialog, type JobDetails } from "@/components/jobs/JobDetailsDialog";
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
  Check,
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
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

// --- COMPONENTE DE ONBOARDING (MANTIDO) ---
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

  // Estados de Filtro
  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => searchParams.get("categories")?.split(",") || [],
  );
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "all");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Job>("posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings: any = PLANS_CONFIG[planTier]?.settings || { job_db_blur: true };
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // --- FUNÇÕES DE UTILIDADE ---
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

  // --- SINCRONIZAÇÃO EM TEMPO REAL ---
  const syncQueue = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id).eq("status", "pending");
    setQueuedJobIds(new Set((data ?? []).map((r) => r.job_id)));
  };

  useEffect(() => {
    if (!profile?.id) return;
    syncQueue();
    const channel = supabase
      .channel("jobs-realtime-v3")
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
    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm)
      query = query.or(`job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    if (stateFilter) query = query.ilike("state", `%${stateFilter}%`);
    if (cityFilter) query = query.ilike("city", `%${cityFilter}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter !== "all") query = query.eq("randomization_group", groupFilter);
    if (minSalary) query = query.gte("salary", Number(minSalary));
    if (maxSalary) query = query.lte("salary", Number(maxSalary));

    query = query.order(sortKey, { ascending: sortDir === "asc" }).range(from, to);
    const { data, count } = await query;
    if (data) {
      setJobs(data as Job[]);
      setTotalCount(count || 0);
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

  const addToQueue = async (job: Job) => {
    if (!profile) return;
    if (planSettings.job_db_blur) {
      toast({ title: t("jobs.upgrade.title"), description: t("jobs.upgrade.description"), variant: "destructive" });
      return;
    }
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

  const toggleSort = (key: keyof Job) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
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
      <div className="space-y-6 text-left">
        <OnboardingModal />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("nav.jobs")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("jobs.subtitle", {
                totalCount: formatNumber(totalCount),
                visaLabel: visaType === "all" ? "H-2A/H-2B" : visaType,
              })}
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

        {/* CENTRAL DE COMANDO MODERNA - SINCRONIZADA EM TEMPO REAL */}
        {queuedJobIds.size > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500 overflow-visible">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-center justify-between gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-l-4 border-l-blue-600 transition-all hover:shadow-[0_8px_30px_rgba(37,99,235,0.08)]">
              <div className="flex items-center gap-4 overflow-visible">
                <div className="relative shrink-0 p-1">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Zap className="h-6 w-6 text-white fill-white/20" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[11px] font-black h-6 w-6 rounded-full flex items-center justify-center border-[3px] border-white shadow-md animate-in zoom-in duration-300">
                    {queuedJobIds.size}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-slate-900 font-bold text-base leading-tight">{t("jobs.queue_banner.title")}</h3>
                  <p className="text-slate-500 text-sm truncate font-medium">
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

        {/* FILTROS - 6 COLUNAS (INTEGRAL) */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-4 pt-4 border-b bg-slate-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Select
                  value={visaType}
                  onValueChange={(v: any) => {
                    setVisaType(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px] bg-white">
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
              </div>
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("jobs.search.placeholder")}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10 bg-white"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <Input
                placeholder="State"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
              <Input
                placeholder="City"
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
              <Select
                value={groupFilter}
                onValueChange={(v) => {
                  setGroupFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {["A", "B", "C", "D", "E", "F", "G", "H"].map((g) => (
                    <SelectItem key={g} value={g}>
                      Group {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  $ Min
                </span>
                <Input
                  type="number"
                  className="pl-12 text-xs"
                  value={minSalary}
                  onChange={(e) => {
                    setMinSalary(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  $ Max
                </span>
                <Input
                  type="number"
                  className="pl-12 text-xs"
                  value={maxSalary}
                  onChange={(e) => {
                    setMaxSalary(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Button
                variant="ghost"
                className="text-xs font-bold text-blue-600"
                onClick={() => {
                  setSearchTerm("");
                  setStateFilter("");
                  setCityFilter("");
                  setGroupFilter("all");
                }}
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LISTAGEM DE VAGAS - 11 COLUNAS (INTEGRAL) */}
        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="animate-spin inline h-10 w-10 text-blue-600 opacity-20" />
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {jobs.map((j) => (
              <MobileJobCard
                key={j.id}
                job={j}
                isBlurred={planSettings.job_db_blur}
                isQueued={queuedJobIds.has(j.id)}
                onAddToQueue={() => addToQueue(j)}
                onClick={() => setSelectedJob(j)}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 uppercase text-[10px] font-black tracking-widest text-slate-500">
                  <TableHead className="py-4 pl-6">Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Openings</TableHead>
                  <TableHead>Wage</TableHead>
                  <TableHead>Visa</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Exp.</TableHead>
                  <TableHead className="text-right pr-6 sticky right-0 bg-slate-50/80 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.03)]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="cursor-pointer hover:bg-slate-50/50 transition-colors border-slate-100"
                  >
                    <TableCell className="font-bold text-slate-900 text-sm uppercase pl-6" translate="no">
                      {j.job_title}
                    </TableCell>
                    <TableCell
                      className={cn("text-slate-600 text-sm", planSettings.job_db_blur && "blur-sm select-none")}
                      translate="no"
                    >
                      {j.company}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm uppercase" translate="no">
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell className="text-center text-slate-600 text-sm font-bold" translate="no">
                      {j.openings ?? "-"}
                    </TableCell>
                    <TableCell className="font-bold text-green-700 text-sm">{renderPrice(j)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-bold">
                        {j.visa_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {j.randomization_group && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-bold text-[10px] py-0 h-5",
                            getGroupBadgeConfig(j.randomization_group).className,
                          )}
                        >
                          G-{j.randomization_group}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-[11px] font-medium">
                      {formatDate(j.posted_date)}
                    </TableCell>
                    <TableCell className="text-slate-600 text-[11px] font-black">{formatDate(j.start_date)}</TableCell>
                    <TableCell className="text-slate-500 text-xs font-bold">
                      {formatExperience(j.experience_months)}
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-white/90 backdrop-blur-sm shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.03)] pr-6">
                      <Button
                        size="sm"
                        variant={queuedJobIds.has(j.id) ? "default" : "outline"}
                        className={cn(
                          "h-8 w-8 p-0 rounded-full",
                          queuedJobIds.has(j.id) && "bg-emerald-500 border-emerald-500 hover:bg-emerald-600",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(j);
                        }}
                        disabled={processingJobIds.has(j.id)}
                      >
                        {processingJobIds.has(j.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : queuedJobIds.has(j.id) ? (
                          <Check className="h-4 w-4 text-white" />
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
          <p className="text-xs text-slate-500 font-black uppercase tracking-widest">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-bold"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="font-bold"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={() => setSelectedJob(null)}
          job={selectedJob}
          planSettings={profile}
          formatSalary={(s: any) => `$${s}/h`}
          onAddToQueue={addToQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
          onShare={() => {}}
        />
      </div>
    </TooltipProvider>
  );
}
