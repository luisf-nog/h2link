import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  RefreshCw,
  Database,
  FileJson,
  History,
  X, // Importação que faltava adicionada aqui
} from "lucide-react";
import { Label } from "@/components/ui/label";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  // --- HELPER: Cálculo de Salário ---
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

  const formatToStaticDate = (dateStr: any) => {
    if (!dateStr || dateStr === "N/A") return null;
    try {
      if (typeof dateStr === "string" && dateStr.includes("T")) return dateStr.split("T")[0];
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
      if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
    }
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    const rawJobsMap = new Map();

    try {
      for (const file of files) {
        const isZip = file.name.endsWith(".zip");
        let contents = [];
        if (isZip) {
          const zip = await new JSZip().loadAsync(file);
          const jsonFiles = Object.keys(zip.files).filter((f) => f.endsWith(".json"));
          for (const f of jsonFiles) contents.push({ filename: f, content: await zip.files[f].async("string") });
        } else {
          contents.push({ filename: file.name, content: await file.text() });
        }

        for (const { filename, content } of contents) {
          const list = JSON.parse(content);
          const nameLower = filename.toLowerCase();
          const isEarly = nameLower.includes("jo") || nameLower.includes("_jo");
          const isH2B = nameLower.includes("h2b") && !nameLower.includes("h2a");
          const visaType = isH2B ? "H-2B" : isEarly ? "H-2A (Early Access)" : "H-2A";

          list.forEach((item: any) => {
            const flat = {
              ...item,
              ...(item.clearanceOrder || {}),
              ...(item.jobRequirements?.qualification || {}),
              ...(item.employer || {}),
            };
            const rawId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]) || "";
            if (!rawId) return;
            const email = getVal(flat, ["recApplyEmail", "email"]);
            if (!email || email === "N/A") return;

            const fingerprint = getCaseBody(rawId);
            const hours = parseFloat(getVal(flat, ["jobHoursTotal", "weekly_hours", "basicHours"]) || "0");

            // DATA GLOBAL: Baseada em New York (Onde o DOL opera)
            const nyToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
            const postedDate =
              formatToStaticDate(getVal(flat, ["dateAcceptanceLtrIssued", "DECISION_DATE", "decisionDate"])) || nyToday;

            rawJobsMap.set(fingerprint, {
              job_id: rawId.split("-GHOST")[0].trim(),
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]),
              company: getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]),
              email: email.toLowerCase(),
              phone: getVal(flat, ["recApplyPhone", "empPhone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState", "state"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode", "zip"]),
              salary: calculateFinalWage(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]), hours),
              start_date: formatToStaticDate(getVal(flat, ["tempneedStart", "jobBeginDate"])),
              posted_date: postedDate,
              end_date: formatToStaticDate(getVal(flat, ["tempneedEnd", "jobEndDate"])),
              job_duties: getVal(flat, ["tempneedDescription", "jobDuties"]),
              job_min_special_req: getVal(flat, ["jobMinspecialreq", "jobAddReqinfo", "specialRequirements"]),
              wage_additional: getVal(flat, [
                "wageAdditional",
                "jobSpecialPayInfo",
                "addSpecialPayInfo",
                "wageAddinfo",
              ]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction", "deductionsInfo"]),
              weekly_hours: hours,
              category:
                getVal(flat, ["tempneedSocTitle", "jobSocTitle", "socTitle", "socCodeTitle", "SOC_TITLE"]) ||
                "General Application",
              openings: parseInt(getVal(flat, ["tempneedWkrPos", "jobWrksNeeded", "totalWorkersNeeded"]) || "0"),
              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experienceMonths"]) || "0"),
              education_required: getVal(flat, ["jobMinedu", "educationLevel"]),
              transport_provided:
                getVal(flat, ["transportation", "transportProvided", "recIsDailyTransport"])
                  ?.toLowerCase()
                  .includes("yes") || false,
              source_url: getVal(flat, ["sourceUrl", "url", "recApplyUrl"]),
              housing_info:
                getVal(flat, ["housingInfo", "housingDescription"]) ||
                (visaType.includes("H-2A") ? "Housing Provided (H-2A Standard)" : null),
              was_early_access: isEarly,
            });
          });
        }
      }

      const allJobs = Array.from(rawJobsMap.values());
      const BATCH_SIZE = 500;
      for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
        await supabase.rpc("process_jobs_bulk", { jobs_data: allJobs.slice(i, i + BATCH_SIZE) });
      }

      // After syncing, deactivate jobs whose start_date is within 5 days or past
      const { data: deactivated } = await supabase.rpc("deactivate_expired_jobs");

      toast({
        title: "Sincronização Concluída!",
        description: `${allJobs.length} vagas sincronizadas. ${deactivated ?? 0} vagas expiradas desativadas automaticamente.`,
      });
      setFiles([]);
    } catch (err: any) {
      toast({ title: "Erro Fatal", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-4 border-indigo-700 shadow-2xl overflow-hidden">
      <CardHeader className="bg-indigo-700 text-white p-6 text-left">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl font-black italic uppercase tracking-tighter">
              <Database className="h-7 w-7 text-indigo-300" /> H2 Linker Master V68
            </CardTitle>
            <CardDescription className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest">
              Queue Protection & Local Date Sync (V68)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6 bg-white text-left">
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-start gap-3">
          <History className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div className="text-xs text-indigo-900 leading-relaxed font-bold uppercase">
            🛡️ PROTEÇÃO ATIVA: A fila não será resetada e as datas foram corrigidas para o fuso de NY.
          </div>
        </div>

        <div className="grid w-full items-center gap-4">
          <Label className="text-xs font-black uppercase text-slate-500 tracking-widest text-left">
            Arquivos DOL (.json / .zip)
          </Label>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
            <FileJson className="w-10 h-10 mb-3 text-slate-400" />
            <p className="text-sm text-slate-500 font-bold">
              {files.length > 0 ? `${files.length} arquivos selecionados` : "Clique para selecionar arquivos"}
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              accept=".json,.zip"
            />
          </label>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="text-[10px] bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono flex items-center gap-1"
                >
                  {f.name}
                  <X
                    className="h-3 w-3 cursor-pointer text-red-500"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-16 bg-indigo-700 hover:bg-indigo-800 text-white font-black text-xl shadow-lg border-b-4 border-indigo-900 active:translate-y-1 disabled:bg-slate-300 disabled:border-slate-400"
        >
          {processing ? (
            <>
              <Loader2 className="animate-spin mr-3 h-6 w-6" />
              PROCESSANDO...
            </>
          ) : (
            <>
              <RefreshCw className="mr-3 h-6 w-6" />
              SINCROZINAR AGORA (V68)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
