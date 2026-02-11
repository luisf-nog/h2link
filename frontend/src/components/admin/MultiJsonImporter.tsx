import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, UploadCloud } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" });
  const { toast } = useToast();

  const parseMoney = (val: any) => {
    if (!val) return null;
    const num = parseFloat(String(val).replace(/[$,]/g, ""));
    return isNaN(num) || num <= 0 ? null : num;
  };

  // --- CÁLCULO DE SALÁRIO V48 (CORREÇÃO DE VALORES MENSAIS/TOTAL) ---
  const calculateFinalWage = (rawVal: any, hours: any) => {
    let val = parseMoney(rawVal);
    if (!val) return null;

    // Se o valor for até 100, já é o valor por hora (AEWR padrão)
    if (val <= 100) return val;

    // Se for acima de 100 (ex: 3711.36), é salário mensal ou por período.
    // Usamos as horas do JSON ou o padrão de 40h/semana se vier zerado.
    const h = hours && hours > 0 ? hours : 40;

    // Lógica Power Query: Valor / (Horas Semanais * 4.333 semanas/mês)
    let calc = val / (h * 4.333);

    // Filtro de sanidade: o resultado deve estar entre o mínimo e um teto razoável
    if (calc >= 7.25 && calc <= 95) {
      return parseFloat(calc.toFixed(2));
    }

    return null;
  };

  const formatToISODate = (dateStr: any) => {
    if (!dateStr || dateStr === "N/A") return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  // --- LIMPEZA DE GHOST IDs ---
  const cleanJobId = (id: string | null) => {
    if (!id) return id;
    return id.split("-GHOST-")[0].trim();
  };

  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;
    const lowerKeysMap: { [key: string]: any } = {};
    for (const k of Object.keys(obj)) {
      lowerKeysMap[k.toLowerCase()] = obj[k];
    }
    for (const key of keys) {
      const targetKey = key.toLowerCase();
      if (lowerKeysMap[targetKey] !== undefined && lowerKeysMap[targetKey] !== null) {
        const val = lowerKeysMap[targetKey];
        if (typeof val === "string") {
          const clean = val.trim();
          if (clean === "" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "null") continue;
          return clean;
        }
        return val;
      }
    }
    return null;
  };

  const determinePostedDate = (item: any, jobId: string) => {
    const root = item || {};
    const nested = getVal(item, ["clearanceOrder"]) || {};
    const decisionDate =
      getVal(root, ["DECISION_DATE", "dateAcceptanceLtrIssued"]) ||
      getVal(nested, ["DECISION_DATE", "dateAcceptanceLtrIssued"]);
    if (decisionDate) return formatToISODate(decisionDate);
    const submissionDate =
      getVal(root, ["dateSubmitted", "CASE_SUBMITTED", "form790AsOfDate"]) ||
      getVal(nested, ["dateSubmitted", "CASE_SUBMITTED", "form790AsOfDate"]);
    if (submissionDate) return formatToISODate(submissionDate);
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
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
          const list = Array.isArray(json) ? json : json.data || json.results || [];

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            const nested = getVal(item, ["clearanceOrder"]) || {};
            const flat = { ...item, ...nested };
            const reqs = getVal(flat, ["jobRequirements", "qualification"]) || {};

            const title = getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]);
            const company = getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]);
            if (!title || !company) continue;

            const fein = getVal(flat, ["empFein", "fein"]);
            const start = formatToISODate(getVal(flat, ["tempneedStart", "jobBeginDate", "start_date"]));
            const city = getVal(flat, ["jobCity", "city"]);
            const fingerprint = `${fein}|${String(title).toUpperCase()}|${String(city || "").toUpperCase()}|${start}`;

            // Lógica de Limpeza de ID e Transição V48
            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || fingerprint;
            const jobId = cleanJobId(rawJobId);
            const transitioned = visaType === "H-2A" && (rawJobId.includes("GHOST") || rawJobId.includes("JO-A"));

            const rawPhone = getVal(flat, ["recApplyPhone", "empPhone", "phone"]);
            const cleanPhone = rawPhone ? String(rawPhone).replace(/[\t\s]/g, "") : null;

            // Variáveis para o cálculo do salário
            const rawWage = getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]);
            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");

            const rawTransp = getVal(flat, ["recIsDailyTransport", "isDailyTransport"]);
            const isTransportProvided =
              rawTransp === true || rawTransp === "true" || rawTransp === 1 || rawTransp === "1";

            const extractedJob = {
              id: crypto.randomUUID(),
              job_id: jobId,
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: getVal(flat, ["recApplyEmail", "email"]),
              phone: cleanPhone,
              city: city,
              state: getVal(flat, ["jobState"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode"]),

              // SALÁRIO CORRIGIDO V48
              salary: calculateFinalWage(rawWage, weeklyHours),

              start_date: start,
              posted_date: determinePostedDate(item, fingerprint),
              end_date: formatToISODate(getVal(flat, ["tempneedEnd", "jobEndDate"])),
              job_duties: getVal(flat, ["jobDuties", "tempneedDescription", "job_duties"]),
              job_min_special_req:
                getVal(flat, ["jobMinspecialreq", "jobAddReqinfo"]) || getVal(reqs, ["specialRequirements"]),
              wage_additional: getVal(flat, ["wageAdditional", "jobSpecialPayInfo", "addSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),
              weekly_hours: weeklyHours || null,
              category: getVal(flat, ["tempneedSocTitle", "jobSocTitle", "socTitle"]),
              openings:
                parseInt(String(getVal(flat, ["tempneedWkrPos", "jobWrksNeeded", "totalWorkersNeeded"]) || "0"), 10) ||
                null,
              experience_months:
                parseInt(
                  String(
                    getVal(flat, ["jobMinexpmonths", "experienceMonths"]) || getVal(reqs, ["monthsExperience"]) || "0",
                  ),
                  10,
                ) || 0,
              education_required: getVal(flat, ["jobMinedu", "educationLevel"]),
              transport_provided: isTransportProvided,
              source_url: getVal(flat, ["recApplyUrl", "jobRobotUrl", "url"]),
              housing_info: visaType.includes("H-2A") ? "Yes (H-2A Mandated)" : null,
              was_early_access: transitioned,
            };

            rawJobsMap.set(fingerprint, extractedJob);
          }
        }
      }

      const finalJobs = Array.from(rawJobsMap.values()).filter((j) => j.email && j.email.length > 2);

      const BATCH_SIZE = 500;
      for (let i = 0; i < finalJobs.length; i += BATCH_SIZE) {
        const batch = finalJobs.slice(i, i + BATCH_SIZE);
        setProgress({ current: i, total: finalJobs.length, status: `Sincronizando lote ${i / BATCH_SIZE + 1}...` });
        const { error } = await supabase.rpc("process_jobs_bulk" as any, { jobs_data: batch });
        if (error) throw error;
      }

      toast({ title: "Sincronização V48", description: "IDs limpos e salários corrigidos com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <UploadCloud className="h-6 w-6" /> H2 Linker Sync V48
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-dashed rounded-lg p-6 mb-4 text-center bg-slate-50">
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">Arraste seus arquivos JSON ou ZIP aqui</p>
        </div>

        {progress.total > 0 && (
          <div className="mb-4 text-sm font-medium text-slate-600">
            {progress.status} ({Math.round((progress.current / progress.total) * 100)}%)
          </div>
        )}

        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-12 bg-green-700 hover:bg-green-800 text-lg font-bold"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar Produção
        </Button>
      </CardContent>
    </Card>
  );
}
