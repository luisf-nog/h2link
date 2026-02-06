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

  // --- NOVA FUNÇÃO DE BUSCA PROFUNDA ---
  // Varre o objeto inteiro atrás de qualquer coisa que pareça um salário
  const deepFindWage = (item: any): { from: number | null; to: number | null; ot: number | null } => {
    let from = null,
      to = null,
      ot = null;

    // 1. Tenta Raiz (H-2B / JO)
    from = parseMoney(item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE);
    to = parseMoney(item.wageTo || item.jobWageTo || item.wageOfferTo || item.WAGE_OFFER_TO);
    ot = parseMoney(item.wageOtFrom || item.overtimeWageFrom || item.ot_wage_from);

    // 2. Se não achou e tem clearanceOrder (H-2A), tenta lá
    if (!from && item.clearanceOrder) {
      const co = item.clearanceOrder;
      from = parseMoney(co.jobWageOffer || co.wageOfferFrom || co.BASIC_WAGE_RATE);
      to = parseMoney(co.jobWageTo || co.wageOfferTo);
      ot = parseMoney(co.overtimeWageFrom);
    }

    // 3. Se ainda não achou, tenta Arrays Especiais (JO / H-2B aninhado)
    if (!from) {
      // H-2A / JO: cropsAndActivities
      const crops = item.cropsAndActivities || item.clearanceOrder?.cropsAndActivities;
      if (Array.isArray(crops)) {
        for (const c of crops) {
          const w = parseMoney(c.addmaWageOffer || c.wageOffer);
          if (w) {
            from = w;
            break;
          }
        }
      }

      // H-2B: employmentLocations
      const locs = item.employmentLocations || item.clearanceOrder?.employmentLocations;
      if (!from && Array.isArray(locs)) {
        for (const l of locs) {
          const w = parseMoney(l.apdxaWageFrom || l.wageFrom);
          if (w) {
            from = w;
            to = parseMoney(l.apdxaWageTo || l.wageTo);
            break;
          }
        }
      }
    }

    // Se o teto for nulo ou igual ao base, deixa nulo para o front-end tratar
    if (to === from) to = null;

    return { from, to, ot };
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
          // O JSON pode ser um array direto ou um objeto com chave 'data'
          let list = [];
          if (Array.isArray(json)) list = json;
          else if (json.data && Array.isArray(json.data)) list = json.data;
          else list = (Object.values(json).find((v) => Array.isArray(v)) as any[]) || [];

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            // Flatten inteligente apenas para campos gerais
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;

            // --- VALIDAÇÃO ---
            const fein = getVal(flat, ["empFein", "employer_fein", "fein", "employerFein"]);
            const title = getVal(flat, ["jobTitle", "job_title", "tempneedJobtitle"]);
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "beginDate"]),
            );
            // Email é opcional para não perder vagas boas, mas recomendado
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail", "contactEmail"]);
            const company = getVal(flat, [
              "empBusinessName",
              "employerBusinessName",
              "legalName",
              "employerName",
              "empName",
            ]);

            // Se não tem FEIN, Título ou Data, não é uma vaga válida.
            if (!fein || !title || !start) {
              skippedCount++;
              continue;
            }

            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;

            // --- EXTRAÇÃO DE PREÇO (DEEP SEARCH) ---
            const wages = deepFindWage(item); // Passa o item original para acessar arrays

            const extractedJob = {
              job_id: getVal(flat, ["caseNumber", "jobOrderNumber", "clearanceOrderNumber"]) || `GEN-${Math.random()}`,
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
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd", "endDate"])),
              posted_date: formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "posted_date", "dateSubmitted"])),

              // SALÁRIOS CORRIGIDOS
              wage_from: wages.from,
              wage_to: wages.to,
              wage_unit: getVal(flat, ["jobWagePer", "wage_unit", "wagePer", "payUnit"]) || "Hour",
              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),

              overtime_available:
                getVal(flat, ["isOvertimeAvailable", "ot_available", "recIsOtAvailable"]) === 1 || !!wages.ot,
              overtime_from: wages.ot,
              overtime_to: null, // Geralmente não fornecido explicitamente como range

              transport_min_reimburse: parseMoney(getVal(flat, ["transportMinreimburse"])),
              transport_max_reimburse: parseMoney(getVal(flat, ["transportMaxreimburse"])),
              transport_desc: getVal(flat, ["transportDescEmp", "transportDescDaily"]),

              housing_type: getVal(flat, ["housingType", "housing_type"]),
              housing_addr: getVal(flat, ["housingAddr1", "housingAddress"]),
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

              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "totalWorkersNeeded"])) || null,
              shift_start: getVal(flat, ["jobHoursStart"]),
              shift_end: getVal(flat, ["jobHoursEnd"]),

              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription"]),
              openings: parseInt(getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos"])) || null,
            };

            const existing = rawJobsMap.get(fingerprint);
            // Prioriza registros com data de postagem ou dados mais completos
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
        description: `${finalJobs.length} vagas importadas. ${skippedCount} sem dados mínimos.`,
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
          <Database className="h-6 w-6 text-primary" /> Extrator Data Miner V3 (Deep Search)
        </CardTitle>
        <CardDescription>Algoritmo Deep Search para encontrar salários aninhados em H-2A, JO e H-2B.</CardDescription>
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
          Importar com Deep Search
        </Button>

        {stats.total > 0 && (
          <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-bold">Processo Finalizado</p>
              <p className="text-sm">
                Vagas válidas: {stats.total} | Ignoradas: {stats.skipped}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
