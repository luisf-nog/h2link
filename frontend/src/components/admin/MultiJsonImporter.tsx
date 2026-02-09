import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, RefreshCw, Microscope, AlertTriangle } from "lucide-react";
import JSZip from "jszip";

export function MultiJsonImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [inspectionData, setInspectionData] = useState<any[] | null>(null); // Dados para inspeção
  const [showInspection, setShowInspection] = useState(false);

  // --- Funções Auxiliares (Mesmas da V35) ---
  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        const val = obj[key];
        if (typeof val === "string" && (val.trim() === "" || val.toLowerCase() === "n/a")) continue;
        return val;
      }
    }
    return null;
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

  // Lógica V35 para Data
  const determinePostedDate = (item: any, jobId: string) => {
    const root = item || {};
    const nested = item.clearanceOrder || {};

    // 1. Decisão
    const decisionDate =
      getVal(root, ["DECISION_DATE", "decision_date", "dateAcceptanceLtrIssued"]) ||
      getVal(nested, ["DECISION_DATE", "decision_date", "dateAcceptanceLtrIssued"]);
    if (decisionDate) return { val: formatToISODate(decisionDate), source: "Decision Date (Found)" };

    // 2. Submissão
    const submissionDate =
      getVal(root, ["dateSubmitted", "CASE_SUBMITTED", "form790AsOfDate"]) ||
      getVal(nested, ["dateSubmitted", "CASE_SUBMITTED", "form790AsOfDate"]);
    if (submissionDate) return { val: formatToISODate(submissionDate), source: "Submission Date (Found)" };

    // 3. ID Fallback
    if (jobId && jobId.startsWith("JO-")) {
      const match = jobId.match(/-(\d{2})(\d{3})-/);
      if (match) {
        const date = new Date(2000 + parseInt(match[1]), 0);
        date.setDate(parseInt(match[2]));
        return { val: date.toISOString().split("T")[0], source: "ID Calculation (Fallback)" };
      }
    }
    return { val: null, source: "NOT FOUND" };
  };

  const inspectJobs = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      const samples: any[] = [];

      for (const file of files) {
        let content = "";
        if (file.name.endsWith(".zip")) {
          const zip = await new JSZip().loadAsync(file);
          const jsonFile = Object.keys(zip.files).find((n) => n.endsWith(".json"));
          if (jsonFile) content = await zip.files[jsonFile].async("string");
        } else {
          content = await file.text();
        }

        if (content) {
          const json = JSON.parse(content);
          const list = Array.isArray(json) ? json : json.data || [];

          // Pega as 3 primeiras vagas JO (Early Access) para análise
          const targetJobs = list
            .filter(
              (j: any) =>
                (j.caseNumber && j.caseNumber.startsWith("JO-")) || (j.CASE_NUMBER && j.CASE_NUMBER.startsWith("JO-")),
            )
            .slice(0, 3);

          for (const item of targetJobs) {
            const flat = item.clearanceOrder ? { ...item, ...item.clearanceOrder } : item;
            const jobId = getVal(flat, ["caseNumber", "jobOrderNumber", "CASE_NUMBER"]);

            // O Teste Real
            const dateResult = determinePostedDate(item, jobId);

            samples.push({
              Arquivo: file.name,
              Job_ID: jobId,
              Resultado_Final: dateResult.val,
              Fonte_Detectada: dateResult.source,
              Dados_Brutos_Raiz: {
                dateSubmitted: item.dateSubmitted,
                form790: item.form790AsOfDate,
              },
            });
          }
        }
      }

      setInspectionData(samples);
      setShowInspection(true);
    } catch (e) {
      alert("Erro ao ler arquivo: " + e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-xl border-2 border-primary/10">
      <CardHeader className="bg-slate-50">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Microscope className="h-6 w-6 text-purple-600" /> Inspetor V36
        </CardTitle>
        <CardDescription>
          Não envia nada para o banco. Apenas diagnostica o que o React está "enxergando".
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="border-dashed border-2 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-white transition-colors">
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full" />
          <p className="mt-2 text-sm text-slate-500">Selecione o arquivo JO (Early Access)</p>
        </div>
        <Button
          onClick={inspectJobs}
          disabled={processing || files.length === 0}
          className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
        >
          {processing ? <Loader2 className="animate-spin mr-2" /> : <Microscope className="mr-2" />}
          Inspecionar Dados
        </Button>

        <Dialog open={showInspection} onOpenChange={setShowInspection}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Relatório de Inspeção</DialogTitle>
              <DialogDescription>Isso é EXATAMENTE o que o código está extraindo do arquivo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {inspectionData?.map((data, i) => (
                <div key={i} className="p-4 bg-slate-100 rounded-md border text-sm font-mono">
                  <div className="flex justify-between font-bold border-b pb-2 mb-2">
                    <span>ID: {data.Job_ID}</span>
                    <span className={data.Resultado_Final ? "text-green-600" : "text-red-600"}>
                      DATA: {data.Resultado_Final || "NULL"}
                    </span>
                  </div>
                  <p>Fonte: {data.Fonte_Detectada}</p>
                  <pre className="mt-2 text-xs text-slate-500">{JSON.stringify(data.Dados_Brutos_Raiz, null, 2)}</pre>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
