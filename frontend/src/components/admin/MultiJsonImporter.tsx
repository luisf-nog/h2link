import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Database, FileJson, History } from "lucide-react";
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

    // Se for salário mensal/anual (>100), converte para hora
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
      return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
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
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
    return null;
  };

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    const rawJobsMap = new Map();

    try {
      // --- PROTEÇÃO ANTI-WIPE ---
      // Removido o rpc "deactivate_all_jobs" para evitar que a fila dos usuários desapareça
      // A lógica agora se baseia no UPSERT (conflito pelo fingerprint)

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

            // --- CORREÇÃO DE DATA (BUG 15/02) ---
            // Usamos a data local formatada para YYYY-MM-DD em vez de .toISOString() pura
            // Isso evita que importações feitas à noite no Brasil saltem para o dia seguinte UTC
            const todayLocal = new Date().toLocaleDateString("en-CA");
            const postedDate =
              formatToISODate(getVal(flat, ["dateAcceptanceLtrIssued", "DECISION_DATE", "decisionDate"])) || todayLocal;

            rawJobsMap.set(fingerprint, {
              job_id: rawId.split("-GHOST")[0].trim(),
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,

              // --- MAPEAMENTO DE CAMPOS ---
              job_title: getVal(flat, ["tempneedJobtitle", "jobTitle", "title"]),
              company: getVal(flat, ["empBusinessName", "employerBusinessName", "empName"]),
              email: email.toLowerCase(),
              phone: getVal(flat, ["recApplyPhone", "empPhone"]),
              city: getVal(flat, ["jobCity", "city"]),
              state: getVal(flat, ["jobState", "state"]),
              zip_code: getVal(flat, ["jobPostcode", "empPostalCode", "zip"]),
              salary: calculateFinalWage(getVal(flat, ["wageFrom", "jobWageOffer", "wageOfferFrom"]), hours),
              start_date: formatToISODate(getVal(flat, ["tempneedStart", "jobBeginDate"])),
              posted_date: postedDate,
              end_date: formatToISODate(getVal(flat, ["tempneedEnd", "jobEndDate"])),

              job_duties: getVal(flat, ["tempneedDescription", "jobDuties"]),

              // --- CAMPOS ADICIONAIS H-2A ---
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
      const BATCH_SIZE = 500; // Reduzido para maior estabilidade
      for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
        const batch = allJobs.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.rpc("process_jobs_bulk", { jobs_data: batch });
        if (error) throw error;
      }

      toast({
        title: "Sincronização V65 Concluída!",
        description: `${allJobs.length} vagas processadas. A fila foi preservada e as datas corrigidas.`,
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
      <CardHeader className="bg-indigo-700 text-white p-6">
        <div className="flex items-center justify-between text-left">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl font-black italic uppercase tracking-tighter">
              <Database className="h-7 w-7 text-indigo-300" /> H2 Linker Master V65
            </CardTitle>
            <CardDescription className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest">
              Queue Protection & Local Date Sync (V65)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6 bg-white text-left">
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-start gap-3">
          <History className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div className="text-xs text-indigo-900 leading-relaxed font-bold uppercase">
            SISTEMA ANTI-WIPE ATIVO 🛡️: As vagas existentes serão atualizadas via Upsert. A fila (my_queue) não será
            mais resetada durante a importação.
          </div>
        </div>

        <div className="grid w-full items-center gap-4">
          <Label className="text-xs font-black uppercase text-slate-500 tracking-widest text-left">
            Arquivos DOL (.json / .zip)
          </Label>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100">
            <FileJson className="w-10 h-10 mb-3 text-slate-400" />
            <p className="text-sm text-slate-500 font-bold">
              {files.length > 0 ? `${files.length} selecionados` : "Clique para upload"}
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              accept=".json,.zip"
            />
          </label>
        </div>

        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full h-16 bg-indigo-700 hover:bg-indigo-800 text-white font-black text-xl shadow-lg border-b-4 border-indigo-900 active:translate-y-1"
        >
          {processing ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <RefreshCw className="mr-3 h-6 w-6" />}
          IMPORTAR SEM APAGAR FILA
        </Button>
      </CardContent>
    </Card>
  );
}
