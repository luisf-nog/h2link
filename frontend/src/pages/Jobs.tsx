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
import type { Tables } from "@/integrations/supabase/types";
import { JobImportDialog } from "@/components/jobs/JobImportDialog";
import { MobileJobCard } from "@/components/jobs/MobileJobCard";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search,
  Plus,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Database,
  Briefcase,
  Rocket,
  ArrowRight,
  X,
  ShieldAlert,
  Lock,
  Tags,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

// --- LISTA DE CATEGORIAS SIMPLIFICADA (EMBUTIDA) ---
const JOB_CATEGORIES_LIST = [
  { value: "Agricultural Equipment", label: "🚜 Operadores de Máquinas (Ag)" },
  { value: "Farmworkers", label: "🌾 Trabalhadores Rurais / Colheita" },
  { value: "Construction Laborers", label: "🏗️ Construção Civil (Geral)" },
  { value: "Landscape", label: "🌳 Paisagismo e Jardinagem" },
  { value: "Truck Drivers", label: "🚚 Motoristas de Caminhão" },
  { value: "Housekeeping", label: "🧹 Limpeza e Camareira" },
  { value: "Cooks", label: "🍳 Cozinheiros e Auxiliares" },
  { value: "Meat", label: "🥩 Açougue e Processamento" },
  { value: "Amusement", label: "🎡 Parques e Diversão" },
  { value: "Forest", label: "🌲 Florestal e Conservação" },
  { value: "Janitors", label: "🧽 Zeladoria e Manutenção" },
  { value: "Packers", label: "📦 Empacotadores" },
  { value: "Helpers", label: "🔨 Ajudantes Gerais" },
];

type Job = Tables<"public_jobs">;

// --- Modal de Onboarding (Mantido) ---
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
        <div className="p-8 space-y-4">
          <h3 className="text-slate-900 font-bold">{t("jobs.onboarding.transparency_title")}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{t("jobs.onboarding.transparency_text")}</p>
          <Button onClick={handleClose} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 shadow-lg">
            {t("jobs.onboarding.cta")}
          </Button>
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
  const [pendingCount, setPendingCount] = useState(0);
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Estados dos Filtros
  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => (searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");

  // FILTRO DE CATEGORIA
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
    const { data: allData } = await supabase.from("my_queue").select("job_id, status").eq("user_id", profile.id);
    if (allData) {
      setQueuedJobIds(new Set(allData.map((r) => r.job_id)));
      setPendingCount(allData.filter((r) => r.status === "pending").length);
    }
  };

  useEffect(() => {
    if (profile?.id) syncQueue();
  }, [profile?.id]);

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

    // Busca Textual Geral
    const term = searchTerm.trim();
    if (term)
      query = query.or(`job_title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%,job_id.ilike.%${term}%`);

    // Filtros Específicos
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);

    // Filtro de Categoria (Integração)
    if (categoryFilter.trim()) query = query.ilike("category", `%${categoryFilter.trim()}%`);

    if (minSalary) query = query.gte("salary", Number(minSalary));
    if (maxSalary) query = query.lte("salary", Number(maxSalary));

    const { data, error, count } = await query.range(from, to);
    if (!error && data) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [visaType, searchTerm, stateFilter, cityFilter, categoryFilter, minSalary, maxSalary, sortKey, sortDir, page]);

  const addToQueue = async (job: Job) => {
    if (!profile || planSettings.job_db_blur) return;
    setProcessingJobIds((prev) => new Set(prev).add(job.id));
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (!error) {
      syncQueue();
      toast({ title: t("jobs.toasts.add_success_title") });
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
    const { error } = await supabase.from("my_queue").delete().eq("user_id", profile.id).eq("job_id", job.id);
    if (!error) syncQueue();
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
    if (g === "A") return { label: "GRUPO - A", className: "bg-emerald-50 text-emerald-800 border-emerald-300" };
    if (g === "B") return { label: "GRUPO - B", className: "bg-blue-50 text-blue-800 border-blue-300" };
    if (g === "C" || g === "D")
      return { label: `GRUPO - ${g}`, className: "bg-amber-50 text-amber-800 border-amber-300" };
    return { label: `GRUPO - ${g}`, className: "bg-slate-50 text-slate-700 border-slate-300" };
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 text-left">
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
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/importer")}>
                <Database className="mr-2 h-4 w-4" /> Sync Master
              </Button>
              <JobImportDialog />
            </div>
          )}
        </div>

        {/* --- GRID DE FILTROS --- */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filtro de Visto */}
              <Select
                value={visaType}
                onValueChange={(v: any) => {
                  setVisaType(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full bg-white h-10">
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

              {/* Busca Geral */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("jobs.search.placeholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              {/* Filtros de Local */}
              <Input
                placeholder="State (Ex: TX)"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="h-10"
              />
              <Input
                placeholder="City"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* --- FILTRO DE CATEGORIA SIMPLES E EMBUTIDO --- */}
              <div className="relative">
                <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="w-full bg-white h-10 border-slate-200 text-slate-700">
                    <SelectValue placeholder="Filtrar por Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-bold text-blue-900 cursor-pointer">
                      Todas as Categorias
                    </SelectItem>
                    {JOB_CATEGORIES_LIST.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="cursor-pointer">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtros de Salário */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  MIN $
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  className="pl-12 h-10"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  MAX $
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value)}
                  className="pl-12 h-10"
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* --- TABELA DE VAGAS --- */}
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
                  <TableHead className="text-center">Openings</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Visa</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Exp</TableHead>
                  <TableHead className="text-right sticky right-0 bg-white z-10">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-20">
                      <Loader2 className="animate-spin inline h-6 w-6" />
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow
                      key={j.id}
                      onClick={() => (planSettings.job_db_blur ? null : setSelectedJob(j))}
                      className="cursor-pointer hover:bg-slate-50/80 transition-all border-slate-100 text-left"
                    >
                      <TableCell className="font-semibold text-slate-900 py-4 text-sm">
                        <span translate="no">{j.job_title}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          translate="no"
                          className={cn("text-sm text-slate-600", planSettings.job_db_blur && "blur-sm")}
                        >
                          {j.company}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 uppercase">
                        {j.city}, {j.state}
                      </TableCell>
                      <TableCell className="text-center text-slate-600 text-sm">{j.openings ?? "-"}</TableCell>
                      <TableCell>
                        <span className="font-bold text-green-700 text-sm">{renderPrice(j)}</span>
                      </TableCell>

                      <TableCell>
                        {(() => {
                          const b = getVisaBadgeConfig(j.visa_type);
                          const wasEarly = (j as any).was_early_access;
                          const isCurrentlyEarly = j.visa_type.includes("Early Access");
                          return (
                            <Badge
                              variant={b.variant}
                              className={cn(
                                b.className,
                                "text-[10px] font-black border-2 transition-all",
                                wasEarly
                                  ? "border-amber-400 bg-amber-50 text-amber-900 shadow-sm hover:brightness-95 hover:scale-105"
                                  : "text-white",
                              )}
                            >
                              <div className="flex items-center gap-1">
                                {isCurrentlyEarly ? (
                                  <Zap className="h-3 w-3 text-amber-600 fill-amber-600 animate-pulse" />
                                ) : wasEarly ? (
                                  <Rocket className="h-3 w-3 text-amber-600 fill-amber-600" />
                                ) : null}
                                <span translate="no">{b.label}</span>
                              </div>
                            </Badge>
                          );
                        })()}
                      </TableCell>

                      <TableCell>
                        {j.randomization_group && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-bold text-[10px]",
                              getGroupBadgeConfig(j.randomization_group).className,
                            )}
                          >
                            {getGroupBadgeConfig(j.randomization_group).label}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Datas Padronizadas (text-sm) */}
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        {formatDate(j.posted_date)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        {formatDate(j.start_date)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        {formatDate(j.end_date)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-slate-600">
                        {formatExperience(j.experience_months)}
                      </TableCell>

                      <TableCell className="text-right sticky right-0 bg-white shadow-[-10px_0_15_px_-3px_rgba(0,0,0,0.05)] z-10">
                        <Button
                          size="sm"
                          variant={queuedJobIds.has(j.id) ? "default" : "outline"}
                          className={cn(
                            "h-8 w-8 p-0 rounded-full",
                            queuedJobIds.has(j.id) && "bg-red-600 border-red-600 text-white",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            queuedJobIds.has(j.id) ? removeFromQueue(j) : addToQueue(j);
                          }}
                        >
                          {processingJobIds.has(j.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : queuedJobIds.has(j.id) ? (
                            <X className="h-4 w-4" />
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

        {/* Modal de Detalhes */}
        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={profile}
          formatSalary={(s: any) => `$${Number(s).toFixed(2)}/h`}
          onAddToQueue={addToQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
          onShare={(j: any) => navigate(`/job/${j.id}`)}
        />
      </div>
    </TooltipProvider>
  );
}
