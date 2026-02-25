import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Radar as RadarIcon,
  ShieldCheck,
  Loader2,
  Save,
  Target,
  ChevronDown,
  ChevronRight,
  Trash2,
  Send,
  MapPin,
  CircleDollarSign,
  Briefcase,
  Building2,
  RefreshCcw,
  Eye,
  Radio,
  LayoutGrid,
  CheckCircle2,
  Zap,
  Layers,
  HelpCircle,
  ArrowRight,
  Bot,
  Rocket,
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
  const [expandedSegments, setExpandedSegments] = useState<string[]>([]);
  const [radarProfile, setRadarProfile] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);

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
  const leftSectorsMemo = useMemo(() => sectorEntries.slice(0, 10), [sectorEntries]);
  const rightSectorsMemo = useMemo(() => sectorEntries.slice(10, 20), [sectorEntries]);
  const totalSinaisGeral = useMemo(
    () => Object.values(groupedCategories).reduce((acc, curr) => acc + curr.totalJobs, 0),
    [groupedCategories],
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="p-6 bg-muted rounded-full">
          <Radio className="h-16 w-16 text-muted-foreground animate-pulse" />
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
    <div className="animate-in fade-in duration-700">
      {/* ─── ONBOARDING DIALOG ────────────────────────────────────── */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-2xl">
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

      {/* ─── HEADER BAR ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Radio className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("radar.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("radar.onboarding.description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={(val) => {
                setIsActive(val);
                performSave({ is_active: val });
              }}
              className="data-[state=checked]:bg-emerald-500"
            />
            <span className="text-sm font-medium text-foreground">
              {isActive ? (
                <span className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  {t("radar.live")}
                </span>
              ) : t("radar.offline")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className={cn("h-4 w-4", autoSend ? "text-emerald-500" : "text-muted-foreground")} />
            <span className={cn("text-sm", autoSend ? "text-emerald-600 font-medium" : "text-muted-foreground")}>
              {t("radar.auto_send")}
            </span>
            <Switch checked={autoSend} onCheckedChange={setAutoSend} className="scale-90 data-[state=checked]:bg-emerald-500" />
          </div>
          <button onClick={() => setShowInstructions(true)} className="text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ─── FILTERS ──────────────────────────────────────────────── */}
      <Card className="border-border shadow-sm mb-6">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
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
            <div className="space-y-1">
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
            <div className="space-y-1">
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
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("radar.filter_wage")}</Label>
              <Input type="number" value={minWage} onChange={(e) => setMinWage(e.target.value)} className="h-9" placeholder="$/h" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("radar.filter_exp")}</Label>
              <Input type="number" value={maxExperience} onChange={(e) => setMaxExperience(e.target.value)} className="h-9" placeholder={t("common.months")} />
            </div>
          </div>
          {hasChangesComputed && (
            <Button onClick={() => performSave()} disabled={saving} className="w-full mt-3 font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t("radar.save_protocols")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── MAIN: SECTORS (left) + MATCHES (right) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ minHeight: "calc(100vh - 320px)" }}>
        {/* LEFT — Sectors (3/5 width) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">{t("radar.sectors_title")}</h2>
            <Badge variant="secondary" className="text-xs ml-auto">
              {t("radar.active_signals", { count: totalSinaisGeral })}
            </Badge>
          </div>

          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pr-3">
              {[leftSectorsMemo, rightSectorsMemo].map((column, colIdx) => (
                <div key={colIdx} className="space-y-2">
                  {column.map(([segment, data]) => {
                    const selectedInSector = data.items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                    const allSelected = data.items.length > 0 && selectedInSector === data.items.length;
                    return (
                      <Card
                        key={segment}
                        className={cn(
                          "transition-all",
                          selectedInSector > 0 ? "border-primary/40 shadow-sm" : "border-border",
                        )}
                      >
                        <div
                          className="p-2.5 cursor-pointer flex items-center justify-between"
                          onClick={() =>
                            setExpandedSegments((p) =>
                              p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-foreground">{segment}</span>
                                {allSelected ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                ) : selectedInSector > 0 && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{selectedInSector}</Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {t("radar.posts_count", { count: data.totalJobs })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant={allSelected ? "default" : "outline"}
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); toggleSector(segment); }}
                              className="h-6 text-[11px] px-2"
                            >
                              {allSelected ? t("radar.remove") : t("radar.add")}
                            </Button>
                            {expandedSegments.includes(segment) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {expandedSegments.includes(segment) && (
                          <div className="px-2.5 pb-2.5 flex flex-col gap-1 border-t border-border pt-2">
                            {data.items.map((cat) => (
                              <button
                                key={cat.raw_category}
                                onClick={() =>
                                  setSelectedCategories((p) =>
                                    p.includes(cat.raw_category)
                                      ? p.filter((c) => c !== cat.raw_category)
                                      : [...p, cat.raw_category],
                                  )
                                }
                                className={cn(
                                  "px-2.5 py-1 rounded-md border text-left text-xs font-medium transition-all flex justify-between items-center",
                                  selectedCategories.includes(cat.raw_category)
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-card text-foreground border-border hover:border-primary/40",
                                )}
                              >
                                <span className="truncate">{cat.raw_category}</span>
                                <span className="text-[10px] opacity-70 ml-2 shrink-0">({cat.count})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT — Matches (2/5 width) */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">{t("radar.matches_title")}</h2>
              <Badge variant="secondary" className="text-xs font-bold">
                {matchCount}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchMatches}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          {matchedJobs.length > 0 && (
            <Button onClick={handleSendAll} disabled={batchSending} size="sm" className="w-full mb-3 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              {batchSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              {t("radar.send_all", { count: matchCount })}
            </Button>
          )}

          <ScrollArea className="flex-1 h-[calc(100vh-380px)]">
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
                            <CircleDollarSign className="h-3 w-3 text-primary" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="text-xs font-medium text-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                            <Briefcase className="h-3 w-3 text-primary" /> {job.experience_months || 0}m
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                          <Button
                            onClick={() => handleSendApplication(match.id, job.id)}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex-1 h-7"
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
                  <div className="p-3 bg-muted rounded-full">
                    <Radio className="h-8 w-8 text-muted-foreground animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground">{t("radar.waiting_signals")}</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">{t("radar.waiting_signals_desc")}</p>
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
