import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Save,
  Target,
  Trash2,
  Send,
  MapPin,
  CircleDollarSign,
  Briefcase,
  Building2,
  RefreshCcw,
  Eye,
  Radio,
  CheckCircle2,
  Zap,
  Layers,
  ArrowRight,
  Satellite,
  Settings2,
  Pause,
  Play,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  Rocket,
  Mail,
  Clock,
  Crown,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTOR_KEYS = [
  "agriculture",
  "farm_equipment",
  "construction",
  "carpentry",
  "installation",
  "mechanics",
  "cleaning",
  "kitchen",
  "dining",
  "hospitality",
  "bar",
  "logistics",
  "transport",
  "manufacturing",
  "welding",
  "wood",
  "textile",
  "meat",
  "landscaping",
  "sales",
] as const;

const SECTOR_KEYWORDS: Record<string, string[]> = {
  agriculture: ["Farmworkers", "Crop", "Nursery", "Harvest", "Agricultural", "Forest", "Farm"],
  farm_equipment: ["Agricultural Equipment", "Tractor"],
  construction: ["Construction", "Laborers", "Cement", "Masons", "Concrete", "Fence", "Brickmasons", "Iron", "Paving"],
  carpentry: ["Carpenters", "Cabinetmakers", "Bench Carpenters", "Roofers"],
  installation: ["Electricians", "Plumbers", "Installation", "Pipelayers", "Septic", "Repair Workers"],
  mechanics: ["Mechanics", "Service Technicians", "Automotive", "Diesel"],
  cleaning: ["Maids", "Housekeeping", "Janitors", "Cleaners"],
  kitchen: ["Cooks", "Bakers", "Food Preparation", "Kitchen"],
  dining: ["Waiters", "Waitresses", "Dining Room", "Hostess", "Dishwashers"],
  hospitality: ["Hotel", "Resort", "Desk Clerks", "Concierges", "Baggage"],
  bar: ["Baristas", "Bartenders"],
  logistics: ["Laborers and Freight", "Stockers", "Packers", "Material Movers", "Order Fillers"],
  transport: ["Truck Drivers", "Shuttle", "Chauffeurs", "Delivery"],
  manufacturing: ["Assemblers", "Fabricators", "Production Workers", "Machine Feeders"],
  welding: ["Welders", "Cutters", "Solderers", "Brazers"],
  wood: ["Woodworking", "Sawing Machine"],
  textile: ["Textile", "Laundry", "Sewing"],
  meat: ["Meat, Poultry", "Butchers", "Slaughterers"],
  landscaping: ["Landscaping", "Groundskeeping", "Tree Trimmers"],
  sales: ["Salespersons", "Counter", "Cashiers", "Retail"],
};

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

export default function Radar() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchSending, setBatchSending] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [groupedCategories, setGroupedCategories] = useState<Record<string, { items: any[]; totalJobs: number }>>({});
  const [radarProfile, setRadarProfile] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [showAutopilotConfirm, setShowAutopilotConfirm] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";
  const isFirstTime = !radarProfile && !loading;

  const sectorEntries = useMemo(() => Object.entries(groupedCategories).sort(), [groupedCategories]);
  const totalSinaisGeral = useMemo(
    () => Object.values(groupedCategories).reduce((acc, curr) => acc + curr.totalJobs, 0),
    [groupedCategories],
  );
  const monitoredCount = useMemo(
    () =>
      sectorEntries.filter(([, data]) => data.items.some((i) => selectedCategories.includes(i.raw_category))).length,
    [sectorEntries, selectedCategories],
  );

  const hasChangesComputed = useMemo(() => {
    if (!radarProfile) return selectedCategories.length > 0;
    return (
      isActive !== (radarProfile.is_active ?? false) ||
      autoSend !== (radarProfile.auto_send ?? false) ||
      JSON.stringify([...selectedCategories].sort()) !== JSON.stringify([...(radarProfile.categories || [])].sort()) ||
      minWage !== (radarProfile.min_wage?.toString() || "") ||
      maxExperience !== (radarProfile.max_experience?.toString() || "") ||
      visaType !== (radarProfile.visa_type || "all") ||
      stateFilter !== (radarProfile.state || "all") ||
      groupFilter !== (radarProfile.randomization_group || "all")
    );
  }, [
    isActive,
    autoSend,
    selectedCategories,
    minWage,
    maxExperience,
    visaType,
    stateFilter,
    groupFilter,
    radarProfile,
  ]);

  const getSectorName = (key: string) => t(`radar.sectors.${key}`, key);

  const wageDisplay = minWage ? `$${minWage}/hr` : t("radar.criteria_any");
  const expDisplay = maxExperience ? `${maxExperience}+ ${t("radar.criteria_years")}` : t("radar.criteria_any");
  const stateDisplay = stateFilter === "all" ? t("radar.state_all") : stateFilter;
  const visaDisplay = visaType === "all" ? t("radar.criteria_all_visas") : visaType.toUpperCase();

  const updateStats = async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase.rpc("get_radar_stats" as any, {
        p_user_id: profile.id,
        p_visa_type: visaType,
        p_state: stateFilter,
        p_min_wage: minWage !== "" ? Number(minWage) : 0,
        p_max_exp: maxExperience !== "" ? Number(maxExperience) : 999,
        p_group: groupFilter,
      });
      if (data) {
        const grouped = (data as any[]).reduce((acc: any, curr: any) => {
          const raw = curr.raw_category || "";
          let segment = "other";
          for (const [sectorKey, keywords] of Object.entries(SECTOR_KEYWORDS)) {
            if (keywords.some((kw) => raw.toLowerCase().includes(kw.toLowerCase()))) {
              segment = sectorKey;
              break;
            }
          }
          const sectorName = getSectorName(segment);
          if (!acc[sectorName]) acc[sectorName] = { items: [], totalJobs: 0 };
          acc[sectorName].items.push(curr);
          acc[sectorName].totalJobs += curr.count || 0;
          return acc;
        }, {});
        SECTOR_KEYS.forEach((s) => {
          const name = getSectorName(s);
          if (!grouped[name]) grouped[name] = { items: [], totalJobs: 0 };
        });
        setGroupedCategories(grouped);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMatches = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("radar_matched_jobs" as any)
      .select(`id, job_id, public_jobs!fk_radar_job (*)`)
      .eq("user_id", profile.id);
    if (data) {
      setMatchedJobs(data);
      setMatchCount(data.length);
    }
  };

  const performSave = async (overrides = {}) => {
    if (!profile?.id) return;
    setSaving(true);
    setMatchedJobs([]);
    const payload = {
      user_id: profile.id,
      is_active: isActive,
      auto_send: autoSend,
      categories: selectedCategories,
      min_wage: minWage !== "" ? Number(minWage) : null,
      max_experience: maxExperience !== "" ? Number(maxExperience) : null,
      visa_type: visaType === "all" ? null : visaType,
      state: stateFilter === "all" ? null : stateFilter,
      randomization_group: groupFilter,
      ...overrides,
    };
    const { error } = radarProfile
      ? await supabase
          .from("radar_profiles" as any)
          .update(payload)
          .eq("user_id", profile.id)
      : await supabase.from("radar_profiles" as any).insert(payload);
    if (!error) {
      setRadarProfile({ ...radarProfile, ...payload });
      if (payload.is_active) {
        await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });
        await fetchMatches();
        await updateStats();
      }
      toast({ title: t("radar.toast_recalibrated") });
    }
    setSaving(false);
  };

  const handleSendAll = async () => {
    if (matchedJobs.length === 0 || !profile?.id) return;
    if (!confirm(t("radar.confirm_send_all", { count: matchCount }))) return;
    setBatchSending(true);
    const currentJobs = [...matchedJobs];
    setMatchedJobs([]);
    setMatchCount(0);
    try {
      const apps = currentJobs.map((m) => ({ user_id: profile.id, job_id: m.job_id, status: "pending" }));
      await supabase.from("my_queue" as any).insert(apps);
      await supabase
        .from("radar_matched_jobs" as any)
        .delete()
        .eq("user_id", profile.id);
      await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });
      await updateStats();
      toast({ title: t("radar.toast_captured_all") });
    } catch (err) {
      setMatchedJobs(currentJobs);
      setMatchCount(currentJobs.length);
      toast({ title: t("radar.toast_send_error"), variant: "destructive" });
    } finally {
      setBatchSending(false);
    }
  };

  const handleSendApplication = async (matchId: string, jobId: string) => {
    if (!profile?.id) return;
    try {
      await supabase.from("my_queue" as any).insert([{ user_id: profile.id, job_id: jobId, status: "pending" }]);
      await supabase
        .from("radar_matched_jobs" as any)
        .delete()
        .eq("id", matchId);
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => Math.max(0, prev - 1));
      toast({ title: t("radar.toast_sent") });
    } catch (err) {
      toast({ title: t("radar.toast_send_error"), variant: "destructive" });
    }
  };

  const removeMatch = async (matchId: string) => {
    try {
      await supabase
        .from("radar_matched_jobs" as any)
        .delete()
        .eq("id", matchId);
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast({ title: t("radar.toast_error"), variant: "destructive" });
    }
  };

  const toggleSector = (segment: string) => {
    const sectorData = groupedCategories[segment];
    if (!sectorData) return;
    const sectorCategories = sectorData.items.map((i) => i.raw_category);
    const allSelected = sectorCategories.every((c) => selectedCategories.includes(c));
    if (allSelected) {
      setSelectedCategories((prev) => prev.filter((c) => !sectorCategories.includes(c)));
    } else {
      setSelectedCategories((prev) => [...new Set([...prev, ...sectorCategories])]);
    }
  };

  const toggleSubCategory = (raw: string) => {
    setSelectedCategories((prev) => (prev.includes(raw) ? prev.filter((c) => c !== raw) : [...prev, raw]));
  };

  const toggleExpanded = (segment: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      next.has(segment) ? next.delete(segment) : next.add(segment);
      return next;
    });
  };

  const handleAutopilotToggle = async () => {
    if (!autoSend && selectedCategories.length === 0) {
      toast({ title: t("radar.select_categories_first"), variant: "destructive" });
      return;
    }
    setAutoSend(!autoSend);
    if (!autoSend) {
      setShowAutopilotConfirm(true);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("radar_profiles" as any)
          .select("*")
          .eq("user_id", profile.id)
          .single();
        if (data) {
          setRadarProfile(data);
          setIsActive(data.is_active ?? false);
          setAutoSend(data.auto_send ?? false);
          setSelectedCategories(data.categories || []);
          setMinWage(data.min_wage?.toString() || "");
          setMaxExperience(data.max_experience?.toString() || "");
          setVisaType(data.visa_type || "all");
          setStateFilter(data.state || "all");
          setGroupFilter(data.randomization_group || "all");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [profile?.id]);

  useEffect(() => {
    if (!loading) {
      updateStats();
      if (isActive) {
        fetchMatches();
      }
    }
  }, [loading, isActive]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* ═══════════════════════════════════════════════════════════════
          PREMIUM BANNER — Feature Launch Announcement
      ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-plan-diamond/30 bg-gradient-to-r from-plan-diamond/[0.08] via-plan-diamond/[0.04] to-accent/[0.06] p-6 sm:p-8">
        {/* Decorative gradient orbs */}
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-plan-diamond/10 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-plan-diamond to-plan-diamond/70 shadow-lg">
                <Gauge className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{t("radar.title", "Radar")}</h1>
                  <Badge className="bg-plan-diamond/20 text-plan-diamond border-plan-diamond/30 font-semibold gap-1">
                    <Crown className="h-3.5 w-3.5" />
                    {t("radar.premium_feature", "Premium")}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/80 max-w-2xl leading-relaxed">
                  {t(
                    "radar.subtitle",
                    "Automatically discover and apply to jobs that match your profile. Let Radar work for you 24/7.",
                  )}
                </p>
              </div>
            </div>
            {isPremium && (
              <div className="hidden sm:flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-xs font-semibold text-success">{t("radar.premium_active", "Active")}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          QUICK FILTERS — Refined Pill Design
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("radar.filters_label", "Filters")}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer"
          >
            <CircleDollarSign className="h-4 w-4" />
            {wageDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer"
          >
            <MapPin className="h-4 w-4" />
            {stateDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer"
          >
            <Briefcase className="h-4 w-4" />
            {expDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer"
          >
            <Target className="h-4 w-4" />
            {visaDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border hover:border-primary/20"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t("radar.edit_criteria", "Edit")}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — FIRST-TIME ONBOARDING (Enhanced)
      ═══════════════════════════════════════════════════════════════ */}
      {isFirstTime && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-accent/[0.03] overflow-hidden">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">
                {t("radar.welcome_title", "Get Started with Radar")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  "radar.welcome_subtitle",
                  "Set up your preferences and let Radar find the best opportunities for you",
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Target, step: "1", titleKey: "radar.welcome_step1_title", descKey: "radar.welcome_step1_desc" },
                {
                  icon: Settings2,
                  step: "2",
                  titleKey: "radar.welcome_step2_title",
                  descKey: "radar.welcome_step2_desc",
                },
                { icon: Zap, step: "3", titleKey: "radar.welcome_step3_title", descKey: "radar.welcome_step3_desc" },
              ].map(({ icon: Icon, step, titleKey, descKey }) => (
                <div
                  key={step}
                  className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
                    <span className="text-xs font-bold text-primary">{step}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t(descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — AUTOPILOT CARD (Enhanced Premium Feel)
      ═══════════════════════════════════════════════════════════════ */}
      <Card
        className={cn(
          "overflow-hidden border transition-all duration-300",
          autoSend
            ? "border-primary/40 bg-gradient-to-r from-primary/[0.08] to-accent/[0.04] shadow-lg shadow-primary/10"
            : "border-border bg-card hover:border-primary/20",
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div
                className={cn(
                  "p-3 rounded-xl shrink-0 transition-all duration-300",
                  autoSend ? "bg-primary/15 shadow-lg shadow-primary/20" : "bg-muted",
                )}
              >
                <Zap className={cn("h-5 w-5", autoSend ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h3 className="text-sm font-bold text-foreground">{t("radar.autosend_title", "Autopilot Mode")}</h3>
                  {autoSend && (
                    <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-bold uppercase tracking-wider">
                      {t("radar.status_active", "Active")}
                    </Badge>
                  )}
                </div>
                <p className={cn("text-xs leading-relaxed", autoSend ? "text-foreground/75" : "text-muted-foreground")}>
                  {autoSend
                    ? t("radar.autosend_active_desc", "Automatically sending applications to matching jobs")
                    : t("radar.autosend_explanation", "Automatically apply to jobs matching your criteria")}
                </p>
              </div>
            </div>
            <Switch
              checked={autoSend}
              onCheckedChange={handleAutopilotToggle}
              className="data-[state=checked]:bg-primary shrink-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3 — MAIN LAYOUT: Categories → Matches
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ minHeight: "calc(100vh - 500px)" }}>
        {/* LEFT — Categories (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">{t("radar.categories_title", "Job Categories")}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t("radar.categories_subtitle", "Select sectors to monitor")}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs font-semibold shrink-0 px-3 py-1.5">
              {totalSinaisGeral} {t("radar.active_jobs", "jobs")}
            </Badge>
          </div>

          <ScrollArea className="h-[calc(100vh-600px)] rounded-lg border border-border">
            <div className="space-y-2 p-4">
              {sectorEntries.map(([segment, data]) => {
                const selectedInSector = data.items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                const allSelected = data.items.length > 0 && selectedInSector === data.items.length;
                const isTracked = selectedInSector > 0;
                const isExpanded = expandedSectors.has(segment);
                const hasSubcategories = data.items.length > 1;

                return (
                  <div
                    key={segment}
                    className={cn(
                      "rounded-lg border transition-all duration-200",
                      isTracked
                        ? "border-primary/30 bg-primary/[0.03] shadow-sm shadow-primary/5"
                        : "border-border bg-card hover:border-primary/10",
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleSector(segment)}
                        className={cn(
                          "shrink-0",
                          isTracked &&
                            !allSelected &&
                            "data-[state=unchecked]:bg-primary/20 data-[state=unchecked]:border-primary",
                        )}
                      />
                      <div
                        className="flex-1 min-w-0 cursor-pointer select-none"
                        onClick={() => (hasSubcategories ? toggleExpanded(segment) : toggleSector(segment))}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-foreground truncate">{segment}</span>
                          {isTracked && !allSelected && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-2 shrink-0 font-medium">
                              {selectedInSector}/{data.items.length}
                            </Badge>
                          )}
                          {allSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          {data.totalJobs} {t("radar.active_jobs", "jobs")}
                          {hasSubcategories &&
                            ` · ${data.items.length} ${t("radar.subcategories_label", "subcategories")}`}
                        </span>
                      </div>
                      {hasSubcategories && (
                        <button
                          onClick={() => toggleExpanded(segment)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </div>

                    {hasSubcategories && isExpanded && (
                      <div className="border-t border-border/50 px-4 py-3 space-y-1.5 bg-muted/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-2">
                          {t("radar.subcategories_hint", "Subcategories")}
                        </p>
                        {data.items.map((item) => (
                          <label
                            key={item.raw_category}
                            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors group"
                          >
                            <Checkbox
                              checked={selectedCategories.includes(item.raw_category)}
                              onCheckedChange={() => toggleSubCategory(item.raw_category)}
                              className="shrink-0"
                            />
                            <span className="text-xs text-foreground flex-1 truncate group-hover:text-primary transition-colors">
                              {item.raw_category}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {item.count} {t("radar.jobs_label", "jobs")}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {hasChangesComputed && (
            <Button
              onClick={() => {
                setIsActive(true);
                performSave({ is_active: true });
              }}
              disabled={saving}
              className="w-full font-bold gap-2 h-11 text-base shadow-lg hover:shadow-xl transition-shadow"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {radarProfile ? t("radar.save_changes", "Save Changes") : t("radar.activate_and_save", "Activate Radar")}
            </Button>
          )}
        </div>

        {/* RIGHT — Matches (2/5) */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          {/* Match count hero */}
          <div
            className={cn(
              "rounded-xl border p-5 text-center transition-all duration-300",
              matchCount > 0
                ? "border-primary/30 bg-gradient-to-br from-primary/[0.08] to-accent/[0.04] shadow-lg shadow-primary/10"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target
                className={cn("h-5 w-5 transition-colors", matchCount > 0 ? "text-primary" : "text-muted-foreground")}
              />
              <h2 className="text-sm font-bold text-foreground">{t("radar.matches_title", "Matches")}</h2>
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={fetchMatches}>
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div
              className={cn(
                "text-4xl font-bold transition-colors",
                matchCount > 0 ? "text-primary" : "text-muted-foreground/50",
              )}
            >
              {matchCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("radar.matches_hero_subtitle", "Ready to apply")}</p>
          </div>

          {/* Send all CTA */}
          {matchedJobs.length > 0 && (
            <Button
              onClick={handleSendAll}
              disabled={batchSending}
              className="w-full font-bold gap-2 h-10 shadow-lg hover:shadow-xl transition-shadow"
            >
              {batchSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("radar.send_all", "Send All")} ({matchCount})
            </Button>
          )}

          {/* Matches list */}
          <ScrollArea className="flex-1 h-[calc(100vh-700px)] rounded-lg border border-border">
            <div className="space-y-3 p-4">
              {matchedJobs.length > 0 ? (
                matchedJobs.map((match) => {
                  const job = match.public_jobs;
                  if (!job) return null;
                  return (
                    <Card
                      key={match.id}
                      className="hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden border-border"
                    >
                      <CardContent className="p-3.5 space-y-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] font-semibold">
                            {job.visa_type}
                          </Badge>
                          {job.randomization_group && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Layers className="h-3 w-3" /> {job.randomization_group}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                            <MapPin className="h-3 w-3" /> {job.state}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-foreground leading-tight">{job.category}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> {job.company || t("radar.company_fallback", "Company")}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-primary flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md">
                            <CircleDollarSign className="h-3.5 w-3.5" /> ${job.salary || "N/A"}/hr
                          </span>
                          <span className="text-xs font-semibold text-primary flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md">
                            <Briefcase className="h-3.5 w-3.5" /> {job.experience_months || 0}m
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 pt-2.5 border-t border-border">
                          <Button
                            onClick={() => handleSendApplication(match.id, job.id)}
                            size="sm"
                            className="font-bold text-xs flex-1 h-8 gap-1"
                          >
                            <Mail className="h-3.5 w-3.5" /> {t("radar.send_to_queue", "Apply")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                            className="text-xs h-8 px-2"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeMatch(match.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          {t("radar.queue_explanation", "Applications are queued and sent automatically")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="py-16 flex flex-col items-center gap-4 text-center">
                  <div
                    className={cn(
                      "p-5 rounded-full transition-all",
                      isActive ? "bg-primary/10 animate-pulse" : "bg-muted",
                    )}
                  >
                    <Satellite className={cn("h-8 w-8", isActive ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      {isActive
                        ? t("radar.scanning", "Scanning for matches...")
                        : t("radar.empty_title", "No matches yet")}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[220px]">
                      {isActive
                        ? t("radar.scanning_desc", "Radar is actively searching for opportunities")
                        : t("radar.empty_desc", "Activate Radar to start finding jobs")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Relationship explainer */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-muted/40 border border-border">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("radar.causality_hint", "Matches are based on your selected categories and filters")}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("radar.edit_criteria", "Edit Criteria")}</DialogTitle>
            <DialogDescription>
              {t("radar.filters_description", "Customize your job search preferences")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="min-wage" className="text-sm font-semibold">
                {t("radar.min_wage_label", "Minimum Hourly Wage")}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id="min-wage"
                  type="number"
                  value={minWage}
                  onChange={(e) => setMinWage(e.target.value)}
                  placeholder="0"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">/hr</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-exp" className="text-sm font-semibold">
                {t("radar.max_experience_label", "Maximum Experience Required")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="max-exp"
                  type="number"
                  value={maxExperience}
                  onChange={(e) => setMaxExperience(e.target.value)}
                  placeholder="0"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">{t("radar.criteria_years", "years")}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state" className="text-sm font-semibold">
                {t("radar.state_label", "State")}
              </Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger id="state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("radar.state_all", "All States")}</SelectItem>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visa" className="text-sm font-semibold">
                {t("radar.visa_label", "Visa Type")}
              </Label>
              <Select value={visaType} onValueChange={setVisaType}>
                <SelectTrigger id="visa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("radar.criteria_all_visas", "All Visa Types")}</SelectItem>
                  {VISA_TYPE_OPTIONS.map((visa) => (
                    <SelectItem key={visa} value={visa}>
                      {visa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setShowFilters(false)} className="w-full font-bold">
              {t("radar.apply_filters", "Apply Filters")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
