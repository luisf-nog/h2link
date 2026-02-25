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
  Loader2, Save, Target, Trash2, Send, MapPin, CircleDollarSign, Briefcase,
  Building2, RefreshCcw, Eye, Radio, CheckCircle2, Zap, Layers, ArrowRight,
  Satellite, Settings2, Pause, Play, ChevronDown, ChevronRight, Info, Sparkles,
  Rocket, Mail, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTOR_KEYS = [
  "agriculture", "farm_equipment", "construction", "carpentry",
  "installation", "mechanics", "cleaning", "kitchen",
  "dining", "hospitality", "bar", "logistics",
  "transport", "manufacturing", "welding", "wood",
  "textile", "meat", "landscaping", "sales",
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
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
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
    () => sectorEntries.filter(([, data]) => data.items.some(i => selectedCategories.includes(i.raw_category))).length,
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
  }, [isActive, autoSend, selectedCategories, minWage, maxExperience, visaType, stateFilter, groupFilter, radarProfile]);

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
      ? await supabase.from("radar_profiles" as any).update(payload).eq("user_id", profile.id)
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
      await supabase.from("radar_matched_jobs" as any).delete().eq("user_id", profile.id);
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
      await supabase.from("radar_matched_jobs" as any).delete().eq("id", matchId);
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => Math.max(0, prev - 1));
      await updateStats();
      toast({ title: t("radar.toast_captured") });
    } catch (err) {
      toast({ title: t("radar.toast_error"), variant: "destructive" });
    }
  };

  const removeMatch = async (matchId: string) => {
    const { error } = await supabase.from("radar_matched_jobs" as any).delete().eq("id", matchId);
    if (!error) {
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => Math.max(0, prev - 1));
      await updateStats();
    }
  };

  const toggleSector = (sectorName: string) => {
    const sectorSubcats = groupedCategories[sectorName].items.map((i) => i.raw_category);
    const allSelected = sectorSubcats.length > 0 && sectorSubcats.every((cat) => selectedCategories.includes(cat));
    setSelectedCategories((prev) =>
      allSelected ? prev.filter((cat) => !sectorSubcats.includes(cat)) : [...new Set([...prev, ...sectorSubcats])],
    );
  };

  const toggleSubCategory = (rawCategory: string) => {
    setSelectedCategories((prev) =>
      prev.includes(rawCategory) ? prev.filter((c) => c !== rawCategory) : [...prev, rawCategory],
    );
  };

  const toggleExpanded = (sectorName: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sectorName)) next.delete(sectorName);
      else next.add(sectorName);
      return next;
    });
  };

  const handleAutopilotToggle = (newValue: boolean) => {
    if (newValue && !autoSend) {
      setShowAutopilotConfirm(true);
    } else {
      setAutoSend(newValue);
    }
  };

  const confirmAutopilot = () => {
    setAutoSend(true);
    setShowAutopilotConfirm(false);
  };

  useEffect(() => { updateStats(); }, [visaType, stateFilter, minWage, maxExperience, groupFilter, profile?.id]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!profile?.id) return;
      setLoading(true);
      const { data: prof }: any = await supabase
        .from("radar_profiles" as any).select("*").eq("user_id", profile.id).maybeSingle();
      if (prof) {
        setRadarProfile(prof);
        setIsActive(prof.is_active);
        setAutoSend(prof.auto_send);
        setSelectedCategories(prof.categories || []);
        setMinWage(prof.min_wage?.toString() || "");
        setMaxExperience(prof.max_experience?.toString() || "");
        setVisaType(prof.visa_type || "all");
        setStateFilter(prof.state || "all");
        setGroupFilter(prof.randomization_group || "all");
      }
      await fetchMatches();
      setLoading(false);
    };
    loadProfile();
  }, [profile?.id]);

  if (!isPremium)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-fade-in">
        <div className="p-6 bg-muted rounded-full">
          <Satellite className="h-16 w-16 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{t("radar.title")}</h2>
          <p className="text-muted-foreground max-w-md">{t("radar.upgrade_cta")}</p>
        </div>
        <Button onClick={() => navigate("/plans")} size="lg" className="font-bold">
          <Rocket className="h-4 w-4 mr-2" /> Upgrade
        </Button>
      </div>
    );

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="animate-fade-in space-y-5">
      {/* ═══ AUTOPILOT CONFIRMATION DIALOG ═══ */}
      <Dialog open={showAutopilotConfirm} onOpenChange={setShowAutopilotConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {t("radar.autopilot_confirm_title")}
            </DialogTitle>
            <DialogDescription>{t("radar.autopilot_confirm_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("radar.autopilot_confirm_point1")}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("radar.autopilot_confirm_point2")}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("radar.autopilot_confirm_point3")}</span>
              </div>
            </div>
            <Button onClick={confirmAutopilot} className="w-full font-bold gap-2">
              <Zap className="h-4 w-4" />
              {t("radar.autopilot_confirm_cta")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ FILTERS DIALOG ═══ */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              {t("radar.filters_dialog_title")}
            </DialogTitle>
            <DialogDescription>{t("radar.filters_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("radar.criteria_min_pay")}</Label>
                <Input type="number" value={minWage} onChange={(e) => setMinWage(e.target.value)} className="h-9" placeholder="$0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("radar.criteria_experience")}</Label>
                <Input type="number" value={maxExperience} onChange={(e) => setMaxExperience(e.target.value)} className="h-9" placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("radar.filter_visa")}</Label>
              <Select value={visaType} onValueChange={setVisaType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISA_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("radar.filter_state")}</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("radar.state_all")}</SelectItem>
                  {US_STATES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("radar.filter_group")}</Label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("radar.group_all")}</SelectItem>
                  <SelectItem value="A">{t("radar.group_label", { group: "A" })}</SelectItem>
                  <SelectItem value="B">{t("radar.group_label", { group: "B" })}</SelectItem>
                  <SelectItem value="C">{t("radar.group_label", { group: "C" })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowFilters(false)} className="w-full">
              {t("radar.apply_filters")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — STATUS HEADER + FILTER CHIPS
      ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Status bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "relative p-2.5 rounded-xl shrink-0 transition-colors",
              isActive ? "bg-primary/10" : "bg-muted",
            )}>
              <Satellite className={cn("h-6 w-6 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
              {isActive && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">{t("radar.title")}</h1>
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className={cn("text-[10px] font-bold uppercase tracking-wider", isActive && "bg-primary text-primary-foreground")}
                >
                  {isActive ? t("radar.status_active") : t("radar.status_paused")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("radar.smart_desc")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isActive ? "outline" : "default"}
              size="sm"
              onClick={() => {
                const newVal = !isActive;
                setIsActive(newVal);
                performSave({ is_active: newVal });
              }}
              className="gap-1.5"
            >
              {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isActive ? t("radar.pause_radar") : t("radar.activate_radar")}
            </Button>
            {hasChangesComputed && (
              <Button onClick={() => performSave()} disabled={saving} size="sm" className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t("radar.save_changes")}
              </Button>
            )}
          </div>
        </div>

        {/* Filter chips — always visible, clickable */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-sm text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <Radio className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{monitoredCount}</span>
            <span className="text-muted-foreground">{t("radar.categories_label")}</span>
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-sm text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
            {wageDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-sm text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {stateDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-sm text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            {expDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-sm text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <Target className="h-3.5 w-3.5 text-primary" />
            {visaDisplay}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t("radar.edit_criteria")}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — FIRST-TIME ONBOARDING
      ═══════════════════════════════════════════════════════════════ */}
      {isFirstTime && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-accent/[0.06]">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">{t("radar.welcome_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("radar.welcome_subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Target, step: "1", titleKey: "radar.welcome_step1_title", descKey: "radar.welcome_step1_desc", color: "text-primary" },
                { icon: Settings2, step: "2", titleKey: "radar.welcome_step2_title", descKey: "radar.welcome_step2_desc", color: "text-primary" },
                { icon: Zap, step: "3", titleKey: "radar.welcome_step3_title", descKey: "radar.welcome_step3_desc", color: "text-primary" },
              ].map(({ icon: Icon, step, titleKey, descKey, color }) => (
                <div key={step} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 shrink-0">
                    <span className="text-xs font-bold text-primary">{step}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3 — AUTOPILOT CARD (highlighted)
      ═══════════════════════════════════════════════════════════════ */}
      <Card className={cn(
        "overflow-hidden border transition-all",
        autoSend
          ? "border-primary/40 bg-gradient-to-r from-primary/[0.06] to-accent/[0.04]"
          : "border-border bg-card",
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn(
                "p-2.5 rounded-xl shrink-0 transition-colors",
                autoSend ? "bg-primary/15" : "bg-muted",
              )}>
                <Zap className={cn("h-5 w-5", autoSend ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-foreground">{t("radar.autosend_title")}</h3>
                  {autoSend && (
                    <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-bold uppercase">
                      {t("radar.status_active")}
                    </Badge>
                  )}
                </div>
                <p className={cn(
                  "text-xs leading-relaxed",
                  autoSend ? "text-foreground/80" : "text-muted-foreground",
                )}>
                  {autoSend ? t("radar.autosend_active_desc") : t("radar.autosend_explanation")}
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
          SECTION 4 — MAIN LAYOUT: Categories → Matches
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" style={{ minHeight: "calc(100vh - 440px)" }}>
        {/* LEFT — Categories (3/5) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">{t("radar.categories_title")}</h2>
              <p className="text-xs text-muted-foreground">{t("radar.categories_subtitle")}</p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {totalSinaisGeral} {t("radar.active_jobs")}
            </Badge>
          </div>

          <ScrollArea className="h-[calc(100vh-540px)]">
            <div className="space-y-1.5 pr-3">
              {sectorEntries.map(([segment, data]) => {
                const selectedInSector = data.items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                const allSelected = data.items.length > 0 && selectedInSector === data.items.length;
                const isTracked = selectedInSector > 0;
                const isExpanded = expandedSectors.has(segment);
                const hasSubcategories = data.items.length > 1;

                return (
                  <div key={segment} className={cn(
                    "rounded-lg border transition-all",
                    isTracked ? "border-primary/30 bg-primary/[0.02]" : "border-border bg-card",
                  )}>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleSector(segment)}
                        className={cn(
                          "shrink-0",
                          isTracked && !allSelected && "data-[state=unchecked]:bg-primary/20 data-[state=unchecked]:border-primary",
                        )}
                      />
                      <div
                        className="flex-1 min-w-0 cursor-pointer select-none"
                        onClick={() => hasSubcategories ? toggleExpanded(segment) : toggleSector(segment)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{segment}</span>
                          {isTracked && !allSelected && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                              {selectedInSector}/{data.items.length}
                            </Badge>
                          )}
                          {allSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {data.totalJobs} {t("radar.active_jobs")}
                          {hasSubcategories && ` · ${data.items.length} ${t("radar.subcategories_label")}`}
                        </span>
                      </div>
                      {hasSubcategories && (
                        <button
                          onClick={() => toggleExpanded(segment)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </div>

                    {hasSubcategories && isExpanded && (
                      <div className="border-t border-border/50 px-3 py-2 space-y-1 bg-muted/30">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5 px-6">
                          {t("radar.subcategories_hint")}
                        </p>
                        {data.items.map((item) => (
                          <label
                            key={item.raw_category}
                            className="flex items-center gap-2.5 px-6 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedCategories.includes(item.raw_category)}
                              onCheckedChange={() => toggleSubCategory(item.raw_category)}
                              className="shrink-0"
                            />
                            <span className="text-xs text-foreground flex-1 truncate">{item.raw_category}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{item.count} {t("radar.jobs_label")}</span>
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
            <Button onClick={() => { setIsActive(true); performSave({ is_active: true }); }} disabled={saving} className="w-full font-bold gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {radarProfile ? t("radar.save_changes") : t("radar.activate_and_save")}
            </Button>
          )}
        </div>

        {/* RIGHT — Matches (2/5) */}
        <div className="lg:col-span-2 flex flex-col space-y-3">
          {/* Match count hero */}
          <div className={cn(
            "rounded-xl border p-4 text-center transition-all",
            matchCount > 0
              ? "border-primary/30 bg-gradient-to-br from-primary/[0.06] to-accent/[0.04]"
              : "border-border bg-card",
          )}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Target className={cn("h-5 w-5", matchCount > 0 ? "text-primary" : "text-muted-foreground")} />
              <h2 className="text-sm font-bold text-foreground">{t("radar.matches_title")}</h2>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchMatches}>
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className={cn(
              "text-4xl font-black tracking-tight my-2 transition-colors",
              matchCount > 0 ? "text-primary" : "text-muted-foreground/50",
            )}>
              {matchCount}
            </div>
            <p className="text-xs text-muted-foreground">{t("radar.matches_hero_subtitle")}</p>
          </div>

          {/* Send all CTA */}
          {matchedJobs.length > 0 && (
            <Button onClick={handleSendAll} disabled={batchSending} className="w-full font-bold gap-2">
              {batchSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("radar.send_all", { count: matchCount })}
            </Button>
          )}

          {/* Matches list */}
          <ScrollArea className="flex-1 h-[calc(100vh-600px)]">
            <div className="space-y-2 pr-3">
              {matchedJobs.length > 0 ? (
                matchedJobs.map((match) => {
                  const job = match.public_jobs;
                  if (!job) return null;
                  return (
                    <Card key={match.id} className="hover:shadow-md transition-shadow border-border">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{job.visa_type}</Badge>
                          {job.randomization_group && (
                            <Badge variant="outline" className="text-[10px]">
                              <Layers className="h-3 w-3 mr-0.5" /> {job.randomization_group}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                            <MapPin className="h-3 w-3" /> {job.state}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-foreground leading-tight">{job.category}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {job.company || t("radar.company_fallback")}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                            <CircleDollarSign className="h-3 w-3 text-primary" /> ${job.salary || "N/A"}/hr
                          </span>
                          <span className="text-xs font-medium text-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                            <Briefcase className="h-3 w-3 text-primary" /> {job.experience_months || 0}m
                          </span>
                        </div>

                        {/* Action buttons with explanation */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                          <Button
                            onClick={() => handleSendApplication(match.id, job.id)}
                            size="sm"
                            className="font-bold text-xs flex-1 h-7 gap-1"
                          >
                            <Mail className="h-3 w-3" /> {t("radar.send_to_queue")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                            className="text-xs h-7"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeMatch(match.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          {t("radar.queue_explanation")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className={cn("p-4 rounded-full", isActive ? "bg-primary/10" : "bg-muted")}>
                    <Satellite className={cn("h-8 w-8", isActive ? "text-primary animate-pulse" : "text-muted-foreground")} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {isActive ? t("radar.scanning") : t("radar.empty_title")}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      {isActive ? t("radar.scanning_desc") : t("radar.empty_desc")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Relationship explainer */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("radar.causality_hint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
