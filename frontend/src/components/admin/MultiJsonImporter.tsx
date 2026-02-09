import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Wand2, RefreshCw } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, updated: 0, new: 0 });
  const { toast } = useToast();

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

  const calculateFinalWage = (item: any, flat: any) => {
    let val = parseMoney(
      item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE || item.AEWR || item.BASIC_RATE,
    );
    if (!val && item.clearanceOrder) val = parseMoney(item.clearanceOrder.jobWageOffer);

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

            const title = getVal(flat, [
              "jobTitle",
              "job_title",
              "tempneedJobtitle",
              "JOB_TITLE",
              "TITLE",
              "job_order_title",
            ]);
            const company = getVal(flat, [
              "empBusinessName",
              "employerBusinessName",
              "legalName",
              "empName",
              "company",
              "EMPLOYER_NAME",
              "FULL_NAME",
            ]);

            let category = getVal(flat, [
              "socTitle",
              "jobSocTitle",
              "tempneedSocTitle",
              "category",
              "Category",
              "SOC_TITLE",
              "soc_title",
            ]);
            if (!category && title) category = detectCategory(title);
            else if (!category) category = "General Labor";

            const posted_date = formatToISODate(
              getVal(flat, ["dateAcceptanceLtrIssued", "posted_date", "dateSubmitted", "form790AsOfDate"]),
            );

            // REMOVIDO: soc_code (Não existe no banco)
            // const socCode = getVal(flat, ["soc_code", "SOC_CODE", "socCode", "jobSocCode", "tempneedSocCode"]);

            const fein = getVal(flat, ["empFein", "employer_fein", "fein"]);
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "START_DATE", "begin_date"]),
            );
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail", "EMAIL", "employer_email"]);

            if (!fein || !title || !start || !email || !company) {
              skippedCount++;
              continue;
            }

            // GERAÇÃO DO ID PARA UPSERT (EVITA DUPLICAR)
            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER", "JO_ORDER_NUMBER"]);
            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;
            const finalJobId = rawJobId || fingerprint;

            const finalWage = calculateFinalWage(item, flat);
            const transportDesc = getVal(flat, ["transportDescEmp", "transportDescDaily"]);
            const transportBool =
              parseBool(getVal(flat, ["isEmploymentTransport", "recIsDailyTransport", "transportProvided"])) ||
              (transportDesc && transportDesc.length > 5);

            const extractedJob = {
              job_id: finalJobId, // Chave única
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,

              job_title: title,
              company: company,
              email: email,
              category: category,
              // soc_code: socCode, <--- REMOVIDO PARA CORRIGIR O ERRO

              posted_date: posted_date,

              city: getVal(flat, ["jobCity", "job_city", "worksite_city", "empCity", "addmbEmpCity", "CITY"]),
              state: getVal(flat, ["jobState", "job_state", "worksite_state", "empState", "addmbEmpState", "STATE"]),
              zip: getVal(flat, ["jobPostcode", "worksite_zip", "empPostcode", "POSTAL_CODE"]),
              worksite_address: getVal(flat, ["jobAddr1", "worksite_address", "empAddr1"]),
              phone: getVal(flat, ["recApplyPhone", "emppocPhone", "employerPhone", "PHONE"]),
              website: getVal(flat, ["recApplyUrl", "employerWebsite"]),

              start_date: start,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd", "END_DATE"])),

              salary: finalWage,
              wage_from: finalWage,
              wage_to: parseMoney(getVal(flat, ["wageTo", "wageOfferTo", "HIGHEST_RATE"])) || finalWage,
              wage_unit: "Hour",
              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),

              overtime_available:
                parseBool(getVal(flat, ["isOvertimeAvailable", "recIsOtAvailable"])) ||
                !!parseMoney(getVal(flat, ["wageOtFrom"])),
              overtime_salary: parseMoney(getVal(flat, ["wageOtFrom", "overtimeWageFrom", "ot_wage_from"])),

              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "basicHours"])) || null,
              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription"]),
              openings: parseInt(getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos"])) || null,

              job_min_special_req: getVal(flat, ["jobMinspecialreq", "jobAddReqinfo", "specialRequirements"]),
              wage_additional: getVal(flat, ["wageAdditional", "addSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),
              education_required: getVal(flat, ["jobMinedu", "jobEducationLevel"], true),
              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,

              transport_provided: transportBool,
              transport_desc: transportDesc,
              housing_info: getVal(flat, ["housingAddInfo", "housingAdditionalInfo"]),
              housing_type: getVal(flat, ["housingType"]) || item.housingLocations?.[0]?.addmbHousingType,
              housing_addr: getVal(flat, ["housingAddr1"]) || item.housingLocations?.[0]?.addmbHousingAddr1,
              housing_city: getVal(flat, ["housingCity"]) || item.housingLocations?.[0]?.addmbHousingCity,
              housing_state: getVal(flat, ["housingState"]) || item.housingLocations?.[0]?.addmbHousingState,
              housing_zip: getVal(flat, ["housingPostcode"]) || item.housingLocations?.[0]?.addmbHousingPostcode,
              housing_capacity: parseInt(getVal(flat, ["housingTotalOccupy", "housing_capacity"])) || null,
              is_meal_provision: parseBool(getVal(flat, ["isMealProvision"])),
              meal_charge: parseMoney(getVal(flat, ["mealCharge"])),
            };

            rawJobsMap.set(finalJobId, extractedJob);
          }
        }
      }

      let finalJobs = Array.from(rawJobsMap.values());
      finalJobs = finalJobs.filter(
        (job) => job.email && job.email.length > 2 && !job.email.toLowerCase().includes("null"),
      );

      // ENVIO EM LOTES (UPSERT)
      const BATCH_SIZE = 500;
      for (let i = 0; i < finalJobs.length; i += BATCH_SIZE) {
        const batch = finalJobs.slice(i, i + BATCH_SIZE);

        const { error } = await supabase.from("public_jobs").upsert(batch, {
          onConflict: "job_id",
          ignoreDuplicates: false,
        });

        if (error) throw error;
      }

      setStats({ total: finalJobs.length, updated: 0, new: 0 });
      toast({
        title: "Sincronização com Sucesso!",
        description: `${finalJobs.length} vagas processadas (Atualizadas/Criadas).`,
      });
    } catch (err: any) {
      toast({ title: "Erro na Sincronização", description: err.message, variant: "destructive" });
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader className="bg-slate-50">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <RefreshCw className="h-6 w-6 text-blue-600" /> Sincronizador V16 (Stable)
        </CardTitle>
        <CardDescription>Atualiza vagas existentes e corrige dados sem duplicar. (SOC Code removido).</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="border-dashed border-2 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-white transition-colors">
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full" />
          <p className="mt-2 text-sm text-slate-500">JSON ou ZIP</p>
        </div>
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full mt-4 h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar Agora
        </Button>
      </CardContent>
    </Card>
  );
}
