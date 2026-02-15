import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import {
  Upload,
  FileText,
  Loader2,
  Download,
  CheckCircle,
  Sparkles,
  AlertCircle,
  HardHat,
  Tractor,
  Utensils,
  Hammer,
  Package,
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Niche = "h2a" | "h2b_hospitality" | "h2b_construction" | "h2b_landscaping" | "h2b_warehouse" | "total_generic";

export default function ResumeConverter() {
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "reading" | "translating" | "formatting" | "done" | "error">("idle");
  const [resume, setResume] = useState<any>(null);

  // --- Estados do Formulário Técnico ---
  const [niche, setNiche] = useState<Niche | "">("");
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [liftingCapacity, setLiftingCapacity] = useState("50+ lbs");
  const [englishLevel, setEnglishLevel] = useState("basic");
  const [extraTechnical, setExtraTechnical] = useState("");

  const handleCheckbox = (id: string) => setSelections((prev) => ({ ...prev, [id]: !prev[id] }));

  // --- Mapeamento de Perguntas Técnicas por Nicho ---
  const technicalQuestions = useMemo(() => {
    if (!niche) return [];

    const options = [
      // H-2A: AGRICULTURE
      {
        id: "heavy_machinery",
        label: "Heavy Machinery Operation (Tractors/Combines)",
        cat: "Operational",
        show: ["h2a", "total_generic"],
      },
      {
        id: "crop_harvest",
        label: "Manual Crop Harvesting & Packing",
        cat: "Operational",
        show: ["h2a", "total_generic"],
      },
      {
        id: "pesticide_safety",
        label: "Chemical & Pesticide Handling Knowledge",
        cat: "Safety",
        show: ["h2a", "total_generic"],
      },
      { id: "irrigation", label: "Irrigation System Maintenance", cat: "Technical", show: ["h2a", "total_generic"] },

      // H-2B: HOSPITALITY
      {
        id: "industrial_cleaning",
        label: "Industrial Cleaning & Sanitation Standards",
        cat: "Operational",
        show: ["h2b_hospitality", "total_generic"],
      },
      {
        id: "guest_service",
        label: "High-Volume Guest Service Experience",
        cat: "Service",
        show: ["h2b_hospitality", "total_generic"],
      },
      {
        id: "kitchen_safety",
        label: "Commercial Kitchen Safety (HAACP)",
        cat: "Safety",
        show: ["h2b_hospitality", "total_generic"],
      },
      {
        id: "laundry_ops",
        label: "Industrial Laundry/Housekeeping Equipment",
        cat: "Technical",
        show: ["h2b_hospitality", "total_generic"],
      },

      // H-2B: CONSTRUCTION & LANDSCAPING
      {
        id: "power_tools",
        label: "Electric & Pneumatic Power Tools Operation",
        cat: "Technical",
        show: ["h2b_construction", "h2b_landscaping", "total_generic"],
      },
      {
        id: "blueprints",
        label: "Basic Blueprint/Site Plan Reading",
        cat: "Technical",
        show: ["h2b_construction", "total_generic"],
      },
      {
        id: "zero_turn",
        label: "Zero-Turn Mower & Trimmer Experience",
        cat: "Operational",
        show: ["h2b_landscaping", "total_generic"],
      },
      {
        id: "osha_standards",
        label: "Knowledge of Worksite Safety (OSHA)",
        cat: "Safety",
        show: ["h2b_construction", "h2b_landscaping", "total_generic"],
      },

      // H-2B: WAREHOUSE
      {
        id: "forklift",
        label: "Forklift / Pallet Jack Operation",
        cat: "Operational",
        show: ["h2b_warehouse", "total_generic"],
      },
      {
        id: "inventory",
        label: "Digital Inventory & Scanning Systems",
        cat: "Technical",
        show: ["h2b_warehouse", "total_generic"],
      },
      {
        id: "packing_speed",
        label: "High-Speed Production/Packing Experience",
        cat: "Operational",
        show: ["h2b_warehouse", "total_generic"],
      },

      // GERAL DE ALTA PERFORMANCE
      { id: "shifts_12h", label: "Experienced with 10-12h Intensive Shifts", cat: "Work Load", show: "all" },
      { id: "flexible_schedule", label: "Available for Weekend/Holiday Rotations", cat: "Work Load", show: "all" },
      { id: "drivers_lic", label: "Valid Driver's License (Operational Use)", cat: "Technical", show: "all" },
    ];

    return options.filter((opt) => opt.show === "all" || (opt.show as string[]).includes(niche));
  }, [niche]);

  const processFile = useCallback(
    async (file: File) => {
      try {
        setStep("reading");
        let rawText =
          file.type === "application/pdf" ? await extractTextFromPDF(file) : await extractTextFromDOCX(file);

        setStep("translating");
        const { data, error } = await supabase.functions.invoke("convert-resume", {
          body: {
            raw_text: rawText,
            context: {
              niche,
              technical_skills: Object.keys(selections).filter((k) => selections[k]),
              lifting: liftingCapacity,
              english: englishLevel,
              notes: extraTechnical,
            },
          },
        });

        if (error) throw error;
        setStep("formatting");
        setResume(data);
        setStep("done");
        toast({ title: "Resume Successfully Generated!" });
      } catch (err: any) {
        setStep("error");
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
    [niche, selections, liftingCapacity, englishLevel, extraTechnical],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.length > 0 && processFile(files[0]),
    disabled: !niche || step !== "idle",
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 text-left">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Professional Resume Converter</h1>
        <p className="text-muted-foreground">Select your technical background to tailor your resume for US Sponsors.</p>
      </div>

      {step !== "done" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LADO ESQUERDO: FORMULÁRIO TÉCNICO */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <HardHat className="h-5 w-5 text-primary" /> 1. Technical Qualifications
                </CardTitle>
                <CardDescription>Specify your operational readiness and skills.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* Seleção de Nicho */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Target Industry</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: "h2a", label: "Agriculture", icon: Tractor },
                      { id: "h2b_hospitality", label: "Hospitality", icon: Utensils },
                      { id: "h2b_construction", label: "Construction", icon: Hammer },
                      { id: "h2b_landscaping", label: "Landscaping", icon: HardHat },
                      { id: "h2b_warehouse", label: "Warehouse", icon: Package },
                      { id: "total_generic", label: "General Labor", icon: Sparkles },
                    ].map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setNiche(item.id as Niche);
                          setSelections({});
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all",
                          niche === item.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-slate-100 hover:border-slate-300",
                        )}
                      >
                        <item.icon
                          className={cn("h-6 w-6 mb-2", niche === item.id ? "text-primary" : "text-slate-400")}
                        />
                        <span
                          className={cn(
                            "text-xs font-bold text-center",
                            niche === item.id ? "text-primary" : "text-slate-600",
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Perguntas Dinâmicas */}
                {niche && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        Specific Skills & Readiness
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {technicalQuestions.map((opt) => (
                          <div
                            key={opt.id}
                            className="flex items-start space-x-3 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                          >
                            <Checkbox
                              id={opt.id}
                              checked={!!selections[opt.id]}
                              onCheckedChange={() => handleCheckbox(opt.id)}
                              className="mt-1"
                            />
                            <label htmlFor={opt.id} className="text-sm font-medium leading-tight cursor-pointer">
                              {opt.label}
                              <span className="block text-[9px] text-primary/70 font-bold uppercase mt-1 tracking-widest">
                                {opt.cat}
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                      <div className="space-y-3">
                        <Label className="font-bold">Physical Strength (Lifting)</Label>
                        <Select onValueChange={setLiftingCapacity} defaultValue="50+ lbs">
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="50+ lbs">Can lift up to 50 lbs (Standard)</SelectItem>
                            <SelectItem value="75+ lbs">Can lift up to 75 lbs (Heavy Duty)</SelectItem>
                            <SelectItem value="100+ lbs">Can lift 100+ lbs (Exceptional)</SelectItem>
                            <SelectItem value="not_heavy">Prefer moderate lifting only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="font-bold">English Proficiency</Label>
                        <Select onValueChange={setEnglishLevel} defaultValue="basic">
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic (Can follow instructions)</SelectItem>
                            <SelectItem value="intermediate">Intermediate (Conversational)</SelectItem>
                            <SelectItem value="fluent">Fluent (Professional)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-bold">Operational Machinery / Licenses</Label>
                      <Textarea
                        placeholder="Example: Certified for Scissor Lifts, experienced with Bobcat loaders, heavy truck driving license..."
                        className="min-h-[100px] resize-none"
                        value={extraTechnical}
                        onChange={(e) => setExtraTechnical(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* LADO DIREITO: UPLOAD */}
          <div className="lg:col-span-4 space-y-6">
            <Card
              className={cn(
                "h-[400px] border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all",
                !niche
                  ? "opacity-30 bg-slate-50 cursor-not-allowed"
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
                <div className="bg-primary/10 p-6 rounded-full mb-4">
                  <Upload className={cn("h-10 w-10 text-primary", !niche && "text-slate-300")} />
                </div>
                <h3 className="font-bold text-lg">2. Upload CV</h3>
                <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                  We'll merge your technical choices with your file.
                </p>

                {step !== "idle" && (
                  <div className="mt-8 w-full space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-xs font-bold uppercase tracking-widest animate-pulse">{step}...</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* RESULTADO (EDITOR) */}
      {step === "done" && resume && (
        <Card className="animate-in fade-in slide-in-from-bottom duration-500 border-2 border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between bg-emerald-50/50">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500 p-2 rounded-full text-white">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-emerald-900 uppercase tracking-tight font-black italic">
                  Resume Optimized!
                </CardTitle>
                <CardDescription>Your technical capabilities are now part of your US Profile.</CardDescription>
              </div>
            </div>
            <Button
              size="lg"
              className="font-bold"
              onClick={() => {
                const doc = generateResumePDF(resume as any);
                doc.save(`${resume.personal_info.full_name}_US_Resume.pdf`);
              }}
            >
              <Download className="mr-2 h-4 w-4" /> DOWNLOAD PDF
            </Button>
          </CardHeader>
          <CardContent className="p-12 text-center text-slate-400 font-mono text-sm italic">
            PDF Preview is ready for download.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
