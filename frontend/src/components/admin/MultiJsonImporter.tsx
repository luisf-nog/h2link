import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Database } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const calculateFinalWage = (rawVal: any, hours: any) => {
    if (!rawVal) return null;
    let val = parseFloat(String(rawVal).replace(/[$,]/g, ""));
    if (isNaN(val) || val <= 0) return null;
    if (val > 100) {
      const h = hours && hours > 0 ? hours : 40;
      let calc = val / (h * 4.333);
      return calc >= 7.25 && calc <= 95 ? parseFloat(calc.toFixed(2)) : null;
    }
    return val;
  };

  const formatToISODate = (dateStr: any) => {
    if (!dateStr || dateStr === "N/A") return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString("en-CA");
    } catch {
      return null;
    }
  };

  const getCaseBody = (id: string) => {
    if (!id) return id;
    const cleanId = id.split("-GHOST")[0].trim();
    const parts = cleanId.split("-");
    if (parts[0] === "JO" && parts[1] === "A") return parts.slice(2).join("-");
    if (parts[0] === "H") return parts.slice(1).join("-");
    return cleanId;
  };

  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;
    for (const key of keys) {
      const val = obj[key] || obj[key.toLowerCase()];
      if (val !== undefined && val !== null) return String(val).trim();
    }
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    const today = getTodayDate();

    try {
      const rawJobsMap = new Map();

      for (const file of files) {
        const isZip = file.name.endsWith(".zip");
        let contents: { filename: string; content: string }[] = [];

        if (isZip) {
          const zip = await new JSZip().loadAsync(file);
          const jsonFiles = Object.keys(zip.files).filter((f) => f.endsWith(".json"));
          for (const filename of jsonFiles) {
            contents.push({ filename, content: await zip.files[filename].async("string") });
          }
        } else {
          contents.push({ filename: file.name, content: await file.text() });
        }

        for (const { filename, content } of contents) {
          const list = JSON.parse(content);
          const visaType = filename.toLowerCase().includes("h2b")
            ? "H-2B"
            : filename.toLowerCase().includes("jo")
              ? "H-2A (Early Access)"
              : "H-2A";

          list.forEach((item: any) => {
            const flat = { ...item, ...(item.clearanceOrder || {}), ...(item.jobRequirements?.qualification || {}) };
            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
            if (!rawJobId) return;

            const email = getVal(flat, ["recApplyEmail", "email"]);
            if (!email || email.toUpperCase() === "N/A" || email.trim() === "") return;

            const fingerprint = getCaseBody(rawJobId);
            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");
            const posted = formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "DECISION_DATE"]));

            rawJobsMap.set(fingerprint, {
              id: crypto.randomUUID(),
              job_id: rawJobId.split("-GHOST")[0].trim(),
              visa_type: visaType,
              fingerprint: fingerprint,
              job_title: getVal(flat, ["jobTitle", "tempneedJobtitle", "title"]),
              company: getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]),
              email: email,
              phone: getVal(flat, ["recApplyPhone", "empPhone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState", "state"]),
              zip: getVal(flat, ["jobPostcode", "empPostalCode"]), // MUDANÇA AQUI: de zip_code para zip
              salary: calculateFinalWage(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]), weeklyHours),
              start_date: formatToISODate(getVal(flat, ["jobBeginDate", "tempneedStart"])),
              posted_date: posted || today,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "tempneedEnd"])),
              job_duties: getVal(flat, ["jobDuties", "tempneedDescription"]),
              job_min_special_req: getVal(flat, ["jobMinspecialreq", "specialRequirements", "jobAddReqinfo"]),
              openings: parseInt(getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos"]) || "0"),
              experience_months: parseInt(
                getVal(flat, ["experienceMonths", "jobMinexpmonths", "monthsExperience"]) || "0",
              ),
              education_required: getVal(flat, ["educationLevel", "jobMinedu"]),
              is_active: true,
              was_early_access: false,
            });
          });
        }
      }

      const allJobs = Array.from(rawJobsMap.values());
      const BATCH_SIZE = 1500;
      for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
        const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: allJobs.slice(i, i + BATCH_SIZE) });
        if (error) throw error;
      }

      toast({
        title: "Sincronização V62 Concluída!",
        description: `${allJobs.length} vagas processadas com sucesso.`,
      });
    } catch (err: any) {
      toast({ title: "Erro de Importação", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-4 border-indigo-700 shadow-2xl">
      <CardHeader className="bg-indigo-50">
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <Database className="h-6 w-6" /> H2 Linker Sync V62 (Turbo Mode)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full text-sm"
        />
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-14 bg-indigo-700 hover:bg-indigo-900 text-white font-black text-lg"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar Produção V62
        </Button>
      </CardContent>
    </Card>
  );
}
