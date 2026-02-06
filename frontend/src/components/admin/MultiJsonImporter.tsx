import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Database } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, skipped: 0 });
  const { toast } = useToast();

  const getVal = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (
        obj &&
        obj[key] !== undefined &&
        obj[key] !== null &&
        obj[key] !== "N/A" &&
        obj[key] !== "" &&
        obj[key] !== "n/a"
      ) {
        return obj[key];
      }
    }
    return null;
  };

  const parseMoney = (val: any): number | null => {
    if (!val) return null;
    const clean = String(val).replace(/[$,]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) || num <= 0 ? null : num;
  };

  // 1. Busca Profunda (Deep Search) - Salário
  const deepFindWage = (item: any): number | null => {
    let val = parseMoney(item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE);
    if (val) return val;

    if (item.clearanceOrder) {
      val = parseMoney(item.clearanceOrder.jobWageOffer || item.clearanceOrder.wageOfferFrom);
      if (val) return val;
    }

    const crops = item.cropsAndActivities || item.clearanceOrder?.cropsAndActivities;
    if (Array.isArray(crops) && crops.length > 0) {
      val = parseMoney(crops[0].addmaWageOffer || crops[0].wageOffer);
      if (val) return val;
    }

    const locs = item.employmentLocations || item.clearanceOrder?.employmentLocations;
    if (Array.isArray(locs) && locs.length > 0) {
      val = parseMoney(locs[0].apdxaWageFrom || locs[0].wageFrom);
      if (val) return val;
    }

    return null;
  };

  // 2. Lógica Power Query (Conversão Mensal -> Horária)
  const calculateFinalWage = (item: any, flat: any): number | null => {
    const rawWage = deepFindWage(item);
    if (!rawWage) return null;
    if (rawWage <= 100) return rawWage;

    const hours = parseFloat(getVal(flat, ["jobHoursTotal", "basicHours", "weekly_hours"]) || "40");
    if (hours > 0) {
      const hourly = rawWage / (hours * 4.333);
      if (hourly >= 7.25 && hourly <= 150) {
        return parseFloat(hourly.toFixed(2));
      }
    }
    return rawWage;
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
          let list = [];
          if (Array.isArray(json)) list = json;
          else if (json.data && Array.isArray(json.data)) list = json.data;
          else list = (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;

            const fein = getVal(flat, ["empFein", "employer_fein", "fein"]);
            const title = getVal(flat, ["jobTitle", "job_title", "tempneedJobtitle"]);
            const start = formatToISODate(getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart"]));
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail"]);
            const company = getVal(flat, ["empBusinessName", "employerBusinessName", "legalName", "empName"]);

            if (!fein || !title || !start || !email || !company) {
              skippedCount++;
              continue;
            }

            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;
            const finalWage = calculateFinalWage(item, flat);

            const extractedJob = {
              job_id: getVal(flat, ["caseNumber", "jobOrderNumber"]) || `GEN-${Math.random()}`,
              visa_type: visaType,
              fingerprint,
              is_active: true,

              job_title: title,
              company: company,
              email: email,

              city: getVal(flat, ["jobCity", "job_city", "worksite_city", "empCity", "addmbEmpCity"]),
              state: getVal(flat, ["jobState", "job_state", "worksite_state", "empState", "addmbEmpState"]),
              zip: getVal(flat, ["jobPostcode", "worksite_zip", "empPostcode"]),
              worksite_address: getVal(flat, ["jobAddr1", "worksite_address", "empAddr1"]),

              phone: getVal(flat, ["recApplyPhone", "emppocPhone", "employerPhone"]),
              website: getVal(flat, ["recApplyUrl", "employerWebsite", "rec_url"]),

              start_date: start,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd"])),
              posted_date: formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "posted_date"])),

              // SALÁRIOS
              salary: finalWage,
              wage_from: finalWage,
              wage_to: finalWage,
              wage_unit: "Hour",
              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),

              // HORA EXTRA (Fix: wageOtFrom para H-2B, isOvertimeAvailable para H-2A)
              overtime_available:
                getVal(flat, ["isOvertimeAvailable", "recIsOtAvailable"]) === 1 ||
                !!parseMoney(getVal(flat, ["wageOtFrom", "overtimeWageFrom"])),
              overtime_from: parseMoney(getVal(flat, ["wageOtFrom", "overtimeWageFrom", "ot_wage_from"])),

              // TURNO (Fix: jobHourStart singular para H-2B)
              shift_start: getVal(flat, ["jobHoursStart", "jobHourStart", "shiftStart"]),
              shift_end: getVal(flat, ["jobHoursEnd", "jobHourEnd", "shiftEnd"]),
              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "basicHours"])) || null,

              // REQUISITOS (Lifting, Driver)
              job_is_lifting: getVal(flat, ["jobIsLifting", "lifting"]) === 1,
              job_lifting_weight: getVal(flat, ["jobLiftingWeight", "liftingWeight"]),
              job_is_drug_screen: getVal(flat, ["jobIsDrugScreen"]) === 1,
              job_is_driver: getVal(flat, ["jobIsDriver", "driver"]) === 1,

              // EDUCAÇÃO e EXPERIÊNCIA
              education_required: getVal(flat, ["jobEducationLevel", "jobEducation", "educationLevel"]),
              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,

              // CAMPOS EXTRAS
              job_min_special_req: getVal(flat, [
                "jobMinspecialreq",
                "jobAddReqinfo",
                "job_min_special_req",
                "specialRequirements",
              ]),
              wage_additional: getVal(flat, ["wageAdditional", "addSpecialPayInfo", "jobSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),

              // TRANSPORTE e MORADIA
              transport_provided:
                getVal(flat, ["isEmploymentTransport", "recIsDailyTransport", "transportProvided"]) === 1 ||
                getVal(flat, ["isEmploymentTransport"]) === true,
              transport_desc: getVal(flat, ["transportDescEmp", "transportDescDaily"]),
              housing_info: getVal(flat, ["housingAddInfo", "housingAdditionalInfo"]),
              // Fallback para moradia em array se não tiver na raiz
              housing_type:
                getVal(flat, ["housingType", "housing_type"]) || item.housingLocations?.[0]?.addmbHousingType,
              housing_addr: getVal(flat, ["housingAddr1"]) || item.housingLocations?.[0]?.addmbHousingAddr1,
              housing_city: getVal(flat, ["housingCity"]) || item.housingLocations?.[0]?.addmbHousingCity,
              housing_state: getVal(flat, ["housingState"]) || item.housingLocations?.[0]?.addmbHousingState,
              housing_zip: getVal(flat, ["housingPostcode"]) || item.housingLocations?.[0]?.addmbHousingPostcode,
              housing_capacity: parseInt(getVal(flat, ["housingTotalOccupy", "housing_capacity"])) || null,

              is_meal_provision: getVal(flat, ["isMealProvision"]) === 1,
              meal_charge: parseMoney(getVal(flat, ["mealCharge"])),

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

      let finalJobs = Array.from(rawJobsMap.values());
      finalJobs = finalJobs.filter((job) => job.email && job.email.length > 2 && job.email !== "n/a");

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
        title: "Importação V5 (Shift Fix)",
        description: `Sucesso: ${finalJobs.length}. Turno, Educação e Hora Extra corrigidos.`,
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
          <Database className="h-6 w-6 text-primary" /> Extrator V5 (Shift Fix)
        </CardTitle>
        <CardDescription>Correção específica para H-2B: Turno (HourStart), Hora Extra e Transporte.</CardDescription>
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
          Importar (Shift + Extra)
        </Button>
        {stats.total > 0 && (
          <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-bold">Processo Finalizado</p>
              <p className="text-sm">Vagas: {stats.total}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
