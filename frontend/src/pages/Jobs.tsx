import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS_CONFIG } from "@/config/plans.config";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { JobDetailsDialog, type JobDetails } from "@/components/jobs/JobDetailsDialog";
import { JobImportDialog } from "@/components/jobs/JobImportDialog";
import { MultiJsonImporter } from "@/components/admin/MultiJsonImporter";
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
  Bot,
  Landmark,
  ShieldAlert,
  Briefcase,
  Rocket,
  CheckCircle2,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from "@/lib/pricing";
import { formatNumber } from "@/lib/number";
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from "@/lib/visaTypes";
import { getJobShareUrl } from "@/lib/shareUtils";

// --- COMPONENTE DE ONBOARDING ---
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

        <div className="bg-slate-50 border-b border-slate-100 px-6 sm:px-8 py-5 sm:py-6">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-shrink-0 mt-1 text-slate-700">
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-sm sm:text-base">Service Transparency & Role</h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed">
                H2 Linker is a <strong>software technology provider</strong>. We are not a recruitment agency. We
                provide the high-performance tools to automate your outreach, but the final hiring decision and
                interview process rest solely between you and the employer. We do not guarantee employment, but we{" "}
                <strong>drastically increase your speed and reach</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5 sm:space-y-6">
          <div className="grid gap-5 sm:gap-6">
            <div className="flex gap-3 sm:gap-4 items-start group">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">Exclusive Early Access Data</h4>
                <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                  Apply before the crowd. We extract official job orders directly from the{" "}
                  <strong>US Department of Labor (DOL)</strong> the moment they are filed, giving you a massive head
                  start.
                </p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 items-start group">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md bg-purple-50 flex items-center justify-center border border-purple-100 group-hover:bg-purple-100 transition-colors">
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">Adaptive AI Email Engine</h4>
                <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                  Our AI generates <strong>dynamic templates</strong> that automatically adapt to each specific job
                  title and company name, ensuring a perfect, personalized first impression for every employer.
                </p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 items-start group">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md bg-emerald-50 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm">High-Speed Bulk Automation</h4>
                <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                  We handle the communication for you. Select your target jobs and{" "}
                  <strong>automate the entire sending process</strong>, reaching up to 450 recruiters daily while you
                  stay productive.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100 mt-2">
            <Button
              onClick={handleClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-12 shadow-lg transition-all active:scale-[0.98]"
            >
              I Understand - Let's Start
            </Button>
            <p className="text-center text-[9px] sm:text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-bold">
              Secure Official Data • AI Automation • Pro Technology
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();
  const locale = i18n.resolvedLanguage || i18n.language;
  const currency = getCurrencyForLanguage(locale);
  const formatPlanPrice = (tier: "gold" | "diamond") => {
    const amount = getPlanAmountForCurrency(PLANS_CONFIG[tier], currency);
    return formatCurrency(amount, currency, locale);
  };
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get("group") ?? "");

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const catParam = searchParams.get("categories");
    return catParam ? catParam.split(",") : [];
  });
  const [minSalary, setMinSalary] = useState(() => searchParams.get("min_salary") ?? "");
  const [maxSalary, setMaxSalary] = useState(() => searchParams.get("max_salary") ?? "");

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

  const buildOrSearch = (term: string) =>
    `job_title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`;

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false, nullsFirst: false });
    query = query.order("id", { ascending: true });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim()) query = query.or(buildOrSearch(searchTerm.trim()));
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);
    if (minSalary && !isNaN(Number(minSalary))) query = query.gte("salary", Number(minSalary));
    if (maxSalary && !isNaN(Number(maxSalary))) query = query.lte("salary", Number(maxSalary));

    query = query.range(from, to);
    const { data, error, count } = await query;

    if (error) {
      toast({ title: t("jobs.toasts.load_error_title"), description: error.message, variant: "destructive" });
    } else {
      const nextJobs = (data as Job[]) || [];
      setJobs(nextJobs);
      setTotalCount(count ?? 0);
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
          if (!reportsMap[row.job_id].reasons.includes(row.reason as ReportReason))
            reportsMap[row.job_id].reasons.push(row.reason as ReportReason);
        }
        setJobReports(reportsMap);
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
      const uniq = Array.from(new Set(data?.map((r) => r.category?.trim()).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      );
      setCategories(uniq);
    } catch (err) {
      console.warn(err);
    } finally {
      setCategoriesLoading(false);
    }
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
  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams();
      if (visaType !== "all") next.set("visa", visaType);
      if (searchTerm.trim()) next.set("q", searchTerm.trim());
      if (stateFilter.trim()) next.set("state", stateFilter.trim());
      if (cityFilter.trim()) next.set("city", cityFilter.trim());
      if (selectedCategories.length > 0) next.set("categories", selectedCategories.join(","));
      if (groupFilter) next.set("group", groupFilter);
      if (minSalary) next.set("min_salary", minSalary);
      if (maxSalary) next.set("max_salary", maxSalary);
      if (!(sortKey === "posted_date" && sortDir === "desc")) {
        next.set("sort", sortKey);
        next.set("dir", sortDir);
      }
      next.set("page", String(page));
      setSearchParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
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

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return "-";
    if (months < 12) return t("jobs.table.experience_months", { count: months });
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem === 0
      ? t("jobs.table.experience_years", { count: years })
      : t("jobs.table.experience_years_months", { years, months: rem });
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    const d = new Date(date);
    return isNaN(d.getTime()) ? date : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  const formatSalary = (salary: number | null) => (salary ? `$${salary.toFixed(2)}/h` : "-");

  const getGroupBadgeConfig = (group: string) => {
    const g = group.toUpperCase();
    if (g === "A")
      return {
        className: "bg-emerald-50 text-emerald-700 border-emerald-400",
        shortDesc: t("jobs.groups.a_short"),
      };
    if (g === "B")
      return {
        className: "bg-blue-50 text-blue-700 border-blue-400",
        shortDesc: t("jobs.groups.b_short"),
      };
    if (g === "C" || g === "D")
      return {
        className: "bg-amber-50 text-amber-700 border-amber-400",
        shortDesc: t("jobs.groups.cd_short"),
      };
    if (["E", "F", "G", "H"].includes(g))
      return {
        className: "bg-slate-50 text-slate-600 border-slate-300",
        shortDesc: t("jobs.groups.risk_short"),
      };
    return {
      className: "bg-gray-50 text-gray-700 border-gray-300",
      shortDesc: t("jobs.groups.linear_short"),
    };
  };

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

    const { error } = await supabase.from("my_queue").insert({
      user_id: profile?.id,
      job_id: job.id,
      status: "pending",
    });

    setProcessingJobIds((prev) => {
      const n = new Set(prev);
      n.delete(job.id);
      return n;
    });

    if (error && error.code !== "23505") {
      setQueuedJobIds((prev) => {
        const n = new Set(prev);
        n.delete(job.id);
        return n;
      });
      toast({ title: t("common.errors.generic"), description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "✓ Vaga adicionada!",
        description: `${job.job_title} foi adicionada à sua fila para envio posterior.`,
      });
    }
  };

  const removeFromQueue = async (job: Job) => {
    if (!profile?.id) return;
    const { error } = await supabase.from("my_queue").delete().eq("user_id", profile.id).eq("job_id", job.id);
    if (error) toast({ title: t("common.errors.delete_failed"), variant: "destructive" });
    else {
      setQueuedJobIds((prev) => {
        const n = new Set(prev);
        n.delete(job.id);
        return n;
      });
      setSelectedJob(null);
    }
  };

  const handleRowClick = (job: Job) => (planSettings.job_db_blur ? setShowUpgradeDialog(true) : setSelectedJob(job));

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
        <OnboardingModal />

        {isFreeLimitReached && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t("jobs.upgrade_banner.title")}</p>
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

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t("nav.jobs")}</h1>
              <p className="text-muted-foreground mt-1">
                {t("jobs.subtitle", { totalCount: formatNumber(totalCount), visaLabel })}
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Dialog open={showImporter} onOpenChange={setShowImporter}>
                  <Button variant="outline" onClick={() => setShowImporter(true)}>
                    <Database className="h-4 w-4 mr-2" /> Importar JSON
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

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                    {VISA_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("jobs.filters.visa.h2a_info")}</p>
                  </TooltipContent>
                </Tooltip>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between text-muted-foreground font-normal">
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
                      <CommandEmpty>Nenhuma categoria.</CommandEmpty>
                      <CommandGroup>
                        {categories.map((c) => (
                          <CommandItem key={c} onSelect={() => toggleCategory(c)}>
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedCategories.includes(c)
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </div>
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                    {selectedCategories.length > 0 && (
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearCategories}>
                          Limpar Filtros
                        </Button>
                      </div>
                    )}
                  </Command>
                </PopoverContent>
              </Popover>
              <Select
                value={groupFilter}
                onValueChange={(v) => {
                  setGroupFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
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
              <div className="flex gap-2 col-span-1 sm:col-span-2 lg:col-span-2">
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number"
                    placeholder="Min"
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
                    placeholder="Max"
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
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                {selectedCategories.map((c) => (
                  <Badge key={c} variant="secondary" className="gap-1">
                    {c}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => toggleCategory(c)} />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearCategories}>
                  Limpar tudo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isMobile ? (
          <div className="space-y-3">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">{t("jobs.table.loading")}</CardContent>
              </Card>
            ) : jobs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">{t("jobs.table.empty")}</CardContent>
              </Card>
            ) : (
              jobs.map((j) => (
                <MobileJobCard
                  key={j.id}
                  job={j}
                  isBlurred={planSettings.job_db_blur}
                  isQueued={queuedJobIds.has(j.id)}
                  onAddToQueue={() => addToQueue(j)}
                  onClick={() => handleRowClick(j)}
                  formatDate={formatDate}
                  reportData={jobReports[j.id]}
                />
              ))
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="whitespace-nowrap">
                    <TableHead>
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
                    <TableHead>
                      <button onClick={() => toggleSort("openings")}>
                        {t("jobs.table.headers.openings")} <SortIcon active={sortKey === "openings"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("salary")}>
                        {t("jobs.table.headers.salary")} <SortIcon active={sortKey === "salary"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("visa_type")}>
                        {t("jobs.table.headers.visa")} <SortIcon active={sortKey === "visa_type"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>Group</TableHead>
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
                    <TableHead className="text-right sticky right-0 bg-white z-10 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                      {t("jobs.table.headers.action")}
                    </TableHead>
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
                    jobs.map((j) => (
                      <TableRow
                        key={j.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleRowClick(j)}
                      >
                        <TableCell className="font-medium min-w-[200px]">
                          <div className="flex items-center gap-2">
                            {jobReports[j.id] && (
                              <JobWarningBadge
                                reportCount={jobReports[j.id].count}
                                reasons={jobReports[j.id].reasons}
                              />
                            )}
                            <span className="line-clamp-2">{j.job_title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <span className={cn("line-clamp-2", planSettings.job_db_blur && "blur-sm select-none")}>
                            {j.company}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {j.city}, {j.state}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">{j.openings ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{renderPrice(j)}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">/{j.wage_unit || "h"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const b = getVisaBadgeConfig(j.visa_type);
                            const wasEarly = (j as any).was_early_access;
                            return (
                              <div className="flex flex-col items-start gap-1">
                                <Badge
                                  variant={b.variant}
                                  className={cn(
                                    b.className,
                                    wasEarly && "border-2 border-amber-400 bg-amber-50 text-amber-700 shadow-sm",
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    {wasEarly && <Rocket className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                    {b.label}
                                  </div>
                                </Badge>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const group = (j as any).randomization_group;
                            if (!group) return <span className="text-muted-foreground">-</span>;

                            const config = getGroupBadgeConfig(group);

                            return (
                              <div className="flex flex-col items-start gap-1">
                                <Badge
                                  variant="outline"
                                  className={cn("font-bold text-[11px] uppercase tracking-wider", config.className)}
                                >
                                  {t("jobs.groups.group_label")} {group}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {config.shortDesc}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                          {formatDate(j.posted_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                          {formatDate(j.start_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                          {formatDate(j.end_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                          {formatExperience(j.experience_months)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                          <Button
                            size="sm"
                            variant={!planSettings.job_db_blur && queuedJobIds.has(j.id) ? "default" : "outline"}
                            className={cn(
                              !planSettings.job_db_blur &&
                                queuedJobIds.has(j.id) &&
                                "bg-primary text-primary-foreground border-primary",
                            )}
                            disabled={!planSettings.job_db_blur && queuedJobIds.has(j.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue(j);
                            }}
                          >
                            {planSettings.job_db_blur ? (
                              <Lock className="h-4 w-4" />
                            ) : processingJobIds.has(j.id) ? (
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
            </CardContent>
          </Card>
        )}

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

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={planSettings}
          formatSalary={formatSalary}
          onAddToQueue={(j) => addToQueue(j as Job)}
          onRemoveFromQueue={(j) => removeFromQueue(j as Job)}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
          onShare={(j) => handleShareJob(j as Job)}
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
                <p className="text-sm mt-1">{t("jobs.upgrade.gold_desc", { price: formatPlanPrice("gold") })}</p>
              </div>
              <div className="p-4 rounded-lg bg-plan-diamond/10 border border-plan-diamond/30">
                <h4 className="font-semibold text-plan-diamond">{t("plans.tiers.diamond.label")}</h4>
                <p className="text-sm mt-1">{t("jobs.upgrade.diamond_desc", { price: formatPlanPrice("diamond") })}</p>
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
                <p className="text-sm">{t("loginDialog.benefit")}</p>
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
      </div>
    </TooltipProvider>
  );
}
