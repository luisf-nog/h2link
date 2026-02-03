import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, FileArchive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import JSZip from 'jszip';

interface ProcessedJob {
  visa_type: string;
  job_id: string;
  company: string;
  email: string;
  job_title: string;
  category?: string;
  city: string;
  state: string;
  openings?: number;
  salary?: number;
  start_date?: string;
  end_date?: string;
  job_duties?: string;
  weekly_hours?: number;
  experience_months?: number;
  education_required?: string;
  housing_info?: string;
  transport_provided?: boolean;
  [key: string]: any;
}

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        f => f.name.endsWith('.json') || f.name.endsWith('.zip')
      );
      setFiles(selectedFiles);
      setResult(null);
    }
  };

  const detectVisaType = (filename: string): string => {
    const lowerName = filename.toLowerCase();
    // Detecta pelo nome do arquivo ZIP ou JSON
    if (lowerName.includes('_jo') || lowerName.includes('jo.')) {
      return 'H-2A (Early Access)';
    } else if (lowerName.includes('h2a')) {
      return 'H-2A';
    }
    return 'H-2B';
  };

  const extractZipFiles = async (zipFile: File): Promise<Array<{ name: string; content: string; visaType: string }>> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const jsonFiles: Array<{ name: string; content: string; visaType: string }> = [];

    // Detecta visa type pelo nome do ZIP
    const zipVisaType = detectVisaType(zipFile.name);

    for (const [filename, file] of Object.entries(contents.files)) {
      if (!file.dir && filename.endsWith('.json')) {
        const content = await file.async('string');
        jsonFiles.push({
          name: filename,
          content,
          visaType: zipVisaType, // Usa o tipo do ZIP, não do arquivo individual
        });
      }
    }

    return jsonFiles;
  };

  const extractJobsList = (content: any): any[] => {
    // Scanner de listas - extrai array independente do nível
    if (Array.isArray(content)) {
      return content;
    }
    
    if (typeof content === 'object' && content !== null) {
      const values = Object.values(content);
      const lists = values.filter(v => Array.isArray(v));
      if (lists.length > 0) {
        return lists[0] as any[];
      }
    }
    
    return [];
  };

  const flattenH2A = (record: any): any => {
    // Tratamento de registros H-2A aninhados
    if (record.clearanceOrder && typeof record.clearanceOrder === 'object') {
      return { ...record, ...record.clearanceOrder };
    }
    return record;
  };

  const unifyField = (...values: any[]): any => {
    for (const val of values) {
      if (val !== null && val !== undefined) {
        return val;
      }
    }
    return null;
  };

  const calculateHourlySalary = (rawWage: number | null, weeklyHours: number | null): number | null => {
    if (!rawWage) return null;
    
    // Se já é horário (menor que 100), retorna direto
    if (rawWage <= 100) return rawWage;
    
    // Se é mensal, tenta calcular
    if (weeklyHours && weeklyHours > 0) {
      const hourly = rawWage / (weeklyHours * 4.333);
      // Validação: entre $7.25 e $80/hora
      if (hourly >= 7.25 && hourly <= 80) {
        return Math.round(hourly * 100) / 100;
      }
    }
    
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Por favor, selecione pelo menos um arquivo JSON ou ZIP.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    setExtracting(true);
    setResult(null);

    try {
      const allJobs: ProcessedJob[] = [];
      const errors: string[] = [];

      // Extrair e processar arquivos
      const jsonContents: Array<{ name: string; content: string; visaType: string }> = [];

      for (const file of files) {
        if (file.name.endsWith('.zip')) {
          // Extrair JSONs do ZIP
          const extracted = await extractZipFiles(file);
          jsonContents.push(...extracted);
        } else {
          // Arquivo JSON direto
          const content = await file.text();
          jsonContents.push({
            name: file.name,
            content,
            visaType: detectVisaType(file.name),
          });
        }
      }

      setExtracting(false);
      toast({
        title: 'Arquivos extraídos',
        description: `${jsonContents.length} arquivos JSON encontrados. Processando...`,
      });

      // Processar cada JSON
      for (const jsonFile of jsonContents) {
        try {
          const json = JSON.parse(jsonFile.content);
          const visaType = jsonFile.visaType;
          
          // Extrair lista de vagas
          const jobsList = extractJobsList(json);
          
          toast({
            title: `Processando ${jsonFile.name}`,
            description: `${jobsList.length} vagas encontradas (${visaType})`,
          });
          
          // Processar cada vaga
          for (const rawJob of jobsList) {
            try {
              const job = flattenH2A(rawJob);
              
              // Unificação de campos (seguindo a lógica do Power Query)
              const company = unifyField(job.employerBusinessName, job.empBusinessName);
              const jobTitle = unifyField(job.job_title, job.jobTitle, job.tempneedJobtitle);
              const category = unifyField(job.socTitle, job.jobSocTitle, job.tempneedSocTitle);
              const openings = unifyField(job.totalWorkersNeeded, job.jobWrksNeeded, job.tempneedWkrPos);
              const startDate = unifyField(job.job_begin_date, job.jobBeginDate, job.tempneedStart);
              const endDate = unifyField(job.job_end_date, job.jobEndDate, job.tempneedEnd);
              const jobDuties = unifyField(job.job_duties, job.jobDuties, job.tempneedDescription);
              const email = unifyField(job.recApplyEmail);
              
              // Cálculo de salário
              const rawWage = unifyField(job.wageOfferFrom, job.jobWageOffer, job.wageFrom);
              const weeklyHours = job.jobHoursTotal;
              const salary = calculateHourlySalary(rawWage, weeklyHours);
              
              // Overtime
              const overtime = unifyField(job.jobWageOtOffer, job.wageOtFrom);
              
              // Requisitos e deduções
              const specialReq = unifyField(job.jobMinspecialreq);
              const wageAdditional = unifyField(job.jobSpecialPayInfo, job.addSpecialPayInfo, job.wageAdditional);
              const payDeductions = unifyField(job.jobPayDeduction, job.recPayDeductions);
              
              // Transporte e moradia
              const transportProvided = job.isDailyTransport === true || job.isDailyTransport === 1 || 
                                       job.recIsDailyTransport === true || job.recIsDailyTransport === '1';
              const housingInfo = visaType.includes('H-2A') ? 'Yes (H-2A Mandated)' : null;
              
              // Validar campos obrigatórios
              if (!email || email === 'N/A') {
                errors.push(`${file.name}: Vaga sem email válido (ID: ${job.caseNumber || 'N/A'})`);
                continue;
              }
              
              if (!jobTitle || !company) {
                errors.push(`${file.name}: Vaga sem título ou empresa (ID: ${job.caseNumber || 'N/A'})`);
                continue;
              }
              
              // Criar objeto processado
              const processedJob: ProcessedJob = {
                visa_type: visaType,
                job_id: job.caseNumber || `${company}-${Date.now()}`,
                company,
                email,
                job_title: jobTitle,
                category,
                city: job.jobCity,
                state: job.jobState,
                openings: openings ? parseInt(openings) : null,
                salary,
                overtime_salary: overtime,
                start_date: startDate,
                end_date: endDate,
                source_url: job.recApplyUrl,
                phone: job.recApplyPhone,
                posted_date: job.dateAcceptanceLtrIssued,
                experience_months: job.jobMinexpmonths ? parseInt(job.jobMinexpmonths) : null,
                housing_info: housingInfo,
                transport_provided: transportProvided,
                weekly_hours: weeklyHours,
                education_required: job.jobMinedu,
                worksite_address: job.jobAddr1,
                worksite_zip: job.jobPostcode,
                job_duties: jobDuties,
                job_min_special_req: specialReq,
                wage_additional: wageAdditional,
                rec_pay_deductions: payDeductions,
              };
              
              allJobs.push(processedJob);
            } catch (err) {
              errors.push(`${jsonFile.name}: Erro ao processar vaga - ${err}`);
            }
          }
        } catch (err) {
          errors.push(`${jsonFile.name}: Erro ao ler arquivo - ${err}`);
        }
      }

      if (allJobs.length === 0) {
        toast({
          title: 'Nenhuma vaga válida',
          description: 'Nenhuma vaga pôde ser processada dos arquivos fornecidos.',
          variant: 'destructive',
        });
        setResult({ success: 0, errors });
        setProcessing(false);
        return;
      }

      // Importar para o Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const response = await supabase.functions.invoke('import-jobs', {
        body: { jobs: allJobs },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResult({
        success: allJobs.length,
        errors,
      });

      toast({
        title: 'Importação concluída!',
        description: `${allJobs.length} vagas importadas com sucesso.`,
      });
    } catch (err) {
      toast({
        title: 'Erro na importação',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Importador Multi-JSON
        </CardTitle>
        <CardDescription>
          Faça upload de múltiplos arquivos JSON (H-2A, H-2B, 790/790A) e processe automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <input
            type="file"
            id="json-files"
            multiple
            accept=".json,.zip"
            onChange={handleFileSelect}
            className="hidden"
          />
          <label htmlFor="json-files" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Clique para selecionar arquivos
            </p>
            <p className="text-xs text-muted-foreground">
              Aceita arquivos .json e .zip
            </p>
          </label>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Arquivos selecionados:</p>
            <div className="space-y-1">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {file.name.endsWith('.zip') ? (
                    <FileArchive className="h-4 w-4 text-orange-500" />
                  ) : (
                    <FileJson className="h-4 w-4 text-primary" />
                  )}
                  <span className="flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  <span className="text-xs font-medium">
                    {detectVisaType(file.name)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Process Button */}
        <Button
          onClick={processJobs}
          disabled={files.length === 0 || processing}
          className="w-full"
        >
          {extracting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Extraindo ZIPs...
            </>
          ) : processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando vagas...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Processar e Importar
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-2">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>{result.success}</strong> vagas importadas com sucesso
              </AlertDescription>
            </Alert>

            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">{result.errors.length} erros encontrados:</p>
                  <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>... e mais {result.errors.length - 10} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p className="font-medium">Como funciona:</p>
          <ul className="space-y-1 ml-4">
            <li>• <strong>Aceita arquivos ZIP e JSON</strong></li>
            <li>• Detecta automaticamente o tipo de visto pelo nome do arquivo:</li>
            <li className="ml-4">→ <code>*_jo*.zip</code> ou <code>*jo.zip</code> → H-2A (Early Access)</li>
            <li className="ml-4">→ <code>*h2a*.zip</code> → H-2A</li>
            <li className="ml-4">→ Outros → H-2B</li>
            <li>• Extrai automaticamente todos os JSONs de dentro do ZIP</li>
            <li>• Unifica campos de diferentes feeds (9142A/B e 790A)</li>
            <li>• Calcula salário horário automaticamente</li>
            <li>• Valida emails e campos obrigatórios</li>
            <li>• <strong>Pode fazer upload de múltiplos ZIPs de uma vez</strong></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
