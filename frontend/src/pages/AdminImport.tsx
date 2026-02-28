import { useState, useEffect, useRef } from 'react';
import { MultiJsonImporter } from '@/components/admin/MultiJsonImporter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database, FileJson, Settings, UploadCloud, Loader2, CheckCircle2, History, XCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface ImportJobStatus {
  jobId: string;
  source: string;
  status: 'processing' | 'completed' | 'failed';
  phase?: string;
  processedRows: number;
  totalRows: number;
  error?: string;
  lastHeartbeat?: string;
  attemptCount?: number;
}

// Stale threshold: 20 minutes without heartbeat
const STALE_THRESHOLD_MS = 20 * 60 * 1000;

export default function AdminImport() {
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: number } | null>(null);
  const [importingSource, setImportingSource] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<ImportJobStatus[]>([]);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistoryJobs(data || []);
    setLoadingHistory(false);
  };

  // Cleanup truly stale jobs on mount (20+ min without heartbeat)
  useEffect(() => {
    const cleanupStaleJobs = async () => {
      const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
      // Only mark as failed if no heartbeat for 20+ minutes
      await supabase
        .from('import_jobs')
        .update({ status: 'failed', phase: 'failed', error_message: 'Stale: sem heartbeat por mais de 20 minutos' } as any)
        .eq('status', 'processing')
        .lt('last_heartbeat_at', staleThreshold);
      
      // Also catch old jobs that never got a heartbeat (legacy)
      const oldThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await supabase
        .from('import_jobs')
        .update({ status: 'failed', phase: 'failed', error_message: 'Stale: job antigo sem heartbeat' } as any)
        .eq('status', 'processing')
        .is('last_heartbeat_at' as any, null)
        .lt('created_at', oldThreshold);
    };
    cleanupStaleJobs();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startPolling = (jobs: ImportJobStatus[]) => {
    setActiveJobs(jobs);
    if (pollingRef.current) clearInterval(pollingRef.current);

    const jobIds = jobs.map(j => j.jobId);

    pollingRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('id, source, status, processed_rows, total_rows, error_message, phase, last_heartbeat_at, attempt_count')
        .in('id', jobIds);

      if (error || !data) return;

      const updated = data.map(d => ({
        jobId: d.id,
        source: d.source,
        status: d.status as ImportJobStatus['status'],
        phase: (d as any).phase as string | undefined,
        processedRows: d.processed_rows ?? 0,
        totalRows: d.total_rows ?? 0,
        error: d.error_message ?? undefined,
        lastHeartbeat: (d as any).last_heartbeat_at as string | undefined,
        attemptCount: (d as any).attempt_count as number | undefined,
      }));

      setActiveJobs(updated);

      const allDone = updated.every(j => j.status === 'completed' || j.status === 'failed');
      if (allDone) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setImportingSource(null);

        const completed = updated.filter(j => j.status === 'completed');
        const failed = updated.filter(j => j.status === 'failed');
        if (completed.length > 0) {
          const totalProcessed = completed.reduce((sum, j) => sum + j.processedRows, 0);
          toast({
            title: `Importação concluída`,
            description: `${totalProcessed} vagas processadas (${completed.map(j => j.source.toUpperCase()).join(', ')})`,
          });
        }
        if (failed.length > 0) {
          toast({
            title: `Importação falhou`,
            description: failed.map(j => `${j.source.toUpperCase()}: ${j.error || 'Erro'}`).join('; '),
            variant: 'destructive',
          });
        }
      }
    }, 3000);
  };

  // Wait for a single job to complete by polling (no hard timeout — heartbeat-based)
  const waitForJob = (jobId: string): Promise<ImportJobStatus> => {
    const POLL_INTERVAL = 3000;

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('import_jobs')
          .select('id, source, status, processed_rows, total_rows, error_message, phase, last_heartbeat_at, attempt_count')
          .eq('id', jobId)
          .single();

        if (!data) return;

        const job: ImportJobStatus = {
          jobId: data.id,
          source: data.source,
          status: data.status as ImportJobStatus['status'],
          phase: (data as any).phase as string | undefined,
          processedRows: data.processed_rows ?? 0,
          totalRows: data.total_rows ?? 0,
          error: data.error_message ?? undefined,
          lastHeartbeat: (data as any).last_heartbeat_at as string | undefined,
          attemptCount: (data as any).attempt_count as number | undefined,
        };

        setActiveJobs(prev => prev.map(j => j.jobId === jobId ? job : j));

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
          resolve(job);
          return;
        }

        // Check for stale heartbeat (20 min)
        if (job.lastHeartbeat) {
          const heartbeatAge = Date.now() - new Date(job.lastHeartbeat).getTime();
          if (heartbeatAge > STALE_THRESHOLD_MS) {
            clearInterval(interval);
            await supabase
              .from('import_jobs')
              .update({ status: 'failed', phase: 'failed', error_message: 'Stale: sem heartbeat por mais de 20 minutos' } as any)
              .eq('id', jobId)
              .eq('status', 'processing');
            
            const staleJob: ImportJobStatus = {
              ...job,
              status: 'failed',
              error: 'Stale: sem heartbeat por mais de 20 minutos',
            };
            setActiveJobs(prev => prev.map(j => j.jobId === jobId ? staleJob : j));
            resolve(staleJob);
          }
        }
      }, POLL_INTERVAL);
    });
  };

  const runManualImport = async (source: string) => {
    setImportingSource(source);
    setActiveJobs([]);
    try {
      if (source === 'all') {
        const sources = ['jo', 'h2a', 'h2b'];

        for (let i = 0; i < sources.length; i++) {
          const s = sources[i];
          const skipRadar = i < sources.length - 1;

          const { data, error } = await supabase.functions.invoke('auto-import-jobs', {
            body: { source: s, skip_radar: skipRadar },
          });
          if (error) throw error;
          const jobId = data?.job_id;
          if (!jobId) throw new Error(`No job_id for ${s}`);

          const newJob: ImportJobStatus = { jobId, source: s, status: 'processing', processedRows: 0, totalRows: 0 };
          setActiveJobs(prev => [...prev, newJob]);

          const result = await waitForJob(jobId);

          if (result.status === 'completed') {
            toast({ title: `${s.toUpperCase()} concluída`, description: `${result.processedRows} vagas processadas` });
          } else {
            toast({ title: `${s.toUpperCase()} falhou`, description: result.error || 'Erro', variant: 'destructive' });
          }
        }

        setImportingSource(null);
      } else {
        const { data, error } = await supabase.functions.invoke('auto-import-jobs', {
          body: { source, skip_radar: true },
        });
        if (error) throw error;
        const jobId = data?.job_id;
        if (!jobId) throw new Error('No job_id returned');
        const newJob: ImportJobStatus = { jobId, source, status: 'processing', processedRows: 0, totalRows: 0 };
        setActiveJobs([newJob]);
        startPolling([newJob]);
      }
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
      setImportingSource(null);
    }
  };

  const processGroupXlsx = async () => {
    if (!xlsxFile) return;
    setProcessing(true);
    setResult(null);

    try {
      const data = await xlsxFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const groupMap = new Map<string, string>();
      for (const row of rows) {
        const caseNumber = row['Case Number'] || row['case_number'] || row['CASE_NUMBER'];
        const group = row['Randomization Group'] || row['randomization_group'] || row['GROUP'];
        if (caseNumber && group) {
          groupMap.set(String(caseNumber).trim(), String(group).trim().toUpperCase());
        }
      }

      let updated = 0;
      let notFound = 0;
      const entries = Array.from(groupMap.entries());
      const BATCH = 50;

      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH);
        const caseNumbers = batch.map(([cn]) => cn);

        const { data: jobs } = await supabase
          .from('public_jobs')
          .select('id, job_id')
          .in('job_id', caseNumbers);

        if (jobs && jobs.length > 0) {
          for (const job of jobs) {
            const group = groupMap.get(job.job_id);
            if (group) {
              const { error } = await supabase
                .from('public_jobs')
                .update({ randomization_group: group } as any)
                .eq('id', job.id);
              if (!error) updated++;
            }
          }
        }
        notFound += batch.length - (jobs?.length || 0);
      }

      setResult({ updated, notFound });
      toast({
        title: 'Grupos Atualizados!',
        description: `${updated} vagas atualizadas, ${notFound} não encontradas no banco.`,
      });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const formatPhase = (phase?: string) => {
    switch (phase) {
      case 'downloading': return '⬇️ Baixando';
      case 'processing': return '⚙️ Processando';
      case 'finalizing': return '✅ Finalizando';
      case 'completed': return '✅ Concluído';
      case 'failed': return '❌ Falhou';
      default: return phase || '';
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Importação de Vagas</h1>
        <p className="text-muted-foreground">
          Gerencie a importação de vagas do DOL (Department of Labor)
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="import">
            <FileJson className="h-4 w-4 mr-2" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="history" onClick={fetchHistory}>
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="groups">
            <UploadCloud className="h-4 w-4 mr-2" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Database className="h-4 w-4 mr-2" />
            Estatísticas
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <MultiJsonImporter />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> Histórico de Importações
              </CardTitle>
              <CardDescription>Últimas 50 execuções (automáticas e manuais)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : historyJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {historyJobs.map((job) => {
                    const isCompleted = job.status === 'completed';
                    const isFailed = job.status === 'failed';
                    const isProcessing = job.status === 'processing';
                    const pct = job.total_rows ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;
                    const createdAt = job.created_at
                      ? format(new Date(job.created_at), 'dd/MM/yyyy HH:mm')
                      : '—';
                    const phase = (job as any).phase;
                    const attemptCount = (job as any).attempt_count;

                    return (
                      <div
                        key={job.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isCompleted ? 'bg-green-50 border-green-200' :
                          isFailed ? 'bg-destructive/5 border-destructive/20' :
                          'bg-muted/50 border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                          {isFailed && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                          {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                {job.source}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{createdAt}</span>
                              {phase && isProcessing && (
                                <span className="text-xs text-muted-foreground">{formatPhase(phase)}</span>
                              )}
                              {attemptCount > 1 && (
                                <Badge variant="secondary" className="text-[9px]">
                                  {attemptCount}x
                                </Badge>
                              )}
                            </div>
                            {isFailed && job.error_message && (
                              <p className="text-xs text-destructive mt-1 max-w-md truncate">{job.error_message}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-mono font-bold">
                            {job.processed_rows}/{job.total_rows}
                          </span>
                          {isCompleted && <span className="ml-2 text-green-600">✓</span>}
                          {isProcessing && <span className="ml-2 text-muted-foreground">{pct}%</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <Card className="shadow-xl border-2 border-amber-500/20">
            <CardHeader className="bg-amber-50">
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <UploadCloud className="h-6 w-6" /> Importar Randomization Groups
              </CardTitle>
              <CardDescription>
                Faça upload do relatório XLSX do DOL (Public Facing Report) para associar o grupo de randomização (A-H) às vagas pelo Case Number.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="border-dashed border-2 rounded-xl p-8 text-center bg-amber-50/30 hover:bg-white transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    setXlsxFile(e.target.files?.[0] || null);
                    setResult(null);
                  }}
                  className="w-full"
                />
                <p className="mt-2 text-sm text-muted-foreground">Arquivo XLSX do DOL com colunas "Case Number" e "Randomization Group"</p>
              </div>

              {result && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">{result.updated} vagas atualizadas com grupo</p>
                    <p className="text-sm text-green-600">{result.notFound} case numbers não encontrados no banco</p>
                  </div>
                </div>
              )}

              <Button
                onClick={processGroupXlsx}
                disabled={processing || !xlsxFile}
                className="w-full h-12 text-lg font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {processing ? <Loader2 className="animate-spin mr-2" /> : <UploadCloud className="mr-2" />}
                Processar Grupos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas de Importação</CardTitle>
              <CardDescription>Resumo das vagas no banco de dados</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Estatísticas em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importação Manual do DOL</CardTitle>
              <CardDescription>Dispare manualmente a importação de cada fonte. O cron roda automaticamente às 06:00 UTC.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => runManualImport('all')}
                disabled={!!importingSource}
                className="w-full justify-between h-12 font-bold"
              >
                <span>🚀 Importar Todas (JO + H2A + H2B)</span>
                {importingSource === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              </Button>

              <div className="border-t my-2" />

              {(['jo', 'h2a', 'h2b'] as const).map((source) => (
                <Button
                  key={source}
                  onClick={() => runManualImport(source)}
                  disabled={!!importingSource}
                  variant="outline"
                  className="w-full justify-between h-12"
                >
                  <span className="font-semibold">{source === 'jo' ? 'JO / Seasonal Jobs' : source.toUpperCase()}</span>
                  {importingSource === source || importingSource === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                </Button>
              ))}

              {activeJobs.filter(j => j.status === 'processing').map(job => {
                const pct = job.totalRows ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
                return (
                  <div key={job.jobId} className="mt-2 space-y-2 p-4 rounded-lg border bg-muted/50">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        Importando {job.source.toUpperCase()}...
                        {job.phase && <span className="ml-2 text-xs text-muted-foreground">({formatPhase(job.phase)})</span>}
                      </span>
                      <span className="text-muted-foreground">
                        {job.processedRows} / {job.totalRows || '?'}
                      </span>
                    </div>
                    <Progress value={job.totalRows ? pct : undefined} className="h-2" />
                    {job.attemptCount && job.attemptCount > 1 && (
                      <p className="text-[10px] text-muted-foreground">Tentativa #{job.attemptCount} (auto-retomada)</p>
                    )}
                  </div>
                );
              })}

              {activeJobs.length > 0 && activeJobs.some(j => j.status === 'processing') && (
                <p className="text-xs text-muted-foreground">Processando em background com auto-retomada. Atualiza a cada 3s.</p>
              )}

              {activeJobs.filter(j => j.status === 'completed').map(job => (
                <div key={job.jobId} className="mt-2 flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      {job.source.toUpperCase()} concluída
                    </p>
                    <p className="text-sm text-green-600">{job.processedRows} vagas processadas</p>
                  </div>
                </div>
              ))}

              {activeJobs.filter(j => j.status === 'failed').map(job => (
                <div key={job.jobId} className="mt-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="font-medium text-destructive">{job.source.toUpperCase()} falhou</p>
                  <p className="text-sm text-destructive/80">{job.error}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
