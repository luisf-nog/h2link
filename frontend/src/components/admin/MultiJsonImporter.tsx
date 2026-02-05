import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileJson, CheckCircle2, Loader2, Database, ShieldAlert } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, skipped: 0 });
  const { toast } = useToast();

  const getVal = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "N/A" && obj[key] !== "") {
        return obj[key];
      }
    }
    return null;
  };

  const formatToISODate = (dateStr: any) => {
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
    let skippedCount = 0;

    try {
      await supabase.from("public_jobs").delete().neq("job_id", "clean_all");

      const rawJobsMap = new Map();

      for (const file of files) {
        const isZip = file.name.endsWith(".zip");
        const zip = isZip ? await new JSZip().loadAsync(file) : null;
        const entries = isZip ? Object.entries(zip!.files) : [[file.name, file]];

        for (const [filename, f] of entries) {
          if (!filename.endsWith(".json")) continue;

          const content = isZip ? await (f as any).async("string") : await (f as File).text();
          const json = JSON.parse(content);
          const list = Array.isArray(json) ? json : (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;

            // --- BLOCO DE VALIDAÇÃO DE INTEGRIDADE ---
            // Extraímos os campos CRÍTICOS primeiro
            const fein = getVal(flat, ["empFein", "employer_fein", "fein"]);
            const title = getVal(flat, ["jobTitle", "job_title", "tempneedJobtitle"]);
            const start = formatToISODate(getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart"]));
            const city = getVal(flat, ["jobCity", "job_city", "worksite_city"]);
            const state = getVal(flat, ["jobState", "job_state", "worksite_state"]);

            // CORREÇÃO AQUI: Extraímos e validamos o E-mail e Empresa AGORA
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail"]);
            const company = getVal(flat, ["empBusinessName", "employerBusinessName", "legalName"]);

            // Se faltar qualquer um desses dados vitais, pulamos a vaga para não quebrar o banco
            if (!fein || !title || !start || !city || !state || !email || !company) {
              skippedCount++;
              continue;
            }
            // ------------------------------------------

            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;

            const extractedJob = {
              job_id: getVal(flat, ["caseNumber", "jobOrderNumber", "clearanceOrderNumber"]) || `GEN-${Math.random()}`,
              visa_type: visaType,
              fingerprint,
              is_active: true,

              job_title: title,
              company: company,
              email: email, // Agora garantido que não é nulo

              city: city,
              state: state,
              zip: getVal(flat, ["jobPostcode", "worksite_zip"]),
              worksite_address: getVal(flat, ["jobAddr1", "worksite_address"]),

              phone: getVal(flat, ["recApplyPhone", "emppocPhone"]),
              website: getVal(flat, ["recApplyUrl", "employerWebsite"]),

              start_date: start,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd"])),
              posted_date: formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "posted_date", "dateSubmitted"])),

              wage_from: parseFloat(getVal(flat, ["jobWageOffer", "wageOfferFrom", "tempneedWageoffer"])) || null,
              wage_to: parseFloat(getVal(flat, ["jobWageTo", "wageOfferTo", "tempneedWageto"])) || null,
              wage_unit: getVal(flat, ["jobWagePer", "wage_unit", "tempneedWageper"]) || "Hour",
              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),
              overtime_available:
                getVal(flat, ["isOvertimeAvailable", "ot_available"]) === 1 || flat.isOvertimeAvailable === true,
              overtime_from: parseFloat(getVal(flat, ["overtimeWageFrom", "ot_wage_from"])) || null,
              overtime_to: parseFloat(getVal(flat, ["overtimeWageTo", "ot_wage_to"])) || null,

              transport_min_reimburse: parseFloat(getVal(flat, ["transportMinreimburse"])) || null,
              transport_max_reimburse: parseFloat(getVal(flat, ["transportMaxreimburse"])) || null,
              transport_desc: getVal(flat, ["transportDescEmp", "transportDescDaily"]),

              housing_type: getVal(flat, ["housingType", "housing_type"]),
              housing_addr: getVal(flat, ["housingAddr1"]),
              housing_city: getVal(flat, ["housingCity"]),
              housing_state: getVal(flat, ["housingState"]),
              housing_zip: getVal(flat, ["housingPostcode"]),
              housing_capacity: parseInt(getVal(flat, ["housingTotalOccupy", "housing_capacity"])) || null,
              is_meal_provision: getVal(flat, ["isMealProvision"]) === 1,
              meal_charge: parseFloat(getVal(flat, ["mealCharge"])) || null,

              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,
              training_months: parseInt(getVal(flat, ["jobMintrainingmonths"])) || null,

              // Booleanos seguros
              job_is_lifting: getVal(flat, ["jobIsLifting"]) === 1,
              job_lifting_weight: getVal(flat, ["jobLiftingWeight"]),
              job_is_drug_screen: getVal(flat, ["jobIsDrugScreen"]) === 1,
              job_is_background: getVal(flat, ["jobIsBackground"]) === 1,
              job_is_driver: getVal(flat, ["jobIsDriver"]) === 1,

              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "totalWorkersNeeded"])) || null,
              shift_start: getVal(flat, ["jobHoursStart"]),
              shift_end: getVal(flat, ["jobHoursEnd"]),

              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription"]),
              crop_activities: flat.cropsAndActivities
                ? flat.cropsAndActivities.map((c: any) => c.addmaCropActivity).join(", ")
                : getVal(flat, ["crops", "crop_activities"]),
              openings: parseInt(getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos"])) || null,
            };

            const existing = rawJobsMap.get(fingerprint);
            if (!existing || (!existing.posted_date && extractedJob.posted_date)) {
              rawJobsMap.set(fingerprint, extractedJob);
            }
          }
        }
      }

      const finalJobs = Array.from(rawJobsMap.values());

      const BATCH_SIZE = 500;
      for (let i = 0; i < finalJobs.length; i += BATCH_SIZE) {
        const batch = finalJobs.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.functions.invoke("import-jobs", {
          body: { jobs: batch },
        });
        if (error) throw error;
      }

      setStats({ total: finalJobs.length, skipped: skippedCount });
      toast({
        title: "Importação Concluída com Sucesso!",
        description: `${finalJobs.length} vagas importadas. ${skippedCount} incompletas foram ignoradas.`,
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader className="bg-slate-50">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Database className="h-6 w-6 text-primary" /> Extrator Data Miner V3 (Blindado)
        </CardTitle>
        <CardDescription>Filtra automaticamente vagas sem e-mail ou empresa para garantir integridade.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="border-dashed border-2 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-white transition-colors">
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full" />
          <p className="mt-2 text-sm text-slate-500">Aceita JSON e ZIP</p>
        </div>

        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full mt-4 h-12 text-lg font-bold"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
          Importar (Ignorar Incompletos)
        </Button>

        {stats.total > 0 && (
          <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-bold">Processo Finalizado</p>
              <p className="text-sm">
                Vagas válidas: {stats.total} | Ignoradas (sem email/dados): {stats.skipped}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
