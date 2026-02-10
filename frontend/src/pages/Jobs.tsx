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

// --- COMPONENTE DE ONBOARDING (DESIGN FOCO EM RESPONSABILIDADE) ---
function OnboardingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Usando v4 para garantir que apareça novamente para teste
    const hasSeen = localStorage.getItem("hasSeenJobOnboarding_v4");
    if (!hasSeen) {
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenJobOnboarding_v4", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-0 shadow-2xl bg-white rounded-xl">
        {/* CABEÇALHO SÓBRIO */}
        <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">H2 Linker Platform</h2>
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Official Automation Tool</p>
            </div>
          </div>
        </div>

        {/* ÁREA DE DESTAQUE: RESPONSABILIDADE (PRIMEIRA VISÃO) */}
        <div className="bg-amber-50 border-b border-amber-100 px-8 py-5">
          <div className="flex gap-4">
            <div className="flex-shrink-0 mt-1">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-amber-900 font-bold text-base">Important Disclaimer: We Are Not an Agency</h3>
              <p className="text-amber-800 text-sm mt-1 leading-relaxed">
                H2 Linker provides <strong>software technology</strong> to automate your applications. We do not
                interview, hire, or guarantee job placement. We simply connect you to official public job listings
                efficiently.
              </p>
            </div>
          </div>
        </div>

        {/* FEATURES - FORMATO "SYSTEM SPECS" */}
        <div className="p-8 space-y-6">
          <div className="grid gap-6">
            {/* Feature 1 */}
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center">
                  <Landmark className="h-5 w-5 text-slate-700" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">Official DOL Data Source</h4>
                <p className="text-slate-600 text-sm mt-0.5">
                  Access verified H-2A/H-2B job orders sourced directly from the US Department of Labor.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-slate-700" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">AI Application Engine</h4>
                <p className="text-slate-600 text-sm mt-0.5">
                  Our system generates professional, context-aware cover letters for every single application.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-slate-700" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">Bulk Outreach Protocol</h4>
                <p className="text-slate-600 text-sm mt-0.5">
                  Select official jobs and automate email delivery. Capacity up to 450 recruiters/day.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button
              onClick={handleClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-11"
            >
              I Understand & Accept
            </Button>
            <p className="text-center text-xs text-slate-400 mt-3">
              By continuing, you acknowledge that H2 Linker is a tool for self-directed job search.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
// --- FIM DO COMPONENTE ---

const renderPrice = (job: JobDetails) => {
  if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
    return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)}`;
  }
  if (job.wage_from) {
    return `$${job.wage_from.toFixed(2)}`;
  }
  if (job.salary) {
    return `$${job.salary.toFixed(2)}`;
  }
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

  // --- Funções de Compartilhamento ---
  const handleShareJob = (job: Job) => {
    const shareUrl = getJobShareUrl(job.id);
    if (navigator.share) {
      navigator
        .share({
          title: `${job.job_title} - ${job.company}`,
          text: `${t("jobs.shareText", "Job opportunity")}: ${job.job_title} ${t("jobs.in", "in")} ${job.city}, ${job.state}`,
          url: shareUrl,
        })
        .catch(() => copyToClipboard(shareUrl));
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link copiado!",
      description: "Link de compartilhamento copiado para área de transferência",
    });
  };

  // --- Configurações e Hooks ---
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();
  const locale = i18n.resolvedLanguage || i18n.language;
  const currency = getCurrencyForLanguage(locale);
  const formatPlanPrice = (tier: "gold" | "diamond") => {
    const amount = getPlanAmountForCurrency(PLANS_CONFIG[tier], currency);
    return formatCurrency(amount, currency, locale);
  };
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Estados de Dados ---
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  // --- Estados de Filtros ---
  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => {
    const v = searchParams.get("visa") as VisaTypeFilter | null;
    if (v === "H-2A") return "H-2A";
    if (v === "H-2B") return "H-2B";
    if (v === "H-2A (Early Access)") return "H-2A (Early Access)";
    return "all";
  });

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");

  // Multi-Select Category State
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const catParam = searchParams.get("categories");
    return catParam ? catParam.split(",") : [];
  });

  // Split Salary State
  const [minSalary, setMinSalary] = useState(() => searchParams.get("min_salary") ?? "");
  const [maxSalary, setMaxSalary] = useState(() => searchParams.get("max_salary") ?? "");

  // --- Ordenação e Paginação ---
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
  type SortDir = "asc" | "desc";

  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const v = searchParams.get("sort") as SortKey | null;
    const allowed: SortKey[] = [
      "job_title",
      "company",
      "state",
      "city",
      "openings",
      "salary",
      "visa_type",
      "posted_date",
      "start_date",
      "end_date",
    ];
    return v && allowed.includes(v) ? v : "posted_date";
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const v = searchParams.get("dir");
    return v === "asc" || v === "desc" ? v : "desc";
  });

  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(p) && p > 0 ? p : 1;
  });

  // --- Variaveis Derivadas ---
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const planTier = profile?.plan_tier || "free";
  const planSettings = PLANS_CONFIG[planTier].settings;
  const isFreeUser = planTier === "free";
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  const dailyLimitTotal = (PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0) + referralBonus;
  const creditsUsedToday = profile?.credits_used_today || 0;
  const isFreeLimitReached = isFreeUser && creditsUsedToday >= dailyLimitTotal;
  const pageSize = 50;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);
  const visaLabel = useMemo(() => (visaType === "all" ? "All Visas" : visaType), [visaType]);
  const tableColSpan = 12;

  // --- Helpers de Busca ---
  const buildOrSearch = (term: string) =>
    `job_title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`;

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    // Ordenação
    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") {
      query = query.order("posted_date", { ascending: false, nullsFirst: false });
    }
    query = query.order("id", { ascending: true });

    // Filtros
    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim()) query = query.or(buildOrSearch(searchTerm.trim()));
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);

    // NOVO: Filtro Multi-Select de Categoria
    if (selectedCategories.length > 0) {
      query = query.in("category", selectedCategories);
    }

    // NOVO: Filtro Salário Min/Max (CORRIGIDO: Usa 'salary' em vez de 'wage_from')
    if (minSalary && !isNaN(Number(minSalary))) {
      query = query.gte("salary", Number(minSalary));
    }
    if (maxSalary && !isNaN(Number(maxSalary))) {
      query = query.lte("salary", Number(maxSalary));
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching jobs:", error);
      toast({ title: t("jobs.toasts.load_error_title"), description: error.message, variant: "destructive" });
      setJobs([]);
      setTotalCount(0);
    } else {
      const nextJobs = (data as Job[]) || [];
      setJobs(nextJobs);
      setTotalCount(count ?? 0);

      // Carregar status da fila/reports se logado
      if (profile?.id && !planSettings.job_db_blur && nextJobs.length) {
        const ids = nextJobs.map((j) => j.id);
        const { data: queueRows } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in("job_id", ids);
        setQueuedJobIds(new Set((queueRows ?? []).map((r) => r.job_id)));

        const { data: reportRows } = await supabase.from("job_reports").select("job_id, reason").in("job_id", ids);
        const reportsMap: Record<string, { count: number; reasons: ReportReason[] }> = {};
        for (const row of reportRows ?? []) {
          if (!reportsMap[row.job_id]) reportsMap[row.job_id] = { count: 0, reasons: [] };
          reportsMap[row.job_id].count++;
          if (!reportsMap[row.job_id].reasons.includes(row.reason as ReportReason)) {
            reportsMap[row.job_id].reasons.push(row.reason as ReportReason);
          }
        }
        setJobReports(reportsMap);
      } else {
        setQueuedJobIds(new Set());
        setJobReports({});
      }
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from("public_jobs")
        .select("category")
        .not("category", "is", null)
        .neq("category", "")
        .order("posted_date", { ascending: false })
        .limit(2000);

      if (error) throw error;

      const categoriesRaw = data?.map((r) => r.category?.trim()).filter((c): c is string => Boolean(c)) || [];

      const uniq = Array.from(new Set(categoriesRaw)).sort((a, b) => a.localeCompare(b));
      setCategories(uniq);
    } catch (err) {
      console.warn("Error fetching categories:", err);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [visaType, searchTerm, stateFilter, cityFilter, selectedCategories, minSalary, maxSalary, sortKey, sortDir, page]);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Persistência na URL
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams();
      if (visaType !== "all") next.set("visa", visaType);
      if (searchTerm.trim()) next.set("q", searchTerm.trim());
      if (stateFilter.trim()) next.set("state", stateFilter.trim());
      if (cityFilter.trim()) next.set("city", cityFilter.trim());

      // Persiste array como string separada por vírgula
      if (selectedCategories.length > 0) next.set("categories", selectedCategories.join(","));

      if (minSalary) next.set("min_salary", minSalary);
      if (maxSalary) next.set("max_salary", maxSalary);

      if (!(sortKey === "posted_date" && sortDir === "desc")) {
        next.set("sort", sortKey);
        next.set("dir", sortDir);
      }
      next.set("page", String(page));
      const current = searchParams.toString();
      if (current !== next.toString()) setSearchParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [visaType, searchTerm, stateFilter, cityFilter, selectedCategories, minSalary, maxSalary, sortKey, sortDir, page]);

  // --- Handlers de UI ---
  const toggleCategory = (category: string) => {
    setPage(1);
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const clearCategories = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCategories([]);
    setPage(1);
  };

  // --- Funções de Formatação ---
  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return "-";
    if (months < 12) return t("jobs.table.experience_months", { count: months });
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return t("jobs.table.experience_years", { count: years });
    return t("jobs.table.experience_years_months", { years, months: remainingMonths });
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    const s = String(date).trim();
    if (!s) return "-";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  const formatSalary = (salary: number | null) => {
    if (!salary) return "-";
    return `$${salary.toFixed(2)}/h`;
  };

  // --- Queue Handlers ---
  const addToQueue = async (job: Job) => {
    if (!profile) {
      setShowLoginDialog(true);
      return;
    }
    if (planSettings.job_db_blur) {
      setShowUpgradeDialog(true);
      return;
    }
    if (queuedJobIds.has(job.id)) return;

    setQueuedJobIds((prev) => new Set(prev).add(job.id));
    setProcessingJobIds((prev) => new Set(prev).add(job.id));

    const { error } = await supabase.from("my_queue").insert({ user_id: profile?.id, job_id: job.id });
    setProcessingJobIds((prev) => {
      const next = new Set(prev);
      next.delete(job.id);
      return next;
    });

    if (error) {
      if (error.code !== "23505") {
        setQueuedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
        toast({ title: t("common.errors.generic"), description: error.message, variant: "destructive" });
      } else {
        toast({ title: t("jobs.toasts.already_in_queue_title"), description: t("jobs.toasts.already_in_queue_desc") });
      }
    } else {
      toast({ title: "✓ Vaga adicionada!", description: `${job.job_title} foi adicionada à sua fila.` });
    }
  };

  const removeFromQueue = async (job: Job) => {
    if (!profile?.id) return;
    const { error } = await supabase.from("my_queue").delete().eq("user_id", profile.id).eq("job_id", job.id);
    if (error) {
      toast({ title: t("common.errors.delete_failed"), description: error.message, variant: "destructive" });
    } else {
      setQueuedJobIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      setSelectedJob(null);
      toast({
        title: t("jobs.toasts.remove_success_title"),
        description: t("jobs.toasts.remove_success_desc", { jobTitle: job.job_title }),
      });
    }
  };

  const handleRowClick = (job: Job) => {
    if (planSettings.job_db_blur) setShowUpgradeDialog(true);
    else setSelectedJob(job);
  };

  const toggleSort = (key: SortKey, defaultDir: SortDir = "asc") => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(defaultDir);
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* MODAL DE BOAS-VINDAS INSERIDO AQUI */}
        <OnboardingModal />

        {/* Banner Limit */}
        {isFreeLimitReached && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{t("jobs.upgrade_banner.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("jobs.upgrade_banner.description", { limit: dailyLimitTotal })}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/plans")} size="sm">
              {t("jobs.upgrade_banner.cta")}
            </Button>
          </div>
        )}

        {/* Header & Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("nav.jobs")}</h1>
              <p className="text-muted-foreground mt-1">
                {t("jobs.subtitle", { totalCount: formatNumber(totalCount), visaLabel })}
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Dialog open={showImporter} onOpenChange={setShowImporter}>
                  <Button variant="outline" onClick={() => setShowImporter(true)}>
                    <Database className="h-4 w-4 mr-2" /> Importar JSON (Data Miner)
                  </Button>
                  <DialogContent className="max-w-4xl p-0">
                    <MultiJsonImporter />
                  </DialogContent>
                </Dialog>
                <JobImportDialog />
              </div>
            )}
          </div>
        </div>

        {/* --- FILTROS --- */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={visaType}
                    onValueChange={(v) => {
                      setVisaType(v as VisaTypeFilter);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={t("jobs.filters.visa.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {VISA_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center text-muted-foreground">
                        <Info className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("jobs.filters.visa.h2a_info")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("jobs.search.placeholder")}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Input
                placeholder={t("jobs.filters.state")}
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                placeholder={t("jobs.filters.city")}
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setPage(1);
                }}
              />

              {/* FILTRO MULTI-SELECT CATEGORIA */}
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryPopoverOpen}
                    className="justify-between text-muted-foreground font-normal overflow-hidden"
                  >
                    {selectedCategories.length > 0
                      ? `${selectedCategories.length} selecionadas`
                      : t("jobs.filters.category")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[250px]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar categoria..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                      <CommandGroup>
                        {categories.map((category) => (
                          <CommandItem key={category} value={category} onSelect={() => toggleCategory(category)}>
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedCategories.includes(category)
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className={cn("h-4 w-4")} />
                            </div>
                            <span>{category}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                    {selectedCategories.length > 0 && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-center text-xs h-8"
                          onClick={clearCategories}
                        >
                          Limpar Filtros
                        </Button>
                      </div>
                    )}
                  </Command>
                </PopoverContent>
              </Popover>

              {/* FILTRO SALARIO MIN / MAX */}
              <div className="flex gap-2 col-span-1 sm:col-span-2 lg:col-span-2">
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number"
                    placeholder="Min Wage"
                    className="pl-6"
                    value={minSalary}
                    onChange={(e) => {
                      setMinSalary(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number"
                    placeholder="Max Wage"
                    className="pl-6"
                    value={maxSalary}
                    onChange={(e) => {
                      setMaxSalary(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Visualização das Tags Selecionadas */}
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground self-center mr-2">Categorias:</span>
                {selectedCategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="px-2 py-1 gap-1 hover:bg-secondary/80">
                    {cat}
                    <X
                      className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                      onClick={() => toggleCategory(cat)}
                    />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearCategories}>
                  Limpar tudo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {isMobile ? (
          <div className="space-y-3">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">{t("jobs.table.loading")}</CardContent>
              </Card>
            ) : jobs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">{t("jobs.table.empty")}</CardContent>
              </Card>
            ) : (
              jobs.map((job) => (
                <MobileJobCard
                  key={job.id}
                  job={job}
                  isBlurred={planSettings.job_db_blur}
                  isQueued={queuedJobIds.has(job.id)}
                  onAddToQueue={() => addToQueue(job)}
                  onClick={() => handleRowClick(job)}
                  formatDate={formatDate}
                  reportData={jobReports[job.id]}
                />
              ))
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("job_title", "asc")}
                      >
                        {t("jobs.table.headers.job_title")} <SortIcon active={sortKey === "job_title"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("company", "asc")}
                      >
                        {t("jobs.table.headers.company")} <SortIcon active={sortKey === "company"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("city", "asc")}
                      >
                        {t("jobs.table.headers.location")} <SortIcon active={sortKey === "city"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("openings", "desc")}
                      >
                        {t("jobs.table.headers.openings")} <SortIcon active={sortKey === "openings"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("salary", "desc")}
                      >
                        {t("jobs.table.headers.salary")} <SortIcon active={sortKey === "salary"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("visa_type", "asc")}
                      >
                        {t("jobs.table.headers.visa")} <SortIcon active={sortKey === "visa_type"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("posted_date", "desc")}
                      >
                        {t("jobs.table.headers.posted")} <SortIcon active={sortKey === "posted_date"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("start_date", "asc")}
                      >
                        {t("jobs.table.headers.start")} <SortIcon active={sortKey === "start_date"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline"
                        onClick={() => toggleSort("end_date", "asc")}
                      >
                        {t("jobs.table.headers.end")} <SortIcon active={sortKey === "end_date"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {t("jobs.table.headers.experience")}
                      </div>
                    </TableHead>
                    <TableHead>{t("jobs.table.headers.email")}</TableHead>
                    <TableHead className="text-right">{t("jobs.table.headers.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={tableColSpan} className="text-center py-8">
                        {t("jobs.table.loading")}
                      </TableCell>
                    </TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableColSpan} className="text-center py-8">
                        {t("jobs.table.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(job)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {jobReports[job.id] && (
                              <JobWarningBadge
                                reportCount={jobReports[job.id].count}
                                reasons={jobReports[job.id].reasons}
                              />
                            )}
                            {job.job_title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn(planSettings.job_db_blur && "blur-sm select-none")}>{job.company}</span>
                        </TableCell>
                        <TableCell>
                          {job.city}, {job.state}
                        </TableCell>
                        <TableCell>{typeof job.openings === "number" ? formatNumber(job.openings) : "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{renderPrice(job)}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">/{job.wage_unit || "h"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const badge = getVisaBadgeConfig(job.visa_type);
                            return (
                              <Badge variant={badge.variant} className={badge.className}>
                                {badge.label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>{formatDate(job.posted_date)}</TableCell>
                        <TableCell>{formatDate(job.start_date)}</TableCell>
                        <TableCell>{formatDate(job.end_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatExperience(job.experience_months)}
                        </TableCell>
                        <TableCell>
                          <span className={cn(planSettings.job_db_blur && "blur-sm select-none")}>{job.email}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={!planSettings.job_db_blur && queuedJobIds.has(job.id) ? "default" : "outline"}
                            className={cn(
                              !planSettings.job_db_blur &&
                                queuedJobIds.has(job.id) &&
                                "bg-primary hover:bg-primary/90 text-primary-foreground border-primary",
                            )}
                            disabled={!planSettings.job_db_blur && queuedJobIds.has(job.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue(job);
                            }}
                          >
                            {planSettings.job_db_blur ? (
                              <Lock className="h-4 w-4" />
                            ) : processingJobIds.has(job.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : queuedJobIds.has(job.id) ? (
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
            </CardContent>
          </Card>
        )}

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(open) => {
            if (!open) setSelectedJob(null);
          }}
          job={selectedJob}
          planSettings={planSettings}
          formatSalary={formatSalary}
          onAddToQueue={(job) => addToQueue(job as Job)}
          onRemoveFromQueue={(job) => removeFromQueue(job as Job)}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
          onShare={(job) => handleShareJob(job as Job)}
        />

        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {t("jobs.upgrade.title")}
              </DialogTitle>
              <DialogDescription>{t("jobs.upgrade.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-plan-gold/10 border border-plan-gold/30">
                <h4 className="font-semibold text-plan-gold">{t("plans.tiers.gold.label")}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("jobs.upgrade.gold_desc", { price: formatPlanPrice("gold") })}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-plan-diamond/10 border border-plan-diamond/30">
                <h4 className="font-semibold text-plan-diamond">{t("plans.tiers.diamond.label")}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("jobs.upgrade.diamond_desc", { price: formatPlanPrice("diamond") })}
                </p>
              </div>
              <Button className="w-full" onClick={() => (window.location.href = "/plans")}>
                {t("jobs.upgrade.cta")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                {t("loginDialog.title")}
              </DialogTitle>
              <DialogDescription>{t("loginDialog.descriptionQueue")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                <p className="text-sm text-foreground">{t("loginDialog.benefit")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowLoginDialog(false);
                    navigate("/auth");
                  }}
                >
                  {t("loginDialog.ctaLogin")}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setShowLoginDialog(false)}>
                  {t("loginDialog.ctaContinue")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("jobs.pagination.page_of", { page, totalPages })}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
