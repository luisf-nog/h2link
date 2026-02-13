import { useState } from "react";
import { Button } from "@/components/ui/button";
// Adicionado CardDescription aqui
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Database, FileJson, CheckCircle2 } from "lucide-react";
// Adicionado Badge e Label que estavam faltando
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, files: 0 });
  const { toast } = useToast();

  const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split("T")[0];
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
      return d.toISOString().split("T")[0];
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
      const val = obj[key] ?? obj[key?.toLowerCase()];
      if (val !== undefined && val !== null) return String(val).trim();
    }
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    const today = getTodayDate();
    const rawJobsMap = new Map();

    try {
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
            const flat = {
              ...item,
              ...(item.clearanceOrder || {}),
              ...(item.jobRequirements?.qualification || {}),
            };

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
              email: email.toLowerCase(),
              phone: getVal(flat, ["recApplyPhone", "empPhone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState", "state"]),
              zip: getVal(flat, ["jobPostcode", "empPostalCode"]),
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
              was_early_access: filename.toLowerCase().includes("jo"),
            });
          });
        }
      }

      const allJobs = Array.from(rawJobsMap.values());
      setStats({ total: allJobs.length, files: files.length });

      const BATCH_SIZE = 1000;
      for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
        const batch = allJobs.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: batch });
        if (error) throw error;
      }

      toast({
        title: "Sincronização Turbo V62 Concluída!",
        description: `${allJobs.length} vagas únicas processadas.`,
      });
      setFiles([]);
    } catch (err: any) {
      toast({
        title: "Erro na Importação",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-4 border-indigo-700 shadow-2xl overflow-hidden">
      <CardHeader className="bg-indigo-700 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl font-black italic uppercase tracking-tighter">
              <Database className="h-7 w-7 text-indigo-300" /> H2 Linker Sync V62
            </CardTitle>
            <CardDescription className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest text-left">
              Production Batch Importer • Turbo Mode
            </CardDescription>
          </div>
          {files.length > 0 && (
            <Badge variant="secondary" className="bg-white text-indigo-700 font-black">
              {files.length} ARQUIVOS
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6 bg-white text-left">
        <div className="grid w-full items-center gap-4">
          <Label className="text-xs font-black uppercase text-slate-500 tracking-widest text-left">
            Selecione arquivos JSON ou ZIP
          </Label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileJson className="w-10 h-10 mb-3 text-slate-400" />
                <p className="mb-2 text-sm text-slate-500 font-bold">
                  {files.length > 0 ? `${files.length} selecionados` : "Clique para upload"}
                </p>
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                accept=".json,.zip"
              />
            </label>
          </div>
        </div>

        {stats.total > 0 && !processing && (
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800 uppercase">
              Último lote: {stats.total} vagas de {stats.files} arquivos.
            </span>
          </div>
        )}

        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-16 bg-indigo-700 hover:bg-indigo-800 text-white font-black text-xl shadow-lg border-b-4 border-indigo-900 transition-all active:translate-y-1 active:border-b-0"
        >
          {processing ? (
            <>
              <Loader2 className="animate-spin mr-3 h-6 w-6" />
              SINCROZINANDO...
            </>
          ) : (
            <>
              <RefreshCw className="mr-3 h-6 w-6" />
              SINCROZINAR PRODUÇÃO V62
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
