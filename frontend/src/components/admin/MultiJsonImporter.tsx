import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, FileArchive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

interface ProcessedJob {
  job_id: string;
  visa_type: string;
  company: string;
  email: string;
  job_title: string;
  city: string;
  state: string;
  start_date: string | null; // Agora sempre em YYYY-MM-DD
  end_date: string | null; // Agora sempre em YYYY-MM-DD
  posted_date: string | null;
  fingerprint: string;
  is_active: boolean;
  [key: string]: any;
}

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const { toast } = useToast();

  // --- 1. CONVERSOR DE DATA INTERNACIONAL (ISO 8601) ---
  const formatToISODate = (dateStr: string | null): string | null => {
    if (!dateStr || dateStr === "N/A") return null;

    try {
      // Tenta converter formatos como "01-Apr-2026" ou ISO strings
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;

      // Retorna no formato YYYY-MM-DD (exatamente o que o i18n precisa)
      return date.toISOString().split("T")[0];
    } catch (e) {
      return null;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files).filter((f) => f.name.endsWith(".json") || f.name.endsWith(".zip")));
      setResult(null);
    }
  };

  const generateFingerprint = (fein: string, title: string, city: string, startDate: string): string => {
    return `${fein}|${(title || "").toUpperCase().trim()}|${(city || "").toUpperCase().trim()}|${startDate}`;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      // PASSO 1: Limpeza Total (Opcional, mas garante o Hub limpo)
      await supabase.from("public_jobs").delete().not("job_id", "is", null);

      setExtracting(true);
      const rawProcessedJobs: ProcessedJob[] = [];
      const jsonContents: any[] = [];

      // Extração de ficheiros (Lógica simplificada para brevidade)
      for (const file of files) {
        if (file.name.endsWith(".zip")) {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          for (const [name, f] of Object.entries(contents.files)) {
            if (!f.dir && name.endsWith(".json")) {
              jsonContents.push({
                content: await f.async("string"),
                visaType: file.name.includes("h2a") ? "H-2A" : "H-2B",
              });
            }
          }
        } else {
          jsonContents.push({ content: await file.text(), visaType: file.name.includes("h2a") ? "H-2A" : "H-2B" });
        }
      }
      setExtracting(false);

      for (const jsonFile of jsonContents) {
        const json = JSON.parse(jsonFile.content);
        const jobsList = Array.isArray(json)
          ? json
          : (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

        for (const rawJob of jobsList) {
          const job = rawJob.clearanceOrder ? { ...rawJob, ...rawJob.clearanceOrder } : rawJob;
          const fein = job.empFein;
          const jobTitle = (job.jobTitle || job.job_title || "").trim();

          // --- 2. PADRONIZAÇÃO DAS DATAS ---
          const rawStart = job.jobBeginDate || job.job_begin_date || job.tempneedStart;
          const rawEnd = job.jobEndDate || job.job_end_date || job.tempneedEnd;

          const startDateISO = formatToISODate(rawStart);
          const endDateISO = formatToISODate(rawEnd);
          const email = job.recApplyEmail;

          if (!fein || !jobTitle || !startDateISO || !email || email === "N/A") continue;

          rawProcessedJobs.push({
            job_id: job.caseNumber || job.jobOrderNumber,
            visa_type: jsonFile.visaType,
            company: job.empBusinessName || job.employerBusinessName,
            email,
            job_title: jobTitle,
            city: job.jobCity,
            state: job.jobState,
            start_date: startDateISO, // Salvo como 2026-04-01
            end_date: endDateISO, // Salvo como 2026-12-15
            posted_date: formatToISODate(job.dateAcceptanceLtrIssued),
            fingerprint: generateFingerprint(fein, jobTitle, job.jobCity, startDateISO),
            is_active: true,
          });
        }
      }

      // Deduplicação (H-2A vence JO)
      const finalJobs = Array.from(
        rawProcessedJobs
          .reduce((acc, current) => {
            const existing = acc.get(current.fingerprint);
            if (!existing || (!existing.posted_date && current.posted_date)) acc.set(current.fingerprint, current);
            return acc;
          }, new Map<string, ProcessedJob>())
          .values(),
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.functions.invoke("import-jobs", {
        body: { jobs: finalJobs },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      setResult({ success: finalJobs.length, errors: [] });
      toast({ title: "Sucesso!", description: "Datas padronizadas e Hub limpo." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronizador Internacional</CardTitle>
        <CardDescription>Converte datas para ISO (YYYY-MM-DD) para suporte multilingue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input type="file" multiple onChange={handleFileSelect} />
        <Button onClick={processJobs} disabled={processing || files.length === 0} className="w-full">
          {processing ? <Loader2 className="animate-spin" /> : "Limpar e Importar com Datas ISO"}
        </Button>
      </CardContent>
    </Card>
  );
}
