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

    <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
      {job.category}
    </h3>

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
  landscaping: ["Landscaping", "Groundskeeping", "Tree Trimmers"],
  logistics: ["Laborers and Freight", "Stockers", "Packers", "Material Movers", "Order Fillers"],
  transport: ["Truck Drivers", "Shuttle", "Chauffeurs", "Delivery"],
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
          for (const [key, kws] of Object.entries(SECTOR_KEYWORDS)) {
            if (kws.some((kw) => raw.toLowerCase().includes(kw.toLowerCase()))) {
              segment = key;
              break;
            }
          }
          const name = t(`radar.sectors.${segment}`, segment);
          if (!acc[name]) acc[name] = { items: [], totalJobs: 0 };
          acc[name].items.push(curr);
          acc[name].totalJobs += curr.count || 0;
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
      const validMatches = (data as any[]).filter(
        (m: any) => m.public_jobs && m.public_jobs.is_active !== false && !m.public_jobs.is_banned,
      );
      setMatchedJobs(validMatches);
      setMatchCount(validMatches.length);
    }
  };

  // --- RESTORED HANDLERS ---
  const handleSendApplication = async (matchId: string, jobId: string) => {
    if (!profile?.id) return;
    try {
      await supabase.from("my_queue").insert([{ user_id: profile.id, job_id: jobId, status: "pending" }]);
      await supabase.from("radar_matched_jobs").delete().eq("id", matchId);
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => Math.max(0, prev - 1));
      toast({ title: "Application added to queue" });
    } catch (err) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const removeMatch = async (matchId: string) => {
    try {
      await supabase.from("radar_matched_jobs").delete().eq("id", matchId);
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast({ title: "Error", variant: "destructive" });
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
        fetchMatches();
        updateStats();
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
      const { data } = await supabase
        .from("radar_profiles" as any)
        .select("*")
        .eq("user_id", profile.id)
        .single();
      if (data) {
        setRadarProfile(data);
        setIsActive(data.is_active ?? false);
        setRadarMode(data.auto_send ? "autopilot" : "manual");
        setSelectedCategories(data.categories || []);
        setMinWage(data.min_wage?.toString() || "");
        setMaxExperience(data.max_experience?.toString() || "");
        setVisaType(data.visa_type || "all");
        setStateFilter(data.state || "all");
        setGroupFilter(data.randomization_group || "all");
      }
      setLoading(false);
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

                    {/* REFINED PREMIUM BADGE - Corrected */}
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
            </div>
          </div>

          {/* Controls */}
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
                      "flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all border",
                      radarMode === mode ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/25 border-border",
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
                  "w-full h-12 rounded-lg font-bold",
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

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Live Signals", val: formatNumber(totalSinaisGeral), icon: Activity },
          { label: "Active Matches", val: formatNumber(matchCount), icon: Target },
          { label: "Sectors", val: formatNumber(selectedCategories.length), icon: Globe },
          { label: "Frequency", val: "Daily", icon: Clock },
        ].map((m, i) => (
          <HeroPanel key={i} className="p-0 overflow-hidden">
            <MetricCard label={m.label} value={m.val} icon={m.icon} />
          </HeroPanel>
        ))}
      </div>

      {/* SYNCED HEIGHT COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-stretch">
        <div className="lg:col-span-4 flex flex-col space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary/60" /> Sector Targeting
            </h2>
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
        </div>

        <div className="lg:col-span-3 flex flex-col space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary/60" /> Live Feed
            </h2>
          </div>
          <div className="rounded-3xl bg-muted/20 border border-border p-1.5 flex-1">
            <HeroPanel className="p-0 border-0 shadow-none h-full">
              <ScrollArea className="h-[600px]">
                <div className="p-6 space-y-4">
                  {matchedJobs.length > 0 ? (
                    matchedJobs.map((match) => (
                      <JobCard
                        key={match.id}
                        job={match.public_jobs}
                        match={match}
                        onApply={handleSendApplication}
                        onView={(id: any) => window.open(`/jobs/${id}`, "_blank")}
                        onDismiss={removeMatch}
                      />
                    ))
                  ) : (
                    <div className="h-[550px] flex flex-col items-center justify-center text-center opacity-40">
                      <Search className="h-10 w-10 mb-4" />
                      <p className="text-xs font-bold uppercase tracking-widest">Scanning...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </HeroPanel>
          </div>
        </div>
      </div>

      {/* FILTER DIALOG */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-2xl rounded-3xl p-8">
          <DialogTitle>Advanced Filters</DialogTitle>
          <div className="grid grid-cols-2 gap-8 py-6">
            <div className="space-y-4">
              <Label>Min Salary</Label>
              <Input type="number" value={minWage} onChange={(e) => setMinWage(e.target.value)} />
            </div>
            <div className="space-y-4">
              <Label>State</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger>
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
          </div>
          <Button
            onClick={() => {
              setShowFilters(false);
              performSave();
            }}
            className="w-full h-11"
          >
            Apply
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
