import { useEffect, useState, useMemo, useRef } from "react";
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
  Activity,
  Shield,
  Search,
  Filter,
  ArrowUpRight,
  BarChart3,
  Globe,
  ZapOff,
  MousePointer2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Custom Components for High-End Feel ---

const GlassCard = ({
  children,
  className,
  active = false,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-2xl border transition-all duration-500",
      active
        ? "border-primary/40 bg-primary/[0.03] shadow-[0_0_40px_-15px_rgba(var(--primary),0.2)]"
        : "border-border/50 bg-card/50 backdrop-blur-md hover:border-primary/20",
      className,
    )}
  >
    {active && (
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
    )}
    {children}
  </div>
);

const AnimatedPulse = () => (
  <div className="relative flex h-3 w-3">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
  </div>
);

const StatBadge = ({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: any;
  trend?: string;
}) => (
  <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border/50">
    <div className="flex items-center justify-between">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {trend && (
        <span className="text-[10px] font-bold text-success flex items-center">
          {trend} <ArrowUpRight className="h-2 w-2" />
        </span>
      )}
    </div>
    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
    <span className="text-lg font-bold text-foreground tracking-tight">{value}</span>
  </div>
);

// --- Main Component ---

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
          const sectorName = t(`radar.sectors.${segment}`, segment);
          if (!acc[sectorName]) acc[sectorName] = { items: [], totalJobs: 0 };
          acc[sectorName].items.push(curr);
          acc[sectorName].totalJobs += curr.count || 0;
          return acc;
        }, {});
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
      if (isActive) fetchMatches();
    }
  }, [loading, isActive]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
      </div>
    );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-700">
      {/* --- HEADER SECTION: Immersive Glass Design --- */}
      <header className="relative flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-2">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
              <Satellite className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-foreground uppercase italic">Radar</h1>
                <Badge className="bg-plan-diamond text-white border-0 text-[10px] font-black px-2 py-0.5 rounded-sm tracking-tighter">
                  PREMIUM
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <AnimatedPulse />
                <span className="text-xs font-bold uppercase tracking-widest opacity-70">
                  {isActive ? "System Online" : "System Standby"}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-md font-medium leading-relaxed">
            Algoritmo de varredura em tempo real para detecção de oportunidades H2B.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <GlassCard
            className="flex items-center gap-4 px-6 py-3 border-primary/20 bg-primary/[0.02]"
            active={isActive}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Autopilot</span>
              <span className="text-sm font-bold">{autoSend ? "ENABLED" : "DISABLED"}</span>
            </div>
            <Switch
              checked={autoSend}
              onCheckedChange={(v) => {
                setAutoSend(v);
                if (v) performSave({ auto_send: true });
              }}
              className="data-[state=checked]:bg-primary"
            />
          </GlassCard>

          <Button
            onClick={() => {
              setIsActive(!isActive);
              performSave({ is_active: !isActive });
            }}
            className={cn(
              "h-14 px-8 rounded-2xl font-black uppercase tracking-widest transition-all duration-500 shadow-xl",
              isActive
                ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20"
                : "bg-primary hover:bg-primary/90 shadow-primary/20",
            )}
          >
            {isActive ? (
              <Pause className="mr-2 h-5 w-5 fill-current" />
            ) : (
              <Play className="mr-2 h-5 w-5 fill-current" />
            )}
            {isActive ? "Stop Scan" : "Start Scan"}
          </Button>
        </div>
      </header>

      {/* --- ANALYTICS BAR --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBadge label="Live Signals" value={totalSinaisGeral} icon={Activity} trend="+12%" />
        <StatBadge label="Active Matches" value={matchCount} icon={Target} />
        <StatBadge label="Monitored Sectors" value={selectedCategories.length} icon={Globe} />
        <StatBadge label="Scan Frequency" value="24/7" icon={Clock} />
      </div>

      {/* --- MAIN INTERFACE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Configuration & Targeting (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" /> Targeting Configuration
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(true)}
              className="text-xs font-bold uppercase tracking-widest hover:bg-primary/5"
            >
              <Settings2 className="h-4 w-4 mr-2" /> Advanced Filters
            </Button>
          </div>

          <GlassCard className="p-1">
            <ScrollArea className="h-[600px] px-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
                {sectorEntries.map(([segment, data]) => {
                  const selectedInSector = data.items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                  const isTracked = selectedInSector > 0;
                  const isExpanded = expandedSectors.has(segment);

                  return (
                    <div
                      key={segment}
                      className={cn(
                        "group relative rounded-xl border p-4 transition-all duration-300 cursor-pointer overflow-hidden",
                        isTracked
                          ? "border-primary/40 bg-primary/[0.04]"
                          : "border-border/40 bg-muted/10 hover:border-primary/20",
                      )}
                      onClick={() =>
                        setExpandedSectors((prev) => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(segment) : next.add(segment);
                          return next;
                        })
                      }
                    >
                      {/* Background Decoration */}
                      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <BarChart3 className="h-24 w-24" />
                      </div>

                      <div className="relative z-10 flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors">
                            {segment}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold border-primary/20 bg-primary/5 text-primary"
                            >
                              {data.totalJobs} SIGNALS
                            </Badge>
                            {isTracked && (
                              <Badge className="text-[9px] font-bold bg-success/20 text-success border-0">
                                MONITORING
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Checkbox
                          checked={isTracked}
                          onCheckedChange={() => {
                            const sectorCats = data.items.map((i) => i.raw_category);
                            setSelectedCategories((prev) =>
                              isTracked
                                ? prev.filter((c) => !sectorCats.includes(c))
                                : [...new Set([...prev, ...sectorCats])],
                            );
                          }}
                          className="mt-1 border-primary/30 data-[state=checked]:bg-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-primary/10 space-y-2 animate-in slide-in-from-top-2 duration-300">
                          {data.items.map((item) => (
                            <div key={item.raw_category} className="flex items-center justify-between group/item">
                              <span className="text-[11px] font-medium text-muted-foreground group-hover/item:text-foreground transition-colors">
                                {item.raw_category}
                              </span>
                              <span className="text-[10px] font-black text-primary/40">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </GlassCard>

          {hasChangesComputed && (
            <Button
              onClick={() => performSave()}
              disabled={saving}
              className="w-full h-14 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98]"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 mr-2" />}
              Commit Configuration
            </Button>
          )}
        </div>

        {/* RIGHT: Live Feed (5/12) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Live Detection Feed
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Real-time</span>
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            </div>
          </div>

          <GlassCard className="flex-1 flex flex-col min-h-[600px]">
            <ScrollArea className="flex-1 h-[600px]">
              <div className="p-4 space-y-4">
                {matchedJobs.length > 0 ? (
                  matchedJobs.map((match, idx) => {
                    const job = match.public_jobs;
                    if (!job) return null;
                    return (
                      <div
                        key={match.id}
                        className="group relative p-5 rounded-2xl border border-border/50 bg-card/30 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-300 animate-in fade-in slide-in-from-right-4"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[9px] font-black tracking-tighter bg-muted/50">
                                {job.visa_type}
                              </Badge>
                              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {job.state}
                              </span>
                            </div>
                            <h3 className="text-base font-black leading-tight tracking-tight group-hover:text-primary transition-colors">
                              {job.category}
                            </h3>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                  Salary
                                </span>
                                <span className="text-sm font-bold text-foreground">${job.salary || "N/A"}/hr</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                  Experience
                                </span>
                                <span className="text-sm font-bold text-foreground">{job.experience_months || 0}m</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              size="icon"
                              onClick={() => handleSendApplication(match.id, job.id)}
                              className="h-12 w-12 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:scale-110 transition-transform"
                            >
                              <Send className="h-5 w-5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                              className="h-10 w-10 rounded-xl border-border/50 hover:bg-primary/5"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground italic">
                            Detected {idx + 1}m ago
                          </span>
                          <button
                            onClick={() => removeMatch(match.id)}
                            className="text-[10px] font-black text-muted-foreground hover:text-destructive uppercase tracking-widest transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-[500px] flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                      <div className="relative p-8 rounded-full bg-primary/5 border border-primary/10">
                        <Search className="h-12 w-12 text-primary" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-black uppercase tracking-tighter">Scanning Frequencies...</p>
                      <p className="text-xs font-medium max-w-[200px] mx-auto">
                        No signals detected in the current targeting parameters.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {matchedJobs.length > 0 && (
              <div className="p-4 border-t border-border/50 bg-muted/10">
                <Button className="w-full h-12 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-black uppercase tracking-widest">
                  Batch Process Signals ({matchCount})
                </Button>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* --- FILTERS DIALOG: Custom High-End Styling --- */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-primary/20 rounded-[2rem] p-8">
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Settings2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
                  Targeting Parameters
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                  Refine your detection algorithm
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Minimum Compensation
                </Label>
                <div className="relative">
                  <CircleDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-14 pl-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary/50 font-bold text-lg"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">
                    USD/HR
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Max Experience Required
                </Label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-14 pl-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary/50 font-bold text-lg"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">
                    YEARS
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Geographic Focus
                </Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-14 rounded-xl bg-muted/30 border-border/50 font-bold">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/20">
                    <SelectItem value="all" className="font-bold">
                      GLOBAL (ALL STATES)
                    </SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s} className="font-bold">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Visa Classification
                </Label>
                <Select value={visaType} onValueChange={setVisaType}>
                  <SelectTrigger className="h-14 rounded-xl bg-muted/30 border-border/50 font-bold">
                    <SelectValue placeholder="All Visas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/20">
                    <SelectItem value="all" className="font-bold">
                      ALL CLASSIFICATIONS
                    </SelectItem>
                    {VISA_TYPE_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v} className="font-bold">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button
            onClick={() => {
              setShowFilters(false);
              performSave();
            }}
            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black uppercase tracking-widest shadow-xl shadow-primary/20"
          >
            Apply Parameters
          </Button>
        </DialogContent>
      </Dialog>

      {/* --- FOOTER: System Status --- */}
      <footer className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 opacity-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Secure Scan Protocol</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Multi-Region Detection</span>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">H2 Link Radar v4.0.2 — Premium Edition</span>
      </footer>
    </div>
  );
}
