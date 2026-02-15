import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { Upload, FileText, Loader2, Download, CheckCircle, Sparkles, AlertCircle, Info, Calendar } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// --- Tipagens ---
type Niche =
  | "h2a"
  | "h2b_hospitality"
  | "h2b_construction"
  | "h2b_landscaping"
  | "h2b_warehouse"
  | "h2b_generic"
  | "total_generic";

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
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("idle");
  const [resume, setResume] = useState<SafeResumeData | null>(null);

  // --- Estados do Formulário ---
  const [niche, setNiche] = useState<Niche | "">("");
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [englishLevel, setEnglishLevel] = useState("basic");
  const [startDate, setStartDate] = useState("");
  const [extraInfo, setExtraInfo] = useState("");

  const handleCheckbox = (id: string) => {
    setSelections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Mapeamento Total de Opções ---
  const dynamicOptions = useMemo(() => {
    if (!niche) return [];

    const options = [
      // 1. DISPONIBILIDADE (Geral)
      { id: "shifts", label: "8–12 hour shifts", cat: "Availability", show: "all" },
      { id: "weekends", label: "Weekends / Holidays", cat: "Availability", show: "all" },
      { id: "relocate", label: "Relocate anywhere in U.S.", cat: "Availability", show: "all" },
      { id: "immediate", label: "Start immediately", cat: "Availability", show: "all" },

      // 2. CAPACIDADE FÍSICA
      { id: "lift50", label: "Lift 50 lbs / 23 kg", cat: "Physical", show: "all" },
      { id: "standing", label: "Long periods standing", cat: "Physical", show: "all" },
      { id: "fastpace", label: "Fast-paced environment", cat: "Physical", show: "all" },
      {
        id: "repetitive",
        label: "Repetitive tasks",
        cat: "Physical",
        show: ["h2b_warehouse", "h2b_generic", "total_generic"],
      },
      {
        id: "weather",
        label: "Outdoor heat/cold",
        cat: "Physical",
        show: ["h2a", "h2b_construction", "h2b_landscaping", "h2b_generic", "total_generic"],
      },

      // 3. RESTRIÇÕES / PREFERÊNCIAS
      {
        id: "indoor",
        label: "Prefer indoor work",
        cat: "Environment",
        show: ["h2b_hospitality", "h2b_warehouse", "h2b_generic", "total_generic"],
      },
      {
        id: "outdoor",
        label: "Prefer outdoor work",
        cat: "Environment",
        show: ["h2a", "h2b_construction", "h2b_landscaping", "h2b_generic", "total_generic"],
      },
      {
        id: "chemicals",
        label: "Cleaning chemicals OK",
        cat: "Environment",
        show: ["h2b_hospitality", "h2b_generic", "total_generic"],
      },
      { id: "animals", label: "Animals OK (Farm)", cat: "Environment", show: ["h2a", "total_generic"] },
      {
        id: "tools",
        label: "Basic hand tools OK",
        cat: "Environment",
        show: ["h2b_construction", "h2b_landscaping", "h2b_generic", "total_generic"],
      },

      // 4. DIFERENCIAIS
      { id: "whatsapp", label: "Has WhatsApp for contact", cat: "Differentials", show: "all" },
      { id: "license_br", label: "Driver's License (BR)", cat: "Differentials", show: "all" },
      { id: "license_us", label: "U.S. Driver's License", cat: "Differentials", show: "all" },
      {
        id: "machinery",
        label: "Heavy Machinery Experience",
        cat: "Differentials",
        show: ["h2a", "h2b_construction", "h2b_landscaping", "h2b_warehouse", "h2b_generic", "total_generic"],
      },

      // 5. CONFIABILIDADE
      { id: "punctual", label: "No attendance issues", cat: "Reliability", show: "all" },
      { id: "full_contract", label: "Will complete full contract", cat: "Reliability", show: "all" },
      { id: "safety", label: "Follows safety procedures", cat: "Reliability", show: "all" },
    ];

    return options.filter((opt) => opt.show === "all" || (opt.show as string[]).includes(niche));
  }, [niche]);

  // --- Processamento ---
  const processFile = useCallback(
    async (file: File) => {
      try {
        setStep("reading");
        let rawText = "";
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          rawText = await extractTextFromPDF(file);
        } else {
          rawText = await extractTextFromDOCX(file);
        }

        setStep("translating");
        const { data, error } = await supabase.functions.invoke("convert-resume", {
          body: {
            raw_text: rawText,
            context: {
              target_niche: niche,
              capabilities: Object.keys(selections).filter((k) => selections[k]),
              english_level: englishLevel,
              start_date: startDate,
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
    [niche, selections, englishLevel, startDate, extraInfo, toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.length > 0 && processFile(files[0]),
    maxFiles: 1,
    disabled: !niche || (step !== "idle" && step !== "error"),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 text-left">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AI Resume Optimizer</h1>
        <p className="text-muted-foreground italic">
          Combine o seu currículo original com as suas capacidades físicas e disponibilidade.
        </p>
      </div>

      {step !== "done" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Job Target & Specific Requirements</CardTitle>
                <CardDescription>First, select your niche to unlock specific capability questions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Seleção de Nicho */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="font-bold">Target Niche (Required)</Label>
                    <Select
                      onValueChange={(v) => {
                        setNiche(v as Niche);
                        setSelections({});
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Choose your niche..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="h2a">H-2A Farm / Field / Livestock</SelectItem>
                        <SelectItem value="h2b_hospitality">H-2B Hospitality (Hotel/Resort)</SelectItem>
                        <SelectItem value="h2b_construction">H-2B Construction Helper</SelectItem>
                        <SelectItem value="h2b_landscaping">H-2B Landscaping</SelectItem>
                        <SelectItem value="h2b_warehouse">H-2B Warehouse / Packing</SelectItem>
                        <SelectItem value="h2b_generic">H-2B General (Multiple niches)</SelectItem>
                        <SelectItem value="total_generic">H-2A & H-2B Total (General Worker)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="font-bold">Estimated Start Date</Label>
                    <div className="relative">
                      <Input
                        type="date"
                        className="h-11"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Checkboxes Dinâmicos Categorizados */}
                {niche && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      {["Availability", "Physical", "Environment", "Differentials", "Reliability"].map((cat) => {
                        const items = dynamicOptions.filter((o) => o.cat === cat);
                        if (items.length === 0) return null;
                        return (
                          <div key={cat} className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-b pb-1">
                              {cat}
                            </h4>
                            <div className="space-y-2.5">
                              {items.map((item) => (
                                <div key={item.id} className="flex items-center space-x-3">
                                  <Checkbox
                                    id={item.id}
                                    checked={!!selections[item.id]}
                                    onCheckedChange={() => handleCheckbox(item.id)}
                                  />
                                  <label htmlFor={item.id} className="text-sm font-medium leading-none cursor-pointer">
                                    {item.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-3">
                      <Label className="font-bold">English Communication Level</Label>
                      <Select onValueChange={setEnglishLevel} defaultValue="basic">
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None / Very Basic (Understand instructions)</SelectItem>
                          <SelectItem value="basic">Basic (Can follow instructions + simple phrases)</SelectItem>
                          <SelectItem value="intermediate">Intermediate (Can hold a conversation)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-bold">Machinery / Special Skills Detail</Label>
                      <Textarea
                        placeholder="Ex: Operator of John Deere tractors, experience with high-pressure washers, drywall finish, etc..."
                        className="min-h-[100px]"
                        value={extraInfo}
                        onChange={(e) => setExtraInfo(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* COLUNA DIREITA: UPLOAD */}
          <div className="md:col-span-4 flex flex-col">
            <Card
              className={cn(
                "flex-1 border-2 border-dashed transition-all flex flex-col items-center justify-center p-8 text-center",
                !niche
                  ? "opacity-30 bg-slate-100"
                  : isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 cursor-pointer hover:bg-slate-50",
              )}
            >
              <div
                {...getRootProps()}
                className={cn(
                  "w-full h-full flex flex-col items-center justify-center",
                  !niche && "pointer-events-none",
                )}
              >
                <input {...getInputProps()} />
                <div className="bg-primary/10 p-5 rounded-full mb-4">
                  <Upload className={cn("h-8 w-8 text-primary", !niche && "text-slate-300")} />
                </div>
                <h3 className="font-black uppercase italic text-lg italic tracking-tight">2. Upload CV</h3>
                <p className="text-xs text-muted-foreground mt-1">Sua base de experiências original.</p>
                {step !== "idle" && step !== "error" && (
                  <div className="mt-6 w-full space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-[10px] font-black uppercase animate-pulse">{step}...</p>
                  </div>
                )}
                {!niche && (
                  <div className="mt-6 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 animate-pulse">
                    <Info className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase">Choose Niche First</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* RESULTADO (Limpo) */}
      {step === "done" && resume && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
          <Card className="border-emerald-100 bg-emerald-50/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-100 p-3 rounded-full">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Resume Successfully Optimized!</CardTitle>
                  <CardDescription>Your US-standard PDF is ready to be sent to employers.</CardDescription>
                </div>
              </div>
              <Button
                size="lg"
                className="px-8 font-black italic"
                onClick={() => {
                  const doc = generateResumePDF(resume as any);
                  doc.save(`${resume.personal_info.full_name}_US_Resume.pdf`);
                }}
              >
                <Download className="mr-2 h-5 w-5" /> DOWNLOAD PDF
              </Button>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-xs uppercase text-slate-400">Target Niche</CardTitle>
              </CardHeader>
              <CardContent className="font-bold uppercase text-primary tracking-widest">{niche}</CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-xs uppercase text-slate-400">Capabilities Injected</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.keys(selections)
                  .filter((k) => selections[k])
                  .map((key) => (
                    <Badge key={key} variant="secondary" className="text-[9px] uppercase font-bold">
                      {key.replace("_", " ")}
                    </Badge>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
