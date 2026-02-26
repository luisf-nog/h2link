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

const MetricCard = ({ label, value, icon: Icon, subtitle }: any) => (
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

const SectorCard = ({ segment, data, isTracked, isExpanded, onToggleAllInSector, onExpand }: any) => {
  const totalInSector = data.items.length;
  const selectedInSector = data.items.filter((i: any) => isTracked.includes(i.raw_category)).length;
  const allSelected = totalInSector > 0 && selectedInSector === totalInSector;
  const partialSelected = selectedInSector > 0 && !allSelected;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border transition-all duration-300 overflow-hidden p-5 cursor-pointer",
        allSelected ? "border-primary/30 bg-primary/[0.05]" : "border-border bg-card hover:border-primary/20",
      )}
      onClick={onExpand}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all",
          allSelected ? "bg-primary" : "bg-transparent",
        )}
      />
      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAllInSector}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{segment}</h3>
              <div className="flex items-center gap-2 text-[11px] mt-1">
                <span className="text-muted-foreground/70">{formatNumber(data.totalJobs)} positions</span>
              </div>
            </div>
          </div>
        </div>
        <ChevronRight
          className={cn("h-4 w-4 text-muted-foreground/50 transition-transform", isExpanded && "rotate-90")}
        />
      </div>
      {isExpanded && data.items.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border/30 space-y-2 animate-in fade-in slide-in-from-top-1">
          {data.items.map((item: any) => (
            <div
              key={item.raw_category}
              className="flex items-center justify-between pl-9 text-[12px] text-muted-foreground/80"
            >
              <span>{item.raw_category}</span>
              <span className="text-[10px] font-bold">{formatNumber(item.count)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const JobCard = ({ job, match, onApply, onView, onDismiss }: any) => (
  <div className="group relative rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300 p-5 space-y-4 shadow-sm hover:shadow-md">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] font-black border-primary/20 bg-primary/5 text-primary">
          {job.visa_type}
        </Badge>
        <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {job.state}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[9px] font-bold text-emerald-600/70 uppercase">New</span>
      </div>
    </div>
    <h3 className="text-base font-bold text-foreground leading-tight">{job.category}</h3>
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase block mb-1">Wage</span>
        <span className="text-sm font-bold text-foreground">${job.salary}/hr</span>
      </div>
      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase block mb-1">Exp</span>
        <span className="text-sm font-bold text-foreground">{job.experience_months || 0}m</span>
      </div>
    </div>
    <div className="flex items-center gap-2 pt-2">
      <Button
        onClick={() => onApply(match.id, job.id)}
        className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider"
      >
        <Send className="h-3.5 w-3.5 mr-2" /> Apply
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onView(job.id)}
        className="h-10 w-10 border border-border hover:bg-primary/5"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDismiss(match.id)}
        className="h-10 w-10 border border-border hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

// --- SECTOR MAPS (UNCHANGED) ---
const SECTOR_KEYWORDS: Record<string, string[]> = {
  agriculture: ["Farmworkers", "Crop", "Nursery", "Harvest", "Agricultural", "Forest", "Farm"],
  farm_equipment: ["Agricultural Equipment", "Tractor"],
  construction: ["Construction", "Laborers", "Cement", "Masons", "Concrete", "Fence", "Brickmasons", "Iron", "Paving"],
  landscaping: ["Landscaping", "Groundskeeping", "Tree Trimmers"],
};
const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "FL", "GA", "TX", "NY", "WA"];

export default function Radar() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [groupedCategories, setGroupedCategories] = useState<any>({});
  const [radarProfile, setRadarProfile] = useState<any>(null);

  const [isActive, setIsActive] = useState(false);
  const [radarMode, setRadarMode] = useState<"manual" | "autopilot">("manual");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // --- LOGIC (REFINED & SYNCED) ---

  const hasChangesComputed = useMemo(() => {
    if (!radarProfile) return selectedCategories.length > 0;
    return (
      isActive !== (radarProfile.is_active ?? false) ||
      radarMode !== (radarProfile.auto_send ? "autopilot" : "manual") ||
      JSON.stringify([...selectedCategories].sort()) !== JSON.stringify([...(radarProfile.categories || [])].sort())
    );
  }, [isActive, radarMode, selectedCategories, radarProfile]);

  const updateStats = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.rpc("get_radar_stats" as any, {
      p_user_id: profile.id,
      p_visa_type: visaType,
      p_state: stateFilter,
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
  };

  const fetchMatches = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("radar_matched_jobs" as any)
      .select(`id, job_id, public_jobs!fk_radar_job (*)`)
      .eq("user_id", profile.id);
    if (data) setMatchedJobs(data.filter((m: any) => m.public_jobs && !m.public_jobs.is_banned));
  };

  const performSave = async (overrides = {}) => {
    if (!profile?.id) return;
    setSaving(true);
    const payload = {
      user_id: profile.id,
      is_active: isActive,
      auto_send: radarMode === "autopilot",
      categories: selectedCategories,
      ...overrides,
    };
    const { error } = radarProfile
      ? await supabase
          .from("radar_profiles" as any)
          .update(payload)
          .eq("user_id", profile.id)
      : await supabase.from("radar_profiles" as any).insert(payload);
    if (!error) {
      setRadarProfile(payload);
      toast({ title: "Radar Recalibrated" });
      fetchMatches();
    }
    setSaving(false);
  };

  useEffect(() => {
    if (profile?.id) {
      updateStats();
      fetchMatches();
      setLoading(false);
    }
  }, [profile?.id, visaType, stateFilter]);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary/20" />
      </div>
    );

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 p-6 md:p-12 animate-in fade-in duration-700">
      {/* LEVEL 1: HERO CONTROL PANEL */}
      <HeroPanel className="p-8">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 shadow-inner">
                <Crown className="h-6 w-6 text-primary/70" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tighter text-foreground">Radar Jobs</h1>

                  {/* REFINED PREMIUM BADGE */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]">
                    <div className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/40 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                      Premium Access
                    </span>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.25em] mt-1">
                  Intelligence Core v4.2
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHowItWorks(true)}
                className="text-xs font-bold text-muted-foreground gap-2"
              >
                <HelpCircle className="h-4 w-4" /> How it works?
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest">Live Engine</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">Radar Mode</label>
              <div className="flex gap-3">
                {["manual", "autopilot"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRadarMode(mode as any)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest border transition-all",
                      radarMode === mode
                        ? "bg-primary/10 border-primary/30 text-primary shadow-lg shadow-primary/5"
                        : "bg-muted/20 border-transparent text-muted-foreground",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                Scan Control
              </label>
              <Button
                onClick={() => {
                  const n = !isActive;
                  setIsActive(n);
                  performSave({ is_active: n });
                }}
                className={cn(
                  "w-full h-12 rounded-xl font-bold uppercase tracking-widest transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {isActive ? "Pause Radar" : "Start Radar"}
              </Button>
            </div>
          </div>
        </div>
      </HeroPanel>

      {/* LEVEL 2: METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HeroPanel className="p-0">
          <MetricCard
            label="Live Signals"
            value={formatNumber(Object.values(groupedCategories).reduce((a: any, c: any) => a + c.totalJobs, 0))}
            icon={Activity}
            subtitle="Detected"
          />
        </HeroPanel>
        <HeroPanel className="p-0">
          <MetricCard label="Matches" value={matchedJobs.length} icon={Target} subtitle="Ready to apply" />
        </HeroPanel>
        <HeroPanel className="p-0">
          <MetricCard label="Active Sectors" value={selectedCategories.length} icon={Globe} />
        </HeroPanel>
        <HeroPanel className="p-0">
          <MetricCard label="Frequency" value="Daily" icon={Clock} />
        </HeroPanel>
      </div>

      {/* LEVEL 3: SYNCED HEIGHT COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-8 items-stretch">
        {/* Left: Sector Targeting */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary/40" /> Sector Targeting
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(true)}
              className="text-[10px] font-black uppercase tracking-widest"
            >
              <Settings2 className="h-3.5 w-3.5 mr-2" /> Filters
            </Button>
          </div>
          <div className="flex-1 rounded-[2rem] bg-muted/20 border border-border p-1.5">
            <HeroPanel className="p-0 border-0 shadow-none h-full">
              <ScrollArea className="h-[600px]">
                <div className="space-y-3 p-6">
                  {Object.entries(groupedCategories).map(([segment, data]: any) => (
                    <SectorCard
                      key={segment}
                      segment={segment}
                      data={data}
                      isTracked={selectedCategories}
                      isExpanded={expandedSectors.has(segment)}
                      onToggleAllInSector={() => {
                        const cats = data.items.map((i: any) => i.raw_category);
                        setSelectedCategories((prev) =>
                          prev.some((c) => cats.includes(c))
                            ? prev.filter((c) => !cats.includes(c))
                            : [...new Set([...prev, ...cats])],
                        );
                      }}
                      onExpand={() =>
                        setExpandedSectors((prev) => {
                          const n = new Set(prev);
                          n.has(segment) ? n.delete(segment) : n.add(segment);
                          return n;
                        })
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            </HeroPanel>
          </div>
          {hasChangesComputed && (
            <Button
              onClick={() => performSave()}
              className="w-full h-14 rounded-2xl bg-foreground text-background font-black uppercase tracking-widest shadow-2xl"
            >
              {saving ? <Loader2 className="animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />} Save & Recalibrate
            </Button>
          )}
        </div>

        {/* Right: Live Feed */}
        <div className="lg:col-span-3 flex flex-col space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary/40" /> Live Detection
            </h2>
            <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Real-time</span>
          </div>
          <div className="flex-1 rounded-[2rem] bg-muted/20 border border-border p-1.5">
            <HeroPanel className="p-0 border-0 shadow-none h-full">
              <ScrollArea className="h-[600px]">
                <div className="p-6 space-y-4">
                  {matchedJobs.length > 0 ? (
                    matchedJobs.map((m) => (
                      <JobCard
                        key={m.id}
                        job={m.public_jobs}
                        match={m}
                        onApply={() => {}}
                        onView={() => {}}
                        onDismiss={() => {}}
                      />
                    ))
                  ) : (
                    <div className="h-[550px] flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                      <Search className="h-10 w-10 text-primary/30" />
                      <p className="text-xs font-bold uppercase tracking-widest">Listening for signals...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </HeroPanel>
          </div>
        </div>
      </div>

      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="rounded-3xl p-8">
          {/* Conteúdo do Modal de Ajuda igual ao anterior, mas com o novo estilo de botões */}
          <Button onClick={() => setShowHowItWorks(false)} className="w-full h-12 rounded-xl">
            Entendi!
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
