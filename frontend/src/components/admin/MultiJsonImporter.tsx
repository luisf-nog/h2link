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

  // 1. Busca Profunda (Deep Search) - Acha o dinheiro onde ele estiver
  const deepFindWage = (item: any): number | null => {
    // Tenta Raiz (JO / H-2B)
    let val = parseMoney(item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE);
    if (val) return val;

    // Tenta Clearance (H-2A)
    if (item.clearanceOrder) {
      val = parseMoney(item.clearanceOrder.jobWageOffer || item.clearanceOrder.wageOfferFrom);
      if (val) return val;
    }

    // Tenta Arrays (JO / H-2B Aninhado)
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

    // Se for <= 100, assume que já é por hora (Power Query Logic)
    if (rawWage <= 100) return rawWage;

    // Se for maior (mensal/semanal), converte
    const hours = parseFloat(getVal(flat, ["jobHoursTotal", "basicHours", "weekly_hours"]) || "40");
    if (hours > 0) {
      // Fórmula do Power Query: Wage / (Hours * 4.333)
      const hourly = rawWage / (hours * 4.333);
      // Trava de sanidade (entre $7.25 e $150)
      if (hourly >= 7.25 && hourly <= 150) {
        return parseFloat(hourly.toFixed(2));
      }
    }

    return rawWage; // Retorna o original se não der pra converter
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

            // --- CÁLCULO FINAL DE SALÁRIO ---
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

              // --- SALÁRIO CORRIGIDO (Popula TODOS os campos) ---
              salary: finalWage, // Legacy
              wage_from: finalWage, // Novo
              wage_to: finalWage, // Novo (Flat)
              wage_unit: "Hour", // Normalizado

              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),

              // Hora Extra (H-2B usa wageOtFrom, H-2A usa isOvertimeAvailable)
              overtime_available:
                getVal(flat, ["isOvertimeAvailable", "recIsOtAvailable"]) === 1 || !!parseMoney(item.wageOtFrom),
              overtime_from: parseMoney(getVal(flat, ["wageOtFrom", "overtimeWageFrom", "ot_wage_from"])),

              // --- CAMPOS QUE ESTAVAM FALTANDO (Mapeamento Power Query) ---
              // Power Query: "Col SpecialReq" = if [req_h2b] <> null then [req_h2b] else [req_h2a]
              // H-2B: jobMinspecialreq / H-2A: jobAddReqinfo
              job_min_special_req: getVal(flat, [
                "jobMinspecialreq",
                "jobAddReqinfo",
                "job_min_special_req",
                "specialRequirements",
              ]),

              // Power Query: "Col Education" = jobMinedu
              education_required: getVal(flat, ["jobMinedu", "jobEducationLevel", "educationLevel"]),

              // Power Query: "Col WageAdd"
              wage_additional: getVal(flat, ["wageAdditional", "addSpecialPayInfo", "jobSpecialPayInfo"]),

              // Power Query: "Col Deductions"
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),

              // Transporte e Moradia
              transport_provided:
                getVal(flat, ["recIsDailyTransport", "isEmploymentTransport"]) === 1 ||
                getVal(flat, ["isEmploymentTransport"]) === true,
              transport_min_reimburse: parseMoney(getVal(flat, ["transportMinreimburse"])),
              transport_max_reimburse: parseMoney(getVal(flat, ["transportMaxreimburse"])),
              transport_desc: getVal(flat, ["transportDescEmp", "transportDescDaily"]),

              housing_info: getVal(flat, ["housingAddInfo", "housingAdditionalInfo"]),
              housing_type: getVal(flat, ["housingType", "housing_type"]),
              housing_addr: getVal(flat, ["housingAddr1"]),
              housing_city: getVal(flat, ["housingCity"]),
              housing_state: getVal(flat, ["housingState"]),
              housing_zip: getVal(flat, ["housingPostcode"]),
              housing_capacity: parseInt(getVal(flat, ["housingTotalOccupy", "housing_capacity"])) || null,

              is_meal_provision: getVal(flat, ["isMealProvision"]) === 1,
              meal_charge: parseMoney(getVal(flat, ["mealCharge"])),

              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,

              job_is_lifting: getVal(flat, ["jobIsLifting"]) === 1,
              job_lifting_weight: getVal(flat, ["jobLiftingWeight"]),
              job_is_drug_screen: getVal(flat, ["jobIsDrugScreen"]) === 1,
              job_is_background: getVal(flat, ["jobIsBackground"]) === 1,
              job_is_driver: getVal(flat, ["jobIsDriver"]) === 1,

              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "basicHours"])) || null,
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

      // Filtro de Segurança (Email)
      let finalJobs = Array.from(rawJobsMap.values());
      const originalCount = finalJobs.length;
      finalJobs = finalJobs.filter((job) => job.email && job.email.length > 2 && job.email !== "n/a");
      skippedCount += originalCount - finalJobs.length;

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
        title: "Importação V4 (Power Query Logic)",
        description: `Sucesso: ${finalJobs.length}. Dados normalizados e calculados.`,
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
          <Database className="h-6 w-6 text-primary" /> Extrator V4 (Power Query Logic)
        </CardTitle>
        <CardDescription>Salários calculados, campos H-2B mapeados e proteção de dados.</CardDescription>
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
          Importar Agora
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
