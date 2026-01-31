import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Search, 
  Plus, 
  Check, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Loader2, 
  ExternalLink,
  Building2,
  MapPin,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/number';
import { AuthRequiredDialog } from '@/components/auth/AuthRequiredDialog';
import { PublicLayout } from '@/components/layout/PublicLayout';

interface Job {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  city: string;
  state: string;
  email: string;
  phone: string | null;
  salary: number | null;
  openings: number | null;
  visa_type: string | null;
  category: string | null;
  posted_date: string;
  start_date: string | null;
  end_date: string | null;
  experience_months: number | null;
}

export default function PublicJobs() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());
  const [processingJobIds, setProcessingJobIds] = useState<Set<string>>(new Set());
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const [visaType, setVisaType] = useState<'all' | 'H-2B' | 'H-2A'>(() => {
    const v = searchParams.get('visa');
    if (v === 'H-2A') return 'H-2A';
    if (v === 'H-2B') return 'H-2B';
    return 'all';
  });

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [stateFilter, setStateFilter] = useState(() => searchParams.get('state') ?? '');
  const [cityFilter, setCityFilter] = useState(() => searchParams.get('city') ?? '');

  type SalaryBand = 'any' | 'lt15' | '15-18' | '18-22' | '22-26' | '26plus';
  const SALARY_BANDS: Array<{ value: SalaryBand; label: string; min: number | null; max: number | null }> = [
    { value: 'any', label: t('jobs.salary.any'), min: null, max: null },
    { value: 'lt15', label: t('jobs.salary.lt15'), min: null, max: 14.99 },
    { value: '15-18', label: t('jobs.salary.15_18'), min: 15, max: 18 },
    { value: '18-22', label: t('jobs.salary.18_22'), min: 18, max: 22 },
    { value: '22-26', label: t('jobs.salary.22_26'), min: 22, max: 26 },
    { value: '26plus', label: t('jobs.salary.26plus'), min: 26, max: null },
  ];

  const [salaryBand, setSalaryBand] = useState<SalaryBand>(() => {
    const v = (searchParams.get('salary') as SalaryBand | null) ?? null;
    if (v && SALARY_BANDS.some((b) => b.value === v)) return v;
    return 'any';
  });

  type SortKey = 'job_title' | 'company' | 'state' | 'city' | 'salary' | 'posted_date';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const v = searchParams.get('sort') as SortKey | null;
    const allowed: SortKey[] = ['job_title', 'company', 'state', 'city', 'salary', 'posted_date'];
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
      .select('id, job_id, job_title, company, city, state, email, phone, salary, openings, visa_type, category, posted_date, start_date, end_date, experience_months', { count: 'exact' })
      .eq('is_banned', false)
      .order(sortKey, { ascending: sortDir === 'asc', nullsFirst: false })
      .range(from, to);

    if (sortKey !== 'posted_date') {
      query = query.order('posted_date', { ascending: false, nullsFirst: false });
    }

    if (visaType !== 'all') query = query.eq('visa_type', visaType);

    if (searchTerm.trim()) {
      query = query.or(buildOrSearch(searchTerm.trim()));
    }

    if (stateFilter.trim()) query = query.ilike('state', `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike('city', `%${cityFilter.trim()}%`);

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
    } else {
      const nextJobs = (data as Job[]) || [];
      setJobs(nextJobs);
      setTotalCount(count ?? 0);

      // Check queued jobs for authenticated users
      if (profile?.id && nextJobs.length) {
        const ids = nextJobs.map((j) => j.id);
        const { data: queueRows } = await supabase
          .from('my_queue')
          .select('job_id')
          .eq('user_id', profile.id)
          .in('job_id', ids);

        setQueuedJobIds(new Set((queueRows ?? []).map((r) => r.job_id)));
      } else {
        setQueuedJobIds(new Set());
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, searchTerm, stateFilter, cityFilter, salaryBand, sortKey, sortDir, page, profile?.id]);

  // Persist filters in URL
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams();
      if (visaType !== 'all') next.set('visa', visaType);
      if (searchTerm.trim()) next.set('q', searchTerm.trim());
      if (stateFilter.trim()) next.set('state', stateFilter.trim());
      if (cityFilter.trim()) next.set('city', cityFilter.trim());
      if (salaryBand !== 'any') next.set('salary', salaryBand);
      if (!(sortKey === 'posted_date' && sortDir === 'desc')) {
        next.set('sort', sortKey);
        next.set('dir', sortDir);
      }
      next.set('page', String(page));

      const current = searchParams.toString();
      const nextStr = next.toString();
      if (current !== nextStr) setSearchParams(next, { replace: true });
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, searchTerm, stateFilter, cityFilter, salaryBand, sortKey, sortDir, page]);

  const handleAddToQueue = async (job: Job) => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    if (!profile?.id || queuedJobIds.has(job.id)) return;

    setQueuedJobIds((prev) => new Set(prev).add(job.id));
    setProcessingJobIds((prev) => new Set(prev).add(job.id));

    const { error } = await supabase.from('my_queue').insert({
      user_id: profile.id,
      job_id: job.id,
    });

    if (error) {
      if (error.code !== '23505') {
        setQueuedJobIds((prev) => {
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

    setProcessingJobIds((prev) => {
      const next = new Set(prev);
      next.delete(job.id);
      return next;
    });
  };

  const formatSalary = (salary: number | null) => {
    if (!salary) return '-';
    return `$${salary.toFixed(2)}/h`;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    const d = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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

  // Mobile Job Card
  const MobileJobCard = ({ job }: { job: Job }) => {
    const isQueued = queuedJobIds.has(job.id);
    const isProcessing = processingJobIds.has(job.id);

    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(`/vaga/${job.id}`)}
      >
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {job.visa_type && <Badge variant="secondary" className="text-xs">{job.visa_type}</Badge>}
              </div>
              <h3 className="font-semibold text-foreground truncate">{job.job_title}</h3>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate">{job.company}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{job.city}, {job.state}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant={isQueued ? 'secondary' : 'default'}
              disabled={isQueued || isProcessing}
              onClick={(e) => {
                e.stopPropagation();
                handleAddToQueue(job);
              }}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isQueued ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="font-medium">{formatSalary(job.salary)}</span>
            </div>
            <span className="text-muted-foreground">{formatDate(job.posted_date)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PublicLayout>
      <TooltipProvider>
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('public.jobs.title')}</h1>
              <p className="text-muted-foreground mt-1">
                {totalCount > 0 ? `${formatNumber(totalCount)} ${t('public.jobs.jobs_available')}` : t('public.jobs.loading')}
              </p>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="relative sm:col-span-2 lg:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={t('jobs.filters.search_placeholder')}
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                      className="pl-9"
                    />
                  </div>

                  <Select value={visaType} onValueChange={(v) => { setVisaType(v as typeof visaType); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('jobs.filters.visa_type')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('jobs.filters.all_visas')}</SelectItem>
                      <SelectItem value="H-2A">H-2A</SelectItem>
                      <SelectItem value="H-2B">H-2B</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder={t('jobs.filters.state_placeholder')}
                    value={stateFilter}
                    onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
                  />

                  <Input
                    placeholder={t('jobs.filters.city_placeholder')}
                    value={cityFilter}
                    onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
                  />

                  <Select value={salaryBand} onValueChange={(v) => { setSalaryBand(v as SalaryBand); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('jobs.filters.salary')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SALARY_BANDS.map((b) => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Jobs List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">{t('jobs.empty')}</p>
              </CardContent>
            </Card>
          ) : isMobile ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <MobileJobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none" 
                      onClick={() => toggleSort('job_title')}
                    >
                      <div className="flex items-center gap-1">
                        {t('jobs.table.title')}
                        <SortIcon active={sortKey === 'job_title'} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none" 
                      onClick={() => toggleSort('company')}
                    >
                      <div className="flex items-center gap-1">
                        {t('jobs.table.company')}
                        <SortIcon active={sortKey === 'company'} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none" 
                      onClick={() => toggleSort('state')}
                    >
                      <div className="flex items-center gap-1">
                        {t('jobs.table.location')}
                        <SortIcon active={sortKey === 'state'} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none text-right" 
                      onClick={() => toggleSort('salary', 'desc')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {t('jobs.table.salary')}
                        <SortIcon active={sortKey === 'salary'} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead>{t('jobs.table.visa')}</TableHead>
                    <TableHead 
                      className="cursor-pointer select-none" 
                      onClick={() => toggleSort('posted_date', 'desc')}
                    >
                      <div className="flex items-center gap-1">
                        {t('jobs.table.posted')}
                        <SortIcon active={sortKey === 'posted_date'} dir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">{t('jobs.table.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const isQueued = queuedJobIds.has(job.id);
                    const isProcessing = processingJobIds.has(job.id);

                    return (
                      <TableRow 
                        key={job.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/vaga/${job.id}`)}
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {job.job_title}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{job.company}</TableCell>
                        <TableCell>{job.city}, {job.state}</TableCell>
                        <TableCell className="text-right">{formatSalary(job.salary)}</TableCell>
                        <TableCell>
                          {job.visa_type && <Badge variant="secondary">{job.visa_type}</Badge>}
                        </TableCell>
                        <TableCell>{formatDate(job.posted_date)}</TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={isQueued ? 'secondary' : 'default'}
                                disabled={isQueued || isProcessing}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToQueue(job);
                                }}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isQueued ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isQueued ? t('jobs.actions.already_added') : t('jobs.actions.add_to_queue')}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('common.page_of', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('common.next')}
              </Button>
            </div>
          )}

          {/* CTA for non-authenticated users */}
          {!user && (
            <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
              <CardContent className="py-8 text-center space-y-4">
                <h2 className="text-xl font-bold text-foreground">{t('public.jobs.cta_title')}</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {t('public.jobs.cta_description')}
                </p>
                <Button size="lg" onClick={() => navigate('/auth?mode=signup')}>
                  {t('public.jobs.cta_button')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </TooltipProvider>

      <AuthRequiredDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
        action="queue"
      />
    </PublicLayout>
  );
}
