import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Database, Fingerprint } from "lucide-react";
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
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  // --- EXTRAÇÃO DO DNA DO CASE NUMBER (O SEGREDO DA V55) ---
  const getCaseBody = (id: string) => {
    if (!id) return id;
    const parts = id.split("-");
    // Se JO-A-300... -> pega 300...
    if (parts[0] === "JO" && parts[1] === "A") return parts.slice(2).join("-");
    // Se H-300... -> pega 300...
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

            const title = (getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]) || "").trim();
            const company = (getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]) || "").trim();
            if (!title || !company) continue;

            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
            // DNA ÚNICO: O corpo do Case Number (H-2A e JO compartilham isso)
            const fingerprint = getCaseBody(rawJobId);
            const cleanJobId = rawJobId.split("-GHOST-")[0].trim();

            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");
            const rawWage = getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]);

            // Lógica de Detecção de Transição no Lote Atual
            const existing = rawJobsMap.get(fingerprint);
            let isTransition = false;
            if (existing) {
              if (
                (existing.visa_type.includes("Early Access") && visaType === "H-2A") ||
                (visaType.includes("Early Access") && existing.visa_type === "H-2A")
              ) {
                isTransition = true;
              }
            }

            const extractedJob = {
              id: crypto.randomUUID(),
              job_id: cleanJobId,
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
              job_duties: getVal(flat, ["jobDuties", "tempneedDescription"]),
              weekly_hours: weeklyHours || null,
              was_early_access: isTransition || (existing?.was_early_access ?? false),
            };

            // Se o novo for H-2A, ele é o oficial, deve prevalecer no Mapa
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
        const batch = finalJobs.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: batch });
        if (error) throw error;
      }

      toast({ title: "V55 - Sucesso Total!", description: "DNA de Case mapeado e salários corrigidos." });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-indigo-600 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-indigo-700">
          <Fingerprint className="h-6 w-6" /> H2 Linker Sync V55 (DNA Mode)
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
          className="w-full h-12 bg-indigo-700 hover:bg-indigo-800 font-bold text-white"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar com DNA de Case
        </Button>
      </CardContent>
    </Card>
  );
}
