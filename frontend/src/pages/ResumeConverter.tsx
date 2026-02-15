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
  Globe,
  ShieldCheck,
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

  // --- Estados de Compliance e Visto (Novos) ---
  const [currentLocation, setCurrentLocation] = useState("outside_us");
  const [workAuth, setWorkAuth] = useState("needs_sponsorship");
  const [hasH2History, setHasH2History] = useState("no");
  const [h2Time, setH2Time] = useState("");
  const [visaDenial, setVisaDenial] = useState("no");

  const handleCheckbox = (id: string) => setSelections((prev) => ({ ...prev, [id]: !prev[id] }));

  const technicalQuestions = useMemo(() => {
    if (!niche) return [];
    const options = [
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
        id: "power_tools",
        label: "Electric & Pneumatic Power Tools Operation",
        cat: "Technical",
        show: ["h2b_construction", "h2b_landscaping", "total_generic"],
      },
      {
        id: "zero_turn",
        label: "Zero-Turn Mower & Trimmer Experience",
        cat: "Operational",
        show: ["h2b_landscaping", "total_generic"],
      },
      {
        id: "forklift",
        label: "Forklift / Pallet Jack Operation",
        cat: "Operational",
        show: ["h2b_warehouse", "total_generic"],
      },
      { id: "shifts_12h", label: "Experienced with 10-12h Intensive Shifts", cat: "Work Load", show: "all" },
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
              compliance: {
                location: currentLocation,
                auth: workAuth,
                h2_history: hasH2History === "yes" ? h2Time : "None",
                denials: visaDenial,
              },
              notes: extraTechnical,
            },
          },
        });

        if (error) throw error;
        setStep("formatting");
        setResume(data);
        setStep("done");
      } catch (err: any) {
        setStep("error");
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
    [
      niche,
      selections,
      liftingCapacity,
      englishLevel,
      currentLocation,
      workAuth,
      hasH2History,
      h2Time,
      visaDenial,
      extraTechnical,
    ],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.length > 0 && processFile(files[0]),
    disabled: !niche || step !== "idle",
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 text-left">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">H-2 Strategic Resume Converter</h1>
        <p className="text-muted-foreground">
          Tailor your profile with technical skills and legal authorization context.
        </p>
      </div>

      {step !== "done" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            {/* CARD 1: TECHNICAL SKILLS */}
            <Card className="border shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <HardHat className="h-5 w-5 text-primary" /> 1. Target & Technical Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Industry</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        onClick={() => setNiche(item.id as Niche)}
                        className={cn(
                          "flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all",
                          niche === item.id ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-300",
                        )}
                      >
                        <item.icon
                          className={cn("h-5 w-5 mb-1", niche === item.id ? "text-primary" : "text-slate-400")}
                        />
                        <span className="text-[10px] font-bold text-center uppercase">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {niche && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-500">
                    {technicalQuestions.map((opt) => (
                      <div key={opt.id} className="flex items-start space-x-3 p-2 rounded-lg border bg-white">
                        <Checkbox
                          id={opt.id}
                          checked={!!selections[opt.id]}
                          onCheckedChange={() => handleCheckbox(opt.id)}
                          className="mt-1"
                        />
                        <label htmlFor={opt.id} className="text-xs font-semibold leading-tight cursor-pointer">
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CARD 2: VISA & COMPLIANCE (O DESTAQUE) */}
            <Card className="border-2 border-primary/20 shadow-md bg-primary/[0.01]">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" /> 2. Visa & Work Authorization Context
                </CardTitle>
                <CardDescription className="text-primary/70 font-medium">
                  Critical info requested by US recruiters in follow-up emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-bold">Current Physical Presence</Label>
                    <Select onValueChange={setCurrentLocation} defaultValue="outside_us">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outside_us">Outside the U.S. (Applying from abroad)</SelectItem>
                        <SelectItem value="inside_us">Currently in the U.S. (Legal Status)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold">Legal Work Authorization</Label>
                    <Select onValueChange={setWorkAuth} defaultValue="needs_sponsorship">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needs_sponsorship">Requires H-2 Visa Sponsorship</SelectItem>
                        <SelectItem value="citizen_resident">U.S. Citizen / Permanent Resident</SelectItem>
                        <SelectItem value="other_status">Other Legal Work Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold">Previous H-2A/H-2B Experience?</Label>
                    <Select onValueChange={setHasH2History} defaultValue="no">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No, first time applicant</SelectItem>
                        <SelectItem value="yes">Yes, I have worked in H-2 status before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasH2History === "yes" && (
                    <div className="space-y-2 animate-in slide-in-from-left-2">
                      <Label className="font-bold">Total Duration (Seasons/Years)</Label>
                      <Input
                        placeholder="Ex: 2 seasons in Montana, 1 year in Florida"
                        value={h2Time}
                        onChange={(e) => setH2Time(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="font-bold text-destructive flex items-center gap-1">
                      Any Visa Denials? <Info className="h-3 w-3" />
                    </Label>
                    <Select onValueChange={setVisaDenial} defaultValue="no">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No, never denied</SelectItem>
                        <SelectItem value="yes">Yes, I had a visa denied previously</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold">Lifting Strength</Label>
                    <Select onValueChange={setLiftingCapacity} defaultValue="50+ lbs">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50+ lbs">Standard (Up to 50 lbs)</SelectItem>
                        <SelectItem value="75+ lbs">Heavy (Up to 75 lbs)</SelectItem>
                        <SelectItem value="100+ lbs">Exceptional (100+ lbs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LADO DIREITO: UPLOAD */}
          <div className="lg:col-span-4">
            <Card
              className={cn(
                "h-full border-2 border-dashed flex flex-col items-center justify-center p-6 text-center",
                !niche ? "opacity-30 bg-slate-50" : "cursor-pointer hover:bg-slate-50",
              )}
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-bold">3. Final Step: Upload CV</h3>
              <p className="text-[10px] text-muted-foreground mt-2 uppercase font-black">
                AI will merge your skills + visa context
              </p>
              {step !== "idle" && (
                <div className="mt-6 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <p className="text-[10px] font-bold uppercase">{step}...</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* RESULTADO */}
      {step === "done" && resume && (
        <Card className="border-2 border-emerald-500 shadow-xl overflow-hidden">
          <div className="bg-emerald-500 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold uppercase tracking-tighter">Strategic Resume Ready for H-2 Application</span>
            </div>
            <Button
              variant="secondary"
              className="font-black"
              onClick={() => {
                const doc = generateResumePDF(resume as any);
                doc.save(`${resume.personal_info.full_name}_H2_Resume.pdf`);
              }}
            >
              DOWNLOAD PDF
            </Button>
          </div>
          <CardContent className="p-8 bg-white text-slate-400 italic text-sm text-center">
            Your legal authorization status and H-2 history have been intelligently injected into the Summary.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
