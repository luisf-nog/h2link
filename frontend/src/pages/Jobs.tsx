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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Estados de Filtro
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

  // --- SINCRONIZAÇÃO DA FILA (PENDENTES) ---
  const syncQueue = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id).eq("status", "pending");

    setQueuedJobIds(new Set((data ?? []).map((r) => r.job_id)));
  };

  useEffect(() => {
    if (!profile?.id) return;
    syncQueue();

    const channel = supabase
      .channel("jobs-queue-monitor")
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

  // --- BUSCA DE VAGAS ---
  const fetchJobs = async () => {
    setLoading(true);
    try {
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

      const { data, count, error } = await query;
      if (error) throw error;

      setJobs((data as Job[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  return (
    <TooltipProvider>
      <div className="space-y-6 text-left">
        {/* Título com Fallback para evitar erro de tradução */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Jobs Hub</h1>
          <p className="text-muted-foreground">
            {t("jobs.subtitle", {
              totalCount: formatNumber(totalCount),
              visaLabel: visaType === "all" ? "H-2A/H-2B" : visaType,
            }) || `${totalCount} jobs available`}
          </p>
        </div>

        {/* CENTRAL DE COMANDO LIGHT - SUMIRÁ QUANDO FILA FOR 0 */}
        {queuedJobIds.size > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 sm:p-4 mb-2 flex items-center justify-between gap-4 shadow-sm group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative shrink-0">
                  <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {queuedJobIds.size}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-blue-900 font-bold text-sm sm:text-base leading-tight">Vagas prontas na fila</h3>
                  <p className="text-blue-700/60 text-xs truncate">Envie agora para garantir sua candidatura.</p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/queue")}
                size="sm"
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-lg shadow-sm flex items-center gap-2"
              >
                ENVIAR AGORA <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* FILTROS E TABELA CONTINUAM ABAIXO DISSO... */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <Select value={visaType} onValueChange={(v: any) => setVisaType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Visa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visas</SelectItem>
                  <SelectItem value="H-2A">H-2A</SelectItem>
                  <SelectItem value="H-2B">H-2B</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
              <Input placeholder="City" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
              {/* Adicione os outros filtros aqui conforme seu layout original */}
            </div>
          </CardContent>
        </Card>

        {/* Mapeamento das Vagas (Mobile ou Desktop) */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="animate-spin inline h-8 w-8 text-slate-300" />
          </div>
        ) : (
          <div className="space-y-4">
            {isMobile ? (
              jobs.map((j) => (
                <MobileJobCard
                  key={j.id}
                  job={j}
                  isBlurred={planSettings.job_db_blur}
                  isQueued={queuedJobIds.has(j.id)}
                  onAddToQueue={() => addToQueue(j)}
                  onClick={() => setSelectedJob(j)}
                  formatDate={(d) => d || ""}
                />
              ))
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.id} onClick={() => setSelectedJob(j)} className="cursor-pointer">
                      <TableCell className="font-bold">{j.job_title}</TableCell>
                      <TableCell className={cn(planSettings.job_db_blur && "blur-sm")}>{j.company}</TableCell>
                      <TableCell>
                        {j.city}, {j.state}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
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
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Dialogs */}
        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={() => setSelectedJob(null)}
          job={selectedJob}
          planSettings={profile}
          formatSalary={(s) => `$${s}/h`}
          onAddToQueue={addToQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
          onShare={() => {}}
        />
      </div>
    </TooltipProvider>
  );
}
