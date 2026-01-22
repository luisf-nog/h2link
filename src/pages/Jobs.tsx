import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Home, Bus, Wrench, Lock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  job_id: string;
  company: string;
  email: string;
  job_title: string;
  category: string | null;
  city: string;
  state: string;
  salary: number | null;
  start_date: string | null;
  posted_date: string;
  housing_info: string | null;
  transport_provided: boolean | null;
  tools_provided: boolean | null;
  weekly_hours: number | null;
}

export default function Jobs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const planTier = profile?.plan_tier || 'free';
  const planSettings = PLANS_CONFIG[planTier].settings;

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('public_jobs')
      .select('*')
      .order('posted_date', { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: 'Erro ao carregar vagas',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setJobs(data || []);
    }
    setLoading(false);
  };

  const addToQueue = async (job: Job) => {
    if (planSettings.job_db_blur) {
      setShowUpgradeDialog(true);
      return;
    }

    const { error } = await supabase.from('my_queue').insert({
      user_id: profile?.id,
      job_id: job.id,
    });

    if (error) {
      if (error.code === '23505') {
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

  const filteredJobs = jobs.filter(
    (job) =>
      job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatSalary = (salary: number | null) => {
    if (!salary) return '-';
    return `$${salary.toFixed(2)}/h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Buscar Vagas</h1>
          <p className="text-muted-foreground mt-1">
            {jobs.length} vagas H-2B disponíveis
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cargo, empresa, cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Salário</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando vagas...
                  </TableCell>
                </TableRow>
              ) : filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Nenhuma vaga encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job) => (
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
                    <TableCell>{formatSalary(job.salary)}</TableCell>
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
                          {job.housing_info && (
                            <Badge variant="outline" className="text-xs">
                              <Home className="h-3 w-3 mr-1" />
                            </Badge>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(job);
                        }}
                      >
                        {planSettings.job_db_blur ? (
                          <Lock className="h-4 w-4" />
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

      {/* Job Details Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedJob?.job_title}</DialogTitle>
            <DialogDescription>{selectedJob?.company}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Local</p>
                <p className="font-medium">
                  {selectedJob?.city}, {selectedJob?.state}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Salário</p>
                <p className="font-medium">{formatSalary(selectedJob?.salary || null)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{selectedJob?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Início</p>
                <p className="font-medium">
                  {selectedJob?.start_date
                    ? new Date(selectedJob.start_date).toLocaleDateString('pt-BR')
                    : '-'}
                </p>
              </div>
            </div>

            {/* Premium info - text for Gold, icons for Diamond */}
            {(planSettings.job_db_access === 'text_only' ||
              planSettings.job_db_access === 'visual_premium') && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Benefícios</p>
                <div className="space-y-2">
                  {selectedJob?.housing_info && (
                    <div className="flex items-center gap-2">
                      {planSettings.show_housing_icons && <Home className="h-4 w-4 text-primary" />}
                      <span>Moradia: {selectedJob.housing_info}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {planSettings.show_housing_icons && <Bus className="h-4 w-4 text-primary" />}
                    <span>Transporte: {selectedJob?.transport_provided ? 'Sim' : 'Não'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {planSettings.show_housing_icons && <Wrench className="h-4 w-4 text-primary" />}
                    <span>Ferramentas: {selectedJob?.tools_provided ? 'Sim' : 'Não'}</span>
                  </div>
                  {selectedJob?.weekly_hours && (
                    <div>
                      <span>Horas semanais: {selectedJob.weekly_hours}h</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => selectedJob && addToQueue(selectedJob)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar à Fila
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
