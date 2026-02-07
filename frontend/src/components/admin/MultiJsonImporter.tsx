import { useState } from "react";utton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Database, Wand2 } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, skipped: 0 });
  const { toast } = useToast();

  const getVal = (obj: any, keys: string[], allowNone = false) => {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) {
        const val = obj[key];
        if (typeof val === "string") {
          const clean = val.trim();
          if (clean === "" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "null") continue;
          if (!allowNone && clean.toLowerCase() === "none") continue;
        }
        return val;
      }
    }
    return null;
  };

  const parseBool = (val: any): boolean => {
    if (!val) return false;
    const s = String(val).toLowerCase().trim();
    return ["1", "true", "yes", "y", "t"].includes(s);
  };

  const parseMoney = (val: any): number | null => {
    if (!val) return null;
    const clean = String(val).replace(/[$,]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) || num <= 0 ? null : num;
  };

  const deepFindWage = (item: any): number | null => {
    let val = parseMoney(
      item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE || item.AEWR || item.BASIC_RATE,
    ); // Added AEWR/BASIC_RATE
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

            // --- MAPEAMENTO EXPANDIDO PARA OS 3 TIPOS DE ARQUIVO ---

            // 1. Título (Data Miner vs DOL vs Genérico)
            const title = getVal(flat, [
              "jobTitle",
              "job_title",
              "tempneedJobtitle",
              "JOB_TITLE",
              "Job_Title",
              "TITLE",
              "job_order_title",
            ]);

            // 2. Empresa
            const company = getVal(flat, [
              "empBusinessName",
              "employerBusinessName",
              "legalName",
              "empName",
              "company",
              "EMPLOYER_NAME",
              "Employer_Name",
              "employer_name",
              "FULL_NAME",
            ]);

            // 3. Categoria (IMPORTANTE: Mapeia as chaves do print e padrões oficiais)
            const category = getVal(flat, [
              "category", // Data Miner (seu print)
              "SOC_TITLE", // Oficial H-2A/H-2B
              "soc_title", // Variação
              "Occupational_Title", // Legado
              "SOC_Title",
            ]);

            // 4. Código SOC (Auxiliar)
            const socCode = getVal(flat, ["soc_code", "SOC_CODE", "socCode"]);

            // Campos padrão
            const fein = getVal(flat, ["empFein", "employer_fein", "fein"]);
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "START_DATE", "begin_date"]),
            );
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail", "EMAIL", "employer_email"]);

            if (!fein || !title || !start || !email || !company) {
              skippedCount++;
              continue;
            }

            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;
            const finalWage = calculateFinalWage(item, flat);

            const transportDesc = getVal(flat, ["transportDescEmp", "transportDescDaily"]);
            const transportBool =
              parseBool(getVal(flat, ["isEmploymentTransport", "recIsDailyTransport", "transportProvided"])) ||
              (transportDesc && transportDesc.length > 5);

            const extractedJob = {
              job_id:
                getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER", "JO_ORDER_NUMBER"]) ||
                `GEN-${Math.random()}`,
              visa_type: visaType,
              fingerprint,
              is_active: true,

              job_title: title,
              company: company,
              email: email,

              // Novos campos mapeados
              category: category,
              soc_code: socCode,

              city: getVal(flat, [
                "jobCity",
                "job_city",
                "worksite_city",
                "empCity",
                "addmbEmpCity",
                "CITY",
                "EMPLOYER_CITY",
              ]),
              state: getVal(flat, [
                "jobState",
                "job_state",
                "worksite_state",
                "empState",
                "addmbEmpState",
                "STATE",
                "EMPLOYER_STATE",
              ]),
              zip: getVal(flat, ["jobPostcode", "worksite_zip", "empPostcode", "POSTAL_CODE", "EMPLOYER_POSTAL_CODE"]),
              worksite_address: getVal(flat, ["jobAddr1", "worksite_address", "empAddr1", "WORKSITE_ADDRESS"]),

              phone: getVal(flat, ["recApplyPhone", "emppocPhone", "employerPhone", "PHONE", "employer_phone"]),
              website: getVal(flat, ["recApplyUrl", "employerWebsite", "rec_url"]),

              start_date: start,
              end_date: formatToISODate(
                getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd", "END_DATE", "expiration_date"]),
              ),
              posted_date: formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "posted_date"])),

              salary: finalWage,
              wage_from: finalWage,
              wage_to: parseMoney(getVal(flat, ["wageTo", "wageOfferTo", "HIGHEST_RATE"])) || finalWage,
              wage_unit: "Hour",
              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),

              overtime_available:
                parseBool(getVal(flat, ["isOvertimeAvailable", "recIsOtAvailable"])) ||
                !!parseMoney(getVal(flat, ["wageOtFrom", "overtimeWageFrom"])),
              overtime_from: parseMoney(getVal(flat, ["wageOtFrom", "overtimeWageFrom", "ot_wage_from"])),

              shift_start: getVal(flat, ["jobHoursStart", "jobHourStart", "shiftStart"]),
              shift_end: getVal(flat, ["jobHoursEnd", "jobHourEnd", "shiftEnd"]),
              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "basicHours"])) || null,

              job_is_lifting: parseBool(getVal(flat, ["jobIsLifting", "lifting"])),
              job_lifting_weight: getVal(flat, ["jobLiftingWeight", "liftingWeight"]),
              job_is_drug_screen: parseBool(getVal(flat, ["jobIsDrugScreen"])),
              job_is_driver: parseBool(getVal(flat, ["jobIsDriver", "driver"])),
              job_is_background: parseBool(getVal(flat, ["jobIsBackground"])),

              education_required: getVal(
                flat,
                ["jobEducationLevel", "jobEducation", "educationLevel", "jobMinedu"],
                true,
              ),
              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,

              job_min_special_req: getVal(flat, [
                "jobMinspecialreq",
                "jobAddReqinfo",
                "job_min_special_req",
                "specialRequirements",
              ]),
              wage_additional: getVal(flat, ["wageAdditional", "addSpecialPayInfo", "jobSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),

              transport_provided: transportBool,
              transport_desc: transportDesc,

              housing_info: getVal(flat, ["housingAddInfo", "housingAdditionalInfo"]),
              housing_type:
                getVal(flat, ["housingType", "housing_type"]) || item.housingLocations?.[0]?.addmbHousingType,
              housing_addr: getVal(flat, ["housingAddr1"]) || item.housingLocations?.[0]?.addmbHousingAddr1,
              housing_city: getVal(flat, ["housingCity"]) || item.housingLocations?.[0]?.addmbHousingCity,
              housing_state: getVal(flat, ["housingState"]) || item.housingLocations?.[0]?.addmbHousingState,
              housing_zip: getVal(flat, ["housingPostcode"]) || item.housingLocations?.[0]?.addmbHousingPostcode,
              housing_capacity: parseInt(getVal(flat, ["housingTotalOccupy", "housing_capacity"])) || null,

              is_meal_provision: parseBool(getVal(flat, ["isMealProvision"])),
              meal_charge: parseMoney(getVal(flat, ["mealCharge"])),

              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription", "JOB_DUTIES"]),
              openings:
                parseInt(
                  getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos", "TOTAL_WORKERS_NEEDED"]),
                ) || null,
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
        title: "Importação V9 (Category + SOC)",
        description: `Sucesso: ${finalJobs.length}. Categoria mapeada de múltiplas fontes.`,
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
          <Wand2 className="h-6 w-6 text-purple-600" /> Extrator V9 (Universal + Categories)
        </CardTitle>
        <CardDescription>
          Mapeia automaticamente 'category', 'SOC_TITLE' e metadados dos 3 formatos de arquivo (H2A, H2B, JO).
        </CardDescription>
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
          Importar (Com Categorias)
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
