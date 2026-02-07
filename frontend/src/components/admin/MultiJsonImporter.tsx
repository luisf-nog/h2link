import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Wand2, Bug } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, skipped: 0 });
  const { toast } = useToast();

  // Função inteligente para detectar categoria pelo título (Fallback de última instância)
  const detectCategory = (title: string, socTitle: string = ""): string => {
    const t = (title + " " + socTitle).toLowerCase();

    if (
      t.includes("landscap") ||
      t.includes("groundskeep") ||
      t.includes("lawn") ||
      t.includes("mower") ||
      t.includes("garden")
    )
      return "Landscaping";
    if (
      t.includes("construct") ||
      t.includes("concrete") ||
      t.includes("mason") ||
      t.includes("brick") ||
      t.includes("roof") ||
      t.includes("carpenter") ||
      t.includes("builder")
    )
      return "Construction";
    if (
      t.includes("housekeep") ||
      t.includes("maid") ||
      t.includes("cleaner") ||
      t.includes("janitor") ||
      t.includes("laundry") ||
      t.includes("room attendant")
    )
      return "Housekeeping";
    if (
      t.includes("cook") ||
      t.includes("chef") ||
      t.includes("kitchen") ||
      t.includes("dishwash") ||
      t.includes("server") ||
      t.includes("waiter") ||
      t.includes("dining") ||
      t.includes("food")
    )
      return "Hospitality & Culinary";
    if (
      t.includes("amusement") ||
      t.includes("carnival") ||
      t.includes("recreation") ||
      t.includes("lifeguard") ||
      t.includes("pool") ||
      t.includes("ride") ||
      t.includes("attendant")
    )
      return "Amusement & Recreation";
    if (
      t.includes("farm") ||
      t.includes("agricult") ||
      t.includes("crop") ||
      t.includes("harvest") ||
      t.includes("nursery") ||
      t.includes("greenhouse") ||
      t.includes("ag ") ||
      t.includes("ranch") ||
      t.includes("animal") ||
      t.includes("livestock")
    )
      return "Agriculture";
    if (
      t.includes("fish") ||
      t.includes("seafood") ||
      t.includes("crab") ||
      t.includes("oyster") ||
      t.includes("process") ||
      t.includes("meat") ||
      t.includes("cutter")
    )
      return "Processing & Seafood";
    if (t.includes("stable") || t.includes("horse") || t.includes("equine") || t.includes("groom"))
      return "Stable Attendant";
    if (t.includes("truck") || t.includes("driver") || t.includes("cdl") || t.includes("haul")) return "Transportation";

    return "General Labor";
  };

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

  const parseBool = (val: any) => ["1", "true", "yes", "y", "t"].includes(String(val).toLowerCase().trim());

  const parseMoney = (val: any) => {
    if (!val) return null;
    const num = parseFloat(String(val).replace(/[$,]/g, ""));
    return isNaN(num) || num <= 0 ? null : num;
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

  // Mantendo a lógica original de salário (V10)
  const calculateFinalWage = (item: any, flat: any) => {
    let val = parseMoney(
      item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE || item.AEWR || item.BASIC_RATE,
    );
    if (!val && item.clearanceOrder) val = parseMoney(item.clearanceOrder.jobWageOffer);

    // Tratamento para converter semanal em horário se necessário
    if (val && val > 100) {
      const hours = parseFloat(getVal(flat, ["jobHoursTotal", "basicHours", "weekly_hours"]) || "40");
      if (hours > 0) {
        const hourly = val / (hours * 4.333);
        if (hourly >= 7.25 && hourly <= 150) return parseFloat(hourly.toFixed(2));
      }
    }
    return val;
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
          for (const [filename, zipObj] of Object.entries(zip.files)) {
            if (!zipObj.dir && filename.endsWith(".json")) {
              const text = await zipObj.async("string");
              contents.push({ filename, content: text });
            }
          }
        } else {
          contents.push({ filename: file.name, content: await file.text() });
        }

        for (const { filename, content } of contents) {
          const json = JSON.parse(content);
          const list = Array.isArray(json) ? json : json.data || [];

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;

            // 1. Título (Mantido lógica V10)
            const title = getVal(flat, [
              "jobTitle",
              "job_title",
              "tempneedJobtitle",
              "JOB_TITLE",
              "Job_Title",
              "TITLE",
              "job_order_title",
            ]);

            // 2. Empresa (Mantido lógica V10)
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

            // === 3. CATEGORIA (A ÚNICA ALTERAÇÃO SIGNIFICATIVA) ===
            // Aqui aplicamos a lógica do Power Query (socTitle > jobSocTitle > tempneedSocTitle)
            let category = getVal(flat, [
              "socTitle", // (Prioridade 1: Feed 790)
              "jobSocTitle", // (Prioridade 2: H-2A)
              "tempneedSocTitle", // (Prioridade 3: H-2B)
              "category", // (Prioridade 4: Data Miner)
              "Category",
              "SOC_TITLE",
              "soc_title",
              "Occupational_Title",
            ]);

            // Fallback de Segurança (Mantido da V10): Se nulo, deduz pelo título
            if (!category && title) {
              category = detectCategory(title);
            } else if (!category) {
              category = "General Labor";
            }

            const socCode = getVal(flat, ["soc_code", "SOC_CODE", "socCode", "jobSocCode", "tempneedSocCode"]);

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
              // Campos básicos (V10)
              job_id:
                getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER", "JO_ORDER_NUMBER"]) ||
                `GEN-${Math.random()}`,
              visa_type: visaType,
              fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: email,

              // === AQUI VAI A CATEGORIA CORRIGIDA ===
              category: category,
              // ======================================

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
                !!parseMoney(getVal(flat, ["wageOtFrom"])),
              overtime_salary: parseMoney(getVal(flat, ["wageOtFrom", "overtimeWageFrom", "ot_wage_from"])),

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
        title: "Importação V13 (Power Query Keys)",
        description: `Sucesso: ${finalJobs.length}. Categoria mapeada via socTitle/jobSocTitle.`,
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
          <Wand2 className="h-6 w-6 text-purple-600" /> Extrator V13 (Category Fix)
        </CardTitle>
        <CardDescription>Mantém a lógica V10 mas usa as chaves do Power Query para a categoria.</CardDescription>
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
          Importar e Corrigir
        </Button>
        {stats.total > 0 && (
          <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg">
            <p className="font-bold">Processo Finalizado!</p>
            <p className="text-sm">{stats.total} vagas enviadas.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
