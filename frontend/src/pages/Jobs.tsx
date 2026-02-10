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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Bot,
  Landmark,
  ShieldAlert,
  Briefcase,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";
import { getJobShareUrl } from "@/lib/shareUtils";

// --- COMPONENTE DE ONBOARDING ATUALIZADO (FOCO EM RESPONSABILIDADE) ---
function OnboardingModal() {
  const [open, setOpen] = useState(false);

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
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-0 shadow-2xl bg-white rounded-xl">
        <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <div className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">H2 Linker Platform</h2>
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Official Automation Tool</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-b border-slate-100 px-8 py-6">
          <div className="flex gap-4">
            <ShieldAlert className="h-6 w-6 text-slate-700 shrink-0 mt-1" />
            <div>
              <h3 className="text-slate-900 font-bold text-base">Service Transparency & Role</h3>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                H2 Linker is a <strong>software technology provider</strong>. We are not a recruitment agency. We
                provide the high-performance tools to automate your outreach, but the final hiring decision rest solely
                between you and the employer. We <strong>drastically increase your speed and reach</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid gap-6">
            <div className="flex gap-4 items-start group">
              <div className="h-10 w-10 rounded-md bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">Exclusive Early Access Data</h4>
                <p className="text-slate-600 text-sm mt-0.5">
                  Apply before the crowd. Data sourced directly from the <strong>DOL</strong> the moment they are filed.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start group">
              <div className="h-10 w-10 rounded-md bg-purple-50 flex items-center justify-center border border-purple-100 group-hover:bg-purple-100 transition-colors">
                <Bot className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">Adaptive AI Email Engine</h4>
                <p className="text-slate-600 text-sm mt-0.5">
                  Our AI generates <strong>dynamic templates</strong> that adapt to each specific job and company name
                  automatically.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start group">
              <div className="h-10 w-10 rounded-md bg-emerald-50 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                <Zap className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">High-Speed Bulk Automation</h4>
                <p className="text-slate-600 text-sm mt-0.5">
                  Select target jobs and <strong>automate the entire sending process</strong> to up to 450 recruiters
                  daily.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button
              onClick={handleClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-12 shadow-lg transition-all active:scale-[0.98]"
            >
              I Understand - Let's Start
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const renderPrice = (job: JobDetails) => {
  if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
    return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
  if (job.wage_from) return `$${job.wage_from.toFixed(2)}`;
  if (job.salary) return `$${job.salary.toFixed(2)}`;
  return "-";
};

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

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  const [visaType, setVisaType] = useState<VisaTypeFilter>((searchParams.get("visa") as VisaTypeFilter) || "all");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(searchParams.get("city") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get("categories")?.split(",") || [],
  );
  const [minSalary, setMinSalary] = useState(searchParams.get("min_salary") ?? "");
  const [maxSalary, setMaxSalary] = useState(searchParams.get("max_salary") ?? "");

  const [sortKey, setSortKey] = useState<string>(searchParams.get("sort") || "posted_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as "asc" | "desc") || "desc");
  const [page, setPage] = useState(Number(searchParams.get("page") || "1"));

  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const dailyLimitTotal =
    (PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0) + Number((profile as any)?.referral_bonus_limit ?? 0);
  const isFreeLimitReached = planTier === "free" && (profile?.credits_used_today || 0) >= dailyLimitTotal;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const tableColSpan = 12;

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false });
    query = query.order("id", { ascending: true });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim())
      query = query.or(
        `job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`,
      );
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (minSalary) query = query.gte("salary", Number(minSalary));
    if (maxSalary) query = query.lte("salary", Number(maxSalary));

    const { data, error, count } = await query.range(from, to);

    if (!error) {
      setJobs(data as Job[]);
      setTotalCount(count ?? 0);
      if (profile?.id && data?.length) {
        const { data: qData } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in(
            "job_id",
            data.map((j) => j.id),
          );
        setQueuedJobIds(new Set(qData?.map((r) => r.job_id)));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [visaType, searchTerm, stateFilter, cityFilter, selectedCategories, minSalary, maxSalary, sortKey, sortDir, page]);

  // LÓGICA DE ADICIONAR À FILA (CORRIGIDA: APENAS INSERT, SEM ENVIO AUTOMÁTICO)
  const addToQueue = async (job: Job) => {
    if (!profile) return setShowLoginDialog(true);
    if (planSettings.job_db_blur) return setShowUpgradeDialog(true);
    if (queuedJobIds.has(job.id)) return;

    setProcessingJobIds((prev) => new Set(prev).add(job.id));

    // ATENÇÃO: Aqui inserimos com status 'pending' (padrão do banco).
    // O envio ocorrerá APENAS na tela de Fila.
    const { error } = await supabase.from("my_queue").insert({
      user_id: profile.id,
      job_id: job.id,
    });

    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } else {
      setQueuedJobIds((prev) => new Set(prev).add(job.id));
      toast({
        title: "Vaga na Fila!",
        description: `${job.job_title} foi adicionada para seu envio futuro na aba Fila.`,
      });
    }
    setProcessingJobIds((prev) => {
      const n = new Set(prev);
      n.delete(job.id);
      return n;
    });
  };

  // Restante das funções de formatação...
  const formatExperience = (m: number | null) =>
    !m || m <= 0 ? "-" : m < 12 ? `${m}m` : `${Math.floor(m / 12)}y ${m % 12}m`;
  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-");
  const toggleSort = (key: string) => {
    const isSame = sortKey === key;
    setSortDir(isSame && sortDir === "asc" ? "desc" : "asc");
    setSortKey(key);
    setPage(1);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />

        {isFreeLimitReached && (
          <div className="flex items-center justify-between p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t("jobs.upgrade_banner.title")}</p>
                <p className="text-sm text-muted-foreground">Daily limit: {dailyLimitTotal} emails.</p>
              </div>
            </div>
            <Button onClick={() => navigate("/plans")} size="sm">
              Upgrade
            </Button>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Job Board</h1>
          {isAdmin && <JobImportDialog />}
        </div>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-4">
            <Select
              value={visaType}
              onValueChange={(v) => {
                setVisaType(v as VisaTypeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
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
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs, companies, cities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
        </Card>

        {isMobile ? (
          <div className="space-y-3">
            {jobs.map((j) => (
              <MobileJobCard
                key={j.id}
                job={j}
                isQueued={queuedJobIds.has(j.id)}
                onAddToQueue={() => addToQueue(j)}
                onClick={() => handleRowClick(j)}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => toggleSort("job_title")} className="cursor-pointer">
                    Title
                  </TableHead>
                  <TableHead onClick={() => toggleSort("company")} className="cursor-pointer">
                    Company
                  </TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead onClick={() => toggleSort("salary")} className="cursor-pointer">
                    Wage
                  </TableHead>
                  <TableHead>Visa</TableHead>
                  <TableHead onClick={() => toggleSort("posted_date")} className="cursor-pointer">
                    Posted
                  </TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.job_title}</TableCell>
                      <TableCell className={cn(planSettings.job_db_blur && "blur-sm")}>{j.company}</TableCell>
                      <TableCell>
                        {j.city}, {j.state}
                      </TableCell>
                      <TableCell>{renderPrice(j)}</TableCell>
                      <TableCell>
                        {(() => {
                          const b = getVisaBadgeConfig(j.visa_type);
                          return (
                            <Badge variant={b.variant} className={b.className}>
                              {b.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{formatDate(j.posted_date)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={queuedJobIds.has(j.id) ? "secondary" : "default"}
                          disabled={queuedJobIds.has(j.id) || processingJobIds.has(j.id)}
                          onClick={() => addToQueue(j)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        <div className="flex justify-between items-center py-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>

        {/* MODAIS DE SUPORTE */}
        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={planSettings}
          onAddToQueue={addToQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
        />
      </div>
    </TooltipProvider>
  );
}
