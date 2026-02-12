import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Fingerprint, Lock } from "lucide-react";
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

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            const nested = getVal(item, ["clearanceOrder"]) || {};
            const flat = { ...item, ...nested };
            const reqs = getVal(flat, ["jobRequirements", "qualification"]) || {};

            const title = (getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]) || "").trim();
            const company = (getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]) || "").trim();
            if (!title || !company) continue;

            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
            const fingerprint = getCaseBody(rawJobId);

            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");
            const rawWage = getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]);

            // Lógica de Transição (Match de DNA no Mapa)
            const existing = rawJobsMap.get(fingerprint);
            let isTransition = false;
            if (
              existing &&
              ((existing.visa_type.includes("Early Access") && visaType === "H-2A") ||
                (visaType.includes("Early Access") && existing.visa_type === "H-2A"))
            ) {
              isTransition = true;
            }

            // --- CAMPOS TRAVADOS (V56) - NÃO REMOVER ---
            const extractedJob = {
              id: crypto.randomUUID(),
              job_id: rawJobId.split("-GHOST-")[0].trim(),
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: getVal(flat, ["recApplyEmail", "email"]),
              phone: getVal(flat, ["recApplyPhone", "empPhone", "phone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode"]),
              salary: calculateFinalWage(rawWage, weeklyHours),
              start_date: formatToISODate(getVal(flat, ["tempneedStart", "jobBeginDate", "start_date"])),
              posted_date: formatToISODate(getVal(flat, ["DECISION_DATE", "dateAcceptanceLtrIssued"])),
              end_date: formatToISODate(getVal(flat, ["tempneedEnd", "jobEndDate"])),

              // Dados Detalhados
              job_duties: getVal(flat, ["jobDuties", "tempneedDescription", "job_duties"]),
              job_min_special_req:
                getVal(flat, ["jobMinspecialreq", "jobAddReqinfo"]) ||
                getVal(reqs, ["specialRequirements", "jobMinSpecialReq"]),
              wage_additional: getVal(flat, ["wageAdditional", "jobSpecialPayInfo", "addSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),

              // Quantitativos
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

              // Outros
              transport_provided:
                getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) === "true" ||
                getVal(flat, ["recIsDailyTransport", "isDailyTransport"]) === true,
              source_url: getVal(flat, ["recApplyUrl", "jobRobotUrl", "url"]),
              housing_info: visaType.includes("H-2A") ? "Yes (H-2A Mandated)" : null,
              was_early_access: isTransition || (existing?.was_early_access ?? false),
            };

            if (existing && existing.visa_type === "H-2A" && visaType.includes("Early Access")) {
              existing.was_early_access = true;
            } else {
              rawJobsMap.set(fingerprint, extractedJob);
            }
          }
        }
      }

      const finalJobs = Array.from(rawJobsMap.values()).filter((j) => j.email && j.email.length > 2);

      const BATCH_SIZE = 500;
      for (let i = 0; i < finalJobs.length; i += BATCH_SIZE) {
        setProgress({ current: i, total: finalJobs.length });
        const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: finalJobs.slice(i, i + BATCH_SIZE) });
        if (error) throw error;
      }

      toast({ title: "H2 Linker V56 Sincronizado", description: "Colunas travadas e transições mapeadas." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-indigo-600 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-indigo-700">
          <Lock className="h-6 w-6" /> H2 Linker Sync V56 (Columns Locked)
        </CardTitle>
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
          className="w-full h-12 bg-indigo-700 hover:bg-indigo-800 font-bold text-white transition-all"
        >
          {processing ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <RefreshCw className="h-5 w-5 mr-2" />}
          Sincronizar com DNA e Colunas Travadas
        </Button>
      </CardContent>
    </Card>
  );
}
