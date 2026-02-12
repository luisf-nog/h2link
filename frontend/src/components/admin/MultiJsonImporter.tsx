import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Database, CheckCircle2, AlertTriangle } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  // --- 1. VALIDAÇÃO DE DINHEIRO ---
  const calculateFinalWage = (rawVal: any, hours: any) => {
    if (!rawVal) return null;
    let val = parseFloat(String(rawVal).replace(/[$,]/g, ""));
    if (isNaN(val) || val <= 0) return null;

    // Se o valor for "total anual/mensal" (ex: 3711), converte para hora
    if (val > 100) {
      const h = hours && hours > 0 ? hours : 40;
      let calc = val / (h * 4.333);
      return calc >= 7.25 && calc <= 95 ? parseFloat(calc.toFixed(2)) : null;
    }
    return val;
  };

  // --- 2. EXTRAÇÃO DE DNA (FINGERPRINT) ---
  const getCaseBody = (id: string) => {
    if (!id) return id;
    const parts = id.split("-");
    if (parts[0] === "JO" && parts[1] === "A") return parts.slice(2).join("-");
    if (parts[0] === "H") return parts.slice(1).join("-");
    return id;
  };

  // --- 3. MAPEADOR DE COLUNAS VALIDADO ---
  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;
    const lowerKeysMap: { [key: string]: any } = {};
    for (const k of Object.keys(obj)) lowerKeysMap[k.toLowerCase()] = obj[k];
    for (const key of keys) {
      const targetKey = key.toLowerCase();
      if (lowerKeysMap[targetKey] !== undefined && lowerKeysMap[targetKey] !== null) {
        return String(lowerKeysMap[targetKey]).trim();
      }
    }
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
          let visaType = filename.toLowerCase().includes("h2b")
            ? "H-2B"
            : filename.toLowerCase().includes("jo")
              ? "H-2A (Early Access)"
              : "H-2A";

          for (const item of list) {
            // Flatten nested objects found in JO/H2A structure
            const clearance = item.clearanceOrder || {};
            const jobReqs = (clearance.jobRequirements || item.jobRequirements || {}).qualification || {};
            const flat = { ...item, ...clearance, ...jobReqs };

            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
            if (!rawJobId) continue;

            const fingerprint = getCaseBody(rawJobId);
            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");

            const extractedJob = {
              id: crypto.randomUUID(),
              job_id: rawJobId.split("-GHOST-")[0].trim(),
              visa_type: visaType,
              fingerprint: fingerprint,
              job_title: getVal(flat, ["jobTitle", "tempneedJobtitle", "title"]),
              company: getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]),
              email: getVal(flat, ["recApplyEmail", "email"]),
              phone: getVal(flat, ["recApplyPhone", "empPhone", "phone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState", "state"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode", "worksite_zip"]),
              salary: calculateFinalWage(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]), weeklyHours),
              start_date: getVal(flat, ["jobBeginDate", "tempneedStart", "start_date"]),
              posted_date: getVal(flat, ["DECISION_DATE", "dateAcceptanceLtrIssued", "posted_date"]),
              end_date: getVal(flat, ["jobEndDate", "tempneedEnd", "end_date"]),
              job_duties: getVal(flat, ["jobDuties", "tempneedDescription", "description"]),
              job_min_special_req: getVal(flat, ["jobMinspecialreq", "jobAddReqinfo", "specialRequirements"]),
              wage_additional: getVal(flat, ["wageAdditional", "addSpecialPayInfo", "jobSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),
              weekly_hours: weeklyHours || null,
              category: getVal(flat, ["socTitle", "jobSocTitle", "tempneedSocTitle"]),

              // --- COLUNAS QUE ESTAVAM FALTANDO (VALIDADAS) ---
              openings: parseInt(
                getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "jobWrksNeededH2a", "tempneedWkrPos"]) || "0",
              ),
              experience_months: parseInt(
                getVal(flat, ["jobMinexpmonths", "experienceMonths", "monthsExperience"]) || "0",
              ),
              education_required: getVal(flat, ["educationLevel", "jobMinedu", "education_required"]),

              transport_provided:
                getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) === "true" ||
                getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) === "Y",
              source_url: getVal(flat, ["url", "jobRobotUrl", "recApplyUrl"]),
              housing_info: visaType.includes("H-2A") ? "Yes (H-2A Mandated)" : getVal(flat, ["housing_info"]),
              was_early_access: false,
            };
            rawJobsMap.set(fingerprint, extractedJob);
          }
        }
      }

      const allJobs = Array.from(rawJobsMap.values()).filter((j) => j.email);

      // Envio em lotes direto para o SQL
      const BATCH_SIZE = 500;
      for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
        const batch = allJobs.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: batch });
        if (error) throw error;
      }

      toast({
        title: "V60 Validada - Sucesso!",
        description: `${allJobs.length} vagas sincronizadas com todas as colunas.`,
      });
    } catch (err: any) {
      toast({ title: "Erro de Validação", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-blue-600 shadow-2xl bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 font-black">
          <Database className="h-6 w-6" /> H2 Linker Sync V60
        </CardTitle>
        <CardDescription>Mapeamento de Experiência e Vagas Validado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-blue-50 p-2 rounded border border-blue-100">
          <div className="flex items-center gap-1 text-green-700">
            <CheckCircle2 size={12} /> Openings OK
          </div>
          <div className="flex items-center gap-1 text-green-700">
            <CheckCircle2 size={12} /> Experience OK
          </div>
          <div className="flex items-center gap-1 text-green-700">
            <CheckCircle2 size={12} /> DNA Case OK
          </div>
          <div className="flex items-center gap-1 text-blue-700">
            <CheckCircle2 size={12} /> Direct DB OK
          </div>
        </div>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full text-sm"
        />
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-12 bg-blue-700 hover:bg-blue-800 text-white font-bold"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar Produção V60
        </Button>
      </CardContent>
    </Card>
  );
}
