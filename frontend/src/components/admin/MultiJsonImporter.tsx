import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileJson, CheckCircle2, Loader2 } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  // Função para unificar campos que mudam de nome entre H2A, H2B e JO
  const unifyField = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "N/A" && obj[key] !== "") {
        return obj[key];
      }
    }
    return null;
  };

  const formatToISODate = (dateStr: any): string | null => {
    if (!dateStr || dateStr === "N/A") return null;
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      // RESET TOTAL DO HUB
      await supabase.from("public_jobs").delete().not("job_id", "is", null);

      const rawProcessedJobs: any[] = [];

      for (const file of files) {
        const isZip = file.name.endsWith(".zip");
        const contents = isZip ? await new JSZip().loadAsync(file) : { [file.name]: file };
        const fileEntries = isZip ? Object.entries((contents as JSZip).files) : [[file.name, file]];

        for (const [name, f] of fileEntries) {
          if (name.endsWith(".json")) {
            const content = isZip ? await (f as JSZip.JSZipObject).async("string") : await (f as File).text();
            const json = JSON.parse(content);
            const jobsList = Array.isArray(json)
              ? json
              : (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

            // Detecção robusta do tipo de visto baseado no nome do ficheiro
            const fileNameLower = name.toLowerCase();
            let detectedVisa = "H-2A";
            if (fileNameLower.includes("h2b")) detectedVisa = "H-2B";
            else if (fileNameLower.includes("jo")) detectedVisa = "H-2A (Early Access)";

            for (const rawJob of jobsList) {
              // NORMALIZAÇÃO: H2A/H2B trazem dados dentro de clearanceOrder. JO traz na raiz.
              const job = rawJob.clearanceOrder ? { ...rawJob, ...rawJob.clearanceOrder } : rawJob;

              const fein = unifyField(job, ["empFein", "employer_fein", "fein"]);
              const title = unifyField(job, ["jobTitle", "job_title", "tempneedJobtitle"]);
              const start = formatToISODate(unifyField(job, ["jobBeginDate", "job_begin_date", "tempneedStart"]));
              const email = unifyField(job, ["recApplyEmail", "emppocEmail", "emppocAddEmail"]);

              if (!fein || !title || !start || !email) continue;

              rawProcessedJobs.push({
                job_id: unifyField(job, ["caseNumber", "jobOrderNumber", "clearanceOrderNumber"]),
                visa_type: detectedVisa,
                fingerprint: `${fein}|${title.toUpperCase()}|${start}`,
                is_active: true,
                company: unifyField(job, ["empBusinessName", "employerBusinessName", "legalName"]),
                email: email,
                job_title: title,
                city: unifyField(job, ["jobCity", "job_city", "worksite_city"]),
                state: unifyField(job, ["jobState", "job_state", "worksite_state"]),
                start_date: start,
                end_date: formatToISODate(unifyField(job, ["jobEndDate", "job_end_date", "tempneedEnd"])),
                posted_date: formatToISODate(unifyField(job, ["dateAcceptanceLtrIssued", "posted_date"])),

                // Remuneração (Pega o valor de H2A, H2B ou a lógica de 'tempneed' do JO)
                wage_from: parseFloat(unifyField(job, ["jobWageOffer", "wageOfferFrom", "tempneedWageoffer"])),
                wage_to: parseFloat(unifyField(job, ["jobWageTo", "wageOfferTo", "tempneedWageto"])),
                wage_unit: unifyField(job, ["jobWagePer", "wage_unit", "tempneedWageper"]) || "Hour",

                // Horas Extras
                overtime_available:
                  unifyField(job, ["isOvertimeAvailable", "ot_available"]) === 1 || job.isOvertimeAvailable === true,
                overtime_from: parseFloat(unifyField(job, ["overtimeWageFrom", "ot_wage_from"])),

                // Requisitos (Booleans mapeados de 0/1 para true/false)
                job_is_lifting: unifyField(job, ["jobIsLifting", "is_lifting"]) == 1,
                job_lifting_weight: unifyField(job, ["jobLiftingWeight", "lifting_weight"]),
                job_is_drug_screen: unifyField(job, ["jobIsDrugScreen", "is_drug_screen"]) == 1,

                // Moradia
                housing_type: unifyField(job, ["housingType", "housing_type"]),
                housing_capacity: parseInt(unifyField(job, ["housingTotalOccupy", "housing_capacity"])),

                // Detalhes extras
                openings: parseInt(unifyField(job, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos"])),
                crop_activities: job.cropsAndActivities
                  ? job.cropsAndActivities.map((c: any) => c.addmaCropActivity).join(", ")
                  : "",
              });
            }
          }
        }
      }

      // DEDUPLICAÇÃO (H-2A Oficial > Early Access)
      const finalJobs = Array.from(
        rawProcessedJobs
          .reduce((acc, current) => {
            const existing = acc.get(current.fingerprint);
            if (!existing || (!existing.posted_date && current.posted_date)) acc.set(current.fingerprint, current);
            return acc;
          }, new Map())
          .values(),
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.functions.invoke("import-jobs", {
        body: { jobs: finalJobs },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      toast({ title: "Sincronização Total!", description: `${finalJobs.length} vagas mapeadas e importadas.` });
    } catch (err: any) {
      toast({ title: "Erro de Estrutura", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-6 w-6 text-primary" /> Mapeador Universal DOL
        </CardTitle>
        <CardDescription>Suporte nativo para estruturas H-2A, H-2B e Early Access (JO).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full p-2 border rounded-md"
        />
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full py-6 font-bold uppercase"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
          Limpar Hub e Sincronizar Tudo
        </Button>
      </CardContent>
    </Card>
  );
}
