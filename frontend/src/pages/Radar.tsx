import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Save,
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
  CheckCircle2,
  Zap,
  Layers,
  HelpCircle,
  ArrowRight,
  Bot,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── font injection ───────────────────────────────────────────── */
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
  .radar-root { font-family: 'Sora', sans-serif; }
  .radar-mono { font-family: 'JetBrains Mono', monospace; }
`;

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

/* ─── sub-components ───────────────────────────────────────────── */

function StatusPulse({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={cn("relative inline-flex rounded-full h-2.5 w-2.5", active ? "bg-emerald-500" : "bg-zinc-500")}
      />
    </span>
  );
}

function StatChip({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
      <Icon className="h-3.5 w-3.5 text-zinc-400" />
      <span className="radar-mono text-xs text-white font-medium">{value}</span>
      <span className="text-[11px] text-zinc-500">{label}</span>
    </div>
  );
}

/* ─── main component ───────────────────────────────────────────── */

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
      await supabase
        .from("my_queue" as any)
        .insert(currentJobs.map((m) => ({ user_id: profile.id, job_id: m.job_id, status: "pending" })));
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
      await updateStats();
      toast({ title: t("radar.toast_captured") });
    } catch {
      toast({ title: t("radar.toast_error"), variant: "destructive" });
    }
  };

  const removeMatch = async (matchId: string) => {
    const { error } = await supabase
      .from("radar_matched_jobs" as any)
      .delete()
      .eq("id", matchId);
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

  /* ─── UPGRADE WALL ─────────────────────────────────────────────── */
  if (!isPremium)
    return (
      <>
        <style>{fontStyle}</style>
        <div className="radar-root flex flex-col items-center justify-center min-h-[60vh] text-center gap-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping scale-150" />
            <div className="relative p-6 rounded-full bg-zinc-900 border border-zinc-800">
              <Radio className="h-14 w-14 text-zinc-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white tracking-tight">{t("radar.title")}</h2>
            <p className="text-zinc-400 max-w-sm">{t("radar.upgrade_cta")}</p>
          </div>
          <button
            onClick={() => navigate("/plans")}
            className="group flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all duration-200 hover:scale-105"
          >
            <Rocket className="h-4 w-4" /> Upgrade
          </button>
        </div>
      </>
    );

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );

  /* ─── MAIN RENDER ───────────────────────────────────────────────── */
  return (
    <>
      <style>{fontStyle}</style>

      {/* ─── ONBOARDING DIALOG ──────────────────────────────────── */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-white radar-root">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg font-bold text-white">
              <div className="p-2 bg-emerald-500/15 rounded-lg">
                <Bot className="h-5 w-5 text-emerald-400" />
              </div>
              {t("radar.onboarding.title")}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">{t("radar.onboarding.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-400">{t("radar.onboarding.what_is_desc")}</p>
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-white text-sm">{t("radar.onboarding.autopilot_title")}</span>
              </div>
              <p className="text-xs text-zinc-400">{t("radar.onboarding.autopilot_desc")}</p>
              <div className="space-y-2 pt-1">
                {[t("radar.onboarding.feature_search"), t("radar.onboarding.feature_instant")].map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs text-zinc-300">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowInstructions(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-colors"
            >
              {t("radar.onboarding.start_button")} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="radar-root space-y-5">
        {/* ─── TOP STATUS BAR ─────────────────────────────────────── */}
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800/60 overflow-hidden">
          {/* Main row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className={cn(
                    "absolute inset-0 rounded-xl transition-all duration-700",
                    isActive ? "bg-emerald-500/20 animate-pulse" : "bg-zinc-800/50",
                  )}
                />
                <div className="relative p-2.5 rounded-xl">
                  <Radio className={cn("h-5 w-5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-base font-bold text-white tracking-tight">{t("radar.title")}</h1>
                  <span
                    className={cn(
                      "radar-mono text-[10px] font-bold px-2 py-0.5 rounded-md tracking-widest uppercase",
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700",
                    )}
                  >
                    {isActive ? "LIVE" : "OFF"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{t("radar.onboarding.description")}</p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              {/* Radar toggle */}
              <div className="flex items-center gap-2.5">
                <StatusPulse active={isActive} />
                <span className="text-xs font-medium text-zinc-300">
                  {isActive ? t("radar.live") : t("radar.offline")}
                </span>
                <Switch
                  checked={isActive}
                  onCheckedChange={(val) => {
                    setIsActive(val);
                    performSave({ is_active: val });
                  }}
                  className="data-[state=checked]:bg-emerald-500 scale-90"
                />
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-zinc-800" />

              {/* Autopilot toggle */}
              <div className="flex items-center gap-2.5">
                <Zap className={cn("h-3.5 w-3.5", autoSend ? "text-amber-400" : "text-zinc-600")} />
                <span className={cn("text-xs font-medium", autoSend ? "text-amber-400" : "text-zinc-500")}>
                  {t("radar.auto_send")}
                </span>
                <Switch
                  checked={autoSend}
                  onCheckedChange={setAutoSend}
                  className="data-[state=checked]:bg-amber-500 scale-90"
                />
              </div>

              <button
                onClick={() => setShowInstructions(true)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Autopilot banner — só aparece quando ativo */}
          {autoSend && (
            <div className="px-5 py-2.5 bg-amber-500/8 border-t border-amber-500/20 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300/80">
                Piloto automático <span className="font-semibold text-amber-400">ativo</span> — suas candidaturas serão
                enviadas automaticamente assim que uma vaga aparecer.
              </p>
            </div>
          )}
        </div>

        {/* ─── FILTERS ────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800/60 px-5 py-4">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest radar-mono mb-3">
            Filtros do radar
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: t("radar.filter_visa"),
                node: (
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-9 bg-zinc-900 border-zinc-800 text-sm text-white focus:ring-emerald-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {VISA_TYPE_OPTIONS.map((o) => (
                        <SelectItem
                          key={o.value}
                          value={o.value}
                          className="text-zinc-300 focus:bg-zinc-800 focus:text-white"
                        >
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              },
              {
                label: t("radar.filter_group"),
                node: (
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="h-9 bg-zinc-900 border-zinc-800 text-sm text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {["all", "A", "B", "C"].map((g) => (
                        <SelectItem key={g} value={g} className="text-zinc-300 focus:bg-zinc-800 focus:text-white">
                          {g === "all" ? t("radar.group_all") : t("radar.group_label", { group: g })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              },
              {
                label: t("radar.filter_state"),
                node: (
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-9 bg-zinc-900 border-zinc-800 text-sm text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="all" className="text-zinc-300 focus:bg-zinc-800 focus:text-white">
                        {t("radar.state_all")}
                      </SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s} className="text-zinc-300 focus:bg-zinc-800 focus:text-white">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              },
              {
                label: t("radar.filter_wage"),
                node: (
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-9 bg-zinc-900 border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus-visible:ring-emerald-500/30"
                    placeholder="$/h"
                  />
                ),
              },
              {
                label: t("radar.filter_exp"),
                node: (
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-9 bg-zinc-900 border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus-visible:ring-emerald-500/30"
                    placeholder={t("common.months")}
                  />
                ),
              },
            ].map(({ label, node }) => (
              <div key={label} className="space-y-1.5">
                <Label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide radar-mono">
                  {label}
                </Label>
                {node}
              </div>
            ))}
          </div>

          {hasChangesComputed && (
            <button
              onClick={() => performSave()}
              disabled={saving}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("radar.save_protocols")}
            </button>
          )}
        </div>

        {/* ─── MAIN GRID ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" style={{ minHeight: "calc(100vh - 360px)" }}>
          {/* ─── LEFT: Sectors ──────────────────────────────────── */}
          <div className="lg:col-span-3 rounded-2xl bg-zinc-950 border border-zinc-800/60 flex flex-col overflow-hidden">
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
              <div>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest radar-mono mb-0.5">
                  Categorias
                </p>
                <h2 className="text-sm font-bold text-white">{t("radar.sectors_title")}</h2>
              </div>
              <div className="radar-mono text-[11px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
                <span className="text-white font-bold">{totalSinaisGeral.toLocaleString()}</span> vagas
              </div>
            </div>

            <ScrollArea className="flex-1 p-4" style={{ height: "calc(100vh - 440px)" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[leftSectorsMemo, rightSectorsMemo].map((column, colIdx) => (
                  <div key={colIdx} className="space-y-1.5">
                    {column.map(([segment, data]) => {
                      const selectedInSector = data.items.filter((i) =>
                        selectedCategories.includes(i.raw_category),
                      ).length;
                      const allSelected = data.items.length > 0 && selectedInSector === data.items.length;
                      const isExpanded = expandedSegments.includes(segment);
                      const hasSelection = selectedInSector > 0;

                      return (
                        <div
                          key={segment}
                          className={cn(
                            "rounded-xl border transition-all duration-200",
                            hasSelection
                              ? "bg-emerald-500/5 border-emerald-500/25"
                              : "bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700",
                          )}
                        >
                          <div
                            className="px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2"
                            onClick={() =>
                              setExpandedSegments((p) =>
                                p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                              )
                            }
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {hasSelection && (
                                <CheckCircle2
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    allSelected ? "text-emerald-400" : "text-emerald-500/60",
                                  )}
                                />
                              )}
                              <div className="min-w-0">
                                <p
                                  className={cn(
                                    "text-xs font-semibold truncate",
                                    hasSelection ? "text-white" : "text-zinc-300",
                                  )}
                                >
                                  {segment}
                                </p>
                                <p className="radar-mono text-[10px] text-zinc-600">
                                  {data.totalJobs} {t("radar.posts_count", { count: "" }).trim()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasSelection && !allSelected && (
                                <span className="radar-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                  {selectedInSector}/{data.items.length}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSector(segment);
                                }}
                                className={cn(
                                  "text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all",
                                  allSelected
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30",
                                )}
                              >
                                {allSelected ? t("radar.remove") : t("radar.add")}
                              </button>
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1.5 border-t border-zinc-800/60 flex flex-wrap gap-1.5">
                              {data.items.map((cat) => {
                                const sel = selectedCategories.includes(cat.raw_category);
                                return (
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
                                      "text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all",
                                      sel
                                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                        : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300",
                                    )}
                                  >
                                    {cat.raw_category}
                                    <span className="opacity-50 ml-1">({cat.count})</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* ─── RIGHT: Matches ─────────────────────────────────── */}
          <div className="lg:col-span-2 rounded-2xl bg-zinc-950 border border-zinc-800/60 flex flex-col overflow-hidden">
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
              <div>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest radar-mono mb-0.5">
                  Encontradas
                </p>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">{t("radar.matches_title")}</h2>
                  <span
                    className={cn(
                      "radar-mono text-sm font-bold px-2 py-0.5 rounded-lg",
                      matchCount > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-900 text-zinc-500",
                    )}
                  >
                    {matchCount}
                  </span>
                </div>
              </div>
              <button
                onClick={fetchMatches}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 transition-all"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* send all */}
            {matchedJobs.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <button
                  onClick={handleSendAll}
                  disabled={batchSending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  {batchSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {t("radar.send_all", { count: matchCount })}
                </button>
              </div>
            )}

            <ScrollArea className="flex-1 p-4" style={{ height: "calc(100vh - 440px)" }}>
              {matchedJobs.length > 0 ? (
                <div className="space-y-2">
                  {matchedJobs.map((match) => {
                    const job = match.public_jobs;
                    if (!job) return null;
                    return (
                      <div
                        key={match.id}
                        className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all p-3 space-y-2.5"
                      >
                        {/* badges row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="radar-mono text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400">
                            {job.visa_type}
                          </span>
                          {job.randomization_group && (
                            <span className="radar-mono text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-500 flex items-center gap-1">
                              <Layers className="h-2.5 w-2.5" /> {job.randomization_group}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-600 flex items-center gap-0.5 ml-auto">
                            <MapPin className="h-2.5 w-2.5" /> {job.state}
                          </span>
                        </div>

                        {/* title + company */}
                        <div>
                          <h3 className="text-sm font-bold text-white leading-snug">{job.category}</h3>
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" /> {job.company || t("radar.company_fallback")}
                          </p>
                        </div>

                        {/* salary + exp chips */}
                        <div className="flex items-center gap-2">
                          <span className="radar-mono text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                            <CircleDollarSign className="h-3 w-3" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="radar-mono text-xs text-zinc-400 flex items-center gap-1 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-lg">
                            <Briefcase className="h-3 w-3" /> {job.experience_months || 0}m
                          </span>
                        </div>

                        {/* action row */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/60">
                          <button
                            onClick={() => handleSendApplication(match.id, job.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors"
                          >
                            <Send className="h-3 w-3" /> {t("radar.send")}
                          </button>
                          <button
                            onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                            className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-300 transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => removeMatch(match.id)}
                            className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-red-500/40 text-zinc-600 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-16">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-zinc-800/50 scale-150 animate-pulse" />
                    <div className="relative p-4 rounded-full bg-zinc-900 border border-zinc-800">
                      <Radio className="h-7 w-7 text-zinc-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-400">{t("radar.waiting_signals")}</p>
                    <p className="text-xs text-zinc-600 max-w-[180px]">{t("radar.waiting_signals_desc")}</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </>
  );
}
