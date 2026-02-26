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
  Sparkles,
  Clock,
  Activity,
  Search,
  Filter,
  Globe,
  Settings2,
  Eye,
  HelpCircle,
  
  CheckCircle2,
  Rocket,
  Radar as RadarIcon,
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
  onToggleSubcategory,
  onExpand,
  t,
}: {
  segment: string;
  data: { items: any[]; totalJobs: number };
  isTracked: string[];
  isExpanded: boolean;
  onToggleAllInSector: () => void;
  onToggleSubcategory: (rawCategory: string) => void;
  onExpand: () => void;
  t: (key: string, opts?: any) => string;
}) => {
  const totalInSector = data.items.length;
  const selectedInSector = data.items.filter((i: any) => isTracked.includes(i.raw_category)).length;

  const allSelected = totalInSector > 0 && selectedInSector === totalInSector;
  const partialSelected = selectedInSector > 0 && !allSelected;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border transition-all duration-300 overflow-hidden",
        "p-4 cursor-pointer",
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

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2.5">
            <div
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={allSelected ? true : partialSelected ? "indeterminate" : false}
                onCheckedChange={() => onToggleAllInSector()}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary/60 data-[state=indeterminate]:border-primary/60"
              />
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                {segment}
              </h3>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-muted-foreground/70">{formatNumber(data.totalJobs)} {t("radar.ui.opportunities")}</span>

                {allSelected && (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20 text-[8px] font-bold px-1.5 py-0"
                  >
                    {t("radar.ui.all_selected")}
                  </Badge>
                )}

                {partialSelected && (
                  <Badge
                    variant="outline"
                    className="bg-primary/5 text-primary/70 border-primary/15 text-[8px] font-bold px-1.5 py-0"
                  >
                    {selectedInSector} {t("radar.ui.of")} {totalInSector}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

      {data.items.length > 0 && (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-300 mt-1",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </div>

      {/* Expanded subcategories with individual checkboxes */}
      {isExpanded && data.items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/30 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] pl-8 pb-1.5">
            {t("radar.ui.subcategories")}
          </p>
          {data.items.map((item: any) => {
            const checked = isTracked.includes(item.raw_category);
            return (
              <div
                key={item.raw_category}
                className={cn(
                  "flex items-center justify-between pl-8 pr-2 py-1.5 rounded-lg transition-colors",
                  checked ? "bg-primary/[0.04]" : "hover:bg-muted/30",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSubcategory(item.raw_category);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggleSubcategory(item.raw_category)}
                    onClick={(e) => e.stopPropagation()}
                    className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary h-3.5 w-3.5"
                  />
                  <span className={cn(
                    "text-[11px] truncate transition-colors",
                    checked ? "text-foreground font-medium" : "text-muted-foreground/80",
                  )}>
                    {item.raw_category}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-muted-foreground/45 tabular-nums">{formatNumber(item.count)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const JobCard = ({ job, match, onApply, onView, onDismiss, t }: any) => (
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
      <span className="text-[9px] text-muted-foreground/45">{t("radar.ui.detected_recently")}</span>
    </div>

    {/* Job title */}
    <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
      {job.category}
    </h3>

    {/* Key metrics */}
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{t("radar.ui.salary")}</span>
        <span className="text-sm font-bold text-foreground">${job.salary ? formatNumber(job.salary) : "N/A"}/hr</span>
      </div>
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{t("radar.ui.experience_short")}</span>
        <span className="text-sm font-bold text-foreground">{job.experience_months || 0}m</span>
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex items-center gap-2 pt-2">
      <Button
        onClick={() => onApply(match.id, job.id)}
        className="flex-1 h-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-bold text-sm transition-all"
      >
        <Send className="h-4 w-4 mr-2" /> {t("radar.send")}
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

// --- Sonar Radar Icon ---
const SonarRadarIcon = ({ isActive }: { isActive: boolean }) => (
  <div className="relative p-3 rounded-xl bg-primary/6 border border-primary/15">
    {isActive && (
      <>
        <div className="absolute inset-0 rounded-xl bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="absolute inset-0 rounded-xl bg-primary/5 animate-ping" style={{ animationDuration: "3s", animationDelay: "0.5s" }} />
      </>
    )}
    <RadarIcon className={cn("h-7 w-7 relative z-10", isActive ? "text-primary" : "text-primary/70")} />
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

      const validMatches = allData.filter((m: any) => {
        const job = m.public_jobs;
        if (!job) return false;
        if (job.is_active === false) return false;
        if (job.is_banned === true) return false;
        return true;
      });

      const autoQueuedCount = allData.filter((m: any) => m.auto_queued).length;

      const jobIds = validMatches.map((m: any) => m.job_id);
      if (jobIds.length > 0) {
        const { data: queuedJobs } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("user_id", profile.id)
          .in("job_id", jobIds);

        const queuedSet = new Set((queuedJobs || []).map((q: any) => q.job_id));
        const queuedCount = validMatches.filter((m: any) => queuedSet.has(m.job_id)).length;
        const finalMatches = validMatches.filter((m: any) => !queuedSet.has(m.job_id));

        setQueuedFromRadar(queuedCount);
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
    } else {
      toast({ title: t("radar.toast_error"), variant: "destructive" });
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

      toast({ title: t("radar.toast_captured") });
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

        const seenKey = "radar_how_it_works_seen";
        if (!localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, "1");
          setTimeout(() => setShowHowItWorks(true), 600);
        }
      }
    };

    init();
  }, [profile?.id]);

  useEffect(() => {
    if (!loading) {
      updateStats();
      if (isActive) fetchMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isActive]);

  useEffect(() => {
    if (!loading) updateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, stateFilter, minWage, maxExperience, groupFilter, loading]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
      </div>
    );

  // Split sectors into 2 columns
  const halfIdx = Math.ceil(sectorEntries.length / 2);
  const col1Sectors = sectorEntries.slice(0, halfIdx);
  const col2Sectors = sectorEntries.slice(halfIdx);

  const renderSectorCard = ([segment, data]: [string, { items: any[]; totalJobs: number }]) => {
    const selectedInSector = data.items.filter((i: any) =>
      selectedCategories.includes(i.raw_category),
    ).length;
    const allSelected = data.items.length > 0 && selectedInSector === data.items.length;
    const isExpanded = expandedSectors.has(segment);

    return (
      <SectorCard
        key={segment}
        segment={segment}
        data={data}
        isTracked={selectedCategories}
        isExpanded={isExpanded}
        t={t}
        onToggleAllInSector={() => {
          const sectorCats = data.items.map((i: any) => i.raw_category);
          setSelectedCategories((prev) =>
            allSelected
              ? prev.filter((c) => !sectorCats.includes(c))
              : [...new Set([...prev, ...sectorCats])],
          );
        }}
        onToggleSubcategory={(rawCat) => {
          setSelectedCategories((prev) =>
            prev.includes(rawCat)
              ? prev.filter((c) => c !== rawCat)
              : [...prev, rawCat],
          );
        }}
        onExpand={() => {
          const next = new Set(expandedSectors);
          isExpanded ? next.delete(segment) : next.add(segment);
          setExpandedSectors(next);
        }}
      />
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 p-6 md:p-12 animate-in fade-in duration-700">
      {/* ═══════════════════════════════════════════════════════════════
          LEVEL 1: HERO CONTROL PANEL
      ═══════════════════════════════════════════════════════════════ */}
      <HeroPanel className="p-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <SonarRadarIcon isActive={isActive} />
              <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("radar.title")}</h1>
                    <div className="relative group">
                      {/* Outer glow layer */}
                      <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-yellow-400/50 via-plan-gold/60 to-yellow-400/50 blur-md opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
                      {/* Shimmer sweep */}
                      <div className="absolute inset-0 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" />
                      </div>
                      <Badge className="relative border border-yellow-400/40 bg-gradient-to-r from-yellow-500 via-plan-gold to-yellow-600 text-white font-extrabold text-[10px] uppercase tracking-[0.15em] px-4 py-1 shadow-[0_0_20px_-4px_hsl(45_100%_50%/0.6),0_0_8px_-2px_hsl(45_100%_50%/0.4)]">
                        {t("radar.ui.premium_access")}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHowItWorks(true)}
                className="text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 gap-1.5 h-8 rounded-lg"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {t("radar.ui.how_it_works")}
              </Button>
              <div className={cn(
                "flex items-center gap-2.5 px-5 py-2.5 rounded-xl border shadow-sm transition-all duration-300",
                isActive
                  ? "bg-emerald-500/10 border-emerald-500/25 shadow-emerald-500/10"
                  : "bg-destructive/10 border-destructive/25 shadow-destructive/10",
              )}>
                <div className="relative flex items-center justify-center">
                  {isActive && (
                    <div className="absolute h-3 w-3 rounded-full bg-emerald-500/40 animate-ping" />
                  )}
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    isActive ? "bg-emerald-500" : "bg-destructive",
                  )} />
                </div>
                <span className={cn(
                  "text-sm font-bold uppercase tracking-wider",
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}>
                  {isActive ? t("radar.ui.system_online") : t("radar.ui.system_offline")}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Active criteria chips */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-3">
              {t("radar.ui.active_criteria")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors shadow-sm">
                <CircleDollarSign className="h-3.5 w-3.5 text-primary/60" />
                {minWage ? `$${formatNumber(Number(minWage))}+/hr` : t("radar.ui.any_salary")}
              </button>
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors shadow-sm">
                <MapPin className="h-3.5 w-3.5 text-primary/60" />
                {stateFilter !== "all" ? stateFilter : t("radar.ui.all_states")}
              </button>
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors shadow-sm">
                <Briefcase className="h-3.5 w-3.5 text-primary/60" />
                {maxExperience ? t("radar.ui.up_to_exp", { months: maxExperience }) : t("radar.ui.any_experience")}
              </button>
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors shadow-sm">
                <Globe className="h-3.5 w-3.5 text-primary/60" />
                {visaType !== "all" ? visaType : t("radar.ui.all_visas")}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Control Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Radar Mode */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                {t("radar.ui.radar_mode")}
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setRadarMode("manual")}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300 border",
                    radarMode === "manual"
                      ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_18px_-10px_hsl(var(--primary)/0.18)]"
                      : "bg-muted/25 border-border text-foreground/70 hover:border-primary/20 hover:bg-muted/30",
                  )}
                >
                  Manual
                </button>
                <button
                  onClick={() => setRadarMode("autopilot")}
                  className={cn(
                    "flex-1 py-3.5 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300 border",
                    radarMode === "autopilot"
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_20px_-6px_hsl(142_76%_36%/0.4)]"
                      : "bg-muted/25 border-border text-foreground/70 hover:border-primary/20 hover:bg-muted/30",
                  )}
                >
                  <span className="flex items-center justify-center gap-2">
                    Autopilot
                    {radarMode === "autopilot" && (
                      <span className="text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded">ON</span>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Right: Radar Control */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                {t("radar.ui.scan_control")}
              </label>
              <Button
                onClick={() => {
                  const next = !isActive;
                  setIsActive(next);
                  performSave({ is_active: next });
                }}
                className={cn(
                  "w-full h-12 rounded-lg font-bold uppercase tracking-wider transition-all duration-300",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15"
                    : "bg-primary text-primary-foreground border border-primary hover:bg-primary/90",
                )}
              >
                {isActive ? t("radar.pause_radar") : t("radar.ui.start_radar")}
              </Button>
            </div>
          </div>
        </div>
      </HeroPanel>

      {/* ═══════════════════════════════════════════════════════════════
          LEVEL 2: METRICS & INTELLIGENCE
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HeroPanel className="p-0 overflow-hidden">
          <MetricCard label={t("radar.ui.live_signals")} value={formatNumber(totalSinaisGeral)} icon={Activity} subtitle={t("radar.ui.opportunities_detected")} />
        </HeroPanel>
        <HeroPanel className="p-0 overflow-hidden">
          <MetricCard label={t("radar.ui.active_matches")} value={formatNumber(matchCount)} icon={Target} subtitle={`${formatNumber(queuedFromRadar)} ${t("radar.ui.sent_to_queue_suffix")}`} />
        </HeroPanel>
        <HeroPanel className="p-0 overflow-hidden">
          <MetricCard
            label={t("radar.ui.sectors_monitored")}
            value={formatNumber(selectedCategories.length)}
            icon={Globe}
            subtitle={t("radar.ui.active_tracking")}
          />
        </HeroPanel>
        <HeroPanel className="p-0 overflow-hidden">
          <MetricCard label={t("radar.ui.scan_frequency")} value={t("radar.ui.daily")} icon={Clock} subtitle={t("radar.ui.new_jobs_daily")} />
        </HeroPanel>
      </div>

      {/* Intelligence Indicator */}
      <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-muted/30 border border-border">
        <Sparkles className="h-4 w-4 text-primary/60" />
        <p className="text-sm text-muted-foreground/80">
          {t("radar.ui.matching_desc")}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LEVEL 3: CONFIGURATION & LIVE FEED
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
        {/* Left: Targeting Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary/60" /> {t("radar.sectors_title")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(true)}
              className="text-xs font-bold uppercase tracking-widest hover:bg-primary/5 h-8"
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> {t("radar.filters_btn")}
            </Button>
          </div>

          {/* 2-column category grid */}
          <div className="rounded-3xl bg-muted/20 border border-border p-1.5">
            <HeroPanel className="p-0 overflow-hidden border-0 shadow-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-6">
                <div className="space-y-3">
                  {col1Sectors.map(renderSectorCard)}
                </div>
                <div className="space-y-3">
                  {col2Sectors.map(renderSectorCard)}
                </div>
              </div>
            </HeroPanel>
          </div>

          {hasChangesComputed && (
            <Button
              onClick={() => performSave()}
              disabled={saving}
              className="w-full h-12 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-wider"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {t("radar.save_changes")}
            </Button>
          )}
        </div>

        {/* Right: Live Detection Feed */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary/60" /> {t("radar.ui.live_feed")}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">
                {t("radar.ui.real_time")}
              </span>
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            </div>
          </div>

          <HeroPanel className="p-0 overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex-1 overflow-y-auto max-h-[600px]">
              <div className="p-6 space-y-4">
                {matchedJobs.length > 0 ? (
                  matchedJobs.map((match) => {
                    const job = match.public_jobs;
                    if (!job) return null;

                    return (
                      <JobCard
                        key={match.id}
                        job={job}
                        match={match}
                        onApply={handleSendApplication}
                        onView={(jobId: string) => window.open(`/jobs/${jobId}`, "_blank")}
                        onDismiss={removeMatch}
                        t={t}
                      />
                    );
                  })
                ) : (
                  <div className="h-[450px] flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-xl" />
                      <div className="relative p-6 rounded-full bg-primary/5 border border-primary/10">
                        <Search className="h-8 w-8 text-primary/40" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">{t("radar.ui.scanning_frequencies")}</p>
                      <p className="text-xs text-muted-foreground/70 max-w-[240px]">
                        {t("radar.ui.no_signals_desc")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </HeroPanel>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          FILTERS DIALOG
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-border rounded-3xl p-8">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-bold">{t("radar.ui.advanced_filters")}</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
              {t("radar.ui.refine_parameters")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                  {t("radar.ui.minimum_salary")}
                </Label>
                <div className="relative">
                  <CircleDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-11 pl-11 rounded-lg bg-muted/20 border-border focus:border-primary/50 font-semibold"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/50">
                    USD/HR
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                  {t("radar.ui.max_experience")}
                </Label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-11 pl-11 rounded-lg bg-muted/20 border-border focus:border-primary/50 font-semibold"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/50">
                    {t("radar.ui.months_unit")}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">{t("radar.filter_state")}</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-11 rounded-lg bg-muted/20 border-border font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border">
                    <SelectItem value="all" className="font-semibold">
                      {t("radar.state_all")}
                    </SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s} className="font-semibold">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                  {t("radar.filter_visa")}
                </Label>
                <Select value={visaType} onValueChange={setVisaType}>
                  <SelectTrigger className="h-11 rounded-lg bg-muted/20 border-border font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border">
                    {VISA_TYPE_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value} className="font-semibold">
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
            className="w-full h-11 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-wider"
          >
            {t("radar.apply_filters")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS DIALOG
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="max-w-xl bg-card/95 backdrop-blur-xl border-border rounded-3xl p-0 overflow-hidden">
          {/* Hero header */}
          <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">{t("radar.ui.hiw_title")}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {t("radar.ui.hiw_subtitle")}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Main pitch */}
            <div className="space-y-3">
              <p className="text-sm text-foreground leading-relaxed">
                {t("radar.ui.hiw_pitch")}
              </p>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15">
                <Rocket className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm font-semibold text-primary">
                  {t("radar.ui.hiw_cta_line")}
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">
                {t("radar.ui.hiw_steps_label")}
              </p>
              
              {[
                { step: "1", title: t("radar.ui.hiw_step1_title"), desc: t("radar.ui.hiw_step1_desc") },
                { step: "2", title: t("radar.ui.hiw_step2_title"), desc: t("radar.ui.hiw_step2_desc") },
                { step: "3", title: t("radar.ui.hiw_step3_title"), desc: t("radar.ui.hiw_step3_desc") },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary font-bold text-sm shrink-0">
                    {item.step}
                  </div>
                  <div className="space-y-1 pt-0.5">
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Benefits */}
            <div className="space-y-3 pt-2">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">
                {t("radar.ui.hiw_benefits_label")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  t("radar.ui.hiw_benefit1"),
                  t("radar.ui.hiw_benefit2"),
                  t("radar.ui.hiw_benefit3"),
                  t("radar.ui.hiw_benefit4"),
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-foreground/80">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-8 pb-8">
            <Button
              onClick={() => setShowHowItWorks(false)}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm uppercase tracking-wider"
            >
              {t("radar.ui.hiw_got_it")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <div className="pt-8 border-t border-border flex items-center justify-between text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">
        <span>H2 Link Radar • {t("radar.ui.premium_edition")}</span>
        <span>v4.2.0</span>
      </div>
    </div>
  );
}
