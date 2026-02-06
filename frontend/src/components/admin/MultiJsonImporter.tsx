import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Database, AlertTriangle } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, skipped: 0 });
  const { toast } = useToast();

  const getVal = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "N/A" && obj[key] !== "" && obj[key] !== "n/a") {
        return obj[key];
      }
    }
    return null;
  };

  const parseMoney = (obj: any, keys: string[]): number | null => {
    const val = getVal(obj, keys);
    if (!val) return null;
    const clean = String(val).replace(/[$,]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) || num === 0 ? null : num;
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
      const rawJobsMap = new Map();

      for (const file of files) {
        const isZip = file.name.endsWith(".zip");
        let contents: { filename: string; content: string }[] = [];

        if (isZip) {
          const zip = await new JSZip().loadAsync(file);
          const entries = Object.entries(zip.files);
          for (const [filename, zipObj] of entries) {
            if (!zipObj.dir && filename.endsWith(".json")) {
              const text = await zipObj.async("string");
              contents.push({ filename, content: text });
            }
          }
        } else {
          const text = await file.text();
          contents.push({ filename: file.name, content: text });
        }

        for (const { filename, content } of contents) {
          const json = JSON.parse(content);
          const list = Array.isArray(json) ? json : (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;

            // --- VALIDAÇÃO DE INTEGRIDADE (CORRIGIDA) ---
            const fein = getVal(flat, ["empFein", "employer_fein", "fein", "employerFein"]);
            const title = getVal(flat, ["jobTitle", "job_title", "tempneedJobtitle"]);
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "beginDate"]),
            );

            // CORREÇÃO: O banco exige e-mail (NOT NULL). Se não tiver, pula.
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail", "contactEmail"]);
            const company = getVal(flat, ["empBusinessName", "employerBusinessName", "legalName", "employerName"]);

            if (!fein || !title || !start || !email || !company) {
              skippedCount++;
              continue; // Ignora silenciosamente a vaga incompleta
            }

            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;

            // Extração de Salários
            const wageFrom = parseMoney(flat, [
              "wageFrom",
              "jobWageOffer",
              "wageOfferFrom",
              "BASIC_WAGE_RATE",
              "tempneedWageoffer",
            ]);
            const wageTo = parseMoney(flat, ["wageTo", "jobWageTo", "wageOfferTo", "WAGE_OFFER_TO", "tempneedWageto"]);
            const wageOt = parseMoney(flat, ["wageOtFrom", "overtimeWageFrom", "ot_wage_from"]);

            const extractedJob = {
              job_id: getVal(flat, ["caseNumber", "jobOrderNumber", "clearanceOrderNumber"]) || `GEN-${Math.random()}`,
              visa_type: visaType,
              fingerprint,
              is_active: true,

              job_title: title,
              company: company,
              email: email, // Agora garantido que existe

              city: getVal(flat, ["jobCity", "job_city", "worksite_city", "empCity"]),
              state: getVal(flat, ["jobState", "job_state", "worksite_state", "empState"]),
              zip: getVal(flat, ["jobPostcode", "worksite_zip", "empPostcode"]),
              worksite_address: getVal(flat, ["jobAddr1", "worksite_address", "empAddr1"]),

              phone: getVal(flat, ["recApplyPhone", "emppocPhone", "employerPhone"]),
              website: getVal(flat, ["recApplyUrl", "employerWebsite", "rec_url"]),

              start_date: start,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd"])),
              posted_date: formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "posted_date", "dateSubmitted"])),

              wage_from: wageFrom,
              wage_to: wageTo,
              wage_unit: getVal(flat, ["jobWagePer", "wage_unit", "wagePer", "payUnit"]) || "Hour",
              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),

              overtime_available:
                getVal(flat, ["isOvertimeAvailable", "ot_available", "recIsOtAvailable"]) === 1 ||
                flat.recIsOtAvailable === true ||
                !!wageOt,
              overtime_from: wageOt,
              overtime_to: parseMoney(flat, ["wageOtTo", "overtimeWageTo"]),

              transport_min_reimburse: parseMoney(flat, ["transportMinreimburse"]),
              transport_max_reimburse: parseMoney(flat, ["transportMaxreimburse"]),
              transport_desc: getVal(flat, ["transportDescEmp", "transportDescDaily"]),

              housing_type: getVal(flat, ["housingType", "housing_type"]),
              housing_addr: getVal(flat, ["housingAddr1", "housingAddress"]),
              housing_city: getVal(flat, ["housingCity"]),
              housing_state: getVal(flat, ["housingState"]),
              housing_zip: getVal(flat, ["housingPostcode"]),
              housing_capacity: parseInt(getVal(flat, ["housingTotalOccupy", "housing_capacity"])) || null,

              is_meal_provision: getVal(flat, ["isMealProvision"]) === 1,
              meal_charge: parseMoney(flat, ["mealCharge"]),

              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,

              job_is_lifting: getVal(flat, ["jobIsLifting"]) === 1,
              job_lifting_weight: getVal(flat, ["jobLiftingWeight"]),
              job_is_drug_screen: getVal(flat, ["jobIsDrugScreen"]) === 1,
              job_is_background: getVal(flat, ["jobIsBackground"]) === 1,
              job_is_driver: getVal(flat, ["jobIsDriver"]) === 1,

              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "totalWorkersNeeded"])) || null,
              shift_start: getVal(flat, ["jobHoursStart"]),
              shift_end: getVal(flat, ["jobHoursEnd"]),

              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription"]),
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
        title: "Importação Concluída",
        description: `Salvos: ${finalJobs.length}. Ignorados (Sem Email/Dados): ${skippedCount}.`,
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
        <CardDescription>Apenas vagas completas (com Email e Empresa) serão importadas.</CardDescription>
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
                Vagas válidas: {stats.total} |{" "}
                <span className="text-red-600 font-bold">Ignoradas (sem email): {stats.skipped}</span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
