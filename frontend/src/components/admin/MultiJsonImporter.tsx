import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, FileArchive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

interface ProcessedJob {
  visa_type: string;
  job_id: string;
  fingerprint: string; // Chave única para evitar duplicatas
  company: string;
  email: string;
  job_title: string;
  category?: string;
  city: string;
  state: string;
  openings?: number | null;
  salary?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  job_duties?: string;
  weekly_hours?: number | null;
  posted_date_raw?: string | null; // Usado para lógica de prioridade
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
        (f) => f.name.endsWith(".json") || f.name.endsWith(".zip"),
      );
      setFiles(selectedFiles);
      setResult(null);
    }
  };

  const detectVisaType = (filename: string): string => {
    const lowerName = filename.toLowerCase();
    if (lowerName.includes("_jo") || lowerName.includes("jo.")) {
      return "H-2A (Early Access)";
    } else if (lowerName.includes("h2a")) {
      return "H-2A";
    }
    return "H-2B";
  };

  // Função para gerar a "Digital da Vaga" (Fingerprint)
  const generateFingerprint = (fein: string, title: string, city: string, startDate: string): string => {
    const cleanTitle = (title || "").toUpperCase().trim();
    const cleanCity = (city || "").toUpperCase().trim();
    return `${fein}|${cleanTitle}|${cleanCity}|${startDate}`;
  };

  const extractZipFiles = async (
    zipFile: File,
  ): Promise<Array<{ name: string; content: string; visaType: string }>> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const jsonFiles: Array<{ name: string; content: string; visaType: string }> = [];
    const zipVisaType = detectVisaType(zipFile.name);

    for (const [filename, file] of Object.entries(contents.files)) {
      if (!file.dir && filename.endsWith(".json")) {
        const content = await file.async("string");
        jsonFiles.push({
          name: filename,
          content,
          visaType: zipVisaType,
        });
      }
    }
    return jsonFiles;
  };

  const extractJobsList = (content: any): any[] => {
    if (Array.isArray(content)) return content;
    if (typeof content === "object" && content !== null) {
      const values = Object.values(content);
      const lists = values.filter((v) => Array.isArray(v));
      if (lists.length > 0) return lists[0] as any[];
    }
    return [];
  };

  const flattenH2A = (record: any): any => {
    if (record.clearanceOrder && typeof record.clearanceOrder === "object") {
      return { ...record, ...record.clearanceOrder };
    }
    return record;
  };

  const unifyField = (...values: any[]): any => {
    for (const val of values) {
      if (val !== null && val !== undefined && val !== "N/A") return val;
    }
    return null;
  };

  const calculateHourlySalary = (rawWage: any, weeklyHours: any): number | null => {
    const wage = typeof rawWage === "string" ? parseFloat(rawWage) : rawWage;
    const hours = typeof weeklyHours === "string" ? parseFloat(weeklyHours) : weeklyHours;

    if (!wage) return null;
    if (wage <= 100) return wage;

    if (hours && hours > 0) {
      const hourly = wage / (hours * 4.333);
      if (hourly >= 7.25 && hourly <= 80) return Math.round(hourly * 100) / 100;
    }
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setExtracting(true);
    setResult(null);

    try {
      let rawProcessedJobs: ProcessedJob[] = [];
      const errors: string[] = [];
      const jsonContents: Array<{ name: string; content: string; visaType: string }> = [];

      for (const file of files) {
        if (file.name.endsWith(".zip")) {
          const extracted = await extractZipFiles(file);
          jsonContents.push(...extracted);
        } else {
          const content = await file.text();
          jsonContents.push({
            name: file.name,
            content,
            visaType: detectVisaType(file.name),
          });
        }
      }

      setExtracting(false);

      for (const jsonFile of jsonContents) {
        try {
          const json = JSON.parse(jsonFile.content);
          const jobsList = extractJobsList(json);

          for (const rawJob of jobsList) {
            try {
              const job = flattenH2A(rawJob);

              // Extração de campos para Fingerprint
              const fein = job.empFein;
              const jobTitle = unifyField(job.job_title, job.jobTitle, job.tempneedJobtitle);
              const city = job.jobCity;
              const startDate = unifyField(job.job_begin_date, job.jobBeginDate, job.tempneedStart);
              const email = unifyField(job.recApplyEmail);
              const company = unifyField(job.employerBusinessName, job.empBusinessName);

              if (!fein || !jobTitle || !startDate || !email || email === "N/A") continue;

              const fingerprint = generateFingerprint(fein, jobTitle, city, startDate);
              const postedDate = job.dateAcceptanceLtrIssued;

              const processedJob: ProcessedJob = {
                visa_type: jsonFile.visaType,
                job_id: job.caseNumber || job.jobOrderNumber, // ID original (H- ou JO-A-)
                fingerprint,
                company,
                email,
                job_title: jobTitle,
                category: unifyField(job.socTitle, job.jobSocTitle, job.tempneedSocTitle),
                city,
                state: job.jobState,
                openings: parseInt(unifyField(job.totalWorkersNeeded, job.jobWrksNeeded, job.tempneedWkrPos)) || null,
                salary: calculateHourlySalary(
                  unifyField(job.wageOfferFrom, job.jobWageOffer, job.wageFrom),
                  job.jobHoursTotal,
                ),
                start_date: startDate,
                end_date: unifyField(job.job_end_date, job.jobEndDate, job.tempneedEnd),
                posted_date_raw: postedDate, // Essencial para a prioridade
                source_url: job.recApplyUrl,
                phone: job.recApplyPhone,
                weekly_hours: job.jobHoursTotal,
                job_duties: unifyField(job.job_duties, job.jobDuties, job.tempneedDescription),
              };

              rawProcessedJobs.push(processedJob);
            } catch (err) {
              errors.push(`${jsonFile.name}: Erro na vaga - ${err}`);
            }
          }
        } catch (err) {
          errors.push(`${jsonFile.name}: Erro de leitura - ${err}`);
        }
      }

      // --- LÓGICA DE DEDUPLICAÇÃO CLIENT-SIDE ---
      // 1. Agrupar por fingerprint
      const jobGroups = new Map<string, ProcessedJob[]>();
      rawProcessedJobs.forEach((job) => {
        const group = jobGroups.get(job.fingerprint) || [];
        group.push(job);
        jobGroups.set(job.fingerprint, group);
      });

      // 2. Escolher a melhor versão de cada vaga (Prioriza quem tem posted_date_raw / Certificada)
      const finalJobs = Array.from(jobGroups.values()).map((group) => {
        return group.sort((a, b) => {
          const aPriority = a.posted_date_raw ? 1 : 2;
          const bPriority = b.posted_date_raw ? 1 : 2;
          return aPriority - bPriority;
        })[0];
      });

      if (finalJobs.length === 0) throw new Error("Nenhuma vaga válida encontrada.");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");

      // Envia apenas as vagas únicas e priorizadas para o Supabase
      const { error } = await supabase.functions.invoke("import-jobs", {
        body: { jobs: finalJobs },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw new Error(error.message);

      setResult({ success: finalJobs.length, errors });
      toast({ title: "Importação concluída!", description: `${finalJobs.length} vagas únicas processadas.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Importador Inteligente H2 Linker
        </CardTitle>
        <CardDescription>Unificação automática de Early Access e H-2A Oficiais via Fingerprint</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input de arquivos idêntico ao original */}
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
            <p className="text-sm font-medium">Selecione arquivos .json ou .zip</p>
          </label>
        </div>

        {/* Lista de arquivos selecionados */}
        {files.length > 0 && (
          <div className="text-sm space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex justify-between">
                <span>{f.name}</span>
                <span className="font-bold">{detectVisaType(f.name)}</span>
              </div>
            ))}
          </div>
        )}

        <Button onClick={processJobs} disabled={files.length === 0 || processing} className="w-full">
          {processing ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
          Processar e Unificar Vagas
        </Button>

        {result && (
          <Alert className={result.errors.length > 0 ? "border-orange-500" : ""}>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>{result.success}</strong> vagas únicas importadas. (Vagas duplicadas foram unificadas
              automaticamente)
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
