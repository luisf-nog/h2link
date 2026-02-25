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
  HelpCircle,
  ArrowRight,
  Bot,
  Rocket,
  Satellite,
  Settings2,
  Pause,
  Play,
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
  const [showInstructions, setShowInstructions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

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
    if (!radarProfile) return false;
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

  useEffect(() => {
    const hasSeen = localStorage.getItem("h2_radar_onboarding_v11");
    if (!hasSeen && !loading) {
      setShowInstructions(true);
      localStorage.setItem("h2_radar_onboarding_v11", "true");
    }
  }, [loading]);

  useEffect(() => {
    updateStats();
  }, [visaType, stateFilter, minWage, maxExperience, groupFilter, profile?.id]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!profile?.id) return;
      setLoading(true);
      const { data: prof }: any = await supabase
        .from("radar_profiles" as any)
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle();
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

  // ─── UPGRADE WALL ──────────────────────────────────────────────────────
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

  const wageDisplay = minWage ? `$${minWage}/hr` : t("radar.criteria_any");
  const expDisplay = maxExperience ? `${maxExperience}+ ${t("radar.criteria_years")}` : t("radar.criteria_any");
  const stateDisplay = stateFilter === "all" ? t("radar.state_all") : stateFilter;
  const visaDisplay = visaType === "all" ? t("radar.criteria_all_visas") : visaType.toUpperCase();

  return (
    <div className="animate-fade-in">
      {/* ─── ONBOARDING DIALOG ────────────────────────────────────── */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Bot className="h-6 w-6 text-primary" />
              {t("radar.onboarding.title")}
            </DialogTitle>
            <DialogDescription>{t("radar.onboarding.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{t("radar.onboarding.what_is_desc")}</p>
            <Card className="bg-accent/50 border-accent">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">{t("radar.onboarding.autopilot_title")}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t("radar.onboarding.autopilot_desc")}</p>
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {t("radar.onboarding.feature_search")}</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {t("radar.onboarding.feature_instant")}</li>
                </ul>
              </CardContent>
            </Card>
            <Button onClick={() => setShowInstructions(false)} className="w-full font-bold">
              {t("radar.onboarding.start_button")} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── FILTERS DIALOG ───────────────────────────────────────── */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              {t("radar.edit_criteria")}
            </DialogTitle>
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
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
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
            <Button onClick={() => { setShowFilters(false); }} className="w-full">
              {t("radar.apply_filters")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          1️⃣  SMART STATUS HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <Card className={cn(
        "mb-6 overflow-hidden border-border transition-colors",
        isActive ? "bg-primary/[0.03]" : "bg-muted/50",
      )}>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Icon + Title + Description */}
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-xl shrink-0 transition-colors",
                isActive ? "bg-primary/10" : "bg-muted",
              )}>
                <Satellite className={cn(
                  "h-7 w-7 transition-colors",
                  isActive ? "text-primary animate-pulse" : "text-muted-foreground",
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl font-bold text-foreground">{t("radar.title")}</h1>
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      isActive && "bg-success text-success-foreground",
                    )}
                  >
                    {isActive ? (
                      <span className="flex items-center gap-1.5">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-success-foreground animate-ping" />
                        {t("radar.status_active")}
                      </span>
                    ) : t("radar.status_paused")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t("radar.smart_desc")}</p>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant={isActive ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  const newVal = !isActive;
                  setIsActive(newVal);
                  performSave({ is_active: newVal });
                }}
                className="gap-2"
              >
                {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isActive ? t("radar.pause_radar") : t("radar.activate_radar")}
              </Button>
              <button onClick={() => setShowInstructions(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Status Metrics Strip */}
          <Separator className="my-4" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Radio className="h-3.5 w-3.5 text-primary" />
              {t("radar.monitoring")}: <span className="font-medium text-foreground">{monitoredCount} {t("radar.categories_label")}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
              {t("radar.criteria_min_pay")}: <span className="font-medium text-foreground">{wageDisplay}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {t("radar.filter_state")}: <span className="font-medium text-foreground">{stateDisplay}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              {t("radar.criteria_experience")}: <span className="font-medium text-foreground">{expDisplay}</span>
            </span>
            <span className={cn(
              "flex items-center gap-1.5",
              autoSend ? "text-success" : "text-muted-foreground",
            )}>
              <Zap className="h-3.5 w-3.5" />
              {t("radar.auto_send")}: <span className="font-medium">{autoSend ? "ON" : "OFF"}</span>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} className="scale-75 data-[state=checked]:bg-success" />
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="font-bold text-foreground">{matchCount}</span> {t("radar.matches_ready")}
            </span>
          </div>

          {/* Edit Criteria button */}
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(true)} className="gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              {t("radar.edit_criteria")}
            </Button>
            {hasChangesComputed && (
              <Button onClick={() => performSave()} disabled={saving} size="sm" className="gap-1.5 text-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t("radar.save_changes")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          2️⃣  MAIN LAYOUT: Categories (left) + Matches (right)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ minHeight: "calc(100vh - 360px)" }}>
        {/* LEFT — Radar Coverage (3/5) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">{t("radar.coverage_title")}</h2>
            </div>
            <Badge variant="secondary" className="text-xs">
              {t("radar.active_signals", { count: totalSinaisGeral })}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t("radar.coverage_desc")}</p>

          <ScrollArea className="h-[calc(100vh-420px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-3">
              {sectorEntries.map(([segment, data]) => {
                const selectedInSector = data.items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                const allSelected = data.items.length > 0 && selectedInSector === data.items.length;
                const isTracked = selectedInSector > 0;
                return (
                  <div
                    key={segment}
                    onClick={() => toggleSector(segment)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all select-none",
                      isTracked
                        ? "border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.07]"
                        : "border-border bg-card hover:border-muted-foreground/30",
                    )}
                  >
                    <Checkbox
                      checked={allSelected}
                      className={cn(
                        "pointer-events-none shrink-0",
                        isTracked && !allSelected && "data-[state=unchecked]:bg-primary/20 data-[state=unchecked]:border-primary",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{segment}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {data.totalJobs} {t("radar.active_jobs")}
                      </span>
                    </div>
                    {isTracked && !allSelected && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">{selectedInSector}/{data.items.length}</Badge>
                    )}
                    {allSelected && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {hasChangesComputed && (
            <div className="mt-3">
              <Button onClick={() => performSave()} disabled={saving} className="w-full font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {t("radar.save_changes")}
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT — Matches (2/5) */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">{t("radar.matches_title")}</h2>
              <Badge variant="secondary" className="text-xs font-bold">{matchCount}</Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchMatches}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          {matchedJobs.length > 0 && (
            <Button onClick={handleSendAll} disabled={batchSending} size="sm" className="w-full mb-3 font-bold bg-success hover:bg-success/90 text-success-foreground">
              {batchSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              {t("radar.send_all", { count: matchCount })}
            </Button>
          )}

          <ScrollArea className="flex-1 h-[calc(100vh-420px)]">
            <div className="space-y-2 pr-3">
              {matchedJobs.length > 0 ? (
                matchedJobs.map((match) => {
                  const job = match.public_jobs;
                  if (!job) return null;
                  return (
                    <Card key={match.id} className="hover:shadow-md transition-shadow">
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
                        <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                          <Button
                            onClick={() => handleSendApplication(match.id, job.id)}
                            size="sm"
                            className="bg-success hover:bg-success/90 text-success-foreground font-bold text-xs flex-1 h-7"
                          >
                            <Send className="h-3 w-3 mr-1" /> {t("radar.send")}
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
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="py-16 flex flex-col items-center gap-3 text-center">
                  <div className={cn(
                    "p-4 rounded-full",
                    isActive ? "bg-primary/10" : "bg-muted",
                  )}>
                    <Satellite className={cn(
                      "h-8 w-8",
                      isActive ? "text-primary animate-pulse" : "text-muted-foreground",
                    )} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {isActive ? t("radar.scanning") : t("radar.waiting_signals")}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[220px]">
                      {isActive ? t("radar.scanning_desc") : t("radar.waiting_signals_desc")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
