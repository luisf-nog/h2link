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
  Check,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Zap,
  Loader2,
  Database,
  ChevronsUpDown,
  Briefcase,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

// Interface para garantir que as propriedades existam no objeto Job
interface Job {
  id: string;
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
}

export default function Jobs() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();

  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
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

  // --- FUNÇÃO CORRIGIDA: renderPrice ---
  const renderPrice = (job: Job) => {
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      return <span translate="no">{`$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`}</span>;
    }
    if (job.wage_from) return <span translate="no">{`$${job.wage_from.toFixed(2)}`}</span>;
    if (job.salary) return <span translate="no">{`$${job.salary.toFixed(2)}`}</span>;
    return "-";
  };

  // --- SINCRONIZAÇÃO DA FILA ---
  const syncQueue = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id).eq("status", "pending");
    setQueuedJobIds(new Set((data ?? []).map((r) => r.job_id)));
  };

  useEffect(() => {
    if (!profile?.id) return;
    syncQueue();
    const channel = supabase
      .channel("jobs-realtime")
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
    if (groupFilter !== "all") query = query.eq("randomization_group", groupFilter);

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
  }, [page, visaType, searchTerm, stateFilter, cityFilter, groupFilter, sortKey, sortDir]);

  const addToQueue = async (job: Job) => {
    if (!profile) return;
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) syncQueue();
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

        {/* BANNER DE FILA CORRIGIDO */}
        {queuedJobIds.size > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-center justify-between shadow-sm border-l-4 border-l-blue-600">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[11px] font-black h-6 w-6 rounded-full flex items-center justify-center border-[3px] border-white shadow-md">
                    {queuedJobIds.size}
                  </div>
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base leading-tight">Vagas prontas para enviar</h3>
                  <p className="text-slate-500 text-sm">
                    Você tem <span className="text-blue-600 font-bold">{queuedJobIds.size}</span> itens pendentes. Envie
                    agora!
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/queue")}
                className="bg-slate-900 hover:bg-blue-600 text-white font-bold h-11 px-6 rounded-xl transition-all flex items-center gap-2"
              >
                ENVIAR AGORA <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-4 pt-4 border-b bg-slate-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
          <CardContent className="p-4">
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
            </div>
          </CardContent>
        </Card>

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
                formatDate={(d) => (d ? new Date(d).toLocaleDateString() : "")}
              />
            ))}
          </div>
        ) : (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 uppercase text-[10px] font-black">
                  <TableHead className="py-4">Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Wage</TableHead>
                  <TableHead className="text-right pr-6 sticky right-0 bg-slate-50/80">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="cursor-pointer hover:bg-slate-50/50"
                  >
                    <TableCell className="font-bold text-slate-900 text-sm uppercase">{j.job_title}</TableCell>
                    <TableCell
                      className={cn("text-slate-600 text-sm", planSettings.job_db_blur && "blur-sm select-none")}
                    >
                      {j.company}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm uppercase">
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell className="text-center font-bold text-green-700">{renderPrice(j)}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.03)] pr-6">
                      <Button
                        size="sm"
                        variant={queuedJobIds.has(j.id) ? "default" : "outline"}
                        className={cn(
                          "h-8 w-8 p-0 rounded-full",
                          queuedJobIds.has(j.id) && "bg-emerald-500 border-emerald-500",
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

        {/* Diálogo de Detalhes */}
        {selectedJob && (
          <JobDetailsDialog
            open={!!selectedJob}
            onOpenChange={() => setSelectedJob(null)}
            job={selectedJob}
            planSettings={profile}
            formatSalary={(s: any) => `$${s}/h`}
            onAddToQueue={addToQueue}
            isInQueue={queuedJobIds.has(selectedJob.id)}
            onShare={() => {}}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
