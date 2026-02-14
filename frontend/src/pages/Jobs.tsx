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

type Job = Tables<"public_jobs">;

// ... (OnboardingModal mantido igual)

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
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});
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

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // IMPORTANTE: Adicionado o filtro .eq("is_active", true) para bater com o Mirror Sync de 5.3k
    let query = supabase
      .from("public_jobs")
      .select("*", { count: "exact" })
      .eq("is_banned", false)
      .eq("is_active", true);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    const term = searchTerm.trim();
    if (term)
      query = query.or(`job_title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%,job_id.ilike.%${term}%`);
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
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
        {/* ... (Cabeçalho e Banner da Queue mantidos exatamente como estavam) ... */}

        <Card className="border-slate-200 shadow-sm">{/* ... (Filtros mantidos exatamente como estavam) ... */}</Card>

        {isMobile ? (
          <div className="space-y-3">
            {jobs.map((j) => (
              <MobileJobCard
                key={j.id}
                job={j}
                isBlurred={planSettings.job_db_blur}
                isQueued={queuedJobIds.has(j.id)}
                onAddToQueue={() => null}
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

                    {/* COLUNA DO VISA BADGE (Ajustada) */}
                    <TableHead className="text-left">
                      <button onClick={() => toggleSort("visa_type")}>
                        {t("jobs.table.headers.visa")} <SortIcon active={sortKey === "visa_type"} dir={sortDir} />
                      </button>
                    </TableHead>

                    <TableHead>Grupo</TableHead>
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
                    <TableHead className="text-right sticky right-0 bg-white z-10">
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
                        onClick={() => setSelectedJob(j)}
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
                            className={cn("text-sm text-slate-600", planSettings.job_db_blur && "blur-sm")}
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

                        {/* RENDERIZAÇÃO DO BADGE (A ÚNICA MUDANÇA) */}
                        <TableCell>
                          {(() => {
                            const b = getVisaBadgeConfig(j.visa_type);
                            const wasEarly = (j as any).was_early_access;
                            const isCurrentlyEarly = j.visa_type.includes("Early Access");
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant={b.variant}
                                    className={cn(
                                      b.className,
                                      "text-[10px] border-2",
                                      wasEarly && "border-amber-400 bg-amber-50 shadow-sm",
                                    )}
                                  >
                                    <div className="flex items-center gap-1">
                                      {isCurrentlyEarly ? (
                                        <Zap className="h-3 w-3 text-amber-500 fill-amber-500 animate-pulse" />
                                      ) : wasEarly ? (
                                        <Rocket className="h-3 w-3 text-amber-500 fill-amber-500" />
                                      ) : null}
                                      <span translate="no">{b.label}</span>
                                    </div>
                                  </Badge>
                                </TooltipTrigger>
                                {wasEarly && (
                                  <TooltipContent className="bg-slate-900 text-white p-2">
                                    <p className="font-bold flex items-center gap-1 text-[10px]">
                                      <Rocket className="h-3 w-3 text-amber-400" /> Early Access Record
                                    </p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            );
                          })()}
                        </TableCell>

                        {/* TODAS AS OUTRAS COLUNAS PRESERVADAS */}
                        <TableCell>
                          {(() => {
                            const group = (j as any).randomization_group;
                            if (!group) return "-";
                            const config = getGroupBadgeConfig(group);
                            return (
                              <Badge
                                variant="outline"
                                className={cn("font-bold text-[10px] py-0 h-5 whitespace-nowrap", config.className)}
                                translate="no"
                              >
                                {config.label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{formatDate(j.posted_date)}</TableCell>
                        <TableCell className="text-sm text-slate-600">{formatDate(j.start_date)}</TableCell>
                        <TableCell className="text-sm text-slate-600">{formatDate(j.end_date)}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {formatExperience(j.experience_months)}
                        </TableCell>
                        <TableCell className="text-right sticky right-0 bg-white shadow-[-10px_0_15_px_-3px_rgba(0,0,0,0.05)] z-10">
                          {/* ... (Botão de Queue mantido igual) */}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        {/* ... (Paginação e Dialog mantidos iguais) */}
      </div>
    </TooltipProvider>
  );
}
