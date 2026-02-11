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

  const calculateFinalWage = (rawVal: any, hours: any) => {
    let val = parseMoney(rawVal);
    if (!val) return null;
    if (val <= 100) return val;
    if (hours && hours > 0) {
      let calc = val / (hours * 4.333);
      if (calc >= 7.25 && calc <= 80) return parseFloat(calc.toFixed(2));
    }
    return null;
  };

  const formatToISODate = (dateStr: any) => {
    if (!dateStr || dateStr === "N/A" || !dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  // --- O MOTOR BLINDADO (CASE-INSENSITIVE) ---
  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;

    // 1. Converte todas as chaves do objeto atual para minúsculas
    const lowerKeysMap: { [key: string]: any } = {};
    for (const k of Object.keys(obj)) {
      lowerKeysMap[k.toLowerCase()] = obj[k];
    }

    // 2. Procura usando as nossas chaves também em minúsculas
    for (const key of keys) {
      const targetKey = key.toLowerCase();
      if (lowerKeysMap[targetKey] !== undefined && lowerKeysMap[targetKey] !== null) {
        const val = lowerKeysMap[targetKey];
        if (typeof val === "string") {
          const clean = val.trim();
          if (clean === "" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "null") continue;
          return clean; // Retorna limpo se for string
        }
        return val; // Retorna objeto/número intacto
      }
    }
    return null;
  };

  const determinePostedDate = (item: any, jobId: string) => {
    const root = item || {};
    // Agora até a busca pelo clearanceOrder ignora maiúsculas/minúsculas
    const nested = getVal(item, ["clearanceOrder"]) || {};
    const decisionDate =
      getVal(root, ["decision_date", "dateAcceptanceLtrIssued"]) ||
      getVal(nested, ["decision_date", "dateAcceptanceLtrIssued"]);
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
            // Com o novo getVal, não importa se é ClearanceOrder ou clearanceorder
            const nested = getVal(item, ["clearanceOrder"]) || {};
            const flat = { ...item, ...nested };

            // Mergulho nos requisitos também sem medo de Case Sensitivity
            const reqs = getVal(flat, ["jobRequirements", "qualification"]) || {};

            const title = getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]);
            const company = getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]);
            if (!title || !company) continue;

            const fein = getVal(flat, ["empFein", "fein"]);
            const start = formatToISODate(getVal(flat, ["tempneedStart", "jobBeginDate", "start_date"]));
            const city = getVal(flat, ["jobCity"]);
            const fingerprint = `${fein}|${String(title).toUpperCase()}|${String(city || "").toUpperCase()}|${start}`;

            const rawPhone = getVal(flat, ["recApplyPhone", "empPhone", "phone"]);
            const cleanPhone = rawPhone ? String(rawPhone).replace(/[\t\s]/g, "") : null;

            const rawWage = getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]);
            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours"]) || "0");

            // --- MAPEAMENTO ABSOLUTO DO POWER QUERY M SCRIPT ---
            const extractedJob = {
              id: crypto.randomUUID(),
              job_id: getVal(flat, ["caseNumber", "jobOrderNumber"]) || fingerprint,
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: getVal(flat, ["recApplyEmail", "email"]),
              phone: cleanPhone,
              city: city,
              state: getVal(flat, ["jobState"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode"]), // Adicionado do script M

              salary: calculateFinalWage(rawWage, weeklyHours),

              start_date: start,
              posted_date: determinePostedDate(item, fingerprint),
              end_date: formatToISODate(getVal(flat, ["tempneedEnd", "jobEndDate"])),

              job_duties: getVal(flat, ["jobDuties", "tempneedDescription"]),

              // Chaves do passo 8: Independentemente da Capitalização, ele vai achar!
              job_min_special_req:
                getVal(flat, ["jobMinspecialreq", "jobAddReqinfo"]) ||
                getVal(reqs, ["specialRequirements", "jobMinSpecialReq"]),
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
                    getVal(flat, ["jobMinexpmonths", "experienceMonths"]) ||
                      getVal(reqs, ["monthsExperience", "experienceMonths"]) ||
                      "0",
                  ),
                  10,
                ) || 0,

              // Outros campos do script M (Caso a base suporte)
              education_required: getVal(flat, ["jobMinedu", "educationLevel"]),
              transport_provided: getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) ? true : false,
            };

            rawJobsMap.set(fingerprint, extractedJob);
          }
        }
      }

      const finalJobs = Array.from(rawJobsMap.values()).filter((j) => j.email && j.email.length > 2);

      const BATCH_SIZE = 500;
      for (let i = 0; i < finalJobs.length; i += BATCH_SIZE) {
        const batch = finalJobs.slice(i, i + BATCH_SIZE);
        setProgress({
          current: i,
          total: finalJobs.length,
          status: `Gravando lote de ${batch.length} vagas sem duplicados...`,
        });
        const { error } = await supabase.rpc("process_jobs_bulk" as any, { jobs_data: batch });
        if (error) throw error;
      }

      setProgress({ current: finalJobs.length, total: finalJobs.length, status: "Concluído!" });
      toast({ title: "Importação Finalizada", description: "Vagas processadas com o motor Case-Insensitive." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-green-700" /> Importador Definitivo (Case-Insensitive)
        </CardTitle>
        <CardDescription>Extração blindada contra mudanças no governo americano.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border-dashed border-2 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-white transition-colors mb-4">
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full" />
        </div>

        {progress.total > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-slate-600 flex justify-between">
              <span>{progress.status}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className="bg-green-700 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        )}

        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-12 bg-green-700 hover:bg-green-800 text-lg font-bold"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Iniciar Sincronização Blindada
        </Button>
      </CardContent>
    </Card>
  );
}
