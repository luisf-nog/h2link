import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import { formatNumber } from "@/lib/number";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Target,
  Trash2,
  Send,
  MapPin,
  CircleDollarSign,
  Briefcase,
  ChevronRight,
  Crown,
  Sparkles,
  Clock,
  Activity,
  Search,
  Filter,
  Globe,
  Settings2,
  Eye,
  HelpCircle,
  Zap,
  CheckCircle2,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Minimalist Premium Components ---

const HeroPanel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={cn(
      "relative rounded-3xl border border-border bg-card",
      "shadow-[0_4px_20px_-4px_hsl(var(--foreground)/0.08),0_8px_32px_-8px_hsl(var(--foreground)/0.06)]",
      "ring-1 ring-inset ring-border/30 overflow-hidden",
      className,
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.015] via-transparent to-transparent pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

const MetricCard = ({
  label,
  value,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: React.ReactNode;
  icon: any;
  subtitle?: string;
}) => (
  <div className="flex flex-col gap-3 p-6">
    <div className="flex items-center justify-between">
      <Icon className="h-4 w-4 text-muted-foreground/60" />
      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">{label}</span>
    </div>
    <div className="space-y-1">
      <div className="text-[34px] leading-none font-bold tracking-tight text-foreground">{value}</div>
      {subtitle && <p className="text-[11px] text-muted-foreground/70">{subtitle}</p>}
    </div>
  </div>
);

const SectorCard = ({
  segment,
  data,
  isTracked,
  isExpanded,
  onToggleAllInSector,
  onExpand,
}: {
  segment: string;
  data: { items: any[]; totalJobs: number };
  isTracked: string[];
  isExpanded: boolean;
  onToggleAllInSector: () => void;
  onExpand: () => void;
}) => {
  const totalInSector = data.items.length;
  const selectedInSector = data.items.filter((i: any) => isTracked.includes(i.raw_category)).length;

  const allSelected = totalInSector > 0 && selectedInSector === totalInSector;
  const partialSelected = selectedInSector > 0 && !allSelected;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border transition-all duration-300 overflow-hidden",
        "p-5 cursor-pointer",
        allSelected
          ? "border-primary/30 bg-primary/[0.05] shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.15)]"
          : partialSelected
            ? "border-primary/20 bg-primary/[0.025] hover:border-primary/25 hover:bg-primary/[0.035]"
            : "border-border bg-card hover:border-primary/20 hover:bg-card/90 hover:shadow-sm",
      )}
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onExpand();
      }}
    >
      {/* Left indicator bar */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
          allSelected ? "bg-primary" : partialSelected ? "bg-primary/45" : "bg-transparent group-hover:bg-primary/20",
        )}
      />

      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => onToggleAllInSector()}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                {segment}
              </h3>
              <div className="flex items-center gap-2 text-[11px] mt-1">
                <span className="text-muted-foreground/70">{formatNumber(data.totalJobs)} opportunities</span>

                {allSelected && (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold"
                  >
                    Monitoring
                  </Badge>
                )}

                {partialSelected && (
                  <Badge
                    variant="outline"
                    className="bg-primary/5 text-primary/70 border-primary/15 text-[9px] font-bold"
                  >
                    Partial
                  </Badge>
                )}

                {totalInSector > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground/50">
                    {selectedInSector}/{totalInSector}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {data.items.length > 1 && (
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground/50 transition-transform duration-300 mt-1",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </div>

      {/* Expanded subcategories */}
      {isExpanded && data.items.length > 1 && (
        <div className="mt-5 pt-5 border-t border-border/30 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {data.items.map((item: any) => {
            const checked = isTracked.includes(item.raw_category);
            return (
              <div key={item.raw_category} className="flex items-center justify-between pl-9">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      checked ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  />
                  <span className="text-[12px] text-muted-foreground/80 truncate">{item.raw_category}</span>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground/45">{formatNumber(item.count)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const JobCard = ({ job, match, onApply, onView, onDismiss }: any) => (
  <div className="group relative rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300 p-5 space-y-4">
    {/* Top metadata */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] font-bold border-border bg-muted/40">
          {job.visa_type}
        </Badge>
        <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {job.state}
        </span>
      </div>
      <span className="text-[9px] text-muted-foreground/45">Detected recently</span>
    </div>

    {/* Job title */}
    <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
      {job.category}
    </h3>

    {/* Key metrics */}
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">Salary</span>
        <span className="text-sm font-bold text-foreground">${job.salary ? formatNumber(job.salary) : "N/A"}/hr</span>
      </div>
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">Exp</span>
        <span className="text-sm font-bold text-foreground">{job.experience_months || 0}m</span>
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex items-center gap-2 pt-2">
      <Button
        onClick={() => onApply(match.id, job.id)}
        className="flex-1 h-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-bold text-sm transition-all"
      >
        <Send className="h-4 w-4 mr-2" /> Apply
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onView(job.id)}
        className="h-10 w-10 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDismiss(match.id)}
        className="h-10 w-10 rounded-lg border border-border hover:border-destructive/30 hover:bg-destructive/5 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
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
  const [matchCount, setMatchCount] = useState(0);
  const [queuedFromRadar, setQueuedFromRadar] = useState(0);
  const [totalRawMatches, setTotalRawMatches] = useState(0);
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [groupedCategories, setGroupedCategories] = useState<Record<string, { items: any[]; totalJobs: number }>>({});
  const [radarProfile, setRadarProfile] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

  const [isActive, setIsActive] = useState(false);
  const [radarMode, setRadarMode] = useState<"manual" | "autopilot">("manual");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

  const sectorEntries = useMemo(() => Object.entries(groupedCategories).sort(), [groupedCategories]);

  const totalSinaisGeral = useMemo(
    () => Object.values(groupedCategories).reduce((acc, curr) => acc + (curr.totalJobs || 0), 0),
    [groupedCategories],
  );

  const hasChangesComputed = useMemo(() => {
    if (!radarProfile) return selectedCategories.length > 0;
    return (
      isActive !== (radarProfile.is_active ?? false) ||
      radarMode !== (radarProfile.auto_send ? "autopilot" : "manual") ||
      JSON.stringify([...selectedCategories].sort()) !== JSON.stringify([...(radarProfile.categories || [])].sort()) ||
      minWage !== (radarProfile.min_wage?.toString() || "") ||
      maxExperience !== (radarProfile.max_experience?.toString() || "") ||
      visaType !== (radarProfile.visa_type || "all") ||
      stateFilter !== (radarProfile.state || "all") ||
      groupFilter !== (radarProfile.randomization_group || "all")
    );
  }, [
    isActive,
    radarMode,
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
      .select(`id, job_id, auto_queued, public_jobs!fk_radar_job (*)`)
      .eq("user_id", profile.id);

    if (data) {
      const allData = data as any[];
      setTotalRawMatches(allData.length);
      const validMatches = allData.filter(
        (m: any) => m.public_jobs && m.public_jobs.is_active !== false && m.public_jobs.is_banned !== true,
      );
      const jobIds = validMatches.map((m: any) => m.job_id);

      if (jobIds.length > 0) {
        const { data: queuedJobs } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in("job_id", jobIds);

        const queuedSet = new Set((queuedJobs || []).map((q: any) => q.job_id));
        const finalMatches = validMatches.filter((m: any) => !queuedSet.has(m.job_id));
        setQueuedFromRadar(validMatches.length - finalMatches.length);
        setMatchedJobs(finalMatches);
        setMatchCount(finalMatches.length);
      } else {
        setQueuedFromRadar(0);
        setMatchedJobs(validMatches);
        setMatchCount(validMatches.length);
      }
    }
  };

  const performSave = async (overrides: Record<string, any> = {}) => {
    if (!profile?.id) return;
    setSaving(true);
    const payload = {
      user_id: profile.id,
      is_active: isActive,
      auto_send: radarMode === "autopilot",
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
          const d = data as any;
          setRadarProfile(d);
          setIsActive(d.is_active ?? false);
          setRadarMode(d.auto_send ? "autopilot" : "manual");
          setSelectedCategories(d.categories || []);
          setMinWage(d.min_wage?.toString() || "");
          setMaxExperience(d.max_experience?.toString() || "");
          setVisaType(d.visa_type || "all");
          setStateFilter(d.state || "all");
          setGroupFilter(d.randomization_group || "all");
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
  useEffect(() => {
    if (!loading) updateStats();
  }, [visaType, stateFilter, minWage, maxExperience, groupFilter, loading]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
      </div>
    );

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 p-6 md:p-12 animate-in fade-in duration-700">
      <HeroPanel className="p-8">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/6 border border-primary/15">
                  <Crown className="h-5 w-5 text-primary/70" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {t("radar.title", "Radar Jobs")}
                    </h1>

                    {/* REFINED PREMIUM BADGE - Surgical Update */}
                    <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400">
                      <div className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                        {t("radar.premium_access", "Premium Access")}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">
                    {t("radar.premium_edition", "Premium Edition")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHowItWorks(true)}
                className="text-xs font-semibold text-muted-foreground hover:text-primary gap-1.5 h-8"
              >
                <HelpCircle className="h-3.5 w-3.5" /> Como funciona?
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/6 border border-success/20">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold text-success/80 uppercase tracking-widest">System Online</span>
              </div>
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="flex flex-wrap gap-2">
            {[
              { icon: CircleDollarSign, label: minWage ? `$${formatNumber(Number(minWage))}+/hr` : "Any salary" },
              { icon: MapPin, label: stateFilter !== "all" ? stateFilter : "All States" },
              { icon: Briefcase, label: maxExperience ? `Up to ${maxExperience}mo exp` : "Any experience" },
              { icon: Globe, label: visaType !== "all" ? visaType : "All Visas" },
            ].map((f, i) => (
              <button
                key={i}
                onClick={() => setShowFilters(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors shadow-sm"
              >
                <f.icon className="h-3.5 w-3.5 text-primary/60" /> {f.label}
              </button>
            ))}
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                Radar Mode
              </label>
              <div className="flex gap-3">
                {(["manual", "autopilot"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRadarMode(mode)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border",
                      radarMode === mode
                        ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                        : "bg-muted/25 border-border text-foreground/70",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                Scan Control
              </label>
              <Button
                onClick={() => {
                  const next = !isActive;
                  setIsActive(next);
                  performSave({ is_active: next });
                }}
                className={cn(
                  "w-full h-12 rounded-lg font-bold uppercase tracking-wider",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {isActive ? "Pause Radar" : "Start Radar"}
              </Button>
            </div>
          </div>
        </div>
      </HeroPanel>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Live Signals", val: formatNumber(totalSinaisGeral), icon: Activity, sub: "Opportunities detected" },
          {
            label: "Active Matches",
            val: formatNumber(matchCount),
            icon: Target,
            sub: `${formatNumber(queuedFromRadar)} sent to queue`,
          },
          {
            label: "Sectors Monitored",
            val: formatNumber(selectedCategories.length),
            icon: Globe,
            sub: "Active tracking",
          },
          { label: "Scan Frequency", val: "Daily", icon: Clock, sub: "New jobs daily" },
        ].map((m, i) => (
          <HeroPanel key={i} className="p-0 overflow-hidden">
            <MetricCard label={m.label} value={m.val} icon={m.icon} subtitle={m.sub} />
          </HeroPanel>
        ))}
      </div>

      <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-muted/30 border border-border">
        <Sparkles className="h-4 w-4 text-primary/60" />
        <p className="text-sm text-muted-foreground/80">
          Matching based on <span className="font-semibold text-foreground">salary</span>,{" "}
          <span className="font-semibold text-foreground">sector</span>, and{" "}
          <span className="font-semibold text-foreground">location</span>.
        </p>
      </div>

      {/* LEVEL 3: CONFIGURATION & LIVE FEED - HEIGHT SYNCED */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-stretch">
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary/60" /> Sector Targeting
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(true)}
              className="text-xs font-bold hover:bg-primary/5 h-8"
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Filters
            </Button>
          </div>
          <div className="rounded-3xl bg-muted/20 border border-border p-1.5 flex-1">
            <HeroPanel className="p-0 border-0 shadow-none h-full">
              <ScrollArea className="h-[600px]">
                <div className="space-y-3 p-6">
                  {sectorEntries.map(([segment, data]) => (
                    <SectorCard
                      key={segment}
                      segment={segment}
                      data={data}
                      isTracked={selectedCategories}
                      isExpanded={expandedSectors.has(segment)}
                      onToggleAllInSector={() => {
                        const sectorCats = data.items.map((i: any) => i.raw_category);
                        setSelectedCategories((prev) =>
                          selectedCategories.includes(sectorCats[0])
                            ? prev.filter((c) => !sectorCats.includes(c))
                            : [...new Set([...prev, ...sectorCats])],
                        );
                      }}
                      onExpand={() => {
                        const next = new Set(expandedSectors);
                        expandedSectors.has(segment) ? next.delete(segment) : next.add(segment);
                        setExpandedSectors(next);
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            </HeroPanel>
          </div>
          {hasChangesComputed && (
            <Button
              onClick={() => performSave()}
              disabled={saving}
              className="w-full h-12 rounded-lg bg-foreground text-background font-bold uppercase tracking-wider"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />} Save
              Configuration
            </Button>
          )}
        </div>

        <div className="lg:col-span-3 space-y-6 flex flex-col">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary/60" /> Live Feed
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-muted-foreground/50 uppercase">Real-time</span>
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            </div>
          </div>
          <div className="rounded-3xl bg-muted/20 border border-border p-1.5 flex-1">
            <HeroPanel className="p-0 border-0 shadow-none h-full flex flex-col">
              <ScrollArea className="h-[600px]">
                <div className="p-6 space-y-4">
                  {matchedJobs.length > 0 ? (
                    matchedJobs.map(
                      (match) =>
                        match.public_jobs && (
                          <JobCard
                            key={match.id}
                            job={match.public_jobs}
                            match={match}
                            onApply={handleSendApplication}
                            onView={(id: any) => window.open(`/jobs/${id}`, "_blank")}
                            onDismiss={removeMatch}
                          />
                        ),
                    )
                  ) : (
                    <div className="h-[550px] flex flex-col items-center justify-center text-center space-y-6">
                      <div className="relative">
                        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-xl" />
                        <div className="relative p-6 rounded-full bg-primary/5 border border-primary/10">
                          <Search className="h-8 w-8 text-primary/40" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Scanning frequencies...</p>
                        <p className="text-xs text-muted-foreground/70 max-w-[240px]">
                          No signals detected. Configure targeting to begin.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </HeroPanel>
          </div>
        </div>
      </div>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-2xl rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-muted-foreground/60">Minimum Salary</Label>
                <div className="relative">
                  <CircleDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-11 pl-11 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-muted-foreground/60">Max Experience</Label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-11 pl-11 rounded-lg"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-muted-foreground/60">State</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-muted-foreground/60">Visa Type</Label>
                <Select value={visaType} onValueChange={setVisaType}>
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISA_TYPE_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
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
            className="w-full h-11 rounded-lg"
          >
            Apply Filters
          </Button>
        </DialogContent>
      </Dialog>

      <div className="pt-8 border-t border-border flex items-center justify-between text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">
        <span>H2 Link Radar • Premium Edition</span>
        <span>v4.1.0</span>
      </div>
    </div>
  );
}
