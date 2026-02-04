import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

interface ProcessedJob {
  // Identificação e Controlo
  job_id: string;
  visa_type: string;
  fingerprint: string;
  is_active: boolean;
  company: string;
  email: string;
  job_title: string;
  crop_activities?: string;

  // Datas Internacionais (YYYY-MM-DD)
  start_date: string | null;
  end_date: string | null;
  posted_date: string | null;

  // Localização
  city: string;
  state: string;
  worksite_address?: string;
  worksite_zip?: string;

  // 💰 Remuneração Detalhada
  wage_from: number | null;
  wage_to: number | null;
  wage_unit: string;
  overtime_available: boolean;
  overtime_from: number | null;
  overtime_to: number | null;

  // 🏋️ Requisitos Físicos e Testes
  job_is_lifting: boolean;
  job_lifting_weight?: string;
  job_is_bending: boolean;
  job_is_repetitive: boolean;
  job_is_drug_screen: boolean;
  job_is_background: boolean;

  // 🏠 Moradia e Alimentação
  housing_type?: string;
  housing_capacity?: number;
  is_meal_provision: boolean;
  meal_charge?: number;

  // Outros Detalhes
  openings: number | null;
  weekly_hours: number | null;
  job_duties?: string;
  [key: string]: any;
}

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; totalRemoved: number } | null>(null);
  const { toast } = useToast();

  // Conversor para formato internacional ISO 8601 (YYYY-MM-DD)
  const formatToISODate = (dateStr: string | null): string | null => {
    if (!dateStr || dateStr === "N/A") return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files).filter((f) => f.name.endsWith(".json") || f.name.endsWith(".zip")));
      setResult(null);
    }
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      // --- PASSO 1: LIMPEZA TOTAL (TABULA RASA) ---
      // Removemos tudo para garantir que não haja conflitos de chaves antigas
      const { error: deleteError, count } = await supabase.from("public_jobs").delete().neq("job_id", "clean_trigger");

      // --- PASSO 2: PROCESSAMENTO DE FICHEIROS ---
      const rawProcessedJobs: ProcessedJob[] = [];
      const jsonContents: any[] = [];

      for (const file of files) {
        if (file.name.endsWith(".zip")) {
          const zip = await new JSZip().loadAsync(file);
          for (const [name, f] of Object.entries(zip.files)) {
            if (!f.dir && name.endsWith(".json")) {
              jsonContents.push({
                content: await f.async("string"),
                visaType: name.toLowerCase().includes("jo") ? "H-2A (Early Access)" : "H-2A",
              });
            }
          }
        } else {
          jsonContents.push({
            content: await file.text(),
            visaType: file.name.toLowerCase().includes("jo") ? "H-2A (Early Access)" : "H-2A",
          });
        }
      }

      for (const jsonFile of jsonContents) {
        const json = JSON.parse(jsonFile.content);
        const jobsList = Array.isArray(json)
          ? json
          : (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

        for (const rawJob of jobsList) {
          // Normaliza o objeto se ele vier dentro de clearanceOrder
          const job = rawJob.clearanceOrder ? { ...rawJob, ...rawJob.clearanceOrder } : rawJob;

          const fein = job.empFein;
          const jobTitle = (job.jobTitle || job.job_title || "").trim();
          const startDate = formatToISODate(job.jobBeginDate || job.job_begin_date || job.tempneedStart);
          const email = job.recApplyEmail || job.emppocEmail;

          // Validação mínima de integridade
          if (!fein || !jobTitle || !startDate || !email || email === "N/A") continue;

          rawProcessedJobs.push({
            job_id: job.caseNumber || job.jobOrderNumber,
            visa_type: jsonFile.visaType,
            fingerprint: `${fein}|${jobTitle.toUpperCase()}|${startDate}`,
            is_active: true,
            company: job.empBusinessName || job.employerBusinessName,
            email: email,
            job_title: jobTitle,
            city: job.jobCity,
            state: job.jobState,
            worksite_address: job.jobAddr1,
            worksite_zip: job.jobPostcode,
            start_date: startDate,
            end_date: formatToISODate(job.jobEndDate || job.job_end_date),
            posted_date: formatToISODate(job.dateAcceptanceLtrIssued),

            // 💰 Remuneração e Overtime
            wage_from: parseFloat(job.jobWageOffer || job.wageOfferFrom) || null,
            wage_to: parseFloat(job.jobWageTo || job.wageOfferTo) || null,
            wage_unit: job.jobWagePer || "Hour",
            overtime_available: job.isOvertimeAvailable === 1 || job.isOvertimeAvailable === true,
            overtime_from: parseFloat(job.overtimeWageFrom) || null,
            overtime_to: parseFloat(job.overtimeWageTo) || null,

            // 🏋️ Requisitos Físicos
            job_is_lifting: job.jobIsLifting === 1,
            job_lifting_weight: job.jobLiftingWeight,
            job_is_bending: job.jobIsBending === 1,
            job_is_repetitive: job.jobIsRepetitive === 1,
            job_is_drug_screen: job.jobIsDrugScreen === 1,
            job_is_background: job.jobIsBackground === 1,

            // 🏠 Moradia e Alimentação
            housing_type: job.housingType,
            housing_capacity: parseInt(job.housingTotalOccupy) || null,
            is_meal_provision: job.isMealProvision === 1,
            meal_charge: parseFloat(job.mealCharge) || null,

            // Outros Detalhes
            crop_activities: job.cropsAndActivities
              ? job.cropsAndActivities.map((c: any) => c.addmaCropActivity).join(", ")
              : "",
            openings: parseInt(job.jobWrksNeeded || job.totalWorkersNeeded) || null,
            weekly_hours: parseFloat(job.jobHoursTotal) || null,
            job_duties: job.jobDuties || job.job_duties,
          });
        }
      }

      // --- PASSO 3: DEDUPLICAÇÃO POR FINGERPRINT ---
      const finalJobs = Array.from(
        rawProcessedJobs
          .reduce((acc, current) => {
            const existing = acc.get(current.fingerprint);
            // Prioriza a vaga Certificada (H-2A) sobre a Early Access (JO)
            if (!existing || (!existing.posted_date && current.posted_date)) {
              acc.set(current.fingerprint, current);
            }
            return acc;
          }, new Map<string, ProcessedJob>())
          .values(),
      );

      // --- PASSO 4: ENVIO PARA O SUPABASE ---
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { error: importError } = await supabase.functions.invoke("import-jobs", {
        body: { jobs: finalJobs },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (importError) throw importError;

      setResult({ success: finalJobs.length, totalRemoved: count || 0 });
      toast({
        title: "Sincronização Completa",
        description: "O Hub foi limpo e os dados internacionais foram importados.",
      });
    } catch (err: any) {
      toast({ title: "Erro Crítico", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-2xl border-primary/20">
      <CardHeader className="bg-primary/5 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <FileJson className="h-7 w-7 text-primary" /> Data Engine H2 Linker
            </CardTitle>
            <CardDescription className="text-base">
              Limpeza total e importação massiva com suporte i18n e salários detalhados.
            </CardDescription>
          </div>
          <div className="bg-blue-100 p-3 rounded-full">
            <Info className="text-blue-600 h-6 w-6" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="border-3 border-dashed border-primary/20 rounded-2xl p-12 text-center hover:bg-primary/5 transition-all cursor-pointer relative">
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Upload className="h-14 w-14 mx-auto mb-4 text-primary/40" />
          <p className="text-lg font-semibold text-primary/80">Solte os seus ZIPs ou ficheiros JSON aqui</p>
          <p className="text-sm text-muted-foreground mt-2">
            Os dados serão convertidos para o padrão internacional automaticamente.
          </p>
        </div>

        {files.length > 0 && (
          <div className="bg-secondary/20 p-4 rounded-xl space-y-2">
            <p className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Ficheiros Selecionados:</p>
            {files.map((f, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-primary/5 last:border-0">
                <span className="truncate max-w-[200px]">{f.name}</span>
                <span className="font-mono text-primary">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full py-8 text-xl font-black shadow-lg hover:shadow-primary/20 transition-all uppercase tracking-tighter"
        >
          {processing ? (
            <>
              <Loader2 className="animate-spin mr-3 h-6 w-6" /> A Processar Dados...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-3 h-6 w-6" /> Limpar Hub e Iniciar Importação
            </>
          )}
        </Button>

        {result && (
          <Alert className="bg-green-500/10 border-green-500/50 animate-in zoom-in-95 duration-300">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-800 text-lg">
              <strong>Sucesso!</strong> Foram removidas {result.totalRemoved} vagas antigas e importadas{" "}
              <strong>{result.success}</strong> novas vagas com dados completos.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
