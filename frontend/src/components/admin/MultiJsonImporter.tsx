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
  fingerprint: string;
  is_active: boolean;
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
  posted_date?: string | null;
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
    if (lowerName.includes("_jo") || lowerName.includes("jo.")) return "H-2A (Early Access)";
    if (lowerName.includes("h2a")) return "H-2A";
    return "H-2B";
  };

  const generateFingerprint = (fein: string, title: string, city: string, startDate: string): string => {
    return `${fein}|${(title || "").toUpperCase().trim()}|${(city || "").toUpperCase().trim()}|${startDate}`;
  };

  const extractZipFiles = async (zipFile: File) => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const jsonFiles: any[] = [];
    const zipVisaType = detectVisaType(zipFile.name);

    for (const [filename, file] of Object.entries(contents.files)) {
      if (!file.dir && filename.endsWith(".json")) {
        const content = await file.async("string");
        jsonFiles.push({ name: filename, content, visaType: zipVisaType });
      }
    }
    return jsonFiles;
  };

  const unifyField = (...values: any[]) => values.find((v) => v !== null && v !== undefined && v !== "N/A") || null;

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setResult(null);

    try {
      // --- PASSO 1: LIMPEZA (MARK) ---
      // Desativa todas as vagas antes da nova importação para limpar "vagas fantasmas"
      const { error: resetError } = await supabase
        .from("public_jobs")
        .update({ is_active: false })
        .neq("job_id", "clean_all_records");

      if (resetError) console.error("Aviso: Falha ao resetar status is_active");

      // --- PASSO 2: PROCESSAMENTO ---
      setExtracting(true);
      const rawProcessedJobs: ProcessedJob[] = [];
      const errors: string[] = [];
      const jsonContents: any[] = [];

      for (const file of files) {
        if (file.name.endsWith(".zip")) {
          const extracted = await extractZipFiles(file);
          jsonContents.push(...extracted);
        } else {
          jsonContents.push({ name: file.name, content: await file.text(), visaType: detectVisaType(file.name) });
        }
      }
      setExtracting(false);

      for (const jsonFile of jsonContents) {
        try {
          const json = JSON.parse(jsonFile.content);
          const jobsList = Array.isArray(json)
            ? json
            : (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

          for (const rawJob of jobsList) {
            const job = rawJob.clearanceOrder ? { ...rawJob, ...rawJob.clearanceOrder } : rawJob;
            const fein = job.empFein;
            const jobTitle = unifyField(job.job_title, job.jobTitle, job.tempneedJobtitle);
            const startDate = unifyField(job.job_begin_date, job.jobBeginDate, job.tempneedStart);
            const email = unifyField(job.recApplyEmail);

            if (!fein || !jobTitle || !startDate || !email || email === "N/A") continue;

            rawProcessedJobs.push({
              visa_type: jsonFile.visaType,
              job_id: job.caseNumber || job.jobOrderNumber,
              fingerprint: generateFingerprint(fein, jobTitle, job.jobCity, startDate),
              is_active: true, // REATIVA A VAGA (SWEEP)
              company: unifyField(job.employerBusinessName, job.empBusinessName),
              email,
              job_title: jobTitle,
              category: unifyField(job.socTitle, job.jobSocTitle, job.tempneedSocTitle),
              city: job.jobCity,
              state: job.jobState,
              openings: parseInt(unifyField(job.totalWorkersNeeded, job.jobWrksNeeded, job.tempneedWkrPos)) || null,
              start_date: startDate,
              end_date: unifyField(job.job_end_date, job.jobEndDate, job.tempneedEnd),
              posted_date: job.dateAcceptanceLtrIssued,
              source_url: job.recApplyUrl,
              phone: job.recApplyPhone,
            });
          }
        } catch (e) {
          errors.push(`Erro no ficheiro ${jsonFile.name}`);
        }
      }

      // --- PASSO 3: DEDUPLICAÇÃO E PRIORIDADE ---
      const finalJobs = Array.from(
        rawProcessedJobs
          .reduce((acc, current) => {
            const existing = acc.get(current.fingerprint);
            // Se houver duplicata, a versão com posted_date (Certificada) substitui a Early Access
            if (!existing || (!existing.posted_date && current.posted_date)) {
              acc.set(current.fingerprint, current);
            }
            return acc;
          }, new Map<string, ProcessedJob>())
          .values(),
      );

      // --- PASSO 4: UPSERT FINAL ---
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { error: importError } = await supabase.functions.invoke("import-jobs", {
        body: { jobs: finalJobs },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (importError) throw new Error(importError.message);

      setResult({ success: finalJobs.length, errors });
      toast({ title: "Importação Concluída", description: `${finalJobs.length} vagas únicas ativadas.` });
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
          <Upload className="h-5 w-5" /> Importador Inteligente H2 Linker
        </CardTitle>
        <CardDescription>Sincronização completa: remove duplicatas e desativa vagas obsoletas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <input type="file" id="files" multiple accept=".json,.zip" onChange={handleFileSelect} className="hidden" />
          <label htmlFor="files" className="cursor-pointer">
            <Loader2 className={`h-12 w-12 mx-auto mb-2 ${extracting ? "animate-spin" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium">Arraste ou selecione ficheiros JSON/ZIP</p>
          </label>
        </div>

        {files.length > 0 && (
          <div className="text-xs space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex justify-between">
                <span>{f.name}</span>
                <strong>{detectVisaType(f.name)}</strong>
              </div>
            ))}
          </div>
        )}

        <Button onClick={processJobs} disabled={files.length === 0 || processing} className="w-full">
          {processing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
          Sincronizar Hub de Vagas
        </Button>

        {result && (
          <Alert className="mt-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>{result.success}</strong> vagas ativas. O excesso de {10000 - result.success} registros antigos
              foi desativado.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
