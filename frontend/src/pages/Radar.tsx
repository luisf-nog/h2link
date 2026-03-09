import { useEffect, useState, useMemo, useCallback } from "react";
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
  Users,
  AlertCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function resolveSectorKey(raw: string, keywords: Record<string, string[]>): string {
  for (const [key, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => raw.toLowerCase().includes(kw.toLowerCase()))) return key;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Primitive components
// ---------------------------------------------------------------------------

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
  const hasNoListings = data.items.every((i: any) => (i.count || 0) === 0);

  return (
    <div
      className={cn(
        "group relative rounded-2xl border transition-all duration-300 overflow-hidden p-4 cursor-pointer",
        allSelected
          ? "border-primary/30 bg-primary/[0.05] shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.15)]"
          : partialSelected
            ? "border-primary/20 bg-primary/[0.025] hover:border-primary/25"
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
              <div className="flex items-center gap-2 text-[10px] mt-0.5 flex-wrap">
                {hasNoListings && selectedInSector > 0 ? (
                  <span className="flex items-center gap-1 text-amber-500/80 font-semibold">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {t("radar.ui.no_current_listings")}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70">
                    {formatNumber(data.totalJobs)} {t("radar.ui.opportunities")}
                  </span>
                )}
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

      {isExpanded && data.items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/30 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] pl-8 pb-1.5">
            {t("radar.ui.subcategories")}
          </p>
          {data.items.map((item: any) => {
            const checked = isTracked.includes(item.raw_category);
            const zeroCount = (item.count || 0) === 0;
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
                  <span
                    className={cn(
                      "text-[11px] truncate transition-colors",
                      checked ? "text-foreground font-medium" : "text-muted-foreground/80",
                    )}
                  >
                    {item.raw_category}
                  </span>
                  {zeroCount && checked && (
                    <span className="text-[8px] font-bold text-amber-500/70 shrink-0">
                      {t("radar.ui.no_listings_short")}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold tabular-nums",
                    zeroCount ? "text-amber-500/50" : "text-muted-foreground/45",
                  )}
                >
                  {zeroCount ? "—" : formatNumber(item.count)}
                </span>
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
    <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
      {job.category}
    </h3>
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          {t("radar.ui.salary")}
        </span>
        <span className="text-sm font-bold text-foreground">${job.salary ? formatNumber(job.salary) : "N/A"}/hr</span>
      </div>
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border">
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          {t("radar.ui.experience_short")}
        </span>
        <span className="text-sm font-bold text-foreground">{job.experience_months || 0}m</span>
      </div>
    </div>
    <div className="flex items-center gap-2 pt-2">
      <Button
        onClick={() => onApply(match.id, job.id)}
        className="flex-1 h-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-bold text-sm"
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

const SonarRadarIcon = ({ isActive }: { isActive: boolean }) => (
  <div className="relative p-3 rounded-xl bg-primary/6 border border-primary/15">
    {isActive && (
      <>
        <div className="absolute inset-0 rounded-xl bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
        <div
          className="absolute inset-0 rounded-xl bg-primary/5 animate-ping"
          style={{ animationDuration: "3s", animationDelay: "0.5s" }}
        />
      </>
    )}
    <RadarIcon className={cn("h-7 w-7 relative z-10", isActive ? "text-primary" : "text-primary/70")} />
  </div>
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const RANDOMIZATION_GROUPS = ["all", "A", "B", "C", "D"];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Radar() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggleSaving, setToggleSaving] = useState(false);
  // rescanning: true while we clear stale matches + trigger edge function
  const [rescanning, setRescanning] = useState(false);
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

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

  // -------------------------------------------------------------------------
  // displayedCategories: keeps selected categories visible even with 0 listings
  // -------------------------------------------------------------------------
  const displayedCategories = useMemo<Record<string, { items: any[]; totalJobs: number }>>(() => {
    const merged: Record<string, { items: any[]; totalJobs: number }> = {};
    for (const [seg, data] of Object.entries(groupedCategories)) {
      merged[seg] = { totalJobs: data.totalJobs, items: [...data.items] };
    }
    const presentRaws = new Set<string>(Object.values(merged).flatMap((s) => s.items.map((i) => i.raw_category)));
    for (const cat of selectedCategories) {
      if (presentRaws.has(cat)) continue;
      const sectorKey = resolveSectorKey(cat, SECTOR_KEYWORDS);
      const sectorName = t(`radar.sectors.${sectorKey}`, sectorKey);
      if (!merged[sectorName]) merged[sectorName] = { items: [], totalJobs: 0 };
      merged[sectorName].items.push({ raw_category: cat, count: 0 });
    }
    return merged;
  }, [groupedCategories, selectedCategories, t]);

  const sectorEntries = useMemo(() => Object.entries(displayedCategories).sort(), [displayedCategories]);

  const totalSinaisGeral = useMemo(
    () => Object.values(groupedCategories).reduce((acc, curr) => acc + (curr.totalJobs || 0), 0),
    [groupedCategories],
  );

  const hasChangesComputed = useMemo(() => {
    if (!radarProfile) return selectedCategories.length > 0;
    return (
      radarMode !== (radarProfile.auto_send ? "autopilot" : "manual") ||
      JSON.stringify([...selectedCategories].sort()) !== JSON.stringify([...(radarProfile.categories || [])].sort()) ||
      minWage !== (radarProfile.min_wage?.toString() || "") ||
      maxExperience !== (radarProfile.max_experience?.toString() || "") ||
      visaType !== (radarProfile.visa_type || "all") ||
      stateFilter !== (radarProfile.state || "all") ||
      groupFilter !== (radarProfile.randomization_group || "all")
    );
  }, [radarMode, selectedCategories, minWage, maxExperience, visaType, stateFilter, groupFilter, radarProfile]);

  // -------------------------------------------------------------------------
  // updateStats
  // -------------------------------------------------------------------------
  const updateStats = useCallback(
    async (override?: {
      visaType?: string;
      stateFilter?: string;
      minWage?: string;
      maxExperience?: string;
      groupFilter?: string;
    }) => {
      if (!profile?.id) return;
      try {
        const vt = override?.visaType ?? visaType;
        const st = override?.stateFilter ?? stateFilter;
        const mw = override?.minWage ?? minWage;
        const me = override?.maxExperience ?? maxExperience;
        const gf = override?.groupFilter ?? groupFilter;

        const { data } = await supabase.rpc("get_radar_stats" as any, {
          p_user_id: profile.id,
          p_visa_type: vt,
          p_state: st,
          p_min_wage: mw !== "" ? Number(mw) : 0,
          p_max_exp: me !== "" ? Number(me) : 999,
          p_group: gf,
        });

        if (data) {
          const grouped = (data as any[]).reduce((acc: any, curr: any) => {
            const raw = curr.raw_category || "";
            const sectorKey = resolveSectorKey(raw, SECTOR_KEYWORDS);
            const sectorName = t(`radar.sectors.${sectorKey}`, sectorKey);
            if (!acc[sectorName]) acc[sectorName] = { items: [], totalJobs: 0 };
            acc[sectorName].items.push(curr);
            acc[sectorName].totalJobs += curr.count || 0;
            return acc;
          }, {});
          setGroupedCategories(grouped);
        }
      } catch (e) {
        console.error("[Radar] updateStats error:", e);
      }
    },
    [profile?.id, visaType, stateFilter, minWage, maxExperience, groupFilter, t],
  );

  // -------------------------------------------------------------------------
  // fetchMatches
  // -------------------------------------------------------------------------
  const fetchMatches = useCallback(async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("radar_matched_jobs" as any)
      .select(`id, job_id, auto_queued, public_jobs!fk_radar_job (*)`)
      .eq("user_id", profile.id);

    if (error) {
      console.error("[Radar] fetchMatches error:", error);
      return;
    }
    if (!data) return;

    const validMatches = (data as any[]).filter((m: any) => {
      const job = m.public_jobs;
      return job && job.is_active !== false && job.is_banned !== true;
    });

    const jobIds = validMatches.map((m: any) => m.job_id);

    if (jobIds.length === 0) {
      setMatchedJobs([]);
      setMatchCount(0);
      setQueuedFromRadar(0);
      return;
    }

    // Batch .in() queries to avoid PostgREST URL length limits
    const CHUNK_SIZE = 150;
    const allQueuedJobs: any[] = [];
    for (let i = 0; i < jobIds.length; i += CHUNK_SIZE) {
      const chunk = jobIds.slice(i, i + CHUNK_SIZE);
      const { data: queuedChunk, error: chunkError } = await supabase
        .from("my_queue")
        .select("job_id")
        .eq("user_id", profile.id)
        .in("job_id", chunk);
      if (chunkError) {
        console.error("[Radar] fetchMatches queue check error:", chunkError);
        return;
      }
      if (queuedChunk) allQueuedJobs.push(...queuedChunk);
    }
    const queuedJobs = allQueuedJobs;
    const queueError = null;

    const queuedSet = new Set((queuedJobs || []).map((q: any) => q.job_id));
    const finalMatches = validMatches.filter((m: any) => !queuedSet.has(m.job_id));
    const queuedCount = validMatches.filter((m: any) => queuedSet.has(m.job_id)).length;

    setMatchedJobs(finalMatches);
    setMatchCount(finalMatches.length);
    setQueuedFromRadar(queuedCount);
  }, [profile?.id]);

  // -------------------------------------------------------------------------
  // triggerRescan
  //
  // Called after any filter/category/mode change is saved while radar is ON.
  //
  // Why clear stale matches first:
  // radar_matched_jobs stores results from the PREVIOUS scan with OLD filters.
  // If the user tightens criteria (e.g. adds a state filter), old matches that
  // no longer satisfy the new criteria would linger in the feed until they
  // age out naturally. Deleting them first ensures the feed only ever shows
  // jobs that match the current saved profile.
  //
  // The edge function then runs against the new profile and re-populates the
  // table with fresh matches — which fetchMatches picks up immediately after.
  // -------------------------------------------------------------------------
  const triggerRescan = useCallback(async () => {
    if (!profile?.id) return;
    setRescanning(true);
    try {
      // 1. Clear stale matches so the feed doesn't show results from old filters
      await supabase
        .from("radar_matched_jobs" as any)
        .delete()
        .eq("user_id", profile.id);

      // 2. Trigger an immediate edge function scan with the newly saved profile
      await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });

      // 3. Short wait so the edge function has time to insert new matches
      //    before we fetch. The function is fast (~1–2s for most users).
      await new Promise((r) => setTimeout(r, 2500));

      // 4. Refresh stats + feed
      await Promise.all([fetchMatches(), updateStats()]);
    } catch (e) {
      console.error("[Radar] triggerRescan error:", e);
    } finally {
      setRescanning(false);
    }
  }, [profile?.id, fetchMatches, updateStats]);

  // -------------------------------------------------------------------------
  // performSave — pure save, returns success boolean
  // -------------------------------------------------------------------------
  const performSave = useCallback(
    async (overrides: Record<string, any> = {}): Promise<boolean> => {
      if (!profile?.id) return false;

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

      if (error) {
        console.error("[Radar] performSave error:", error);
        return false;
      }
      setRadarProfile((prev: any) => ({ ...prev, ...payload }));
      return true;
    },
    [
      profile?.id,
      isActive,
      radarMode,
      selectedCategories,
      minWage,
      maxExperience,
      visaType,
      stateFilter,
      groupFilter,
      radarProfile,
    ],
  );

  // -------------------------------------------------------------------------
  // handleToggleActive — optimistic with rollback
  // -------------------------------------------------------------------------
  const handleToggleActive = useCallback(async () => {
    if (toggleSaving || rescanning) return;
    const next = !isActive;
    setIsActive(next);
    setToggleSaving(true);
    try {
      const ok = await performSave({ is_active: next });
      if (!ok) {
        setIsActive(!next);
        toast({ title: t("radar.toast_error"), variant: "destructive" });
        return;
      }
      if (next) {
        // Radar just turned ON → scan with current saved criteria
        await triggerRescan();
      }
      toast({ title: t("radar.toast_recalibrated") });
    } finally {
      setToggleSaving(false);
    }
  }, [isActive, toggleSaving, rescanning, performSave, triggerRescan, toast, t]);

  // -------------------------------------------------------------------------
  // handleFullSave
  //
  // Saves filters/categories/mode, then:
  // - if radar is ON  → clear stale matches + trigger rescan with new criteria
  // - if radar is OFF → just refresh stats so the sector grid shows updated counts
  // -------------------------------------------------------------------------
  const handleFullSave = useCallback(async () => {
    setSaving(true);
    try {
      const ok = await performSave();
      if (!ok) {
        toast({ title: t("radar.toast_error"), variant: "destructive" });
        return;
      }

      if (isActive) {
        await triggerRescan();
      } else {
        await updateStats();
      }

      toast({ title: t("radar.toast_recalibrated") });
    } finally {
      setSaving(false);
    }
  }, [performSave, triggerRescan, updateStats, isActive, toast, t]);

  // -------------------------------------------------------------------------
  // handleSendApplication
  // -------------------------------------------------------------------------
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
      setQueuedFromRadar((prev) => prev + 1);
      toast({ title: t("radar.toast_captured") });
    } catch {
      toast({ title: t("radar.toast_send_error"), variant: "destructive" });
    }
  };

  // -------------------------------------------------------------------------
  // removeMatch — client-side dismiss
  // -------------------------------------------------------------------------
  const removeMatch = async (matchId: string) => {
    setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
    setMatchCount((prev) => Math.max(0, prev - 1));
  };

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
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

          await updateStats({
            visaType: d.visa_type || "all",
            stateFilter: d.state || "all",
            minWage: d.min_wage?.toString() || "",
            maxExperience: d.max_experience?.toString() || "",
            groupFilter: d.randomization_group || "all",
          });

          if (d.is_active) await fetchMatches();
        }
      } catch (e) {
        console.error("[Radar] init error:", e);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (loading) return;
    updateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, stateFilter, minWage, maxExperience, groupFilter]);

  // -------------------------------------------------------------------------
  // renderSectorCard
  // -------------------------------------------------------------------------
  const renderSectorCard = useCallback(
    ([segment, data]: [string, { items: any[]; totalJobs: number }]) => {
      const selectedInSector = data.items.filter((i: any) => selectedCategories.includes(i.raw_category)).length;
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
              allSelected ? prev.filter((c) => !sectorCats.includes(c)) : [...new Set([...prev, ...sectorCats])],
            );
          }}
          onToggleSubcategory={(rawCat) =>
            setSelectedCategories((prev) =>
              prev.includes(rawCat) ? prev.filter((c) => c !== rawCat) : [...prev, rawCat],
            )
          }
          onExpand={() =>
            setExpandedSectors((prev) => {
              const next = new Set(prev);
              isExpanded ? next.delete(segment) : next.add(segment);
              return next;
            })
          }
        />
      );
    },
    [selectedCategories, expandedSectors, t],
  );

  // -------------------------------------------------------------------------
  // Loading / premium gate
  // -------------------------------------------------------------------------
  if (loading)
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
      </div>
    );

  if (!isPremium)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6 text-center p-8">
        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/15">
          <RadarIcon className="h-10 w-10 text-primary/40" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{t("radar.title")}</h2>
          <p className="text-sm text-muted-foreground max-w-xs">{t("radar.ui.premium_required_desc")}</p>
        </div>
        <Button onClick={() => navigate("/plans")} className="h-11 px-8 font-bold">
          {t("radar.ui.upgrade_to_premium")}
        </Button>
      </div>
    );

  const halfIdx = Math.ceil(sectorEntries.length / 2);
  const col1Sectors = sectorEntries.slice(0, halfIdx);
  const col2Sectors = sectorEntries.slice(halfIdx);

  const isBusy = saving || toggleSaving || rescanning;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="max-w-[1600px] mx-auto space-y-12 p-6 md:p-12 animate-in fade-in duration-700">
      {/* LEVEL 1: HERO */}
      <HeroPanel className="p-8">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SonarRadarIcon isActive={isActive} />
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("radar.title")}</h1>
                <div className="relative group">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-yellow-400/50 via-plan-gold/60 to-yellow-400/50 blur-md opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
                  <Badge className="relative border border-yellow-400/40 bg-gradient-to-r from-yellow-500 via-plan-gold to-yellow-600 text-white font-extrabold text-[10px] uppercase tracking-[0.15em] px-4 py-1 shadow-[0_0_20px_-4px_hsl(45_100%_50%/0.6)]">
                    {t("radar.ui.premium_access")}
                  </Badge>
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
                <HelpCircle className="h-3.5 w-3.5" /> {t("radar.ui.how_it_works")}
              </Button>
              <div
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 rounded-xl border shadow-sm transition-all duration-300",
                  isActive ? "bg-emerald-500/10 border-emerald-500/25" : "bg-destructive/10 border-destructive/25",
                )}
              >
                <div className="relative flex items-center justify-center">
                  {isActive && <div className="absolute h-3 w-3 rounded-full bg-emerald-500/40 animate-ping" />}
                  <div className={cn("h-2.5 w-2.5 rounded-full", isActive ? "bg-emerald-500" : "bg-destructive")} />
                </div>
                <span
                  className={cn(
                    "text-sm font-bold uppercase tracking-wider",
                    isActive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                  )}
                >
                  {isActive ? t("radar.ui.system_online") : t("radar.ui.system_offline")}
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Active criteria chips */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-3">
              {t("radar.ui.active_criteria")}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  icon: CircleDollarSign,
                  label: minWage ? `$${formatNumber(Number(minWage))}+/hr` : t("radar.ui.any_salary"),
                },
                { icon: MapPin, label: stateFilter !== "all" ? stateFilter : t("radar.ui.all_states") },
                {
                  icon: Briefcase,
                  label: maxExperience
                    ? t("radar.ui.up_to_exp", { months: maxExperience })
                    : t("radar.ui.any_experience"),
                },
                { icon: Globe, label: visaType !== "all" ? visaType : t("radar.ui.all_visas") },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => setShowFilters(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-primary/60" /> {label}
                </button>
              ))}
              {groupFilter !== "all" && (
                <button
                  onClick={() => setShowFilters(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-semibold text-primary hover:border-primary/30 transition-colors shadow-sm"
                >
                  <Users className="h-3.5 w-3.5 text-primary/60" /> {t("radar.ui.group_label")} {groupFilter}
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Mode + toggle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                {t("radar.ui.radar_mode")}
              </label>
              <div className="flex gap-3">
                {(["manual", "autopilot"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRadarMode(mode)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-300 border",
                      radarMode === mode
                        ? mode === "autopilot"
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_20px_-6px_hsl(142_76%_36%/0.4)]"
                          : "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/25 border-border text-foreground/70 hover:border-primary/20",
                    )}
                  >
                    {mode === "autopilot" && radarMode === "autopilot" ? (
                      <span className="flex items-center justify-center gap-2">
                        <Zap className="h-3.5 w-3.5" /> Autopilot{" "}
                        <span className="text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded">ON</span>
                      </span>
                    ) : (
                      mode.charAt(0).toUpperCase() + mode.slice(1)
                    )}
                  </button>
                ))}
              </div>
              {/* Autopilot description — key UX context for the user */}
              <div
                className={cn(
                  "px-3 py-2.5 rounded-lg border text-[11px] leading-relaxed transition-all duration-300",
                  radarMode === "autopilot"
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted/30 border-border text-muted-foreground/70",
                )}
              >
                {
                  radarMode === "autopilot"
                    ? t("radar.ui.autopilot_desc") // "Whenever new jobs are imported, the radar automatically detects matches and sends them to your queue — no action required."
                    : t("radar.ui.manual_desc") // "Matches appear in the feed below. You decide which ones to send."
                }
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                {t("radar.ui.scan_control")}
              </label>
              <Button
                onClick={handleToggleActive}
                disabled={isBusy}
                className={cn(
                  "w-full h-12 rounded-lg font-bold uppercase tracking-wider transition-all duration-300",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15"
                    : "bg-primary text-primary-foreground border border-primary hover:bg-primary/90",
                )}
              >
                {toggleSaving || rescanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isActive ? (
                  t("radar.pause_radar")
                ) : (
                  t("radar.ui.start_radar")
                )}
              </Button>
            </div>
          </div>
        </div>
      </HeroPanel>

      {/* LEVEL 2: METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HeroPanel className="p-0 overflow-hidden">
          <MetricCard
            label={t("radar.ui.live_signals")}
            value={formatNumber(totalSinaisGeral)}
            icon={Activity}
            subtitle={t("radar.ui.opportunities_detected")}
          />
        </HeroPanel>
        <HeroPanel className="p-0 overflow-hidden">
          <MetricCard
            label={t("radar.ui.active_matches")}
            value={formatNumber(matchCount)}
            icon={Target}
            subtitle={`${formatNumber(queuedFromRadar)} ${t("radar.ui.sent_to_queue_suffix")}`}
          />
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
          <MetricCard
            label={t("radar.ui.scan_frequency")}
            value={t("radar.ui.daily")}
            icon={Clock}
            subtitle={t("radar.ui.new_jobs_daily")}
          />
        </HeroPanel>
      </div>

      <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-muted/30 border border-border">
        <Sparkles className="h-4 w-4 text-primary/60" />
        <p className="text-sm text-muted-foreground/80">{t("radar.ui.matching_desc")}</p>
      </div>

      {/* LEVEL 3: CONFIGURATION + FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
        {/* Left: Sector targeting */}
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

          <div className="rounded-3xl bg-muted/20 border border-border p-1.5">
            <HeroPanel className="p-0 overflow-hidden border-0 shadow-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-6">
                <div className="space-y-3">{col1Sectors.map(renderSectorCard)}</div>
                <div className="space-y-3">{col2Sectors.map(renderSectorCard)}</div>
              </div>
            </HeroPanel>
          </div>

          {hasChangesComputed && (
            <Button
              onClick={handleFullSave}
              disabled={isBusy}
              className="w-full h-12 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-wider"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {rescanning ? t("radar.ui.rescanning") : t("radar.ui.saving")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t("radar.save_changes")}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Right: Live feed */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary/60" /> {t("radar.ui.live_feed")}
            </h2>
            <div className="flex items-center gap-2">
              {rescanning ? (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-primary/70 uppercase tracking-[0.18em]">
                  <RefreshCw className="h-3 w-3 animate-spin" /> {t("radar.ui.rescanning")}
                </span>
              ) : (
                <>
                  <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">
                    {t("radar.ui.real_time")}
                  </span>
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isActive ? "bg-success animate-pulse" : "bg-muted-foreground/30",
                    )}
                  />
                </>
              )}
            </div>
          </div>

          <HeroPanel className="p-0 overflow-hidden">
            <div className="overflow-y-auto max-h-[600px]">
              <div className="p-6 space-y-4">
                {rescanning ? (
                  <div className="h-[340px] flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-xl" />
                      <div className="relative p-6 rounded-full bg-primary/5 border border-primary/10">
                        <RefreshCw className="h-8 w-8 text-primary/40 animate-spin" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">{t("radar.ui.recalibrating")}</p>
                      <p className="text-xs text-muted-foreground/70 max-w-[240px]">
                        {t("radar.ui.recalibrating_desc")}
                      </p>
                    </div>
                  </div>
                ) : matchedJobs.length > 0 ? (
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
                  <div className="h-[340px] flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-xl" />
                      <div className="relative p-6 rounded-full bg-primary/5 border border-primary/10">
                        <Search className="h-8 w-8 text-primary/40" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">{t("radar.ui.scanning_frequencies")}</p>
                      <p className="text-xs text-muted-foreground/70 max-w-[240px]">{t("radar.ui.no_signals_desc")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </HeroPanel>
        </div>
      </div>

      {/* FILTERS DIALOG */}
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

              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                  {t("radar.ui.randomization_group")}
                </Label>
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="h-11 rounded-lg bg-muted/20 border-border font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border">
                    {RANDOMIZATION_GROUPS.map((g) => (
                      <SelectItem key={g} value={g} className="font-semibold">
                        {g === "all" ? t("radar.ui.all_groups") : `${t("radar.ui.group_label")} ${g}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                  {t("radar.filter_state")}
                </Label>
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
              handleFullSave();
            }}
            disabled={isBusy}
            className="w-full h-11 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-wider"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("radar.apply_filters")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* HOW IT WORKS DIALOG */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="max-w-xl bg-card/95 backdrop-blur-xl border-border rounded-3xl p-0 overflow-hidden">
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
            <div className="space-y-3">
              <p className="text-sm text-foreground leading-relaxed">{t("radar.ui.hiw_pitch")}</p>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15">
                <Rocket className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm font-semibold text-primary">{t("radar.ui.hiw_cta_line")}</p>
              </div>
            </div>
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

      <div className="pt-8 border-t border-border flex items-center justify-between text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">
        <span>H2 Link Radar • {t("radar.ui.premium_edition")}</span>
        <span>v4.4.0</span>
      </div>
    </div>
  );
}
