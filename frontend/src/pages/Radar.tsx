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
  Users,
  Building2,
  RefreshCcw,
  Eye,
  Radio,
  LayoutGrid,
  CheckCircle2,
  Zap,
  Layers,
  HelpCircle,
  Activity,
  ArrowRight,
  ShieldAlert,
  Bot,
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

  const getGroupStyles = (group: string) => {
    switch (group?.toUpperCase()) {
      case "A": return "bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-100";
      case "B": return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "C": return "bg-slate-100 text-slate-600 border-slate-200";
      default: return "bg-slate-50 text-slate-400 border-slate-100";
    }
  };

  // Map sector key to translated name
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
      toast({ title: t("radar.toast_recalibrated"), className: "bg-indigo-600 text-white shadow-xl" });
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
      toast({ title: t("radar.toast_captured_all"), className: "bg-emerald-600 text-white shadow-xl" });
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
      toast({ title: t("radar.toast_captured"), className: "bg-emerald-600 text-white shadow-sm" });
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

  if (!isPremium)
    return (
      <div className="p-20 text-center">
        <Radio className="h-20 w-20 mx-auto text-slate-200 animate-pulse" />
        <Button onClick={() => navigate("/plans")} className="mt-6 bg-indigo-600 font-black shadow-lg">
          {t("radar.upgrade_cta")}
        </Button>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24 px-4 sm:px-6 text-left">
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-4xl bg-white border-none shadow-2xl rounded-[2.5rem] overflow-hidden p-0 text-left">
          <div className="grid grid-cols-1 md:grid-cols-5 h-full">
            <div className="md:col-span-2 bg-indigo-600 p-10 text-white flex flex-col justify-between relative overflow-hidden text-left">
              <div className="z-10 text-left">
                <Badge className="bg-white/20 text-white border-none px-3 py-1 text-[10px] font-black uppercase mb-4 tracking-widest text-left">
                  {t("radar.onboarding.badge")}
                </Badge>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-4 text-left">
                  {t("radar.onboarding.title")}
                </h2>
                <p className="text-indigo-100 text-sm font-medium opacity-90 leading-relaxed text-left">
                  {t("radar.onboarding.description")}
                </p>
              </div>
              <Bot className="absolute -bottom-10 -left-10 h-64 w-64 text-white/10" />
            </div>
            <div className="md:col-span-3 p-10 space-y-8 bg-white overflow-y-auto max-h-[85vh] custom-scrollbar text-left">
              <section className="text-left">
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 mb-2">
                  {t("radar.onboarding.what_is_title")}
                </h3>
                <p className="text-sm text-slate-500 text-left">
                  {t("radar.onboarding.what_is_desc")}
                </p>
              </section>
              <section className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 text-left">
                <div className="flex items-center gap-3 mb-3 text-left">
                  <Zap className="h-6 w-6 text-indigo-600 fill-indigo-600" />
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-indigo-900">
                    {t("radar.onboarding.autopilot_title")}
                  </h3>
                </div>
                <p className="text-sm text-indigo-700 leading-relaxed mb-4">
                  {t("radar.onboarding.autopilot_desc")}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase">
                    <CheckCircle2 className="h-4 w-4" /> {t("radar.onboarding.feature_search")}
                  </li>
                  <li className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase">
                    <CheckCircle2 className="h-4 w-4" /> {t("radar.onboarding.feature_instant")}
                  </li>
                </ul>
              </section>
              <Button
                onClick={() => setShowInstructions(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-7 rounded-2xl shadow-lg border-b-4 border-indigo-800 transition-all uppercase tracking-widest text-xs"
              >
                {t("radar.onboarding.start_button")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 space-y-6">
          <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden text-left">
            <button
              onClick={() => setShowInstructions(true)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center group shadow-sm z-10"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-4 text-left">
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all shadow-inner",
                    isActive ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-400",
                  )}
                >
                  <Radio className={cn("h-7 w-7", isActive && "animate-pulse")} />
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                    {t("radar.title")}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    {isActive ? (
                      <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 shadow-sm">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{t("radar.live")}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 leading-none">
                        {t("radar.offline")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(val) => {
                  setIsActive(val);
                  performSave({ is_active: val });
                }}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>
            {hasChangesComputed && (
              <Button
                onClick={() => performSave()}
                disabled={saving}
                className="w-full bg-indigo-600 text-white font-black h-12 rounded-xl shadow-lg border-b-4 border-indigo-800 transition-all uppercase tracking-widest text-[10px]"
              >
                {t("radar.save_protocols")}
              </Button>
            )}
          </div>

          <Card className="border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden text-left">
            <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-row text-left">
              <CardTitle className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-2 tracking-[0.1em] text-left">
                <ShieldCheck className="h-4 w-4 text-indigo-600" /> {t("radar.filters_title")}
              </CardTitle>
              <div className="flex items-center gap-3 bg-indigo-600 px-3 py-1.5 rounded-full border border-indigo-700 shadow-sm">
                <Label className="text-[9px] font-black text-white cursor-pointer uppercase leading-none">
                  {t("radar.auto_send")}
                </Label>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} className="scale-75 data-[state=checked]:bg-white" />
              </div>
            </CardHeader>
            <CardContent className="p-5 text-left">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1.5 text-left">
                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("radar.filter_visa")}</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-9 border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VISA_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-left">
                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("radar.filter_group")}</Label>
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="h-9 border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("radar.group_all")}</SelectItem>
                      <SelectItem value="A">{t("radar.group_label", { group: "A" })}</SelectItem>
                      <SelectItem value="B">{t("radar.group_label", { group: "B" })}</SelectItem>
                      <SelectItem value="C">{t("radar.group_label", { group: "C" })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-left">
                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("radar.filter_state")}</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-9 border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("radar.state_all")}</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-left">
                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("radar.filter_wage")}</Label>
                  <Input type="number" value={minWage} onChange={(e) => setMinWage(e.target.value)} className="h-9 font-black text-xs" />
                </div>
                <div className="space-y-1.5 text-left">
                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("radar.filter_exp")}</Label>
                  <Input type="number" value={maxExperience} onChange={(e) => setMaxExperience(e.target.value)} className="h-9 font-black text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden text-left">
            <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-left">
              <div className="flex items-center gap-3 text-left">
                <CardTitle className="text-[11px] font-black uppercase text-slate-500 tracking-[0.1em] flex items-center gap-2 text-left">
                  <LayoutGrid className="h-4 w-4 text-indigo-600" /> {t("radar.sectors_title")}
                </CardTitle>
                <Badge className="bg-indigo-600 text-white font-black text-[9px] px-2 py-0.5 shadow-sm">
                  {t("radar.active_signals", { count: totalSinaisGeral })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 bg-slate-50/20 text-left">
              <div className="grid grid-cols-2 gap-4">
                {[leftSectorsMemo, rightSectorsMemo].map((column, colIdx) => (
                  <div key={colIdx} className="space-y-2 text-left">
                    {column.map(([segment, data]) => {
                      const selectedInSector = data.items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                      const allSelected = data.items.length > 0 && selectedInSector === data.items.length;
                      return (
                        <div
                          key={segment}
                          className={cn(
                            "border bg-white rounded-xl overflow-hidden shadow-sm transition-all text-left",
                            selectedInSector > 0 ? "border-indigo-400 ring-1 ring-indigo-100" : "border-slate-200",
                          )}
                        >
                          <div
                            className="p-2.5 cursor-pointer flex items-center justify-between group"
                            onClick={() =>
                              setExpandedSegments((p) =>
                                p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                              )
                            }
                          >
                            <div className="flex flex-col text-left">
                              <div className="flex items-center gap-2 text-left">
                                <span className="text-[10px] font-black text-slate-700 uppercase leading-none text-left">
                                  {segment}
                                </span>
                                {allSelected ? (
                                  <CheckCircle2 className="h-3 w-3 text-indigo-600 shrink-0" />
                                ) : (
                                  selectedInSector > 0 && (
                                    <span className="text-[8px] font-bold text-indigo-600 shrink-0">• {selectedInSector}</span>
                                  )
                                )}
                              </div>
                              <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 text-left">
                                {t("radar.posts_count", { count: data.totalJobs })}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSector(segment);
                              }}
                              className={cn(
                                "h-6 text-[7px] font-black px-1.5 border",
                                allSelected ? "bg-indigo-600 text-white" : "text-indigo-600 border-indigo-100",
                              )}
                            >
                              {allSelected ? t("radar.remove") : t("radar.add")}
                            </Button>
                          </div>
                          {expandedSegments.includes(segment) && (
                            <div className="p-2 bg-slate-50 border-t border-slate-100 flex flex-col gap-1 text-left">
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
                                    "p-1.5 rounded-lg border text-left text-[9px] font-bold transition-all flex justify-between items-center",
                                    selectedCategories.includes(cat.raw_category)
                                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                                      : "bg-white text-slate-500 hover:border-indigo-200",
                                  )}
                                >
                                  {cat.raw_category} <span className="text-[8px] opacity-60">({cat.count})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-4 text-left">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 text-left">
            <div className="text-left">
              <h2 className="text-xl font-black uppercase italic text-slate-900 flex items-center gap-3 text-left">
                <Target className="h-6 w-6 text-indigo-600" /> {t("radar.matches_title")}
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 text-left">
                {t("radar.matches_subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={fetchMatches} className="text-slate-400 hover:text-indigo-600">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Badge className="bg-indigo-600 text-white font-black px-4 py-1.5 shadow-lg">
                {t("radar.matches_count", { count: matchCount })}
              </Badge>
            </div>
          </div>
          {matchedJobs.length > 0 && (
            <Button
              onClick={handleSendAll}
              disabled={batchSending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 rounded-xl shadow-lg border-b-4 border-emerald-800 flex items-center justify-center gap-3 transition-all uppercase text-[10px]"
            >
              <Zap className="h-5 w-5 fill-white" /> {t("radar.send_all", { count: matchCount })}
            </Button>
          )}
          <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[75vh] pr-2 custom-scrollbar text-left">
            {matchedJobs.length > 0 ? (
              matchedJobs.map((match) => {
                const job = match.public_jobs;
                if (!job) return null;
                return (
                  <Card
                    key={match.id}
                    className="group border-slate-200 bg-white hover:border-indigo-400 transition-all shadow-sm overflow-hidden text-left"
                  >
                    <CardContent className="p-0 flex flex-col md:flex-row md:items-stretch text-left">
                      <div className="p-4 flex-1 space-y-2.5 text-left">
                        <div className="flex items-center gap-2 text-left">
                          <Badge className="bg-indigo-50 text-indigo-600 text-[9px] border-indigo-100 font-black px-2">
                            {job.visa_type}
                          </Badge>
                          {job.randomization_group && (
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 border flex items-center gap-1.5 transition-all shadow-sm",
                                getGroupStyles(job.randomization_group),
                              )}
                            >
                              <Layers className="h-2.5 w-2.5" /> {t("radar.group_label", { group: job.randomization_group })}
                            </Badge>
                          )}
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 border-l border-slate-100 pl-2 font-mono text-left">
                            <MapPin className="h-3 w-3" /> {job.state}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight text-left">
                          {job.category}
                        </h3>
                        <div className="flex items-center gap-2 border-l-2 border-indigo-600 pl-3 py-1 bg-slate-50/50 text-left">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-[11px] font-black text-indigo-900 uppercase italic leading-none text-left">
                            {job.company || t("radar.company_fallback")}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 pt-2 text-left">
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <CircleDollarSign className="h-3.5 w-3.5 text-indigo-600" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> {job.experience_months || 0}m exp
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-4 flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 min-w-[160px] text-center">
                        <Button
                          onClick={() => handleSendApplication(match.id, job.id)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-9 px-6 rounded-xl shadow-md w-full transition-all active:translate-y-0.5 border-b-2 border-emerald-900 uppercase tracking-widest text-center"
                        >
                          {t("radar.send")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                          className="text-[9px] font-black h-8 w-full border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-2 uppercase tracking-widest text-center"
                        >
                          {t("radar.hub")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => removeMatch(match.id)}
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 transition-colors text-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-32 bg-slate-50/30 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-5 text-center">
                <Radio className="h-14 w-14 text-slate-200 animate-pulse" />
                <div className="space-y-1 text-center">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">{t("radar.waiting_signals")}</p>
                  <p className="text-[10px] text-slate-400 text-center">
                    {t("radar.waiting_signals_desc")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
