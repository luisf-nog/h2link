import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import {
  Upload,
  FileText,
  Loader2,
  Download,
  ArrowRight,
  CheckCircle,
  Sparkles,
  AlertCircle,
  Wheat,
  Building2,
  ConciergeBell,
  Hammer,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf";
import { extractTextFromDOCX } from "@/lib/docx";
import { generateResumePDF, type ResumeData } from "@/lib/resumePdf";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Definição dos nichos para o sistema H-2
const NICHES = [
  { id: "h2a", label: "Agriculture (H-2A)", icon: Wheat, desc: "Farming, Livestock, Harvest" },
  { id: "h2b_construction", label: "Construction (H-2B)", icon: Hammer, desc: "Masonry, Carpentry, Labor" },
  { id: "h2b_hospitality", label: "Hospitality (H-2B)", icon: ConciergeBell, desc: "Housekeeping, Waiter, Hotel" },
  { id: "h2b_landscaping", label: "Landscaping (H-2B)", icon: Building2, desc: "Gardening, Maintenance" },
];

interface SafeResumeData {
  personal_info: { full_name: string; city_state_country: string; email: string; phone: string };
  summary: string;
  skills: string[];
  experience: Array<{ title: string; company: string; location: string; dates: string; points: string[] }>;
  education: Array<{ degree: string; school: string; year: string }>;
  languages: string[];
}

type Step = "idle" | "reading" | "translating" | "formatting" | "done" | "error";

export default function ResumeConverter() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("idle");
  const [resume, setResume] = useState<SafeResumeData | null>(null);

  // Estados de Personalização (O "Pulo do Gato")
  const [selectedNiche, setSelectedNiche] = useState<string>("");
  const [extraSkills, setExtraSkills] = useState("");

  const processFile = useCallback(
    async (file: File) => {
      if (!selectedNiche) {
        toast({ title: "Select a niche", description: "Please choose a job category first.", variant: "destructive" });
        return;
      }

      try {
        setStep("reading");
        let rawText = "";

        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          rawText = await extractTextFromPDF(file);
        } else if (
          file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          file.name.endsWith(".docx")
        ) {
          rawText = await extractTextFromDOCX(file);
        }

        if (!rawText || rawText.trim().length < 50) throw new Error("Could not read file content.");

        setStep("translating");

        // ENVIANDO O CONTEXTO PARA A IA
        const { data, error } = await supabase.functions.invoke("convert-resume", {
          body: {
            raw_text: rawText,
            target_niche: selectedNiche,
            extra_info: extraSkills, // Informações chaves que o usuário digitou
          },
        });

        if (error || !data) throw new Error("AI failed to process resume.");

        setStep("formatting");
        await new Promise((r) => setTimeout(r, 800));

        setResume(data as SafeResumeData);
        setStep("done");
        toast({ title: "Success!", description: "Resume optimized for " + selectedNiche });
      } catch (err: any) {
        setStep("error");
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    },
    [selectedNiche, extraSkills],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.length > 0 && processFile(files[0]),
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    disabled: step !== "idle" && step !== "error",
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">AI Resume Optimizer</h1>
        <p className="text-slate-500 font-medium">
          Configure seu perfil para alinhar o currículo com as exigências americanas.
        </p>
      </div>

      {step !== "done" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* COLUNA 1: CONFIGURAÇÃO DE NICHO */}
          <div className="space-y-6">
            <Card className="border-2 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" /> 1. Escolha o Alvo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  {NICHES.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNiche(n.id)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
                        selectedNiche === n.id
                          ? "border-indigo-600 bg-indigo-50"
                          : "border-slate-100 hover:border-slate-200",
                      )}
                    >
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          selectedNiche === n.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400",
                        )}
                      >
                        <n.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <p
                          className={cn(
                            "text-sm font-bold",
                            selectedNiche === n.id ? "text-indigo-900" : "text-slate-700",
                          )}
                        >
                          {n.label}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">{n.desc}</p>
                      </div>
                      {selectedNiche === n.id && <CheckCircle className="h-5 w-5 text-indigo-600" />}
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4">
                  <Label className="text-[10px] font-black uppercase text-slate-400">
                    Informações Chaves (Opcional)
                  </Label>
                  <Textarea
                    placeholder="Ex: Tenho experiência com tratores John Deere, possuo CNH D, ou trabalhei 5 anos em obras..."
                    className="resize-none h-24 text-sm"
                    value={extraSkills}
                    onChange={(e) => setExtraSkills(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* COLUNA 2: UPLOAD */}
          <div className="flex flex-col">
            <Card
              className={cn(
                "flex-1 border-2 border-dashed transition-all flex flex-col items-center justify-center p-10",
                isDragActive ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200",
              )}
            >
              {step === "idle" || step === "error" ? (
                <div {...getRootProps()} className="text-center cursor-pointer">
                  <input {...getInputProps()} />
                  <div className="bg-indigo-50 p-6 rounded-full mb-6 mx-auto w-fit">
                    <Upload className="h-10 w-10 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic text-slate-900">2. Envie seu CV Original</h3>
                  <p className="text-slate-400 text-sm mt-2">Arraste seu arquivo PDF ou Word aqui</p>
                  {!selectedNiche && (
                    <p className="text-amber-500 text-[10px] font-bold mt-4 uppercase">Selecione um nicho primeiro ↑</p>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-6 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
                  <span className="text-lg font-black uppercase text-slate-700 italic">{step}...</span>
                  <Progress value={40} className="h-2" />
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* RESULTADO (EDITOR/PREVIEW) */}
      {step === "done" && resume && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom duration-500">
          {/* Editor de campos e Preview do PDF entrariam aqui */}
          <Card className="p-6 col-span-2 bg-indigo-900 text-white flex justify-between items-center rounded-[2rem]">
            <div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Currículo Otimizado com Sucesso!</h3>
              <p className="text-indigo-200 text-sm">
                Focado em: <span className="font-bold text-white uppercase">{selectedNiche}</span>
              </p>
            </div>
            <Button size="lg" className="bg-white text-indigo-900 hover:bg-indigo-50 font-black">
              <Download className="mr-2 h-5 w-5" /> DOWNLOAD PDF
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
