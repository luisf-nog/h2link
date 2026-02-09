import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ updated: 0, created: 0 });
  const { toast } = useToast();

  // --- Funções Auxiliares (Mesmas de antes) ---
  const detectCategory = (title: string, socTitle: string = ""): string => {
    const t = (title + " " + socTitle).toLowerCase();
    if (t.includes("landscap") || t.includes("groundskeep") || t.includes("lawn") || t.includes("mower"))
      return "Landscaping";
    if (
      t.includes("construct") ||
      t.includes("concrete") ||
      t.includes("mason") ||
      t.includes("brick") ||
      t.includes("carpenter")
    )
      return "Construction";
    if (t.includes("housekeep") || t.includes("maid") || t.includes("cleaner") || t.includes("janitor"))
      return "Housekeeping";
    if (
      t.includes("cook") ||
      t.includes("chef") ||
      t.includes("kitchen") ||
      t.includes("dishwash") ||
      t.includes("server")
    )
      return "Hospitality & Culinary";
    if (t.includes("amusement") || t.includes("carnival") || t.includes("recreation") || t.includes("lifeguard"))
      return "Amusement & Recreation";
    if (
      t.includes("farm") ||
      t.includes("agricult") ||
      t.includes("crop") ||
      t.includes("harvest") ||
      t.includes("nursery")
    )
      return "Agriculture";
    return "General Labor";
  };

  const getVal = (obj: any, keys: string[], allowNone = false) => {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) {
        const val = obj[key];
        if (typeof val === "string") {
          const clean = val.trim();
          if (clean === "" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "null") continue;
          if (!allowNone && clean.toLowerCase() === "none") continue;
        }
        return val;
      }
    }
    return null;
  };

  const parseBool = (val: any) => ["1", "true", "yes", "y", "t"].includes(String(val).toLowerCase().trim());

  const parseMoney = (val: any) => {
    if (!val) return null;
    const num = parseFloat(String(val).replace(/[$,]/g, ""));
    return isNaN(num) || num <= 0 ? null : num;
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

  const calculateFinalWage = (item: any, flat: any) => {
    let val = parseMoney(
      item.wageFrom || item.jobWageOffer || item.wageOfferFrom || item.BASIC_WAGE_RATE || item.AEWR || item.BASIC_RATE,
    );
    if (!val && item.clearanceOrder) val = parseMoney(item.clearanceOrder.jobWageOffer);

    if (val && val > 100) {
      const hours = parseFloat(getVal(flat, ["jobHoursTotal", "basicHours", "weekly_hours"]) || "40");
      if (hours > 0) {
        const hourly = val / (hours * 4.333);
        if (hourly >= 7.25 && hourly <= 150) return parseFloat(hourly.toFixed(2));
      }
    }
    return val;
  };
  // --------------------------

  const processJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      const rawJobsMap = new Map();

      // 1. Ler Arquivos
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

        // 2. Parsear JSON
        for (const { filename, content } of contents) {
          const json = JSON.parse(content);
          const list = Array.isArray(json) ? json : json.data || [];

          let visaType = "H-2A";
          if (filename.toLowerCase().includes("h2b")) visaType = "H-2B";
          else if (filename.toLowerCase().includes("jo")) visaType = "H-2A (Early Access)";

          for (const item of list) {
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;

            const title = getVal(flat, [
              "jobTitle",
              "job_title",
              "tempneedJobtitle",
              "JOB_TITLE",
              "TITLE",
              "job_order_title",
            ]);
            const company = getVal(flat, [
              "empBusinessName",
              "employerBusinessName",
              "legalName",
              "empName",
              "company",
              "EMPLOYER_NAME",
            ]);

            if (!title || !company) continue;

            const fein = getVal(flat, ["empFein", "employer_fein", "fein"]);
            const start = formatToISODate(
              getVal(flat, ["jobBeginDate", "job_begin_date", "tempneedStart", "START_DATE", "begin_date"]),
            );
            const rawJobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER", "JO_ORDER_NUMBER"]);
            const fingerprint = `${fein}|${title.toUpperCase()}|${start}`;

            // Prioridade para Case Number, mas garantindo que nunca seja null/undefined para chave do Map
            const finalJobId = rawJobId || fingerprint;

            // Dados processados
            let category = getVal(flat, [
              "socTitle",
              "jobSocTitle",
              "tempneedSocTitle",
              "category",
              "Category",
              "SOC_TITLE",
              "soc_title",
            ]);
            if (!category && title) category = detectCategory(title);
            else if (!category) category = "General Labor";

            const posted_date = formatToISODate(
              getVal(flat, ["dateAcceptanceLtrIssued", "posted_date", "dateSubmitted", "form790AsOfDate"]),
            );
            const email = getVal(flat, ["recApplyEmail", "emppocEmail", "emppocAddEmail", "EMAIL", "employer_email"]);
            const finalWage = calculateFinalWage(item, flat);
            const transportDesc = getVal(flat, ["transportDescEmp", "transportDescDaily"]);
            const transportBool =
              parseBool(getVal(flat, ["isEmploymentTransport", "recIsDailyTransport", "transportProvided"])) ||
              (transportDesc && transportDesc.length > 5);

            const extractedJob = {
              job_id: finalJobId,
              visa_type: visaType,
              fingerprint: fingerprint,
              is_active: true,
              job_title: title,
              company: company,
              email: email,
              category: category,
              posted_date: posted_date,
              city: getVal(flat, ["jobCity", "job_city", "worksite_city", "empCity", "addmbEmpCity", "CITY"]),
              state: getVal(flat, ["jobState", "job_state", "worksite_state", "empState", "addmbEmpState", "STATE"]),
              zip: getVal(flat, ["jobPostcode", "worksite_zip", "empPostcode", "POSTAL_CODE"]),
              worksite_address: getVal(flat, ["jobAddr1", "worksite_address", "empAddr1"]),
              phone: getVal(flat, ["recApplyPhone", "emppocPhone", "employerPhone", "PHONE"]),
              website: getVal(flat, ["recApplyUrl", "employerWebsite"]),
              start_date: start,
              end_date: formatToISODate(getVal(flat, ["jobEndDate", "job_end_date", "tempneedEnd", "END_DATE"])),
              salary: finalWage,
              wage_from: finalWage,
              wage_to: parseMoney(getVal(flat, ["wageTo", "wageOfferTo", "HIGHEST_RATE"])) || finalWage,
              wage_unit: "Hour",
              pay_frequency: getVal(flat, ["jobPayFrequency", "pay_frequency"]),
              weekly_hours: parseFloat(getVal(flat, ["jobHoursTotal", "basicHours"])) || null,
              job_duties: getVal(flat, ["jobDuties", "job_duties", "tempneedDescription"]),
              openings: parseInt(getVal(flat, ["jobWrksNeeded", "totalWorkersNeeded", "tempneedWkrPos"])) || null,
              job_min_special_req: getVal(flat, ["jobMinspecialreq", "jobAddReqinfo", "specialRequirements"]),
              wage_additional: getVal(flat, ["wageAdditional", "addSpecialPayInfo"]),
              rec_pay_deductions: getVal(flat, ["recPayDeductions", "jobPayDeduction"]),
              education_required: getVal(flat, ["jobMinedu", "jobEducationLevel"], true),
              experience_months: parseInt(getVal(flat, ["jobMinexpmonths", "experience_required"])) || null,
              transport_provided: transportBool,
              transport_desc: transportDesc,
              housing_info: getVal(flat, ["housingAddInfo", "housingAdditionalInfo"]),
              housing_type: getVal(flat, ["housingType"]) || item.housingLocations?.[0]?.addmbHousingType,
              housing_addr: getVal(flat, ["housingAddr1"]) || item.housingLocations?.[0]?.addmbHousingAddr1,
              housing_city: getVal(flat, ["housingCity"]) || item.housingLocations?.[0]?.addmbHousingCity,
              housing_state: getVal(flat, ["housingState"]) || item.housingLocations?.[0]?.addmbHousingState,
              housing_zip: getVal(flat, ["housingPostcode"]) || item.housingLocations?.[0]?.addmbHousingPostcode,
              housing_capacity: parseInt(getVal(flat, ["housingTotalOccupy", "housing_capacity"])) || null,
              is_meal_provision: parseBool(getVal(flat, ["isMealProvision"])),
              meal_charge: parseMoney(getVal(flat, ["mealCharge"])),
            };

            rawJobsMap.set(finalJobId, extractedJob);
          }
        }
      }

      let finalJobs = Array.from(rawJobsMap.values());
      finalJobs = finalJobs.filter(
        (job) => job.email && job.email.length > 2 && !job.email.toLowerCase().includes("null"),
      );

      // === V22: A ESTRATÉGIA "BULLETPROOF" ===

      const allJobIds = finalJobs.map((j) => j.job_id);
      const allFingerprints = finalJobs.map((j) => j.fingerprint);
      const existingIdMap = new Map();
      const QUERY_BATCH = 1000;

      // 1. BUSCA DUPLA: Pelo Job ID E Pelo Fingerprint
      // Isso garante que acharemos a vaga não importa qual regra de unicidade ela esteja seguindo

      // Busca A: Por Job ID
      for (let i = 0; i < allJobIds.length; i += QUERY_BATCH) {
        const batch = allJobIds.slice(i, i + QUERY_BATCH);
        const { data } = await supabase.from("public_jobs").select("id, job_id").in("job_id", batch);
        if (data) data.forEach((row) => existingIdMap.set(row.job_id, row.id));
      }

      // Busca B: Por Fingerprint (apenas se já não achamos pelo ID)
      for (let i = 0; i < allFingerprints.length; i += QUERY_BATCH) {
        const batch = allFingerprints.slice(i, i + QUERY_BATCH);
        const { data } = await supabase.from("public_jobs").select("id, fingerprint").in("fingerprint", batch);
        if (data) {
          // Mapeamos fingerprint -> id também
          data.forEach((row) => existingIdMap.set(row.fingerprint, row.id));
        }
      }

      // 2. UNIFICAÇÃO: Aplica os IDs encontrados
      const jobsToUpdate: any[] = [];
      const jobsToInsert: any[] = [];

      finalJobs.forEach((job) => {
        // Tenta achar ID pelo job_id OU pelo fingerprint
        const existingUuid = existingIdMap.get(job.job_id) || existingIdMap.get(job.fingerprint);

        if (existingUuid) {
          jobsToUpdate.push({ ...job, id: existingUuid });
        } else {
          jobsToInsert.push(job);
        }
      });

      const SEND_BATCH = 500;

      // 3. ENVIAR ATUALIZAÇÕES (Seguro, pois tem ID)
      if (jobsToUpdate.length > 0) {
        for (let i = 0; i < jobsToUpdate.length; i += SEND_BATCH) {
          const batch = jobsToUpdate.slice(i, i + SEND_BATCH);
          const { error } = await supabase.from("public_jobs").upsert(batch);
          if (error) throw error;
        }
      }

      // 4. ENVIAR NOVOS (Com Fallback Inteligente)
      if (jobsToInsert.length > 0) {
        for (let i = 0; i < jobsToInsert.length; i += SEND_BATCH) {
          const batch = jobsToInsert.slice(i, i + SEND_BATCH);

          // Tentativa 1: Upsert padrão (confia no job_id)
          const { error } = await supabase.from("public_jobs").upsert(batch, {
            onConflict: "job_id",
            ignoreDuplicates: false,
          });

          if (error) {
            // SE FALHAR COM "duplicate key ... uq_fingerprint", TENTAMOS A ESTRATÉGIA B
            if (error.message.includes("uq_fingerprint")) {
              console.warn("Conflito de Fingerprint detectado na inserção. Tentando fallback...");
              // Tentativa 2: Upsert focado no fingerprint
              const { error: error2 } = await supabase.from("public_jobs").upsert(batch, {
                onConflict: "fingerprint",
                ignoreDuplicates: false,
              });
              if (error2) throw error2; // Se falhar de novo, aí sim é um erro real
            } else {
              throw error; // Outros erros (ex: null constraint) devem parar o processo
            }
          }
        }
      }

      setStats({ updated: jobsToUpdate.length, created: jobsToInsert.length });
      toast({
        title: "Sincronização V22 (Bulletproof)",
        description: `Finalizado! ${jobsToUpdate.length} atualizados e ${jobsToInsert.length} inseridos/verificados com sucesso.`,
      });
    } catch (err: any) {
      toast({ title: "Erro Fatal", description: err.message, variant: "destructive" });
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader className="bg-slate-50">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <RefreshCw className="h-6 w-6 text-green-600" /> Sincronizador V22 (Final)
        </CardTitle>
        <CardDescription>Sistema de dupla verificação e fallback automático de erros.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="border-dashed border-2 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-white transition-colors">
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full" />
          <p className="mt-2 text-sm text-slate-500">JSON ou ZIP</p>
        </div>
        <Button
          onClick={processJobs}
          disabled={processing || files.length === 0}
          className="w-full mt-4 h-12 text-lg font-bold bg-green-600 hover:bg-green-700"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
          Sincronizar (Modo Seguro)
        </Button>
      </CardContent>
    </Card>
  );
}
