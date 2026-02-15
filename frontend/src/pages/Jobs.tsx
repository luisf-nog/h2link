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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  DollarSign,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";

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

  const renderPrice = (job: Job) => {
    if (job.wage_from) return `$${job.wage_from.toFixed(2)}`;
    if (job.salary) return `$${job.salary.toFixed(2)}`;
    return "-";
  };

  const syncQueue = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from("my_queue").select("job_id").eq("user_id", profile.id);
    if (data) setQueuedJobIds(new Set(data.map((r) => r.job_id)));
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

  const toggleSort = (key: SortKey) => {
    setPage(1);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 text-left px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("nav.jobs")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{formatNumber(totalCount)} vagas encontradas</p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/importer")}
              className="w-full sm:w-auto"
            >
              <Database className="mr-2 h-4 w-4" /> Sync Master
            </Button>
          )}
        </div>

        {/* FILTROS RESPONSIVOS */}
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Input placeholder="State (TX)" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
              <Input placeholder="City" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {JOB_CATEGORIES_LIST.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Min $"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max $"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
              />
            </div>
          </CardHeader>
        </Card>

        {/* LISTA DE VAGAS - TABELA (DESKTOP) E CARDS (MOBILE) */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : isMobile ? (
          /* MOBILE LAYOUT */
          <div className="space-y-4">
            {jobs.map((j) => (
              <Card key={j.id} onClick={() => setSelectedJob(j)} className="active:scale-[0.98] transition-transform">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-slate-900 leading-tight flex-1">{j.job_title}</h3>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-green-700 block">{renderPrice(j)}/h</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-y-2 gap-x-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> {j.company}
                    </span>
                    <span className="flex items-center gap-1 uppercase">
                      <MapPin className="h-3 w-3" /> {j.city}, {j.state}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Badge
                      className={cn(
                        "text-[10px] font-black",
                        j.visa_type === "H-2A" && !j.was_early_access && "bg-green-600 text-white",
                        j.visa_type === "H-2B" && !j.was_early_access && "bg-blue-600 text-white",
                        (j.visa_type.includes("Early Access") || j.was_early_access) &&
                          "bg-amber-50 border-amber-400 text-amber-900",
                      )}
                    >
                      {j.visa_type}
                    </Badge>
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatDate(j.posted_date)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* DESKTOP TABLE */
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead onClick={() => toggleSort("job_title")} className="cursor-pointer">
                    Title
                  </TableHead>
                  <TableHead onClick={() => toggleSort("company")} className="cursor-pointer">
                    Company
                  </TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Visa</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id} onClick={() => setSelectedJob(j)} className="cursor-pointer hover:bg-slate-50">
                    <TableCell className="font-semibold text-sm">{j.job_title}</TableCell>
                    <TableCell className="text-sm text-slate-600">{j.company}</TableCell>
                    <TableCell className="text-sm uppercase">
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell className="font-bold text-green-700">{renderPrice(j)}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10px] font-black border-2",
                          !j.was_early_access && j.visa_type === "H-2A" && "bg-green-600 text-white border-green-600",
                          !j.was_early_access && j.visa_type === "H-2B" && "bg-blue-600 text-white border-blue-600",
                          (j.visa_type.includes("Early Access") || j.was_early_access) &&
                            "bg-amber-50 text-amber-900 border-amber-400 hover:bg-amber-50",
                        )}
                      >
                        {j.visa_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDate(j.posted_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8 w-8 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* PAGINAÇÃO */}
        <div className="flex items-center justify-between py-6">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <span className="text-sm font-medium">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o: boolean) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={profile}
          formatSalary={(s: any) => `$${Number(s).toFixed(2)}/h`}
          onAddToQueue={() => {}}
        />
      </div>
    </TooltipProvider>
  );
}
