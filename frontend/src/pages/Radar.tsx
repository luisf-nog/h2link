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
  Satellite,
  Sparkles,
  Clock,
  Activity,
  Search,
  Filter,
  Globe,
  Settings2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Visual Components with improved contrast & hierarchy ---

const HeroPanel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={cn(
      "relative rounded-2xl border bg-card",
      "shadow-[0_4px_24px_-4px_hsl(var(--foreground)/0.08)]",
      "border-border",
      className,
    )}
  >
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
  <div className="flex flex-col gap-3 p-5">
    <div className="flex items-center justify-between">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <div className="space-y-1">
      <div className="text-3xl leading-none font-bold tracking-tight text-foreground">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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
        "group relative rounded-xl border transition-all duration-200 overflow-hidden",
        "p-4 cursor-pointer",
        allSelected
          ? "border-primary/40 bg-primary/[0.06] shadow-sm"
          : partialSelected
            ? "border-primary/25 bg-primary/[0.03] hover:border-primary/35"
            : "border-border bg-card hover:border-primary/25 hover:shadow-sm",
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
          "absolute left-0 top-0 bottom-0 w-1 transition-all duration-200",
          allSelected ? "bg-primary" : partialSelected ? "bg-primary/50" : "bg-transparent group-hover:bg-primary/20",
        )}
      />

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex-1 space-y-2">
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
              <div className="flex items-center gap-2 text-xs mt-0.5">
                <span className="text-muted-foreground">{formatNumber(data.totalJobs)} vagas</span>

                {allSelected && (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/25 text-[10px] font-semibold"
                  >
                    Monitorando
                  </Badge>
                )}

                {partialSelected && (
                  <Badge
                    variant="outline"
                    className="bg-primary/5 text-primary/70 border-primary/20 text-[10px] font-semibold"
                  >
                    Parcial
                  </Badge>
                )}

                {totalInSector > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
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
              "h-4 w-4 text-muted-foreground transition-transform duration-200 mt-1",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </div>

      {/* Expanded subcategories */}
      {isExpanded && data.items.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border/60 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {data.items.map((item: any) => {
            const checked = isTracked.includes(item.raw_category);
            return (
              <div key={item.raw_category} className="flex items-center justify-between pl-9">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      checked ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="text-xs text-muted-foreground truncate">{item.raw_category}</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{formatNumber(item.count)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const JobCard = ({ job, match, onApply, onView, onDismiss }: any) => (
  <div className="group relative rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 p-5 space-y-4">
    {/* Top metadata */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] font-semibold border-border bg-muted/50">
          {job.visa_type}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {job.state}
        </span>
      </div>
    </div>

    {/* Job title */}
    <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
      {job.category}
    </h3>

    {/* Key metrics */}
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border border-border">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Salário</span>
        <span className="text-sm font-bold text-foreground">${job.salary ? formatNumber(job.salary) : "N/A"}/hr</span>
      </div>
      <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border border-border">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exp.</span>
        <span className="text-sm font-bold text-foreground">{job.experience_months || 0} meses</span>
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex items-center gap-2 pt-2">
      <Button
        onClick={() => onApply(match.id, job.id)}
        className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm transition-all"
      >
        <Send className="h-4 w-4 mr-2" /> Candidatar
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
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
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

  // --- Filter display helpers ---
  const wageDisplay = minWage ? `$${formatNumber(Number(minWage))}+/hr` : "Qualquer salário";
  const stateDisplay = stateFilter !== "all" ? stateFilter : "Todos os estados";
  const expDisplay = maxExperience ? `Até ${maxExperience} meses exp.` : "Qualquer experiência";
  const visaDisplay = visaType !== "all" ? visaType : "Todos os vistos";

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
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
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

      toast({ title: "Candidatura adicionada à fila de envio!" });
    } catch (err) {
      toast({ title: "Erro ao enviar candidatura", variant: "destructive" });
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
      toast({ title: "Erro", variant: "destructive" });
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500">

      {/* ═══════════════════════════════════════════════════════════════
          LEVEL 1: RADAR STATUS + ACTIVE CRITERIA
      ═══════════════════════════════════════════════════════════════ */}
      <HeroPanel className="p-6 md:p-8">
        <div className="space-y-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                <Satellite className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">Job Radar</h1>
                <p className="text-xs text-muted-foreground">
                  Busca automática 24/7 por vagas que combinam com você
                </p>
              </div>
            </div>

            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold",
              isActive
                ? "bg-success/10 border-success/30 text-success"
                : "bg-muted border-border text-muted-foreground"
            )}>
              <div className={cn("h-2 w-2 rounded-full", isActive ? "bg-success animate-pulse" : "bg-muted-foreground/40")} />
              {isActive ? "Radar Ativo" : "Radar Pausado"}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Active Criteria Chips — always visible */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3">
              Critérios de busca — o radar só mostra vagas que atendem a TODOS estes filtros:
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
                {wageDisplay}
              </button>
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {stateDisplay}
              </button>
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <Briefcase className="h-3.5 w-3.5 text-primary" />
                {expDisplay}
              </button>
              <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <Globe className="h-3.5 w-3.5 text-primary" />
                {visaDisplay}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Control Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Radar Mode */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Modo do Radar
              </label>
              <div className="flex gap-3">
                {(["manual", "autopilot"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRadarMode(mode)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 border",
                      radarMode === mode
                        ? mode === "autopilot"
                          ? "bg-success/10 border-success/30 text-success"
                          : "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:border-primary/25 hover:bg-muted/60",
                    )}
                  >
                    {mode === "manual" ? "Manual" : "🤖 Autopilot"}
                  </button>
                ))}
              </div>
              {radarMode === "autopilot" && (
                <p className="text-xs text-success/80 bg-success/5 border border-success/20 rounded-lg px-3 py-2">
                  O sistema envia candidaturas automaticamente para vagas compatíveis. Você não precisa fazer nada!
                </p>
              )}
            </div>

            {/* Right: Radar Control */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Controle
              </label>
              <Button
                onClick={() => {
                  const next = !isActive;
                  setIsActive(next);
                  performSave({ is_active: next });
                }}
                className={cn(
                  "w-full h-12 rounded-lg font-semibold transition-all duration-200",
                  isActive
                    ? "bg-muted text-foreground border border-border hover:bg-muted/80"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {isActive ? "⏸ Pausar Radar" : "▶ Ativar Radar"}
              </Button>
            </div>
          </div>
        </div>
      </HeroPanel>

      {/* ═══════════════════════════════════════════════════════════════
          LEVEL 2: METRICS
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HeroPanel>
          <MetricCard label="Vagas Encontradas" value={formatNumber(totalSinaisGeral)} icon={Activity} subtitle="No total" />
        </HeroPanel>
        <HeroPanel>
          <MetricCard label="Matches" value={formatNumber(matchCount)} icon={Target} subtitle="Prontos para envio" />
        </HeroPanel>
        <HeroPanel>
          <MetricCard label="Setores" value={formatNumber(selectedCategories.length)} icon={Globe} subtitle="Monitorados" />
        </HeroPanel>
        <HeroPanel>
          <MetricCard label="Frequência" value="24/7" icon={Clock} subtitle="Contínuo" />
        </HeroPanel>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LEVEL 3: SECTOR TARGETING + LIVE FEED
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Left: Targeting Configuration — subtle background difference */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Setores Monitorados
            </h2>
            <span className="text-xs text-muted-foreground">
              Selecione os setores → vagas aparecem ao lado
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-1">
            <HeroPanel className="border-0 shadow-none bg-card">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2 p-4">
                  {sectorEntries.map(([segment, data]) => {
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
                        onToggleAllInSector={() => {
                          const sectorCats = data.items.map((i: any) => i.raw_category);
                          setSelectedCategories((prev) =>
                            allSelected
                              ? prev.filter((c) => !sectorCats.includes(c))
                              : [...new Set([...prev, ...sectorCats])],
                          );
                        }}
                        onExpand={() => {
                          const next = new Set(expandedSectors);
                          isExpanded ? next.delete(segment) : next.add(segment);
                          setExpandedSectors(next);
                        }}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </HeroPanel>
          </div>

          {hasChangesComputed && (
            <Button
              onClick={() => performSave()}
              disabled={saving}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Salvar Configuração
            </Button>
          )}
        </div>

        {/* Right: Live Detection Feed */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Vagas Encontradas
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Em tempo real</span>
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            </div>
          </div>

          <HeroPanel className="flex flex-col min-h-[500px]">
            <ScrollArea className="flex-1 h-[500px]">
              <div className="p-4 space-y-3">
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
                      />
                    );
                  })
                ) : (
                  <div className="h-[450px] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-5 rounded-full bg-muted/50 border border-border">
                      <Search className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Buscando vagas...</p>
                      <p className="text-xs text-muted-foreground max-w-[260px]">
                        Selecione setores à esquerda e ative o radar para encontrar vagas compatíveis.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </HeroPanel>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          FILTERS DIALOG
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-2xl bg-card border-border rounded-2xl p-6 md:p-8">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-bold">Critérios de Busca</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Defina os parâmetros mínimos. O radar só mostra vagas que atendem a <strong>todos</strong> os critérios abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Salário mínimo por hora
                </Label>
                <div className="relative">
                  <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-10 pl-10 rounded-lg border-border font-medium"
                    placeholder="Ex: 16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    USD/HR
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Experiência máxima exigida (meses)
                </Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-10 pl-10 rounded-lg border-border font-medium"
                    placeholder="Ex: 12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    meses
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Estado (EUA)</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-10 rounded-lg border-border font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border">
                    <SelectItem value="all" className="font-medium">
                      Todos os estados
                    </SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s} className="font-medium">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Tipo de Visto
                </Label>
                <Select value={visaType} onValueChange={setVisaType}>
                  <SelectTrigger className="h-10 rounded-lg border-border font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border">
                    {VISA_TYPE_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value} className="font-medium">
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
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            Aplicar Filtros
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
