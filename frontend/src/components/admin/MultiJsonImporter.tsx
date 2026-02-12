import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Send, Zap } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const parseMoney = (val: any) => {
    if (!val) return null;
    const num = parseFloat(String(val).replace(/[$,]/g, ""));
    return isNaN(num) || num <= 0 ? null : num;
  };

  const calculateFinalWage = (rawVal: any, hours: any) => {
    let val = parseMoney(rawVal);
    if (!val) return null;
    if (val > 100) {
      const h = hours && hours > 0 ? hours : 40;
      let calc = val / (h * 4.333);
      if (calc >= 7.25 && calc <= 95) return parseFloat(calc.toFixed(2));
      return null;
    }
    return val;
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

  const getCaseBody = (id: string) => {
    if (!id) return id;
    const parts = id.split("-");
    if (parts[0] === "JO" && parts[1] === "A") return parts.slice(2).join("-");
    if (parts[0] === "H") return parts.slice(1).join("-");
    return id;
  };

  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;
    const lowerKeysMap: { [key: string]: any } = {};
    for (const k of Object.keys(obj)) lowerKeysMap[k.toLowerCase()] = obj[k];
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
            const nested = getVal(item, ["clearanceOrder"]) || {};
            const flat = { ...item, ...nested };
            const reqs = getVal(flat, ["jobRequirements", "qualification"]) || {};

            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
            if (!rawJobId) continue;

            const fingerprint = getCaseBody(rawJobId);
            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");

            const extractedJob = {
              id: crypto.randomUUID(),
              job_id: rawJobId.split("-GHOST-")[0].trim(),
              visa_type: visaType,
              fingerprint: fingerprint,
              job_title: getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]),
              company: getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]),
              email: getVal(flat, ["recApplyEmail", "email"]),
              phone: getVal(flat, ["recApplyPhone", "empPhone", "phone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode"]),
              salary: calculateFinalWage(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]), weeklyHours),
              start_date: formatToISODate(getVal(flat, ["tempneedStart", "jobBeginDate", "start_date"])),
              posted_date: formatToISODate(getVal(flat, ["DECISION_DATE", "dateAcceptanceLtrIssued"])),
              end_date: formatToISODate(getVal(flat, ["tempneedEnd", "jobEndDate"])),
              job_duties: getVal(flat, ["jobDuties", "tempneedDescription", "job_duties"]),
              job_min_special_req:
                getVal(flat, ["jobMinspecialreq", "jobAddReqinfo"]) ||
                getVal(reqs, ["specialRequirements", "jobMinSpecialReq"]),
              wage_additional: getVal(flat, ["wageAdditional", "jobSpecialPayInfo", "addSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),
              weekly_hours: weeklyHours || null,
              category: getVal(flat, ["tempneedSocTitle", "jobSocTitle", "socTitle"]),
              openings:
                parseInt(
                  String(
                    getVal(flat, ["jobWrksNeeded", "jobWrksNeededH2a", "totalWorkersNeeded", "tempneedWkrPos"]) || "0",
                  ),
                  10,
                ) || null,
              experience_months:
                parseInt(
                  String(
                    getVal(flat, ["jobMinexpmonths", "experienceMonths"]) || getVal(reqs, ["monthsExperience"]) || "0",
                  ),
                  10,
                ) || 0,
              education_required: getVal(flat, ["jobMinedu", "educationLevel"]) || getVal(reqs, ["educationLevel"]),
              transport_provided:
                getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) === "true" ||
                getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) === true,
              source_url: getVal(flat, ["recApplyUrl", "jobRobotUrl", "url"]),
              housing_info: visaType.includes("H-2A") ? "Yes (H-2A Mandated)" : null,
              is_active: true,
            };

            rawJobsMap.set(fingerprint, extractedJob);
          }
        }
      }

      const allJobs = Array.from(rawJobsMap.values()).filter((j) => j.email && j.email.length > 2);
      setProgress({ current: 0, total: allJobs.length });

      // --- COMO CHAMAR A FUNÇÃO EDGE (V58) ---
      // 'import-jobs' deve ser o nome da sua pasta dentro de supabase/functions
      const { data, error } = await supabase.functions.invoke("import-jobs", {
        body: { jobs: allJobs },
      });

      if (error) throw error;

      toast({
        title: "Sincronização Turbo Concluída!",
        description: `Processamos ${data.imported} vagas via Edge Function.`,
      });
    } catch (err: any) {
      toast({ title: "Erro no Importer", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-indigo-500 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-indigo-700">
          <Zap className="h-6 w-6" /> H2 Linker Sync V58 (Edge Mode)
        </CardTitle>
        <CardDescription>Velocidade máxima de processamento via servidor.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full text-sm"
        />
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-12 bg-indigo-700 hover:bg-indigo-900 font-bold text-white"
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin h-5 w-5" /> Enviando ao Servidor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="h-5 w-5" /> Disparar para o Backend
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
