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

  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        const val = obj[key];
        if (typeof val === "string") {
          const clean = val.trim();
          if (clean === "" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "null") continue;
        }
        return val;
      }
    }
    return null;
  };

  const determinePostedDate = (item: any, jobId: string) => {
    const root = item || {};
    const nested = item.clearanceOrder || {};
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
            // A mesma lógica FlattenH2A do seu Power Query:
            const nested = item.clearanceOrder || {};
            const flat = { ...item, ...nested };

            const title = getVal(flat, ["tempneedJobtitle", "jobTitle", "job_title"]);
            const company = getVal(flat, ["empBusinessName", "employerBusinessName"]);
            if (!title || !company) continue;

            const fein = getVal(flat, ["empFein"]);
            const start = formatToISODate(getVal(flat, ["tempneedStart", "jobBeginDate", "job_begin_date"]));
            const city = getVal(flat, ["jobCity", "job_city"]);

            // O Fingerprint exato do seu Power Query: fein|title|city|start
            const fingerprint = `${fein}|${String(title).toUpperCase()}|${String(city || "").toUpperCase()}|${start}`;

            const rawPhone = getVal(flat, ["recApplyPhone", "empPhone"]);
            const cleanPhone = rawPhone ? String(rawPhone).replace(/[\t\s]/g, "") : null;

            // Mapeamento 1:1 do seu Power Query
            const extractedJob = {
              job_id: getVal(flat, ["caseNumber"]) || fingerprint,
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: getVal(flat, ["recApplyEmail"]),
              phone: cleanPhone,
              city: city,
              state: getVal(flat, ["jobState", "job_state"]),

              // O seu "Col Salary"
              salary: parseMoney(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"])),

              start_date: start,
              posted_date: determinePostedDate(item, fingerprint),
              end_date: formatToISODate(getVal(flat, ["tempneedEnd", "jobEndDate", "job_end_date"])),

              // Exatamente as chaves do passo 8 do seu script
              job_duties: getVal(flat, ["jobDuties", "tempneedDescription", "job_duties"]),
              job_min_special_req: getVal(flat, ["jobMinspecialreq", "jobAddReqinfo"]),
              wage_additional: getVal(flat, ["wageAdditional", "jobSpecialPayInfo", "addSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),
              weekly_hours: getVal(flat, ["jobHoursTotal"]),

              category: getVal(flat, ["tempneedSocTitle", "jobSocTitle", "socTitle"]),
              openings:
                parseInt(String(getVal(flat, ["tempneedWkrPos", "jobWrksNeeded", "totalWorkersNeeded"]) || "0"), 10) ||
                null,
              experience_months: parseInt(String(getVal(flat, ["jobMinexpmonths"]) || "0"), 10) || 0,
            };

            rawJobsMap.set(fingerprint, extractedJob);
          }
        }
      }

      const finalJobs = Array.from(rawJobsMap.values()).filter((j) => j.email && j.email.length > 2);

      const BATCH_SIZE = 500;
      for (let i = 0; i < finalJobs.length; i += BATCH_SIZE) {
        const batch = finalJobs.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.rpc("process_jobs_bulk" as any, { jobs_data: batch });
        if (error) throw error;
      }

      toast({ title: "Sincronização V44 Concluída", description: "Lógica Power Query aplicada com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro Fatal", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-green-700" /> Importador V44 (M-Script Engine)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="mb-4 w-full"
        />
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-12 bg-green-700 hover:bg-green-800"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar Produção
        </Button>
      </CardContent>
    </Card>
  );
}
