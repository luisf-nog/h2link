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
import { JobDetailsDialog, type JobDetails } from "@/components/jobs/JobDetailsDialog"; // Corrigido Import
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
  ShieldAlert,
  Briefcase,
  Rocket,
} from "lucide-react";
import { JobWarningBadge } from "@/components/jobs/JobWarningBadge";
import type { ReportReason } from "@/components/queue/ReportJobButton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
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

        <div className="bg-slate-50 border-b border-slate-100 px-6 sm:px-8 py-5 sm:py-6 text-left">
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

        <div className="p-6 sm:p-8 space-y-5 sm:space-y-6 text-left">
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

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleShareJob = (job: JobDetails) => {
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<JobDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [jobReports, setJobReports] = useState<Record<string, { count: number; reasons: ReportReason[] }>>({});
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
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

  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const planTier = profile?.plan_tier || "free";
  const isFreeUser = planTier === "free";
  const dailyLimitTotal = PLANS_CONFIG[planTier]?.limits?.daily_emails ?? 0;
  const creditsUsedToday = profile?.credits_used_today || 0;
  const isFreeLimitReached = isFreeUser && creditsUsedToday >= dailyLimitTotal;
  const pageSize = 50;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);
  const visaLabel = useMemo(() => (visaType === "all" ? "All Visas" : visaType), [visaType]);
  const tableColSpan = 12;

  const fetchJobs = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from("public_jobs").select("*", { count: "exact" }).eq("is_banned", false);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
    if (sortKey !== "posted_date") query = query.order("posted_date", { ascending: false, nullsFirst: false });

    if (visaType !== "all") query = query.eq("visa_type", visaType);
    if (searchTerm.trim())
      query = query.or(
        `job_title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`,
      );
    if (stateFilter.trim()) query = query.ilike("state", `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
    if (selectedCategories.length > 0) query = query.in("category", selectedCategories);
    if (groupFilter) query = query.eq("randomization_group", groupFilter);

    query = query.range(from, to);
    const { data, error, count } = await query;

    if (error) {
      toast({ title: t("jobs.toasts.load_error_title"), description: error.message, variant: "destructive" });
    } else {
      const nextJobs = (data as JobDetails[]) || [];
      setJobs(nextJobs);
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

  const toggleSort = (key: SortKey, defaultDir: SortDir = "asc") => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(defaultDir);
  };

  const addToQueue = async (job: JobDetails) => {
    if (!profile) {
      setShowLoginDialog(true);
      return;
    }
    if (queuedJobIds.has(job.id)) return;
    setQueuedJobIds((prev) => new Set(prev).add(job.id));
    const { error } = await supabase
      .from("my_queue")
      .insert({ user_id: profile.id, job_id: job.id, status: "pending" });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "✓ Vaga adicionada!", description: `${job.job_title} foi salva.` });
  };

  const removeFromQueue = async (job: JobDetails) => {
    if (!profile?.id) return;
    const { error } = await supabase.from("my_queue").delete().eq("user_id", profile.id).eq("job_id", job.id);
    if (!error) {
      setQueuedJobIds((prev) => {
        const n = new Set(prev);
        n.delete(job.id);
        return n;
      });
      setSelectedJob(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <OnboardingModal />
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">{t("nav.jobs")}</h1>
          <p className="text-muted-foreground">
            {t("jobs.subtitle", { totalCount: formatNumber(totalCount), visaLabel })}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <Input
                placeholder={t("jobs.search.placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Input
                placeholder={t("jobs.filters.state")}
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-40"
              />
            </div>
          </CardContent>
        </Card>

        {isMobile ? (
          <div className="space-y-3">
            {jobs.map((j) => (
              <MobileJobCard
                key={j.id}
                job={j as any}
                isBlurred={["visitor", "free"].includes(planTier)}
                isQueued={queuedJobIds.has(j.id)}
                onAddToQueue={() => addToQueue(j)}
                onClick={() => setSelectedJob(j)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => toggleSort("job_title")}>Title</TableHead>
                  <TableHead onClick={() => toggleSort("company")}>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id} onClick={() => setSelectedJob(j)} className="cursor-pointer">
                    <TableCell>{j.job_title}</TableCell>
                    <TableCell>{j.company}</TableCell>
                    <TableCell>
                      {j.city}, {j.state}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(j);
                        }}
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

        <JobDetailsDialog
          open={!!selectedJob}
          onOpenChange={(o: boolean) => !o && setSelectedJob(null)}
          job={selectedJob}
          planSettings={profile}
          formatSalary={formatSalary}
          onAddToQueue={addToQueue}
          onRemoveFromQueue={removeFromQueue}
          isInQueue={selectedJob ? queuedJobIds.has(selectedJob.id) : false}
          onShare={handleShareJob}
        />
      </div>
    </TooltipProvider>
  );
}
