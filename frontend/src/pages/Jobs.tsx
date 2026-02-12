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
  ShieldAlert,
  Briefcase,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

interface Job extends JobDetails {
  id: string;
}

export default function Jobs() {
  const { profile } = useAuth();
  const { t } = useTranslation();
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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Filtros
  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => searchParams.get("categories")?.split(",") || [],
  );
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "");
  const [minSalary, setMinSalary] = useState(() => searchParams.get("min_salary") ?? "");
  const [maxSalary, setMaxSalary] = useState(() => searchParams.get("max_salary") ?? "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || "1"));
  const [sortKey, setSortKey] = useState<any>("posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier]?.settings || {};
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // --- LÓGICA DE SINCRONIZAÇÃO EM TEMPO REAL ---
  const syncQueue = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id).eq("status", "pending");
    setQueuedJobIds(new Set((data ?? []).map((r) => r.job_id)));
  };

  useEffect(() => {
    if (!profile?.id) return;
    syncQueue();
    const channel = supabase
      .channel("jobs-realtime-queue")
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
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
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
  }, [page, visaType, searchTerm, stateFilter, cityFilter, selectedCategories, groupFilter, sortKey, sortDir]);

  const addToQueue = async (job: Job) => {
    if (!profile) return;
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) syncQueue();
  };

  const toggleSort = (key: any) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 text-left">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Jobs Hub</h1>
          <p className="text-muted-foreground">
            {t("jobs.subtitle", {
              totalCount: formatNumber(totalCount),
              visaLabel: visaType === "all" ? "H-2A/H-2B" : visaType,
            })}
          </p>
        </div>

        {/* CENTRAL DE COMANDO MODERNA - SINCRONIZADA */}
        {queuedJobIds.size > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500 overflow-visible">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-center justify-between gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-l-4 border-l-blue-600 transition-all hover:shadow-[0_8px_30px_rgba(37,99,235,0.1)]">
              <div className="flex items-center gap-4 overflow-visible">
                {/* Ícone Apple-style */}
                <div className="relative shrink-0 p-1">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Zap className="h-6 w-6 text-white fill-white/20" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[11px] font-black h-6 w-6 rounded-full flex items-center justify-center border-[3px] border-white shadow-md animate-bounce-subtle">
                    {queuedJobIds.size}
                  </div>
                </div>

                <div className="min-w-0">
                  <h3 className="text-slate-900 font-bold text-base leading-tight">Vagas prontas para enviar</h3>
                  <p className="text-slate-500 text-sm truncate font-medium">
                    Você selecionou{" "}
                    <span className="text-blue-600 font-bold" translate="no">
                      {queuedJobIds.size} {queuedJobIds.size === 1 ? "vaga" : "vagas"}
                    </span>
                    . Conclua agora!
                  </p>
                </div>
              </div>

              <Button
                onClick={() => navigate("/queue")}
                className="shrink-0 bg-slate-900 hover:bg-blue-600 text-white font-bold h-11 px-6 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 group"
              >
                ENVIAR AGORA
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        )}

        {/* FILTROS INTEGRADOS */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-4 pt-4 border-b bg-slate-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Select value={visaType} onValueChange={(v: any) => setVisaType(v)}>
                  <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Visa Type" />
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
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                onChange={(e) => setStateFilter(e.target.value)}
                className="text-xs"
              />
              <Input
                placeholder="City"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="text-xs"
              />
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {["A", "B", "C", "D"].map((g) => (
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
                  onChange={(e) => setMinSalary(e.target.value)}
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
                  onChange={(e) => setMaxSalary(e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                className="text-xs font-bold text-blue-600"
                onClick={() => {
                  setSearchTerm("");
                  setStateFilter("");
                  setCityFilter("");
                  setGroupFilter("");
                  setMinSalary("");
                  setMaxSalary("");
                }}
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LISTAGEM PRINCIPAL */}
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
                formatDate={(d) => d || ""}
              />
            ))}
          </div>
        ) : (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-bold py-4">JOB TITLE</TableHead>
                  <TableHead className="font-bold">COMPANY</TableHead>
                  <TableHead className="font-bold">LOCATION</TableHead>
                  <TableHead className="font-bold text-center">WAGE</TableHead>
                  <TableHead className="font-bold text-right pr-6 sticky right-0 bg-slate-50/80">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="font-bold text-slate-900 text-sm uppercase">{j.job_title}</TableCell>
                    <TableCell
                      className={cn("text-slate-600 text-sm", planSettings.job_db_blur && "blur-sm select-none")}
                    >
                      {j.company}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell className="text-center font-bold text-green-700">{renderPrice(j)}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-white/80 backdrop-blur-sm shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.03)] pr-6">
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
                      >
                        {queuedJobIds.has(j.id) ? (
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

        <div className="flex items-center justify-between py-4">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
