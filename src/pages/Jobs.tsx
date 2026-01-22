import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Info, Search, Plus, Check, Home, Bus, Wrench, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Job extends JobDetails {
  id: string;
}

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<string>>(new Set());

  const [visaType, setVisaType] = useState<'all' | 'H-2B' | 'H-2A'>(() => {
    const v = searchParams.get('visa');
    if (v === 'H-2A') return 'H-2A';
    if (v === 'H-2B') return 'H-2B';
    return 'all';
  });

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [stateFilter, setStateFilter] = useState(() => searchParams.get('state') ?? '');
  const [cityFilter, setCityFilter] = useState(() => searchParams.get('city') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') ?? '');
  const [salaryMin, setSalaryMin] = useState(() => searchParams.get('min') ?? '');
  const [salaryMax, setSalaryMax] = useState(() => searchParams.get('max') ?? '');
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
      .order('posted_date', { ascending: false })
      .range(from, to);

    if (visaType !== 'all') query = query.eq('visa_type', visaType);

    if (searchTerm.trim()) {
      query = query.or(buildOrSearch(searchTerm.trim()));
    }

    if (stateFilter.trim()) query = query.ilike('state', `%${stateFilter.trim()}%`);
    if (cityFilter.trim()) query = query.ilike('city', `%${cityFilter.trim()}%`);
    if (categoryFilter.trim()) query = query.ilike('category', `%${categoryFilter.trim()}%`);

    const min = salaryMin.trim() ? Number(salaryMin) : null;
    const max = salaryMax.trim() ? Number(salaryMax) : null;
    if (min !== null && Number.isFinite(min)) query = query.gte('salary', min);
    if (max !== null && Number.isFinite(max)) query = query.lte('salary', max);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: 'Erro ao carregar vagas',
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
      } else {
        setQueuedJobIds(new Set());
      }
    }

    setLoading(false);
  };

  // Fetch on filter changes (server-side pagination)
  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, searchTerm, stateFilter, cityFilter, categoryFilter, salaryMin, salaryMax, page]);

  // Persist filters in URL (debounced)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams();
      if (visaType !== 'all') next.set('visa', visaType);
      if (searchTerm.trim()) next.set('q', searchTerm.trim());
      if (stateFilter.trim()) next.set('state', stateFilter.trim());
      if (cityFilter.trim()) next.set('city', cityFilter.trim());
      if (categoryFilter.trim()) next.set('category', categoryFilter.trim());
      if (salaryMin.trim()) next.set('min', salaryMin.trim());
      if (salaryMax.trim()) next.set('max', salaryMax.trim());
      next.set('page', String(page));

      // Only update if different (prevents churn)
      const current = searchParams.toString();
      const nextStr = next.toString();
      if (current !== nextStr) setSearchParams(next, { replace: true });
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, searchTerm, stateFilter, cityFilter, categoryFilter, salaryMin, salaryMax, page]);

  const visaLabel = useMemo(() => {
    if (visaType === 'all') return 'H-2A + H-2B';
    return visaType;
  }, [visaType]);

  // Cargo, Empresa, Local, Qtd. Vagas, Salário, Visto, Postada, Início, Fim, Email, (Benefícios?), Ação
  const tableColSpan = planSettings.show_housing_icons ? 12 : 11;

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    const s = String(date).trim();
    if (!s) return '-';

    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const addToQueue = async (job: Job) => {
    if (planSettings.job_db_blur) {
      setShowUpgradeDialog(true);
      return;
    }

    if (queuedJobIds.has(job.id)) return;

    const { error } = await supabase.from('my_queue').insert({
      user_id: profile?.id,
      job_id: job.id,
    });

    if (error) {
      if (error.code === '23505') {
        setQueuedJobIds((prev) => new Set(prev).add(job.id));
        toast({
          title: 'Já na fila',
          description: 'Esta vaga já está na sua fila.',
        });
      } else {
        toast({
          title: 'Erro ao adicionar',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      setQueuedJobIds((prev) => new Set(prev).add(job.id));
      toast({
        title: 'Adicionado à fila!',
        description: `${job.job_title} foi adicionado à sua fila.`,
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

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Buscar Vagas</h1>
            <p className="text-muted-foreground mt-1">
              {totalCount} vagas {visaLabel} disponíveis
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
                    <SelectValue placeholder="Filtrar visto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos (H-2A + H-2B)</SelectItem>
                    <SelectItem value="H-2B">Apenas H-2B</SelectItem>
                    <SelectItem value="H-2A">Apenas H-2A</SelectItem>
                  </SelectContent>
                </Select>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-muted-foreground">
                      <Info className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>H-2A é agricultura: não tem cap anual e moradia é obrigatória.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cargo, empresa, cidade..."
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
              placeholder="Estado (ex: FL)"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="Cidade"
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="Categoria"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            />
            <Input
              inputMode="decimal"
              placeholder="Salário mín ($/h)"
              value={salaryMin}
              onChange={(e) => {
                setSalaryMin(e.target.value);
                setPage(1);
              }}
            />
            <Input
              inputMode="decimal"
              placeholder="Salário máx ($/h)"
              value={salaryMax}
              onChange={(e) => {
                setSalaryMax(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Qtd. Vagas</TableHead>
                <TableHead>Salário</TableHead>
                <TableHead>Visto</TableHead>
                <TableHead>Postada</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Email</TableHead>
                {planSettings.show_housing_icons && (
                  <TableHead className="text-center">Benefícios</TableHead>
                )}
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="text-center py-8">
                    Carregando vagas...
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="text-center py-8">
                    Nenhuma vaga encontrada
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(job)}
                  >
                    <TableCell className="font-medium">{job.job_title}</TableCell>
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
                    <TableCell>{job.openings ?? '-'}</TableCell>
                    <TableCell>{formatSalary(job.salary)}</TableCell>
                    <TableCell>
                      <Badge variant={job.visa_type === 'H-2A' ? 'secondary' : 'default'}>
                        {job.visa_type === 'H-2A' ? 'H-2A' : 'H-2B'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(job.posted_date)}</TableCell>
                    <TableCell>{formatDate(job.start_date)}</TableCell>
                    <TableCell>{formatDate(job.end_date)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          planSettings.job_db_blur && 'blur-sm select-none'
                        )}
                      >
                        {job.email}
                      </span>
                    </TableCell>
                    {planSettings.show_housing_icons && (
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          {/* H-2A: Moradia é mandatória, então destacamos o ícone */}
                          {(job.housing_info || job.visa_type === 'H-2A') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Badge
                                    variant={job.visa_type === 'H-2A' ? 'secondary' : 'outline'}
                                    className={cn(
                                      'text-xs',
                                      job.visa_type === 'H-2A' && 'border-transparent'
                                    )}
                                  >
                                    <Home className="h-3 w-3 mr-1" />
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {job.visa_type === 'H-2A'
                                    ? 'H-2A: moradia é obrigatória por regra do visto.'
                                    : 'Moradia disponível.'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {job.transport_provided && (
                            <Badge variant="outline" className="text-xs">
                              <Bus className="h-3 w-3 mr-1" />
                            </Badge>
                          )}
                          {job.tools_provided && (
                            <Badge variant="outline" className="text-xs">
                              <Wrench className="h-3 w-3 mr-1" />
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!planSettings.job_db_blur && queuedJobIds.has(job.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(job);
                        }}
                      >
                        {planSettings.job_db_blur ? (
                          <Lock className="h-4 w-4" />
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
       />

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Conteúdo Exclusivo
            </DialogTitle>
            <DialogDescription>
              Faça upgrade para desbloquear informações de contato e benefícios das vagas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-plan-gold/10 border border-plan-gold/30">
              <h4 className="font-semibold text-plan-gold">Plano Gold</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Desbloqueie emails e empresas por apenas R$ 19,90/mês
              </p>
            </div>

            <div className="p-4 rounded-lg bg-plan-diamond/10 border border-plan-diamond/30">
              <h4 className="font-semibold text-plan-diamond">Plano Diamond</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Acesso completo + IA + benefícios visuais por R$ 39,90/mês
              </p>
            </div>

            <Button className="w-full" onClick={() => (window.location.href = '/plans')}>
              Ver Planos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
