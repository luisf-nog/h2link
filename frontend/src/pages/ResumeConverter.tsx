import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, Loader2, Download, CheckCircle, Sparkles, AlertCircle,
  HardHat, Tractor, Utensils, Hammer, Package, ShieldCheck, Info,
  Truck, TreePine, Building2, Wrench, ChefHat, Warehouse,
  Globe, Calendar, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf";
import { extractTextFromDOCX } from "@/lib/docx";
import { generateResumePDF, type ResumeData } from "@/lib/resumePdf";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Practical experience options ---
const PRACTICAL_EXPERIENCE = [
  { id: "farming_crops", label: "Crop Farming & Harvesting", icon: Tractor, tags: ["h2a"] },
  { id: "livestock", label: "Livestock & Animal Care", icon: Tractor, tags: ["h2a"] },
  { id: "greenhouse_nursery", label: "Greenhouse / Nursery Work", icon: TreePine, tags: ["h2a"] },
  { id: "landscaping", label: "Landscaping & Grounds Maintenance", icon: TreePine, tags: ["h2b"] },
  { id: "construction", label: "Construction & Building", icon: Hammer, tags: ["h2b"] },
  { id: "painting_finishing", label: "Painting & Finishing", icon: Wrench, tags: ["h2b"] },
  { id: "plumbing_electrical", label: "Plumbing / Electrical Basics", icon: Wrench, tags: ["h2b"] },
  { id: "hospitality_hotel", label: "Hotels & Housekeeping", icon: Building2, tags: ["h2b"] },
  { id: "restaurant_kitchen", label: "Restaurant / Kitchen Work", icon: ChefHat, tags: ["h2b"] },
  { id: "warehouse_logistics", label: "Warehouse & Logistics", icon: Warehouse, tags: ["h2b"] },
  { id: "driving_transport", label: "Driving & Transportation", icon: Truck, tags: ["h2a", "h2b"] },
  { id: "food_processing", label: "Food Processing & Packing", icon: Package, tags: ["h2a", "h2b"] },
  { id: "cleaning_janitorial", label: "Cleaning & Janitorial", icon: Building2, tags: ["h2b"] },
  { id: "factory_manufacturing", label: "Factory / Manufacturing", icon: HardHat, tags: ["h2b"] },
  { id: "office_admin", label: "Office / Administrative (will be reframed)", icon: FileText, tags: [] },
];

// --- Physical skills ---
const PHYSICAL_SKILLS = [
  { id: "heavy_lifting", label: "Heavy Lifting (50+ lbs / 23+ kg)" },
  { id: "outdoor_heat", label: "Outdoor Work in Extreme Heat" },
  { id: "outdoor_cold", label: "Outdoor Work in Cold Weather" },
  { id: "standing_long", label: "Standing/Walking 8-12 hours" },
  { id: "repetitive_motion", label: "Repetitive Physical Tasks" },
  { id: "heights", label: "Comfortable Working at Heights" },
  { id: "machinery", label: "Heavy Machinery / Equipment Operation" },
  { id: "power_tools", label: "Power Tools (drills, saws, etc.)" },
  { id: "drivers_license", label: "Valid Driver's License" },
  { id: "forklift", label: "Forklift / Pallet Jack Certified" },
];

type Step = "form" | "uploading" | "generating" | "done" | "error";

export default function ResumeConverter() {
  const [step, setStep] = useState<Step>("form");

  // Practical experience
  const [selectedExperience, setSelectedExperience] = useState<Record<string, boolean>>({});
  // Physical skills
  const [selectedPhysical, setSelectedPhysical] = useState<Record<string, boolean>>({});

  // Migration/visa status
  const [currentLocation, setCurrentLocation] = useState("outside_us");
  const [workAuth, setWorkAuth] = useState("needs_sponsorship");
  const [hasH2History, setHasH2History] = useState("no");
  const [h2Details, setH2Details] = useState("");
  const [visaDenials, setVisaDenials] = useState("no");
  const [passportStatus, setPassportStatus] = useState("valid");

  // Availability
  const [availableWhen, setAvailableWhen] = useState("immediately");
  const [durationPref, setDurationPref] = useState("full_season");

  // Extra notes
  const [extraNotes, setExtraNotes] = useState("");

  // English level
  const [englishLevel, setEnglishLevel] = useState("basic");

  // Results
  const [h2aResume, setH2aResume] = useState<any>(null);
  const [h2bResume, setH2bResume] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("h2a");

  // Collapsible sections
  const [showPhysical, setShowPhysical] = useState(true);
  const [showVisa, setShowVisa] = useState(true);

  const toggleExperience = (id: string) => setSelectedExperience(p => ({ ...p, [id]: !p[id] }));
  const togglePhysical = (id: string) => setSelectedPhysical(p => ({ ...p, [id]: !p[id] }));

  const selectedExpList = PRACTICAL_EXPERIENCE.filter(e => selectedExperience[e.id]).map(e => e.label);
  const selectedPhysList = PHYSICAL_SKILLS.filter(s => selectedPhysical[s.id]).map(s => s.label);

  const processFile = useCallback(async (file: File) => {
    try {
      setStep("uploading");
      const rawText = file.type === "application/pdf"
        ? await extractTextFromPDF(file)
        : await extractTextFromDOCX(file);

      setStep("generating");

      const context = {
        practical_experience: selectedExpList,
        physical_skills: selectedPhysList,
        english_level: englishLevel,
        migration_status: {
          location: currentLocation === "outside_us" ? "Outside the U.S." : "Currently in the U.S.",
          work_auth: workAuth === "needs_sponsorship" ? "Requires H-2 Visa Sponsorship"
            : workAuth === "citizen_resident" ? "U.S. Citizen / Permanent Resident"
            : "Other Legal Work Status",
          h2_history: hasH2History === "yes" ? h2Details : "None - first time applicant",
          visa_denials: visaDenials === "yes" ? "Has had a previous visa denial" : "No visa denials",
          passport: passportStatus === "valid" ? "Valid passport" : passportStatus === "expired" ? "Expired - renewing" : "No passport yet",
        },
        availability: {
          when: availableWhen === "immediately" ? "Immediately available"
            : availableWhen === "30_days" ? "Available within 30 days"
            : availableWhen === "60_days" ? "Available within 60 days"
            : "Specific date (flexible)",
          duration: durationPref === "full_season" ? "Full season"
            : durationPref === "6_months" ? "Up to 6 months"
            : durationPref === "1_year" ? "Up to 1 year"
            : "Flexible",
        },
        extra_notes: extraNotes || undefined,
      };

      const { data, error } = await supabase.functions.invoke("convert-resume", {
        body: { raw_text: rawText, context },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setH2aResume(data.h2a);
      setH2bResume(data.h2b);
      setStep("done");
      toast.success("Both H-2A and H-2B resumes generated and saved!");
    } catch (err: any) {
      console.error("Resume conversion error:", err);
      setStep("error");
      toast.error(err.message || "Failed to generate resumes");
    }
  }, [selectedExpList, selectedPhysList, englishLevel, currentLocation, workAuth, hasH2History, h2Details, visaDenials, passportStatus, availableWhen, durationPref, extraNotes]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (files) => files.length > 0 && processFile(files[0]),
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    disabled: step !== "form",
    maxFiles: 1,
  });

  const handleDownload = (resume: any, type: string) => {
    const doc = generateResumePDF(resume as ResumeData);
    const name = (resume.personal_info?.full_name || "Resume").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
    doc.save(`${name}_${type}_Resume.pdf`);
  };

  const handleReset = () => {
    setStep("form");
    setH2aResume(null);
    setH2bResume(null);
  };

  // RESULT VIEW
  if (step === "done" && h2aResume && h2bResume) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Success header */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Resumes Generated Successfully!</h2>
              <p className="text-sm text-muted-foreground">Both H-2A and H-2B versions saved to your profile automatically.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>Generate New</Button>
        </div>

        {/* Tabs for H-2A / H-2B */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="h2a" className="gap-2 text-sm font-bold">
              <Tractor className="h-4 w-4" /> H-2A Agricultural
            </TabsTrigger>
            <TabsTrigger value="h2b" className="gap-2 text-sm font-bold">
              <HardHat className="h-4 w-4" /> H-2B Non-Agricultural
            </TabsTrigger>
          </TabsList>

          {[
            { key: "h2a", resume: h2aResume, label: "H-2A" },
            { key: "h2b", resume: h2bResume, label: "H-2B" },
          ].map(({ key, resume, label }) => (
            <TabsContent key={key} value={key}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{resume.personal_info?.full_name} — {label} Resume</CardTitle>
                  <Button size="sm" className="gap-2" onClick={() => handleDownload(resume, label)}>
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary */}
                  {resume.summary && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Professional Summary</p>
                      <p className="text-sm text-foreground leading-relaxed">{resume.summary}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {resume.skills?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {resume.skills.map((s: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience */}
                  {resume.experience?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Experience</p>
                      <div className="space-y-3">
                        {resume.experience.map((exp: any, i: number) => (
                          <div key={i} className="border-l-2 border-primary/30 pl-3">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-semibold">{exp.title}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{exp.dates}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{exp.company}{exp.location ? ` — ${exp.location}` : ""}</p>
                            {exp.points?.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {exp.points.map((pt: string, j: number) => (
                                  <li key={j} className="text-xs text-foreground flex items-start gap-1.5">
                                    <span className="text-primary mt-0.5">•</span> {pt}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {resume.languages?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Languages</p>
                      <p className="text-sm">{resume.languages.join(" • ")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // GENERATING STATE
  if (step === "uploading" || step === "generating") {
    return (
      <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {step === "uploading" ? "Reading your resume..." : "AI is generating both H-2A & H-2B resumes..."}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {step === "generating" && "This may take 30-60 seconds. We're creating two optimized versions."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          <div className={cn("p-3 rounded-lg border text-center", step === "generating" ? "border-primary/30 bg-primary/5" : "border-muted")}>
            <Tractor className="h-5 w-5 mx-auto mb-1 text-primary" />
            <span className="text-[10px] font-bold uppercase">H-2A</span>
            {step === "generating" && <Loader2 className="h-3 w-3 animate-spin mx-auto mt-1 text-primary" />}
          </div>
          <div className={cn("p-3 rounded-lg border text-center", step === "generating" ? "border-primary/30 bg-primary/5" : "border-muted")}>
            <HardHat className="h-5 w-5 mx-auto mb-1 text-primary" />
            <span className="text-[10px] font-bold uppercase">H-2B</span>
            {step === "generating" && <Loader2 className="h-3 w-3 animate-spin mx-auto mt-1 text-primary" />}
          </div>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (step === "error") {
    return (
      <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">The AI couldn't process your resume. Please try again.</p>
        <Button onClick={() => setStep("form")}>Try Again</Button>
      </div>
    );
  }

  // FORM VIEW
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">H-2 Smart Resume Builder</h1>
        <p className="text-sm text-muted-foreground">
          Answer a few questions, upload your CV, and we'll generate <strong>two optimized resumes</strong> — one for H-2A and one for H-2B positions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Questions */}
        <div className="lg:col-span-2 space-y-5">

          {/* 1. Practical Experience */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                1. Practical Experience
              </CardTitle>
              <CardDescription>Select all work experience you have, even if not on your resume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRACTICAL_EXPERIENCE.map((exp) => (
                  <div
                    key={exp.id}
                    onClick={() => toggleExperience(exp.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                      selectedExperience[exp.id]
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <Checkbox checked={!!selectedExperience[exp.id]} className="pointer-events-none" />
                    <exp.icon className={cn("h-4 w-4 flex-shrink-0", selectedExperience[exp.id] ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-xs font-medium leading-tight">{exp.label}</span>
                    {exp.tags.length > 0 && (
                      <div className="ml-auto flex gap-1">
                        {exp.tags.map(t => (
                          <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 h-4">{t.toUpperCase()}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* English level */}
              <div className="mt-4 flex items-center gap-3">
                <Label className="text-xs font-bold whitespace-nowrap">English Level:</Label>
                <Select value={englishLevel} onValueChange={setEnglishLevel}>
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="fluent">Fluent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 2. Physical Skills */}
          <Card>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowPhysical(!showPhysical)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <HardHat className="h-4 w-4 text-primary" />
                  2. Physical Skills & Capabilities
                  {selectedPhysList.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{selectedPhysList.length} selected</Badge>
                  )}
                </CardTitle>
                {showPhysical ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {showPhysical && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PHYSICAL_SKILLS.map((skill) => (
                    <div
                      key={skill.id}
                      onClick={() => togglePhysical(skill.id)}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                        selectedPhysical[skill.id]
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <Checkbox checked={!!selectedPhysical[skill.id]} className="pointer-events-none" />
                      <span className="text-xs font-medium">{skill.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* 3. Visa & Migration Status */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowVisa(!showVisa)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  3. Visa & Work Authorization
                </CardTitle>
                {showVisa ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              <CardDescription>This info helps tailor your resume for US employers</CardDescription>
            </CardHeader>
            {showVisa && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Where are you now?</Label>
                    <Select value={currentLocation} onValueChange={setCurrentLocation}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outside_us">Outside the U.S.</SelectItem>
                        <SelectItem value="inside_us">Inside the U.S. (Legal Status)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Work Authorization</Label>
                    <Select value={workAuth} onValueChange={setWorkAuth}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needs_sponsorship">Needs H-2 Visa Sponsorship</SelectItem>
                        <SelectItem value="citizen_resident">U.S. Citizen / Permanent Resident</SelectItem>
                        <SelectItem value="other_status">Other Legal Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Previous H-2 Visa Experience?</Label>
                    <Select value={hasH2History} onValueChange={setHasH2History}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No — First time</SelectItem>
                        <SelectItem value="yes">Yes — Worked on H-2 before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasH2History === "yes" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">H-2 Details</Label>
                      <Input
                        className="h-9 text-xs"
                        placeholder="E.g.: 2 seasons in Montana (H-2A), 1 year Florida (H-2B)"
                        value={h2Details}
                        onChange={(e) => setH2Details(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Passport Status</Label>
                    <Select value={passportStatus} onValueChange={setPassportStatus}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valid">Valid passport</SelectItem>
                        <SelectItem value="expired">Expired — renewing</SelectItem>
                        <SelectItem value="none">No passport yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      Any Visa Denials? <Info className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Select value={visaDenials} onValueChange={setVisaDenials}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No — Never denied</SelectItem>
                        <SelectItem value="yes">Yes — Had a visa denied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Availability */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> When can you start?
                    </Label>
                    <Select value={availableWhen} onValueChange={setAvailableWhen}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediately">Immediately</SelectItem>
                        <SelectItem value="30_days">Within 30 days</SelectItem>
                        <SelectItem value="60_days">Within 60 days</SelectItem>
                        <SelectItem value="flexible">Flexible / Specific date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Duration Preference</Label>
                    <Select value={durationPref} onValueChange={setDurationPref}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_season">Full season</SelectItem>
                        <SelectItem value="6_months">Up to 6 months</SelectItem>
                        <SelectItem value="1_year">Up to 1 year</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Extra notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Additional Notes (optional)</Label>
            <Textarea
              className="text-xs min-h-[60px]"
              placeholder="Anything else you want the AI to know when building your resume..."
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Upload */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-4">
            {/* Summary of selections */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-bold uppercase text-muted-foreground">Your Profile</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Experience areas:</span>
                    <Badge variant="secondary">{selectedExpList.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Physical skills:</span>
                    <Badge variant="secondary">{selectedPhysList.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">English:</span>
                    <span className="font-medium capitalize">{englishLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">H-2 history:</span>
                    <span className="font-medium">{hasH2History === "yes" ? "Yes" : "First time"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upload area */}
            <Card
              className={cn(
                "border-2 border-dashed transition-all cursor-pointer hover:border-primary/50",
                selectedExpList.length === 0 ? "opacity-50 pointer-events-none" : ""
              )}
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Upload Your CV</h3>
                  <p className="text-[10px] text-muted-foreground mt-1">PDF or DOCX — any language</p>
                </div>
                <div className="bg-primary/5 rounded-lg p-3 w-full">
                  <p className="text-[10px] font-medium text-primary">
                    AI will generate <strong>2 resumes</strong>: one optimized for H-2A and another for H-2B positions
                  </p>
                </div>
                {selectedExpList.length === 0 && (
                  <p className="text-[10px] text-destructive font-medium">
                    ← Select at least one experience area first
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
