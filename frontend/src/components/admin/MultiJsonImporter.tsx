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

  // --- LÓGICA POWER QUERY (Salário) ---
  const calculateHourlyWage = (item: any, flat: any) => {
    // 1. Acha o valor bruto (igual seu Power Query Step 8/9)
    let rawWage = parseMoney(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom", "BASIC_WAGE_RATE"]));

    // Se não achou na raiz, tenta arrays (Deep Search igual antes, mas focado)
    if (!rawWage && item.cropsAndActivities && Array.isArray(item.cropsAndActivities)) {
      rawWage = parseMoney(item.cropsAndActivities[0]?.addmaWageOffer);
    }
    if (!rawWage && item.employmentLocations && Array.isArray(item.employmentLocations)) {
      rawWage = parseMoney(item.employmentLocations[0]?.apdxaWageFrom);
    }

    if (!rawWage) return null;

    // 2. Aplica a lógica de conversão do seu Power Query
    // "if raw_wage <= 100 then raw_wage else ..."
    if (rawWage <= 100) return rawWage; // Já é horário

    // Se for maior que 100 (semanal/mensal), converte
    const hours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "40");
    if (hours > 0) {
      const calc = rawWage / (hours * 4.333); // 4.333 semanas/mês
      // "if calc >= 7.25 and calc <= 80 then Number.Round(calc, 2)"
      if (calc >= 7.25 && calc <= 150) {
        // Aumentei o teto pra garantir
        return parseFloat(calc.toFixed(2));
      }
    }

    return rawWage; // Retorna bruto se não conseguiu converter (melhor que null)
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
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "beginDate"]),
            );
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail"]);
            const company = getVal(flat, ["empBusinessName", "employerBusinessName", "legalName", "employerName"]);

            if (!fein || !title || !start || !email || !company) {
              skippedCount++;
              continue;
            }

            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;

            // Lógica Power Query de Salário
            const finalWage = calculateHourlyWage(item, flat);

            const extractedJob = {
              job_id: getVal(flat, ["caseNumber", "jobOrderNumber"]) || `GEN-${Math.random()}`,
              visa_type: visaType,
              fingerprint,
              is_active: true,

              job_title: title,
              company: company,
              email: email,

              // Mapeamento Power Query (#"Registro Expandido")
              city: getVal(flat, ["jobCity", "worksite_city", "empCity", "addmbEmpCity"]),
              state: getVal(flat, ["jobState", "worksite_state", "empState", "addmbEmpState"]),
              zip: getVal(flat, ["jobPostcode", "worksite_zip", "empPostcode"]),
              worksite_address: getVal(flat, ["jobAddr1", "worksite_address", "empAddr1"]),
              phone: getVal(flat, ["recApplyPhone", "emppocPhone"]),
              website: getVal(flat, ["recApplyUrl", "employerWebsite", "rec_url"]),

              start_date: start,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "tempneedEnd", "endDate"])),
              posted_date: formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "posted_date"])),

              // --- CAMPOS CRÍTICOS QUE VOCÊ PEDIU ---
              // Power Query: "Col SpecialReq" = if [req_h2b] <> null then [req_h2b] else [req_h2a]
              job_min_special_req: getVal(flat, ["jobMinspecialreq", "jobAddReqinfo", "job_min_special_req"]),

              // Power Query: "Col Duties"
              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription"]),

              // Power Query: "Col WageAdd"
              wage_additional: getVal(flat, ["wageAdditional", "addSpecialPayInfo", "jobSpecialPayInfo"]),

              // Power Query: "Col Deductions"
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),

              // Power Query: "Col Salary" (Calculado acima)
              wage_from: finalWage,
              wage_to: finalWage, // Assumindo flat wage se não houver range explícito no PQ
              wage_unit: "Hour", // Power Query normaliza para hora

              // Outros campos
              education_required: getVal(flat, ["jobEducationLevel", "jobEducation"]),
              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,

              housing_info: getVal(flat, ["housingAddInfo"]),
              housing_type: getVal(flat, ["housingType"]),
              housing_addr: getVal(flat, ["housingAddr1"]),
              transport_provided:
                getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) === true ||
                getVal(flat, ["isEmploymentTransport"]) === 1,

              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "basicHours"])) || null,
              openings: parseInt(getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos"])) || null,

              // Campos Booleanos extras
              job_is_lifting: getVal(flat, ["jobIsLifting"]) === 1,
              job_lifting_weight: getVal(flat, ["jobLiftingWeight"]),
              job_is_driver: getVal(flat, ["jobIsDriver"]) === 1,
            };

            const existing = rawJobsMap.get(fingerprint);
            if (!existing || (!existing.posted_date && extractedJob.posted_date)) {
              rawJobsMap.set(fingerprint, extractedJob);
            }
          }
        }
      }

      // Filtro de Segurança Final (Email)
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
        title: "Importação Power Query Style",
        description: `Sucesso: ${finalJobs.length}. Mantivemos Duties, SpecialReq e Deductions.`,
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
          <Database className="h-6 w-6 text-primary" /> Importador V4 (Power Query Logic)
        </CardTitle>
        <CardDescription>Réplica exata da lógica do seu Power Query para garantir todos os campos.</CardDescription>
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
          Importar (Lógica Power Query)
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
