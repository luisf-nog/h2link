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
    if (!dateStr || dateStr === "N/A") return null;
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
          const clean = val.trim().toLowerCase();
          if (clean === "" || clean === "n/a" || clean === "null") continue;
        }
        return val;
      }
    }
    return null;
  };

  const toList = (json: any) => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.results)) return json.results;
    if (Array.isArray(json.records)) return json.records;
    if (Array.isArray(json.items)) return json.items;
    if (json.caseNumber || json.jobOrderNumber || json.CASE_NUMBER || json.JO_ORDER_NUMBER) return [json];
    const arr = Object.values(json).find((v) => Array.isArray(v));
    return Array.isArray(arr) ? (arr as any[]) : [];
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

    if (jobId && jobId.startsWith("JO-")) {
      const match = jobId.match(/-(\d{2})(\d{3})-/);
      if (match) {
        const date = new Date(2000 + parseInt(match[1], 10), 0);
        date.setDate(parseInt(match[2], 10));
        return date.toISOString().split("T")[0];
      }
    }
    return null;
  };

  const calculateFinalWage = (item: any, flat: any) => {
    let val = parseMoney(
      item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE || item.AEWR || item.BASIC_RATE,
    );
    if (!val && item.clearanceOrder) val = parseMoney(item.clearanceOrder.jobWageOffer);
    if (val && val > 100) {
      const hours = parseFloat(String(getVal(flat, ["jobHoursTotal", "basicHours", "weekly_hours"]) || "40"));
      if (hours > 0) {
        const hourly = val / (hours * 4.333);
        if (hourly >= 7.25 && hourly <= 150) return parseFloat(hourly.toFixed(2));
      }
    }
    return val;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress({ current: 0, total: 100, status: "A ler ficheiros..." });

    try {
      const rawJobsMap = new Map<string, any>();

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
          let json: any;
          try {
            json = JSON.parse(content);
          } catch (e) {
            console.warn("JSON inválido:", filename, e);
            continue;
          }

          const list = toList(json);
          if (!list.length) continue;

          let fileVisaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) fileVisaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) fileVisaType = "H-2A (Early Access)";

          for (const item of list) {
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;

            let title = getVal(flat, ["jobTitle", "job_title", "tempneedJobtitle", "JOB_TITLE", "TITLE"]);
            let company = getVal(flat, ["empBusinessName", "employerBusinessName", "legalName", "empName", "company"]);

            // Fallback de Emergência
            if (!title) {
              title = fileVisaType.includes("H-2A")
                ? "Agricultural Worker (Emergency Filing)"
                : "General Labor (Emergency Filing)";
            }
            if (!company) {
              company = "Confidential Employer";
            }

            const fein = getVal(flat, ["empFein", "employer_fein", "fein"]);
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "START_DATE"]),
            );
            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER", "JO_ORDER_NUMBER"]);
            const fingerprint = `${fein}|${String(title).toUpperCase()}|${start}`;
            const finalJobId = rawJobId || fingerprint;

            const posted_date = determinePostedDate(item, finalJobId);
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail", "EMAIL"]);
            const openings =
              parseInt(
                String(
                  getVal(flat, ["jobWrksNeeded", "jobWrksNeededH2a", "tempneedWkrPos", "totalWorkersNeeded"]) || "",
                ),
                10,
              ) || null;

            const extractedJob = {
              id: crypto.randomUUID(),
              job_id: finalJobId,
              visa_type: fileVisaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: email,
              posted_date: posted_date,
              salary: calculateFinalWage(item, flat),
              city: getVal(flat, ["jobCity", "job_city", "worksite_city", "empCity", "CITY"]),
              state: getVal(flat, ["jobState", "job_state", "worksite_state", "empState", "STATE"]),
              start_date: start,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "END_DATE"])),
              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription"]),
              openings: openings,
              category: "General Labor",
            };

            // A MUDANÇA ESTÁ AQUI: Agrupa pela "Digital" da vaga (fingerprint) em vez do job_id
            rawJobsMap.set(fingerprint, extractedJob);
          }
        }
      }

      // Filtro para garantir vagas válidas
      const finalJobs = Array.from(rawJobsMap.values()).filter((j) => {
        return j.id && j.email && j.email.length > 2;
      });

      const BATCH_SIZE = 1000;
      let processed = 0;

      for (let i = 0; i < finalJobs.length; i += BATCH_SIZE) {
        const batch = finalJobs.slice(i, i + BATCH_SIZE);
        setProgress({
          current: processed,
          total: finalJobs.length,
          status: `A gravar lote de ${batch.length} vagas no banco de dados...`,
        });

        const { error } = await supabase.rpc("process_jobs_bulk" as any, { jobs_data: batch });
        if (error) throw error;

        processed += batch.length;
      }

      setProgress({ current: finalJobs.length, total: finalJobs.length, status: "Concluído!" });
      toast({
        title: "Importação Concluída com Sucesso",
        description: `Foram processadas ${finalJobs.length} vagas sem duplicados.`,
      });
    } catch (err: any) {
      toast({ title: "Erro Fatal na Importação", description: err.message, variant: "destructive" });
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader className="bg-slate-50">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <UploadCloud className="h-6 w-6 text-green-700" /> Importador de Vagas (Final)
        </CardTitle>
        <CardDescription>Envio otimizado com eliminação de duplicados via Fingerprint.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="border-dashed border-2 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-white transition-colors">
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full" />
          <p className="mt-2 text-sm text-slate-500">JSON ou ZIP do Departamento de Trabalho (DOL)</p>
        </div>
        <div className="mt-4">
          {progress.total > 0 && (
            <div className="mb-2 text-sm font-medium text-slate-600 flex justify-between">
              <span>{progress.status}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
          )}
          <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4">
            <div
              className="bg-green-700 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <Button
            onClick={processJobs}
            disabled={processing || files.length === 0}
            className="w-full h-12 text-lg font-bold bg-green-700 hover:bg-green-800 text-white"
          >
            {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
            Processar Ficheiros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
