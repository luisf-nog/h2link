import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, Loader2, Download, CheckCircle, Sparkles, AlertCircle,
  HardHat, Tractor, Utensils, Hammer, ShieldCheck, Info,
  Truck, TreePine, Building2, Wrench, ChefHat, Warehouse,
  Globe, Calendar, FileText, ChevronDown, ChevronUp, Eye, RefreshCw,
  Beef, Shirt, Axe, Zap, Paintbrush, UtensilsCrossed, Wine, DoorOpen, Package, Car,
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
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, Crown } from "lucide-react";
import { PlanTier } from "@/config/plans.config";
import { useTranslation } from "react-i18next";

const TIER_RESUME_LIMITS: Record<PlanTier, { max: number; label: string }> = {
  free: { max: 0, label: "Upgrade to unlock" },
  gold: { max: 1, label: "1 Optimized Resume (H-2A or H-2B)" },
  diamond: { max: 2, label: "2 Optimized Resumes (H-2A + H-2B)" },
  black: { max: 5, label: "5 Sector Resumes + H-2A/H-2B Fallbacks" },
};

// Normalized sector categories that map to public_jobs categories via get_normalized_category (20 sub-sectors)
const SECTOR_CATEGORIES = [
  { id: "agricultura_colheita", label: "Agricultura e Colheita", labelEn: "Agriculture & Harvesting", icon: Tractor },
  { id: "equipamentos_agricolas", label: "Equipamentos Agrícolas", labelEn: "Farm Equipment", icon: Wrench },
  { id: "construcao_geral", label: "Construção Geral", labelEn: "General Construction", icon: Hammer },
  { id: "carpintaria_telhados", label: "Carpintaria e Telhados", labelEn: "Carpentry & Roofing", icon: Axe },
  { id: "instalacao_eletrica", label: "Instalação e Elétrica", labelEn: "Installation & Electrical", icon: Zap },
  { id: "mecanica_reparo", label: "Mecânica e Reparo", labelEn: "Mechanics & Repair", icon: Wrench },
  { id: "limpeza_zeladoria", label: "Limpeza e Zeladoria", labelEn: "Cleaning & Janitorial", icon: Paintbrush },
  { id: "cozinha_preparacao", label: "Cozinha e Preparação", labelEn: "Kitchen & Food Prep", icon: ChefHat },
  { id: "servico_mesa", label: "Serviço de Mesa", labelEn: "Dining & Table Service", icon: UtensilsCrossed },
  { id: "hotelaria_recepcao", label: "Hotelaria e Recepção", labelEn: "Hospitality & Front Desk", icon: DoorOpen },
  { id: "bar_bebidas", label: "Bar e Bebidas", labelEn: "Bar & Beverages", icon: Wine },
  { id: "logistica_estoque", label: "Logística e Estoque", labelEn: "Logistics & Warehousing", icon: Package },
  { id: "transporte_motorista", label: "Transporte e Motorista", labelEn: "Transport & Driving", icon: Car },
  { id: "manufatura_montagem", label: "Manufatura e Montagem", labelEn: "Manufacturing & Assembly", icon: Warehouse },
  { id: "soldagem_corte", label: "Soldagem e Corte", labelEn: "Welding & Cutting", icon: HardHat },
  { id: "marcenaria_madeira", label: "Marcenaria e Madeira", labelEn: "Woodworking", icon: Axe },
  { id: "carnes_frigorifico", label: "Carnes e Frigorífico", labelEn: "Meat Processing", icon: Beef },
  { id: "textil_lavanderia", label: "Têxtil e Lavanderia", labelEn: "Textile & Laundry", icon: Shirt },
  { id: "paisagismo_jardinagem", label: "Paisagismo e Jardinagem", labelEn: "Landscaping & Gardening", icon: TreePine },
  { id: "vendas_atendimento", label: "Vendas e Atendimento", labelEn: "Sales & Customer Service", icon: FileText },
];

// --- Duration options ---
const DURATION_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "less_1m", label: "< 1 month" },
  { value: "1_3m", label: "1–3 months" },
  { value: "3_6m", label: "3–6 months" },
  { value: "6_12m", label: "6–12 months" },
  { value: "1_2y", label: "1–2 years" },
  { value: "2_5y", label: "2–5 years" },
  { value: "5_plus", label: "5+ years" },
];

const DURATION_LABELS: Record<string, string> = {
  "less_1m": "< 1 mo",
  "1_3m": "1–3 mo",
  "3_6m": "3–6 mo",
  "6_12m": "6–12 mo",
  "1_2y": "1–2 yr",
  "2_5y": "2–5 yr",
  "5_plus": "5+ yr",
};

// --- Lifting weight options ---
const LIFTING_OPTIONS = [
  { value: "30lbs", label: "Up to 30 lbs (14 kg)" },
  { value: "50lbs", label: "Up to 50 lbs (23 kg)" },
  { value: "70lbs", label: "Up to 70 lbs (32 kg)" },
  { value: "80lbs", label: "Up to 80 lbs (36 kg)" },
  { value: "100lbs", label: "Up to 100 lbs (45 kg)" },
  { value: "100plus", label: "100+ lbs (45+ kg)" },
];

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
  { id: "office_admin", label: "Office / Administrative", icon: FileText, tags: [] },
];

// --- Physical skills with optional sub-options ---
const PHYSICAL_SKILLS = [
  { id: "heavy_lifting", label: "Heavy Lifting", hasDetail: "weight" as const },
  { id: "outdoor_heat", label: "Outdoor Work in Extreme Heat" },
  { id: "outdoor_cold", label: "Outdoor Work in Cold Weather" },
  { id: "standing_long", label: "Standing/Walking 8-12 hours" },
  { id: "repetitive_motion", label: "Repetitive Physical Tasks" },
  { id: "heights", label: "Comfortable Working at Heights" },
  { id: "machinery", label: "Heavy Machinery / Equipment Operation", hasDetail: "text" as const, placeholder: "E.g.: Tractor, excavator, combine harvester" },
  { id: "power_tools", label: "Power Tools (drills, saws, etc.)", hasDetail: "text" as const, placeholder: "E.g.: Circular saw, nail gun, angle grinder" },
  { id: "drivers_license", label: "Valid Driver's License", hasDetail: "text" as const, placeholder: "E.g.: Class B, CDL, motorcycle" },
  { id: "forklift", label: "Forklift / Pallet Jack Certified" },
];

type Step = "loading" | "form" | "uploading" | "generating" | "generating_sectors" | "done" | "error";

export default function ResumeConverter() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("loading");

  // Practical experience with duration
  const [selectedExperience, setSelectedExperience] = useState<Record<string, boolean>>({});
  const [experienceDuration, setExperienceDuration] = useState<Record<string, string>>({});

  // Physical skills with details
  const [selectedPhysical, setSelectedPhysical] = useState<Record<string, boolean>>({});
  const [physicalDetails, setPhysicalDetails] = useState<Record<string, string>>({});

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

  // Language levels
  const [englishLevel, setEnglishLevel] = useState("basic");
  const [spanishLevel, setSpanishLevel] = useState("none");

  // Gold tier: visa choice (h2a or h2b)
  const [goldVisaChoice, setGoldVisaChoice] = useState<"h2a" | "h2b">("h2b");

  // Black tier: sector categories (up to 5)
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

  // Results
  const [h2aResume, setH2aResume] = useState<any>(null);
  const [h2bResume, setH2bResume] = useState<any>(null);
  const [sectorResumes, setSectorResumes] = useState<Array<{ category: string; resume_data: any }>>([]);
  const [activeTab, setActiveTab] = useState("h2a");
  const [hasSavedResumes, setHasSavedResumes] = useState(false);

  // Collapsible sections
  const [showPhysical, setShowPhysical] = useState(true);
  const [showVisa, setShowVisa] = useState(true);

  const planTier = (profile?.plan_tier || "free") as PlanTier;
  const tierLabel = t(`resume.tier_labels.${planTier}`);

  // Load saved data on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setStep("form"); return; }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("resume_data_h2a, resume_data_h2b, resume_extra_context")
          .eq("id", user.id)
          .single();

        if (!profileData) { setStep("form"); return; }

        // Load saved resumes
        if (profileData.resume_data_h2a || profileData.resume_data_h2b) {
          if (profileData.resume_data_h2a) setH2aResume(profileData.resume_data_h2a);
          if (profileData.resume_data_h2b) setH2bResume(profileData.resume_data_h2b);
          setHasSavedResumes(true);
        }

        // Load sector resumes for Black tier
        if (planTier === "black") {
          const { data: sectors } = await supabase
            .from("sector_resumes")
            .select("category, resume_data")
            .eq("user_id", user.id);
          if (sectors && sectors.length > 0) {
            setSectorResumes(sectors as any);
          }
        }

        // Load saved preferences
        const ctx = profileData.resume_extra_context as any;
        if (ctx) {
          // Restore experience selections & durations
          if (ctx.practical_experience?.length) {
            const expMap: Record<string, boolean> = {};
            const durMap: Record<string, string> = {};
            for (const item of ctx.practical_experience) {
              const match = PRACTICAL_EXPERIENCE.find(e => e.label === item.area);
              if (match) {
                expMap[match.id] = true;
                const durEntry = Object.entries(DURATION_LABELS).find(([, v]) => v === item.duration);
                if (durEntry) durMap[match.id] = durEntry[0];
              }
            }
            setSelectedExperience(expMap);
            setExperienceDuration(durMap);
          }

          // Restore physical skills
          if (ctx.physical_skills?.length) {
            const physMap: Record<string, boolean> = {};
            const detailMap: Record<string, string> = {};
            for (const item of ctx.physical_skills) {
              const match = PHYSICAL_SKILLS.find(s => s.label === item.skill);
              if (match) {
                physMap[match.id] = true;
                if (item.detail) detailMap[match.id] = item.detail;
              }
            }
            setSelectedPhysical(physMap);
            setPhysicalDetails(detailMap);
          }

          // Restore language levels
          if (ctx.languages) {
            if (ctx.languages.english) setEnglishLevel(ctx.languages.english);
            if (ctx.languages.spanish) setSpanishLevel(ctx.languages.spanish);
          }

          // Restore migration status
          if (ctx.migration_status) {
            const ms = ctx.migration_status;
            if (ms.location?.includes("Outside")) setCurrentLocation("outside_us");
            else if (ms.location?.includes("Currently")) setCurrentLocation("inside_us");

            if (ms.work_auth?.includes("H-2")) setWorkAuth("needs_sponsorship");
            else if (ms.work_auth?.includes("Citizen")) setWorkAuth("citizen_resident");
            else if (ms.work_auth?.includes("Other")) setWorkAuth("other_status");

            if (ms.h2_history && ms.h2_history !== "None - first time applicant") {
              setHasH2History("yes");
              setH2Details(ms.h2_history);
            }

            if (ms.visa_denials?.includes("Has had")) setVisaDenials("yes");
            if (ms.passport?.includes("Expired")) setPassportStatus("expired");
            else if (ms.passport?.includes("No passport")) setPassportStatus("none");
          }

          // Restore availability
          if (ctx.availability) {
            const av = ctx.availability;
            if (av.when?.includes("Immediately")) setAvailableWhen("immediately");
            else if (av.when?.includes("30")) setAvailableWhen("30_days");
            else if (av.when?.includes("60")) setAvailableWhen("60_days");
            else setAvailableWhen("flexible");

            if (av.duration?.includes("Full")) setDurationPref("full_season");
            else if (av.duration?.includes("6")) setDurationPref("6_months");
            else if (av.duration?.includes("1 year")) setDurationPref("1_year");
            else setDurationPref("flexible");
          }

          // Restore extra notes
          if (ctx.extra_notes) setExtraNotes(ctx.extra_notes);

          // Restore sector selections
          if (ctx.selected_sectors?.length) {
            setSelectedSectors(ctx.selected_sectors);
          }

          // Restore gold visa choice
          if (ctx.gold_visa_choice) {
            setGoldVisaChoice(ctx.gold_visa_choice);
          }
        }

        // Show saved resumes or form
        if (profileData.resume_data_h2a || profileData.resume_data_h2b) {
          setStep("done");
        } else {
          setStep("form");
        }
      } catch (err) {
        console.error("Error loading saved data:", err);
        setStep("form");
      }
    };
    loadSavedData();
  }, [planTier]);

  const toggleExperience = (id: string) => setSelectedExperience(p => ({ ...p, [id]: !p[id] }));
  const togglePhysical = (id: string) => setSelectedPhysical(p => ({ ...p, [id]: !p[id] }));

  const toggleSector = (id: string) => {
    setSelectedSectors(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 5) {
        toast.error(t("resume.max_sectors"));
        return prev;
      }
      return [...prev, id];
    });
  };

  const selectedExpList = PRACTICAL_EXPERIENCE.filter(e => selectedExperience[e.id]).map(e => ({
    area: e.label,
    duration: DURATION_LABELS[experienceDuration[e.id]] || "not specified",
  }));
  const selectedPhysList = PHYSICAL_SKILLS.filter(s => selectedPhysical[s.id]).map(s => ({
    skill: s.label,
    detail: physicalDetails[s.id] || undefined,
  }));

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
        languages: { english: englishLevel, spanish: spanishLevel },
        migration_status: {
          location: currentLocation === "outside_us" ? "Outside the U.S." : "Currently in the U.S.",
          work_auth: workAuth === "needs_sponsorship" ? "Requires H-2 Visa Sponsorship"
            : workAuth === "citizen_resident" ? "U.S. Citizen / Permanent Resident" : "Other Legal Work Status",
          h2_history: hasH2History === "yes" ? h2Details : "None - first time applicant",
          visa_denials: visaDenials === "yes" ? "Has had a previous visa denial" : "No visa denials",
          passport: passportStatus === "valid" ? "Valid passport" : passportStatus === "expired" ? "Expired - renewing" : "No passport yet",
        },
        availability: {
          when: availableWhen === "immediately" ? "Immediately available"
            : availableWhen === "30_days" ? "Available within 30 days"
            : availableWhen === "60_days" ? "Available within 60 days" : "Specific date (flexible)",
          duration: durationPref === "full_season" ? "Full season"
            : durationPref === "6_months" ? "Up to 6 months"
            : durationPref === "1_year" ? "Up to 1 year" : "Flexible",
        },
        extra_notes: extraNotes || undefined,
        gold_visa_choice: planTier === "gold" ? goldVisaChoice : undefined,
        selected_sectors: planTier === "black" ? selectedSectors : undefined,
        plan_tier: planTier,
      };

      const { data, error } = await supabase.functions.invoke("convert-resume", {
        body: { raw_text: rawText, context },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set results based on tier
      if (planTier === "gold") {
        if (goldVisaChoice === "h2a") {
          setH2aResume(data.h2a);
          setH2bResume(null);
          setActiveTab("h2a");
        } else {
          setH2bResume(data.h2b);
          setH2aResume(null);
          setActiveTab("h2b");
        }
      } else if (planTier === "diamond") {
        setH2aResume(data.h2a);
        setH2bResume(data.h2b);
      } else if (planTier === "black") {
        // Black: sector resumes + H-2A/H-2B fallbacks
        if (data.sector_resumes?.length) {
          setSectorResumes(data.sector_resumes);
        }
        if (data.h2a) setH2aResume(data.h2a);
        if (data.h2b) setH2bResume(data.h2b);
      }

      setHasSavedResumes(true);
      setStep("done");

      const resumeCount = planTier === "black"
        ? (data.sector_resumes?.length || 0) + (data.h2a ? 1 : 0) + (data.h2b ? 1 : 0)
        : planTier === "gold" ? 1 : 2;
      toast.success(t("resume.toast_success", { count: resumeCount }));
    } catch (err: any) {
      console.error("Resume conversion error:", err);
      setStep("error");
      toast.error(err.message || t("resume.toast_error"));
    }
  }, [selectedExpList, selectedPhysList, englishLevel, spanishLevel, currentLocation, workAuth, hasH2History, h2Details, visaDenials, passportStatus, availableWhen, durationPref, extraNotes, planTier, goldVisaChoice, selectedSectors, t]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (files) => files.length > 0 && processFile(files[0]),
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    disabled: step !== "form",
    maxFiles: 1,
  });

  const buildWorkAuthorizationFallback = () => {
    const when = availableWhen === "immediately" ? "Immediately available"
      : availableWhen === "30_days" ? "Available within 30 days"
      : availableWhen === "60_days" ? "Available within 60 days" : "Specific date (flexible)";

    const duration = durationPref === "full_season" ? "Full season"
      : durationPref === "6_months" ? "Up to 6 months"
      : durationPref === "1_year" ? "Up to 1 year" : "Flexible";

    return {
      visa_type: workAuth === "needs_sponsorship"
        ? "Requires H-2 Visa Sponsorship"
        : workAuth === "citizen_resident"
          ? "U.S. Citizen / Permanent Resident"
          : "Other Legal Work Status",
      current_location: currentLocation === "outside_us" ? "Outside the U.S." : "Currently in the U.S.",
      passport_status: passportStatus === "valid" ? "Valid passport" : passportStatus === "expired" ? "Expired - renewing" : "No passport yet",
      previous_h2_experience: hasH2History === "yes" ? (h2Details || "Has previous H-2 experience") : "None - first time applicant",
      availability: `${when} — ${duration}`,
      visa_denial_history: visaDenials === "yes" ? "Has had a previous visa denial" : "No visa denials",
    };
  };

  const withWorkAuthorizationFallback = (resume: any): ResumeData => {
    const fallback = buildWorkAuthorizationFallback();
    const current = resume?.work_authorization ?? {};

    return {
      ...resume,
      work_authorization: {
        visa_type: current.visa_type || fallback.visa_type,
        current_location: current.current_location || fallback.current_location,
        passport_status: current.passport_status || fallback.passport_status,
        previous_h2_experience: current.previous_h2_experience || fallback.previous_h2_experience,
        availability: current.availability || fallback.availability,
        visa_denial_history: current.visa_denial_history || fallback.visa_denial_history,
      },
    } as ResumeData;
  };

  const handleDownload = (resume: any, type: string) => {
    const normalizedResume = withWorkAuthorizationFallback(resume);
    const doc = generateResumePDF(normalizedResume);
    const name = (normalizedResume.personal_info?.full_name || "Resume").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
    doc.save(`${name}_${type}_Resume.pdf`);
  };

  const handleReset = () => setStep("form");

  // LOADING STATE
  if (step === "loading") {
    return (
      <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("resume.loading")}</p>
      </div>
    );
  }

  // FREE TIER GATE
  if (!authLoading && planTier === "free") {
    return (
      <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">{t("resume.gate.title")}</h2>
          <p className="text-sm text-muted-foreground max-w-md" dangerouslySetInnerHTML={{ __html: t("resume.gate.description") }} />
        </div>
        <div className="grid gap-2 text-left text-xs max-w-xs w-full">
          {(["gold", "diamond", "black"] as PlanTier[]).map((tier) => (
            <div key={tier} className="flex items-center gap-2 p-2 rounded-lg border border-border">
              <Crown className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="font-medium capitalize">{tier}:</span>
              <span className="text-muted-foreground">{t(`resume.tier_labels.${tier}`)}</span>
            </div>
          ))}
        </div>
        <Button onClick={() => navigate("/plans")} className="gap-2">
          <Crown className="h-4 w-4" /> {t("resume.gate.view_plans")}
        </Button>
      </div>
    );
  }

  // DONE STATE
  if (step === "done" && (h2aResume || h2bResume || sectorResumes.length > 0)) {
    const availableResumes = [
      ...(h2aResume ? [{ key: "h2a", resume: h2aResume, label: "H-2A" }] : []),
      ...(h2bResume ? [{ key: "h2b", resume: h2bResume, label: "H-2B" }] : []),
      ...sectorResumes.map((sr) => {
        const sectorDef = SECTOR_CATEGORIES.find(s => s.id === sr.category);
        return { key: `sector_${sr.category}`, resume: sr.resume_data, label: sectorDef?.labelEn || sr.category };
      }),
    ];
    const firstTab = availableResumes[0]?.key || "h2a";

    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">
                {hasSavedResumes ? t("resume.done_title_saved") : t("resume.done_title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {planTier === "black"
                  ? t("resume.done_desc_black", { count: availableResumes.length })
                  : planTier === "gold"
                    ? t("resume.done_desc_gold", { visa: goldVisaChoice.toUpperCase() })
                    : t("resume.done_desc_diamond")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
              <RefreshCw className="h-3.5 w-3.5" /> {t("resume.done_regenerate")}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-accent/50 border border-accent rounded-lg px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
          <span>{t("resume.done_smart_profile_hint")}</span>
        </div>

        <Tabs defaultValue={firstTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={cn("grid w-full",
            availableResumes.length <= 2 ? "grid-cols-2" :
            availableResumes.length <= 3 ? "grid-cols-3" :
            availableResumes.length <= 4 ? "grid-cols-4" : "grid-cols-5"
          )} style={{ height: "auto" }}>
            {availableResumes.map(({ key, label }) => (
              <TabsTrigger key={key} value={key} className="gap-1 text-xs font-bold py-2 px-1">{label}</TabsTrigger>
            ))}
          </TabsList>

          {availableResumes.map(({ key, resume, label }) => (
            <TabsContent key={key} value={key}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{resume.personal_info?.full_name} — {label} Resume</CardTitle>
                  <Button size="sm" className="gap-2" onClick={() => handleDownload(resume, label.replace(/\s+/g, "_"))}>
                    <Download className="h-4 w-4" /> {t("resume.done_download")}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {resume.summary && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-1">{t("resume.preview_summary")}</p>
                      <p className="text-sm text-foreground leading-relaxed">{resume.summary}</p>
                    </div>
                  )}
                  {resume.skills?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{t("resume.preview_skills")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {resume.skills.map((s: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {resume.experience?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{t("resume.preview_experience")}</p>
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
                  {(() => {
                    const wa = withWorkAuthorizationFallback(resume).work_authorization;
                    const waItems = [
                      { label: t("resume.preview_wa_visa"), value: wa?.visa_type },
                      { label: t("resume.preview_wa_location"), value: wa?.current_location },
                      { label: t("resume.preview_wa_passport"), value: wa?.passport_status },
                      { label: t("resume.preview_wa_h2exp"), value: wa?.previous_h2_experience },
                      { label: t("resume.preview_wa_availability"), value: wa?.availability },
                      { label: t("resume.preview_wa_denials"), value: wa?.visa_denial_history },
                    ].filter((item) => Boolean(item.value));

                    if (waItems.length === 0) return null;

                    return (
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{t("resume.preview_work_auth")}</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {waItems.map((item) => (
                            <div key={item.label} className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                              <p className="text-xs text-foreground">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {resume.languages?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-1">{t("resume.preview_languages")}</p>
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
  if (step === "uploading" || step === "generating" || step === "generating_sectors") {
    return (
      <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {step === "uploading" ? t("resume.generating_reading")
              : step === "generating_sectors" ? t("resume.generating_sectors")
              : t("resume.generating_ai")}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {step === "generating" && planTier === "black"
              ? t("resume.generating_black_hint", { count: selectedSectors.length })
              : step === "generating" && t("resume.generating_hint")}
          </p>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (step === "error") {
    return (
      <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">{t("resume.error_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("resume.error_desc")}</p>
        <Button onClick={() => setStep("form")}>{t("resume.error_retry")}</Button>
      </div>
    );
  }

  const selectedExpCount = Object.values(selectedExperience).filter(Boolean).length;
  const canUpload = selectedExpCount > 0 && (planTier !== "black" || selectedSectors.length > 0);

  const langOptions = [
    { value: "none", label: t("resume.lang_none") },
    { value: "basic", label: t("resume.lang_basic") },
    { value: "intermediate", label: t("resume.lang_intermediate") },
    { value: "advanced", label: t("resume.lang_advanced") },
    { value: "fluent", label: t("resume.lang_fluent") },
  ];

  // FORM VIEW
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t("resume.page_title")}</h1>
        <p className="text-sm text-muted-foreground">
          {planTier === "black" ? t("resume.desc_black")
            : planTier === "gold" ? t("resume.desc_gold")
            : t("resume.desc_diamond")}
        </p>
        <Badge variant="secondary" className="text-xs">
          <Crown className="h-3 w-3 mr-1" /> {tierLabel}
        </Badge>
      </div>

      {/* Saved resumes banner */}
      {hasSavedResumes && (h2aResume || h2bResume || sectorResumes.length > 0) && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t("resume.saved_banner_title")}</p>
                <p className="text-xs text-muted-foreground">{t("resume.saved_banner_desc")}</p>
              </div>
            </div>
            <Button size="sm" variant="default" className="gap-1.5 whitespace-nowrap" onClick={() => setStep("done")}>
              <Eye className="h-3.5 w-3.5" /> {t("resume.saved_banner_view")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Questions */}
        <div className="lg:col-span-2 space-y-5">

          {/* Gold: Visa type choice */}
          {planTier === "gold" && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <Crown className="h-4 w-4" /> {t("resume.gold_visa_title")}
                </CardTitle>
                <CardDescription>{t("resume.gold_visa_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "h2a" as const, label: "H-2A (Agricultural)", icon: Tractor },
                    { value: "h2b" as const, label: "H-2B (Non-Agricultural)", icon: HardHat },
                  ].map(({ value, label, icon: Icon }) => (
                    <div key={value} onClick={() => setGoldVisaChoice(value)}
                      className={cn("p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
                        goldVisaChoice === value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                      )}>
                      <Icon className={cn("h-6 w-6", goldVisaChoice === value ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-bold">{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Black: Sector selection */}
          {planTier === "black" && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <Crown className="h-4 w-4" /> {t("resume.black_sector_title")}
                </CardTitle>
                <CardDescription>{t("resume.black_sector_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SECTOR_CATEGORIES.map((sector) => {
                    const isSelected = selectedSectors.includes(sector.id);
                    const Icon = sector.icon;
                    return (
                      <div key={sector.id} onClick={() => toggleSector(sector.id)}
                        className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30",
                          !isSelected && selectedSectors.length >= 5 && "opacity-40 cursor-not-allowed"
                        )}>
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <Icon className={cn("h-4 w-4 flex-shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium block">{sector.labelEn}</span>
                          <span className="text-[10px] text-muted-foreground">{sector.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant={selectedSectors.length > 0 ? "default" : "secondary"} className="text-xs">
                    {t("resume.black_sector_count", { count: selectedSectors.length })}
                  </Badge>
                  {selectedSectors.length === 0 && (
                    <span className="text-[10px] text-destructive">{t("resume.black_sector_min")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 1. Practical Experience */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {planTier === "black" || planTier === "gold" ? "2" : "1"}. {t("resume.experience_title")}
              </CardTitle>
              <CardDescription>{t("resume.experience_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRACTICAL_EXPERIENCE.map((exp) => {
                  const isSelected = !!selectedExperience[exp.id];
                  return (
                    <div key={exp.id} className="space-y-1.5">
                      <div onClick={() => toggleExperience(exp.id)}
                        className={cn("flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                          isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                        )}>
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <exp.icon className={cn("h-4 w-4 flex-shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-xs font-medium leading-tight flex-1">{exp.label}</span>
                        {exp.tags.length > 0 && (
                          <div className="flex gap-1">
                            {exp.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-[8px] px-1 py-0 h-4">{tag.toUpperCase()}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="ml-8 flex items-center gap-2">
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">{t("resume.how_long")}</Label>
                          <Select value={experienceDuration[exp.id] || ""} onValueChange={(v) => setExperienceDuration(p => ({ ...p, [exp.id]: v }))}>
                            <SelectTrigger className="h-7 text-[11px] w-32"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                            <SelectContent>
                              {DURATION_OPTIONS.filter(d => d.value).map(d => (
                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Language levels */}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold whitespace-nowrap">🇺🇸 {t("resume.english_label")}:</Label>
                  <Select value={englishLevel} onValueChange={setEnglishLevel}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {langOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold whitespace-nowrap">🇪🇸 {t("resume.spanish_label")}:</Label>
                  <Select value={spanishLevel} onValueChange={setSpanishLevel}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {langOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Physical Skills */}
          <Card>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowPhysical(!showPhysical)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <HardHat className="h-4 w-4 text-primary" />
                  {planTier === "black" || planTier === "gold" ? "3" : "2"}. {t("resume.physical_title")}
                  {Object.values(selectedPhysical).filter(Boolean).length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{t("resume.physical_selected", { count: Object.values(selectedPhysical).filter(Boolean).length })}</Badge>
                  )}
                </CardTitle>
                {showPhysical ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {showPhysical && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PHYSICAL_SKILLS.map((skill) => {
                    const isSelected = !!selectedPhysical[skill.id];
                    return (
                      <div key={skill.id} className="space-y-1.5">
                        <div onClick={() => togglePhysical(skill.id)}
                          className={cn("flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                          )}>
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <span className="text-xs font-medium">{skill.label}</span>
                        </div>
                        {isSelected && skill.hasDetail === "weight" && (
                          <div className="ml-8 flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">{t("resume.max_weight")}</Label>
                            <Select value={physicalDetails[skill.id] || ""} onValueChange={(v) => setPhysicalDetails(p => ({ ...p, [skill.id]: v }))}>
                              <SelectTrigger className="h-7 text-[11px] w-44"><SelectValue placeholder={t("resume.select_capacity")} /></SelectTrigger>
                              <SelectContent>
                                {LIFTING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {isSelected && skill.hasDetail === "text" && (
                          <div className="ml-8">
                            <Input className="h-7 text-[11px]" placeholder={skill.placeholder || "Specify details..."}
                              value={physicalDetails[skill.id] || ""}
                              onChange={(e) => setPhysicalDetails(p => ({ ...p, [skill.id]: e.target.value }))} />
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  {planTier === "black" || planTier === "gold" ? "4" : "3"}. {t("resume.visa_title")}
                </CardTitle>
                {showVisa ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              <CardDescription>{t("resume.visa_desc")}</CardDescription>
            </CardHeader>
            {showVisa && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t("resume.visa_location")}</Label>
                    <Select value={currentLocation} onValueChange={setCurrentLocation}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outside_us">{t("resume.visa_location_outside")}</SelectItem>
                        <SelectItem value="inside_us">{t("resume.visa_location_inside")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t("resume.visa_work_auth")}</Label>
                    <Select value={workAuth} onValueChange={setWorkAuth}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needs_sponsorship">{t("resume.visa_needs_sponsorship")}</SelectItem>
                        <SelectItem value="citizen_resident">{t("resume.visa_citizen")}</SelectItem>
                        <SelectItem value="other_status">{t("resume.visa_other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t("resume.visa_h2_history")}</Label>
                    <Select value={hasH2History} onValueChange={setHasH2History}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">{t("resume.visa_h2_no")}</SelectItem>
                        <SelectItem value="yes">{t("resume.visa_h2_yes")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {hasH2History === "yes" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">{t("resume.visa_h2_details")}</Label>
                      <Input className="h-9 text-xs" placeholder={t("resume.visa_h2_placeholder")}
                        value={h2Details} onChange={(e) => setH2Details(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t("resume.visa_passport")}</Label>
                    <Select value={passportStatus} onValueChange={setPassportStatus}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valid">{t("resume.visa_passport_valid")}</SelectItem>
                        <SelectItem value="expired">{t("resume.visa_passport_expired")}</SelectItem>
                        <SelectItem value="none">{t("resume.visa_passport_none")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      {t("resume.visa_denials")} <Info className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Select value={visaDenials} onValueChange={setVisaDenials}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">{t("resume.visa_denials_no")}</SelectItem>
                        <SelectItem value="yes">{t("resume.visa_denials_yes")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Availability */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {t("resume.availability_when")}
                    </Label>
                    <Select value={availableWhen} onValueChange={setAvailableWhen}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediately">{t("resume.availability_immediately")}</SelectItem>
                        <SelectItem value="30_days">{t("resume.availability_30")}</SelectItem>
                        <SelectItem value="60_days">{t("resume.availability_60")}</SelectItem>
                        <SelectItem value="flexible">{t("resume.availability_flexible")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">{t("resume.availability_duration")}</Label>
                    <Select value={durationPref} onValueChange={setDurationPref}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_season">{t("resume.availability_full_season")}</SelectItem>
                        <SelectItem value="6_months">{t("resume.availability_6_months")}</SelectItem>
                        <SelectItem value="1_year">{t("resume.availability_1_year")}</SelectItem>
                        <SelectItem value="flexible">{t("resume.availability_flexible")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Extra notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">{t("resume.extra_notes")}</Label>
            <Textarea className="text-xs min-h-[60px]" placeholder={t("resume.extra_notes_placeholder")}
              value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} maxLength={500} />
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
                  {planTier === "gold" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("resume.visa_type_label")}</span>
                      <Badge variant="default" className="text-[10px]">{goldVisaChoice.toUpperCase()}</Badge>
                    </div>
                  )}
                  {planTier === "black" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("resume.sectors_label")}</span>
                      <Badge variant={selectedSectors.length > 0 ? "default" : "secondary"} className="text-[10px]">{selectedSectors.length}/5</Badge>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("resume.experience_areas")}</span>
                    <Badge variant="secondary">{selectedExpCount}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("resume.physical_skills_label")}</span>
                    <Badge variant="secondary">{Object.values(selectedPhysical).filter(Boolean).length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("resume.english_label")}:</span>
                    <span className="font-medium capitalize">{englishLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("resume.spanish_label")}:</span>
                    <span className="font-medium capitalize">{spanishLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("resume.h2_history_label")}</span>
                    <span className="font-medium">{hasH2History === "yes" ? t("common.yes") : t("resume.h2_first_time")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upload area */}
            <Card
              className={cn(
                "border-2 border-dashed transition-all cursor-pointer hover:border-primary/50",
                !canUpload ? "opacity-50 pointer-events-none" : ""
              )}
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {hasSavedResumes ? t("resume.upload_title_regen") : t("resume.upload_title")}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">{t("resume.upload_hint")}</p>
                </div>
                <div className="bg-primary/5 rounded-lg p-3 w-full">
                  <p className="text-[10px] font-medium text-primary">
                    {planTier === "black"
                      ? t("resume.upload_ai_black", { count: selectedSectors.length })
                      : planTier === "gold"
                        ? t("resume.upload_ai_gold", { visa: goldVisaChoice.toUpperCase() })
                        : t("resume.upload_ai_diamond")}
                  </p>
                </div>
                {!canUpload && (
                  <p className="text-[10px] text-destructive font-medium">
                    {planTier === "black" && selectedSectors.length === 0
                      ? t("resume.upload_need_sector")
                      : t("resume.upload_need_exp")}
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
