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
      getVal(root, ["DECISION_DATE", "decision_date", "dateAcceptanceLtrIssued"]) ||
      getVal(nested, ["DECISION_DATE", "decision_date", "dateAcceptanceLtrIssued"]);
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
            const root = item || {};
            const nested = item.clearanceOrder || {};

            // Fusão Prioritária para Dados Profundos
            const flat = { ...root, ...nested };
            const reqs = nested.jobRequirements || root.jobRequirements || {};

            const title = getVal(flat, ["jobTitle", "job_title", "tempneedJobtitle", "JOB_TITLE", "TITLE"]);
            const company = getVal(flat, [
              "empBusinessName",
              "employerBusinessName",
              "legalName",
              "empName",
              "company",
            ]);
            if (!title || !company) continue;

            const fein = getVal(flat, ["empFein", "employer_fein", "fein"]);
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "START_DATE"]),
            );
            const fingerprint = `${fein}|${String(title).toUpperCase()}|${start}`;

            // --- MAPEAMENTO V43 (RESTAURAÇÃO TOTAL) ---

            // 1. Contatos Limpos
            const rawPhone = getVal(flat, ["empPhone", "employer_phone", "emppocPhone", "PHONE", "recApplyPhone"]);
            const cleanPhone = rawPhone ? String(rawPhone).replace(/[\t\s]/g, "") : null;

            // 2. Openings (Ajustado para H-2B novo via tempneedWkrPos)
            const openingsVal = getVal(flat, [
              "tempneedWkrPos",
              "jobWrksNeeded",
              "totalWorkersNeeded",
              "jobWrksNeededH2a",
            ]);
            const openings = parseInt(String(openingsVal || "0"), 10) || null;

            // 3. Work Schedule (Apenas Horas Semanais conforme pedido)
            const weeklyHours = getVal(flat, ["jobHoursTotal", "basicHours", "weekly_hours", "totalHours"]);

            // 4. Detalhes Financeiros e Requisitos
            const specialReqs =
              getVal(reqs, ["jobMinSpecialReq", "specialRequirements", "SPEC_REQ_DESC"]) ||
              getVal(flat, ["jobMinSpecialReq", "specialRequirements"]);
            const deductions = getVal(flat, [
              "recPayDeductions",
              "payDeductions",
              "PAY_DEDUCTION_DESC",
              "pay_deductions",
            ]);
            const bonus = getVal(flat, ["wageAdditional", "WAGE_ADDITIONAL_DESC", "additional_wage_info"]);

            const extractedJob = {
              job_id: getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER", "JO_ORDER_NUMBER"]) || fingerprint,
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail", "EMAIL", "email"]),
              phone: cleanPhone,
              city: getVal(flat, ["jobCity", "job_city", "worksite_city", "CITY"]),
              state: getVal(flat, ["jobState", "job_state", "worksite_state", "STATE"]),
              salary: parseMoney(getVal(flat, ["wageFrom", "jobWageOffer", "BASIC_WAGE_RATE", "AEWR"])),
              start_date: start,
              posted_date: determinePostedDate(item, fingerprint),
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd", "END_DATE"])),

              // Novos campos preenchidos corretamente
              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription", "JOB_DUTIES", "description"]),
              job_min_special_req: specialReqs,
              rec_pay_deductions: deductions,
              wage_additional: bonus,
              weekly_hours: weeklyHours, // Aqui entram as 40h

              category: getVal(flat, ["socTitle", "soc_title", "SOC_TITLE", "category"]) || "General Labor",
              openings: openings,
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

      toast({
        title: "Sincronização V43 Concluída",
        description: "Vagas H-2B restauradas com horas semanais e número de vagas correto.",
      });
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
          <UploadCloud className="h-6 w-6 text-green-700" /> Sincronizador V43 (Hours & Openings Fixed)
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
          Sincronizar Agora
        </Button>
      </CardContent>
    </Card>
  );
}
