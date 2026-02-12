import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Database, ShieldCheck } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  // --- DATA LOCAL REAL ---
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
    // Remove qualquer rastro de GHOST antes de gerar o fingerprint único
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
      if (val !== undefined && val !== null) {
        const trimmed = String(val).trim();
        // Bloqueio de strings inúteis
        if (trimmed.toUpperCase() === "N/A" || trimmed === "-") return null;
        return trimmed;
      }
    }
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    const today = getTodayDate();

    // Contadores para o relatório final
    let skippedByEmail = 0;
    let skippedByGhost = 0;

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

            // 1. EXTRAÇÃO E TRAVA DE ID (ANTI-GHOST)
            let rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
            if (!rawJobId || rawJobId.toUpperCase().includes("GHOST")) {
              skippedByGhost++;
              return;
            }

            // 2. EXTRAÇÃO E TRAVA DE EMAIL (INADMISSÍVEL N/A)
            const email = getVal(flat, ["recApplyEmail", "email"]);
            if (!email || email === "" || email.toUpperCase() === "N/A" || !email.includes("@")) {
              skippedByEmail++;
              return;
            }

            const fingerprint = getCaseBody(rawJobId);
            const weeklyHours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");
            const posted = formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "DECISION_DATE"]));

            rawJobsMap.set(fingerprint, {
              id: crypto.randomUUID(),
              job_id: rawJobId.split("-GHOST")[0].trim(), // Limpeza extra por garantia
              visa_type: visaType,
              fingerprint: fingerprint,
              job_title: getVal(flat, ["jobTitle", "tempneedJobtitle", "title"]),
              company: getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]),
              email: email,
              phone: getVal(flat, ["recApplyPhone", "empPhone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState", "state"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode"]),
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

      if (allJobs.length === 0) {
        toast({
          title: "Nenhuma vaga válida",
          description: "O arquivo processado não continha vagas com e-mails válidos.",
          variant: "destructive",
        });
        return;
      }

      const BATCH_SIZE = 1500;
      for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
        const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: allJobs.slice(i, i + BATCH_SIZE) });
        if (error) throw error;
      }

      toast({
        title: "Sincronização Protegida Concluída!",
        description: `${allJobs.length} vagas inseridas. Bloqueios de segurança: ${skippedByEmail} sem e-mail e ${skippedByGhost} registros GHOST.`,
      });
    } catch (err: any) {
      toast({ title: "Erro de Processamento", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-4 border-indigo-700 shadow-2xl">
      <CardHeader className="bg-indigo-50">
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <ShieldCheck className="h-6 w-6 text-emerald-600" /> H2 Linker Armored Sync V62
        </CardTitle>
        <CardDescription className="text-indigo-700 font-bold">
          Segurança Ativa: Vagas sem e-mail ou com chaves "Ghost" são descartadas automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-14 bg-indigo-700 hover:bg-indigo-900 text-white font-black text-lg shadow-lg transition-all active:scale-[0.98]"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar Produção Armored
        </Button>
      </CardContent>
    </Card>
  );
}
