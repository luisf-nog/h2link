import { useState, useCallback, useMemo } from "react";
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
  Info,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

// --- Tipagens e Opções ---
type Niche = "h2a" | "h2b_hospitality" | "h2b_construction" | "h2b_landscaping" | "h2b_warehouse" | "generic";

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

  // --- Estados do Formulário de Contexto ---
  const [niche, setNiche] = useState<Niche | "">("");
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [englishLevel, setEnglishLevel] = useState("basic");
  const [extraInfo, setExtraInfo] = useState("");

  const handleCheckbox = (id: string) => {
    setSelections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Processamento ---
  const processFile = useCallback(
    async (file: File) => {
      if (!niche) {
        toast({
          title: "Select a job type",
          description: "Please choose your target niche first.",
          variant: "destructive",
        });
        return;
      }

      try {
        setStep("reading");
        let rawText = "";
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          rawText = await extractTextFromPDF(file);
        } else {
          rawText = await extractTextFromDOCX(file);
        }

        setStep("translating");

        // Enviamos o texto original + todos os marcadores de contexto
        const { data, error } = await supabase.functions.invoke("convert-resume", {
          body: {
            raw_text: rawText,
            context: {
              target_niche: niche,
              capabilities: Object.keys(selections).filter((k) => selections[k]),
              english_level: englishLevel,
              additional_notes: extraInfo,
            },
          },
        });

        if (error) throw error;
        setStep("formatting");
        setResume(data);
        setStep("done");
        toast({ title: "Resume Generated!" });
      } catch (err: any) {
        setStep("error");
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
    [niche, selections, englishLevel, extraInfo],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.length > 0 && processFile(files[0]),
    maxFiles: 1,
    disabled: step !== "idle" && step !== "error",
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Resume Converter</h1>
        <p className="text-muted-foreground">Transform your CV into a US-standard resume tailored for H-2 visas.</p>
      </div>

      {step !== "done" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* LADO ESQUERDO: FORMULÁRIO DE CONTEXTO */}
          <div className="md:col-span-7 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Job Target & Capabilities</CardTitle>
                <CardDescription>
                  This information will be used to create a strong "Capability Section".
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tipo de Vaga */}
                <div className="space-y-3">
                  <Label className="font-bold">Job Type (Required)</Label>
                  <Select onValueChange={(v) => setNiche(v as Niche)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target niche..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="h2a">H-2A Farm / Field Worker</SelectItem>
                      <SelectItem value="h2b_hospitality">H-2B Hospitality (Hotel/Kitchen)</SelectItem>
                      <SelectItem value="h2b_construction">H-2B Construction Helper</SelectItem>
                      <SelectItem value="h2b_landscaping">H-2B Landscaping</SelectItem>
                      <SelectItem value="h2b_warehouse">H-2B Warehouse / Production</SelectItem>
                      <SelectItem value="generic">General H-2A/H-2B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Disponibilidade */}
                <div className="space-y-3">
                  <Label className="font-bold">Availability</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "shifts", label: "Available for 8–12 hour shifts" },
                      { id: "weekends", label: "Available for weekends / holidays" },
                      { id: "relocate", label: "Willing to relocate anywhere in the U.S." },
                      { id: "immediate", label: "Available to start immediately" },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox id={item.id} onCheckedChange={() => handleCheckbox(item.id)} />
                        <label htmlFor={item.id} className="text-sm leading-none">
                          {item.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Capacidade Física */}
                <div className="space-y-3">
                  <Label className="font-bold">Physical Capability</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "lift50", label: "Able to lift 50 lbs / 23 kg" },
                      { id: "standing", label: "Comfortable standing for long periods" },
                      { id: "weather", label: "Comfortable working in extreme heat/cold" },
                      { id: "fastpace", label: "Comfortable working at a fast pace" },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox id={item.id} onCheckedChange={() => handleCheckbox(item.id)} />
                        <label htmlFor={item.id} className="text-sm leading-none">
                          {item.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Idioma */}
                <div className="space-y-3">
                  <Label className="font-bold">English Communication</Label>
                  <Select onValueChange={setEnglishLevel} defaultValue="basic">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Very Basic</SelectItem>
                      <SelectItem value="basic">Basic (Can follow instructions)</SelectItem>
                      <SelectItem value="intermediate">Intermediate / Conversation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LADO DIREITO: UPLOAD */}
          <div className="md:col-span-5 flex flex-col gap-6">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">2. Original CV</CardTitle>
                <CardDescription>Upload your current file.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div
                  {...getRootProps()}
                  className={cn(
                    "flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted",
                  )}
                >
                  <input {...getInputProps()} />
                  {step === "idle" || step === "error" ? (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium">Click or drag your PDF/DOCX</p>
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        The AI will combine this file with your choices.
                      </p>
                    </>
                  ) : (
                    <div className="space-y-4 w-full">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm font-bold animate-pulse uppercase tracking-wider">{step}...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* RESULTADO (EDITOR) */}
      {step === "done" && resume && (
        <Card className="animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle>Resume Ready</CardTitle>
              <CardDescription>Review the US-optimized version below.</CardDescription>
            </div>
            <Button
              onClick={() => {
                const doc = generateResumePDF(resume as any);
                doc.save(`${resume.personal_info.full_name}_US_Resume.pdf`);
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Label className="text-primary font-bold">Generated Content (Editable)</Label>
                <Textarea
                  className="min-h-[400px] font-mono text-sm"
                  value={
                    resume.summary + "\n\n" + resume.experience.map((e) => `${e.title}\n${e.company}`).join("\n\n")
                  }
                  readOnly
                />
              </div>
              <div className="bg-slate-50 rounded-lg p-6 border flex items-center justify-center text-muted-foreground italic text-sm">
                PDF Preview will be generated upon download.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
