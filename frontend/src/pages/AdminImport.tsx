import { useState, useEffect, useRef } from 'react';
import { MultiJsonImporter } from '@/components/admin/MultiJsonImporter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database, FileJson, Settings, UploadCloud, Loader2, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';

interface ImportJobStatus {
  jobId: string;
  source: string;
  status: 'processing' | 'completed' | 'failed';
  processedRows: number;
  totalRows: number;
  error?: string;
}

export default function AdminImport() {
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: number } | null>(null);
  const [importingSource, setImportingSource] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<ImportJobStatus[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
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
        .select('id, source, status, processed_rows, total_rows, error_message')
        .in('id', jobIds);

      if (error || !data) return;

      const updated = data.map(d => ({
        jobId: d.id,
        source: d.source,
        status: d.status as ImportJobStatus['status'],
        processedRows: d.processed_rows ?? 0,
        totalRows: d.total_rows ?? 0,
        error: d.error_message ?? undefined,
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
    }, 2000);
  };

  const runManualImport = async (source: string) => {
    setImportingSource(source);
    try {
      const { data, error } = await supabase.functions.invoke('auto-import-jobs', {
        body: { source, skip_radar: true },
      });
      if (error) throw error;

      if (source === 'all') {
        const jobIds = data?.job_ids as string[];
        if (!jobIds?.length) throw new Error('No job_ids returned');
        startPolling(jobIds.map((id, i) => ({
          jobId: id,
          source: ['jo', 'h2a', 'h2b'][i],
          status: 'processing',
          processedRows: 0,
          totalRows: 0,
        })));
      } else {
        const jobId = data?.job_id;
        if (!jobId) throw new Error('No job_id returned');
        startPolling([{ jobId, source, status: 'processing', processedRows: 0, totalRows: 0 }]);
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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Importação de Vagas</h1>
        <p className="text-muted-foreground">
          Gerencie a importação de vagas do DOL (Department of Labor)
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="import">
            <FileJson className="h-4 w-4 mr-2" />
            Importar
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
              {/* Import All button */}
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

              {/* Active jobs progress */}
              {activeJobs.filter(j => j.status === 'processing').map(job => {
                const pct = job.totalRows ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
                return (
                  <div key={job.jobId} className="mt-2 space-y-2 p-4 rounded-lg border bg-muted/50">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Importando {job.source.toUpperCase()}...</span>
                      <span className="text-muted-foreground">
                        {job.processedRows} / {job.totalRows || '?'}
                      </span>
                    </div>
                    <Progress value={job.totalRows ? pct : undefined} className="h-2" />
                  </div>
                );
              })}

              {activeJobs.length > 0 && activeJobs.some(j => j.status === 'processing') && (
                <p className="text-xs text-muted-foreground">Processando em background. Atualiza a cada 2s.</p>
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
