import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobDetailsDialog, type JobDetails } from '@/components/jobs/JobDetailsDialog';
import { JobImportDialog } from '@/components/jobs/JobImportDialog';
import { MobileJobCard } from '@/components/jobs/MobileJobCard';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import { Info, Search, Plus, Check, Lock, ArrowUpDown, ArrowUp, ArrowDown, Zap, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { JobWarningBadge } from '@/components/jobs/JobWarningBadge';
import type { ReportReason } from '@/components/queue/ReportJobButton';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatCurrency, getCurrencyForLanguage, getPlanAmountForCurrency } from '@/lib/pricing';
import { formatNumber } from '@/lib/number';
import { getVisaBadgeConfig, VISA_TYPE_OPTIONS, type VisaTypeFilter } from '@/lib/visaTypes';

interface Job extends JobDetails {
  id: string;
}

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleShareJob = (job: Job) => {
    // Use backend route that generates proper Open Graph meta tags for social sharing
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://visa-type-badge-fix.preview.emergentagent.com';
    const shareUrl = `${backendUrl}/job/${job.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: `${job.job_title} - ${job.company}`,
        text: `${t('jobs.shareText', 'Job opportunity')}: ${job.job_title} ${t('jobs.in', 'in')} ${job.city}, ${job.state}`,
        url: shareUrl,
      }).catch(() => {
        copyToClipboard(shareUrl);
      });
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Link copiado!',
      description: 'Link de compartilhamento copiado para área de transferência',
    });
  };

  const isAdmin = useIsAdmin();
  const isMobile = useIsMobile();
  const locale = i18n.resolvedLanguage || i18n.language;
  const currency = getCurrencyForLanguage(locale);
  const formatPlanPrice = (tier: 'gold' | 'diamond') => {
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

  // Derive daily limit data for banner
  const planTierCheck = profile?.plan_tier || 'free';
  const isFreeUser = planTierCheck === 'free';
  // Referral bonus only applies to free users
  const referralBonus = isFreeUser ? Number((profile as any)?.referral_bonus_limit ?? 0) : 0;
  const dailyLimitTotal = (PLANS_CONFIG[planTierCheck]?.limits?.daily_emails ?? 0) + referralBonus;
  const creditsUsedToday = profile?.credits_used_today || 0;
  const isFreeLimitReached = isFreeUser && creditsUsedToday >= dailyLimitTotal;

  const [visaType, setVisaType] = useState<VisaTypeFilter>(() => {
    const v = searchParams.get('visa') as VisaTypeFilter | null;
    if (v === 'H-2A') return 'H-2A';
    if (v === 'H-2B') return 'H-2B';
    if (v === 'H-2A (Early Access)') return 'H-2A (Early Access)';
    return 'all';
  });

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [stateFilter, setStateFilter] = useState(() => searchParams.get('state') ?? '');
  const [cityFilter, setCityFilter] = useState(() => searchParams.get('city') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') ?? '');

  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  type SalaryBand = 'any' | 'lt15' | '15-18' | '18-22' | '22-26' | '26plus';
  const SALARY_BANDS: Array<{ value: SalaryBand; label: string; min: number | null; max: number | null }> = [
    { value: 'any', label: t('jobs.salary.any'), min: null, max: null },
    { value: 'lt15', label: t('jobs.salary.lt15'), min: null, max: 14.99 },
    { value: '15-18', label: t('jobs.salary.15_18'), min: 15, max: 18 },
    { value: '18-22', label: t('jobs.salary.18_22'), min: 18, max: 22 },
    { value: '22-26', label: t('jobs.salary.22_26'), min: 22, max: 26 },
    { value: '26plus', label: t('jobs.salary.26plus'), min: 26, max: null },
  ];

  const deriveBandFromLegacyMinMax = (minRaw: string | null, maxRaw: string | null): SalaryBand => {
    const parse = (v: string | null) => {
      if (!v) return null;
      const n = Number(String(v).trim().replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    const min = parse(minRaw);
    const max = parse(maxRaw);
    const match = SALARY_BANDS.find((b) => b.min === min && b.max === max);
    return match?.value ?? 'any';
  };

  const [salaryBand, setSalaryBand] = useState<SalaryBand>(() => {
    const v = (searchParams.get('salary') as SalaryBand | null) ?? null;
    if (v && SALARY_BANDS.some((b) => b.value === v)) return v;
    // backward-compat: old min/max params
    return deriveBandFromLegacyMinMax(searchParams.get('min'), searchParams.get('max'));
  });

  type SortKey =
    | 'job_title'
    | 'company'
    | 'state'
    | 'city'
    | 'openings'
    | 'salary'
    | 'visa_type'
    | 'posted_date'
    | 'start_date'
    | 'end_date';

  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const v = searchParams.get('sort') as SortKey | null;
    const allowed: SortKey[] = [
      'job_title',
      'company',
      'state',
      'city',
      'openings',
      'salary',
      'visa_type',
      'posted_date',
      'start_date',
      'end_date',
    ];
    return v && allowed.includes(v) ? v : 'posted_date';
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const v = searchParams.get('dir');
    return v === 'asc' || v === 'desc' ? v : 'desc';
  });

  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(p) && p > 0 ? p : 1;
  });

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const planTier = profile?.plan_tier || 'free';
  const planSettings = PLANS_CONFIG[planTier].settings;

  const pageSize = 25;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);

  const buildOrSearch = (term: string) =>
    `job_title.ilike.%${term}%,company.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`;

  const fetchJobs = async () => {
    setLoading(true);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('public_jobs')
      .select('*', { count: 'exact' })
      .eq('is_banned', false) // Exclude banned jobs
      .order(sortKey, { ascending: sortDir === 'asc', nullsFirst: false })
      .range(from, to);

    // desempate estável
    if (sortKey !== 'posted_date') {
      query = query.order('posted_date', { ascending: false, nullsFirst: false });
    }

    if (visaType !== 'all') query = query.eq('visa_type', visaType);

    if (searchTerm.trim()) {
      query = query.or(buildOrSearch(searchTerm.trim()));
    }

    if (stateFilter.trim()) query = query.ilike('state', `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike('city', `%${cityFilter.trim()}%`);
    if (categoryFilter.trim()) query = query.ilike('category', `%${categoryFilter.trim()}%`);

    const band = SALARY_BANDS.find((b) => b.value === salaryBand) ?? SALARY_BANDS[0];
    if (band.min !== null) query = query.gte('salary', band.min);
    if (band.max !== null) query = query.lte('salary', band.max);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: t('jobs.toasts.load_error_title'),
        description: error.message,
        variant: 'destructive',
      });
      setJobs([]);
      setTotalCount(0);
      setQueuedJobIds(new Set());
    } else {
      const nextJobs = (data as Job[]) || [];
      setJobs(nextJobs);
      setTotalCount(count ?? 0);

      // Marca vagas já adicionadas pelo usuário (para trocar + por ✓)
      // (não aplicamos isso quando o plano blur está ativo)
      if (profile?.id && !planSettings.job_db_blur && nextJobs.length) {
        const ids = nextJobs.map((j) => j.id);
        const { data: queueRows, error: queueErr } = await supabase
          .from('my_queue')
          .select('job_id')
          .eq('user_id', profile.id)
          .in('job_id', ids);

        if (queueErr) {
          console.warn('Error fetching queue marks:', queueErr);
          setQueuedJobIds(new Set());
        } else {
          setQueuedJobIds(new Set((queueRows ?? []).map((r) => r.job_id)));
        }

        // Fetch job reports for these jobs
        const { data: reportRows, error: reportErr } = await supabase
          .from('job_reports')
          .select('job_id, reason')
          .in('job_id', ids);

        if (reportErr) {
          console.warn('Error fetching job reports:', reportErr);
          setJobReports({});
        } else {
          // Aggregate reports by job_id
          const reportsMap: Record<string, { count: number; reasons: ReportReason[] }> = {};
          for (const row of reportRows ?? []) {
            if (!reportsMap[row.job_id]) {
              reportsMap[row.job_id] = { count: 0, reasons: [] };
            }
            reportsMap[row.job_id].count++;
            if (!reportsMap[row.job_id].reasons.includes(row.reason as ReportReason)) {
              reportsMap[row.job_id].reasons.push(row.reason as ReportReason);
            }
          }
          setJobReports(reportsMap);
        }
      } else {
        setQueuedJobIds(new Set());
        setJobReports({});
      }
    }

    setLoading(false);
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    // Note: PostgREST distinct isn't consistently exposed in client; we fetch and de-dupe client-side.
    // IMPORTANT: paginate because the backend caps at 1000 rows per request.
    const pageSize = 1000;
    const maxPages = 25; // safety cap (25k rows)
    const seen = new Set<string>();

    try {
      for (let page = 0; page < maxPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('public_jobs')
          .select('category')
          .not('category', 'is', null)
          .range(from, to);

        if (error) throw error;

        const batch = (data ?? [])
          .map((r) => String((r as { category: string | null }).category ?? '').trim())
          .filter(Boolean);

        batch.forEach((c) => seen.add(c));

        if (!data || data.length < pageSize) break;
      }

      const uniq = Array.from(seen).sort((a, b) => a.localeCompare(b));
      setCategories(uniq);
    } catch (err) {
      console.warn('Error fetching categories:', err);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  // Fetch on filter changes (server-side pagination)
  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, searchTerm, stateFilter, cityFilter, categoryFilter, salaryBand, sortKey, sortDir, page]);

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryOptions = useMemo(() => {
    const base = categories;
    const current = categoryFilter.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [categories, categoryFilter]);

  // Persist filters in URL (debounced)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams();
      if (visaType !== 'all') next.set('visa', visaType);
      if (searchTerm.trim()) next.set('q', searchTerm.trim());
      if (stateFilter.trim()) next.set('state', stateFilter.trim());
      if (cityFilter.trim()) next.set('city', cityFilter.trim());
      if (categoryFilter.trim()) next.set('category', categoryFilter.trim());

      if (salaryBand !== 'any') next.set('salary', salaryBand);
      // mantém compatibilidade se alguém tiver link antigo
      const legacy = SALARY_BANDS.find((b) => b.value === salaryBand);
      if (legacy?.min !== null) next.set('min', String(legacy.min));
      if (legacy?.max !== null) next.set('max', String(legacy.max));

      if (!(sortKey === 'posted_date' && sortDir === 'desc')) {
        next.set('sort', sortKey);
        next.set('dir', sortDir);
      }
      next.set('page', String(page));

      // Only update if different (prevents churn)
      const current = searchParams.toString();
      const nextStr = next.toString();
      if (current !== nextStr) setSearchParams(next, { replace: true });
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, searchTerm, stateFilter, cityFilter, categoryFilter, salaryBand, sortKey, sortDir, page]);

  const visaLabel = useMemo(() => {
    if (visaType === 'all') return 'All Visas';
    return visaType;
  }, [visaType]);

  // Cargo, Empresa, Local, Qtd. Vagas, Salário, Visto, Postada, Início, Fim, Experiência, Email, Ação
  const tableColSpan = 12;

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return '-';
    if (months < 12) return t('jobs.table.experience_months', { count: months });
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return t('jobs.table.experience_years', { count: years });
    return t('jobs.table.experience_years_months', { years, months: remainingMonths });
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    const s = String(date).trim();
    if (!s) return '-';

    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const addToQueue = async (job: Job) => {
    // Check if user is authenticated before allowing queue action
    if (!profile) {
      setShowLoginDialog(true);
      return;
    }

    if (planSettings.job_db_blur) {
      setShowUpgradeDialog(true);
      return;
    }

    if (queuedJobIds.has(job.id)) return;

    // OPTIMISTIC UPDATE: Mark as queued immediately for instant UI feedback
    setQueuedJobIds((prev) => new Set(prev).add(job.id));
    // Track processing state for spinner
    setProcessingJobIds((prev) => new Set(prev).add(job.id));

    // Run DNS check and insert in background (non-blocking)
    (async () => {
      const requiresDnsCheck = PLANS_CONFIG[planTier].features.dns_bounce_check;
      if (requiresDnsCheck) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) {
            // Revert optimistic update
            setQueuedJobIds((prev) => {
              const next = new Set(prev);
              next.delete(job.id);
              return next;
            });
            setProcessingJobIds((prev) => {
              const next = new Set(prev);
              next.delete(job.id);
              return next;
            });
            toast({ title: t('common.errors.no_session'), variant: 'destructive' });
            return;
          }

          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-dns-mx`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email: job.email }),
          });

          const payload = await res.json().catch(() => null);
          const ok = Boolean(payload?.ok);
          if (!ok) {
            // Revert optimistic update
            setQueuedJobIds((prev) => {
              const next = new Set(prev);
              next.delete(job.id);
              return next;
            });
            setProcessingJobIds((prev) => {
              const next = new Set(prev);
              next.delete(job.id);
              return next;
            });
            toast({
              title: t('queue.toasts.mx_invalid_title'),
              description: t('queue.toasts.mx_invalid_desc', { domain: String(payload?.domain ?? '') }),
              variant: 'destructive',
            });
            return;
          }
        } catch (_e) {
          // Revert optimistic update
          setQueuedJobIds((prev) => {
            const next = new Set(prev);
            next.delete(job.id);
            return next;
          });
          setProcessingJobIds((prev) => {
            const next = new Set(prev);
            next.delete(job.id);
            return next;
          });
          toast({
            title: t('queue.toasts.mx_invalid_title'),
            description: t('queue.toasts.mx_invalid_desc', { domain: '' }),
            variant: 'destructive',
          });
          return;
        }
      }

      const { error } = await supabase.from('my_queue').insert({
        user_id: profile?.id,
        job_id: job.id,
      });

      if (error) {
        if (error.code === '23505') {
          // Already in queue - keep the optimistic state
          toast({
            title: t('jobs.toasts.already_in_queue_title'),
            description: t('jobs.toasts.already_in_queue_desc'),
          });
        } else {
          // Revert optimistic update on error
          setQueuedJobIds((prev) => {
            const next = new Set(prev);
            next.delete(job.id);
            return next;
          });
          setProcessingJobIds((prev) => {
            const next = new Set(prev);
            next.delete(job.id);
            return next;
          });
          toast({
            title: t('jobs.toasts.add_error_title'),
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: t('jobs.toasts.add_success_title'),
          description: t('jobs.toasts.add_success_desc', { jobTitle: job.job_title }),
        });
      }
      // Clear processing state
      setProcessingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    })();
  };

  const removeFromQueue = async (job: Job) => {
    if (!profile?.id) return;
    
    const { error } = await supabase
      .from('my_queue')
      .delete()
      .eq('user_id', profile.id)
      .eq('job_id', job.id);

    if (error) {
      toast({
        title: t('common.errors.delete_failed'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setQueuedJobIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      setSelectedJob(null);
      toast({
        title: t('jobs.toasts.remove_success_title'),
        description: t('jobs.toasts.remove_success_desc', { jobTitle: job.job_title }),
      });
    }
  };

  const handleRowClick = (job: Job) => {
    if (planSettings.job_db_blur) {
      setShowUpgradeDialog(true);
    } else {
      setSelectedJob(job);
    }
  };

  const formatSalary = (salary: number | null) => {
    if (!salary) return '-';
    return `$${salary.toFixed(2)}/h`;
  };

  const toggleSort = (key: SortKey, defaultDir: SortDir = 'asc') => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(defaultDir);
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
      {/* Upgrade Banner for Free users at limit */}
      {isFreeLimitReached && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t('jobs.upgrade_banner.title')}</p>
              <p className="text-sm text-muted-foreground">{t('jobs.upgrade_banner.description', { limit: dailyLimitTotal })}</p>
            </div>
          </div>
          <Button onClick={() => navigate('/plans')} size="sm">
            {t('jobs.upgrade_banner.cta')}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('nav.jobs')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('jobs.subtitle', { totalCount: formatNumber(totalCount), visaLabel })}
            </p>
          </div>
          {isAdmin && <JobImportDialog />}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Select
                  value={visaType}
                  onValueChange={(v) => {
                    const next = (v === 'H-2A' || v === 'H-2B' || v === 'all') ? v : 'all';
                    setVisaType(next);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t('jobs.filters.visa.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('jobs.filters.visa.all')}</SelectItem>
                    <SelectItem value="H-2B">{t('jobs.filters.visa.only_h2b')}</SelectItem>
                    <SelectItem value="H-2A">{t('jobs.filters.visa.only_h2a')}</SelectItem>
                  </SelectContent>
                </Select>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-muted-foreground">
                      <Info className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('jobs.filters.visa.h2a_info')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('jobs.search.placeholder')}
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
              placeholder={t('jobs.filters.state')}
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder={t('jobs.filters.city')}
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
            />
            <Select
              value={categoryFilter.trim() ? categoryFilter : '__all__'}
              onValueChange={(v) => {
                setCategoryFilter(v === '__all__' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('jobs.filters.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('jobs.filters.category_all')}</SelectItem>
                {categoriesLoading ? (
                  <SelectItem value="__loading__" disabled>
                    {t('common.loading')}
                  </SelectItem>
                ) : (
                  categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Select
              value={salaryBand}
              onValueChange={(v) => {
                const next = (v as SalaryBand) ?? 'any';
                setSalaryBand(next);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('jobs.salary.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {SALARY_BANDS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mobile View: Cards */}
      {isMobile ? (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t('jobs.table.loading')}
              </CardContent>
            </Card>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t('jobs.table.empty')}
              </CardContent>
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
        /* Desktop View: Table */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('job_title', 'asc')}
                    >
                      {t('jobs.table.headers.job_title')} <SortIcon active={sortKey === 'job_title'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('company', 'asc')}
                    >
                      {t('jobs.table.headers.company')} <SortIcon active={sortKey === 'company'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('city', 'asc')}
                    >
                      {t('jobs.table.headers.location')} <SortIcon active={sortKey === 'city'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('openings', 'desc')}
                    >
                      {t('jobs.table.headers.openings')} <SortIcon active={sortKey === 'openings'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('salary', 'desc')}
                    >
                      {t('jobs.table.headers.salary')} <SortIcon active={sortKey === 'salary'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('visa_type', 'asc')}
                    >
                      {t('jobs.table.headers.visa')} <SortIcon active={sortKey === 'visa_type'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('posted_date', 'desc')}
                    >
                      {t('jobs.table.headers.posted')} <SortIcon active={sortKey === 'posted_date'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('start_date', 'asc')}
                    >
                      {t('jobs.table.headers.start')} <SortIcon active={sortKey === 'start_date'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:underline"
                      onClick={() => toggleSort('end_date', 'asc')}
                    >
                      {t('jobs.table.headers.end')} <SortIcon active={sortKey === 'end_date'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <div className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {t('jobs.table.headers.experience')}
                    </div>
                  </TableHead>
                  <TableHead>{t('jobs.table.headers.email')}</TableHead>
                  <TableHead className="text-right">{t('jobs.table.headers.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={tableColSpan} className="text-center py-8">
                      {t('jobs.table.loading')}
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableColSpan} className="text-center py-8">
                      {t('jobs.table.empty')}
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
                        <span
                          className={cn(
                            planSettings.job_db_blur && 'blur-sm select-none'
                          )}
                        >
                          {job.company}
                        </span>
                      </TableCell>
                      <TableCell>
                        {job.city}, {job.state}
                      </TableCell>
                      <TableCell>{typeof job.openings === 'number' ? formatNumber(job.openings) : '-'}</TableCell>
                      <TableCell>{formatSalary(job.salary)}</TableCell>
                      <TableCell>
                        <Badge variant={job.visa_type === 'H-2A' ? 'secondary' : 'default'}>
                          {job.visa_type === 'H-2A' ? 'H-2A' : 'H-2B'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(job.posted_date)}</TableCell>
                      <TableCell>{formatDate(job.start_date)}</TableCell>
                      <TableCell>{formatDate(job.end_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatExperience(job.experience_months)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            planSettings.job_db_blur && 'blur-sm select-none'
                          )}
                        >
                          {job.email}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={!planSettings.job_db_blur && queuedJobIds.has(job.id) ? "default" : "outline"}
                          className={cn(
                            !planSettings.job_db_blur && queuedJobIds.has(job.id) && 
                            "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500"
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

       {/* Job Details Dialog (scroll + mais detalhes) */}
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

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t('jobs.upgrade.title')}
            </DialogTitle>
            <DialogDescription>
              {t('jobs.upgrade.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-plan-gold/10 border border-plan-gold/30">
              <h4 className="font-semibold text-plan-gold">{t('plans.tiers.gold.label')}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('jobs.upgrade.gold_desc', { price: formatPlanPrice('gold') })}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-plan-diamond/10 border border-plan-diamond/30">
              <h4 className="font-semibold text-plan-diamond">{t('plans.tiers.diamond.label')}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('jobs.upgrade.diamond_desc', { price: formatPlanPrice('diamond') })}
              </p>
            </div>

            <Button className="w-full" onClick={() => (window.location.href = '/plans')}>
              {t('jobs.upgrade.cta')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Login Required Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {t('loginDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('loginDialog.descriptionQueue')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="text-sm text-foreground">
                {t('loginDialog.benefit')}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                className="w-full" 
                onClick={() => {
                  setShowLoginDialog(false);
                  navigate('/auth');
                }}
              >
                {t('loginDialog.ctaLogin')}
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowLoginDialog(false)}
              >
                {t('loginDialog.ctaContinue')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('jobs.pagination.page_of', { page, totalPages })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('common.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
