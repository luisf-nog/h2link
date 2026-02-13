import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import {
  Radar as RadarIcon,
  Zap,
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
  Cpu,
  Database,
  Activity,
  LayoutGrid,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- MAPEAMENTO LÓGICO (VINCULADO AO SEU CSV) ---
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "Agricultura e Colheita": ["Farmworkers", "Crop", "Nursery", "Harvest", "Agricultural"],
  "Maquinário Agrícola": ["Equipment Operators", "Tractor", "Agricultural Equipment"],
  "Construção Civil": ["Construction", "Laborers", "Cement", "Masons", "Concrete", "Fence"],
  "Carpintaria e Marcenaria": ["Carpenters", "Cabinetmakers", "Roofers"],
  "Instalações e Manutenção": ["Electricians", "Installation", "Maintenance", "Repair", "Plumbers"],
  "Mecânica e Reparos": ["Mechanics", "Service Technicians", "Automotive", "Diesel"],
  "Limpeza e Governança": ["Maids", "Housekeeping", "Janitors", "Cleaners"],
  "Cozinha e Gastronomia": ["Cooks", "Bakers", "Food Preparation"],
  "Atendimento de Salão": ["Waiters", "Waitresses", "Dining Room", "Dishwashers"],
  "Hotelaria e Recepção": ["Hotel", "Resort", "Desk Clerks", "Concierges"],
  "Bar e Cafeteria": ["Baristas", "Bartenders"],
  "Logística e Carga": ["Laborers", "Freight", "Stock", "Packers", "Order Fillers"],
  "Transporte de Carga": ["Truck Drivers", "Shuttle", "Chauffeurs"],
  "Manufatura e Produção": ["Assemblers", "Fabricators", "Production Workers"],
  "Soldagem e Metalurgia": ["Welders", "Cutters", "Solderers"],
  "Indústria da Madeira": ["Woodworking", "Sawing Machine"],
  "Têxtil e Lavanderia": ["Textile", "Laundry", "Sewing"],
  "Setor de Carnes": ["Meat", "Poultry", "Butchers", "Slaughterers"],
  "Paisagismo e Jardinagem": ["Landscaping", "Groundskeeping", "Tree Trimmers"],
  "Vendas e Comércio": ["Salespersons", "Counter", "Cashiers"],
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
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [groupedCategories, setGroupedCategories] = useState<Record<string, { items: any[]; totalJobs: number }>>({});
  const [expandedSegments, setExpandedSegments] = useState<string[]>([]);
  const [radarProfile, setRadarProfile] = useState<any>(null);

  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

  const fetchMatches = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("radar_matched_jobs" as any)
      .select(`id, job_id, public_jobs!fk_radar_job (*)`)
      .eq("user_id", profile.id);
    if (!error && data) {
      setMatchedJobs(data);
      setMatchCount(data.length);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;
      try {
        setLoading(true);
        const { data: catData } = await supabase.rpc("get_category_stats_cached" as any);
        if (catData) {
          const grouped = (catData as any[]).reduce((acc: any, curr: any) => {
            const raw = curr.raw_category || "";
            let segment = "Serviços Gerais";
            for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
              if (keywords.some((kw) => raw.toLowerCase().includes(kw.toLowerCase()))) {
                segment = sector;
                break;
              }
            }
            if (!acc[segment]) acc[segment] = { items: [], totalJobs: 0 };
            acc[segment].items.push(curr);
            acc[segment].totalJobs += curr.count || 0;
            return acc;
          }, {});
          setGroupedCategories(grouped);
        }

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
        }
        await fetchMatches();
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile?.id]);

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
      }
      toast({ title: "Radar Synced", className: "bg-indigo-600 text-white" });
    }
    setSaving(false);
  };

  const handleSendApplication = async (matchId: string, jobId: string) => {
    try {
      await supabase.from("my_queue" as any).insert([{ user_id: profile?.id, job_id: jobId, status: "pending" }]);
      await supabase
        .from("radar_matched_jobs" as any)
        .delete()
        .eq("id", matchId);
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => Math.max(0, prev - 1));
      toast({ title: "Signal Captured!", className: "bg-indigo-600 text-white" });
    } catch (err) {
      toast({ title: "Routing Fail", variant: "destructive" });
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
    }
  };

  const sectorEntries = useMemo(() => Object.entries(groupedCategories).sort(), [groupedCategories]);
  const leftSectors = useMemo(() => sectorEntries.slice(0, 10), [sectorEntries]);
  const rightSectors = useMemo(() => sectorEntries.slice(10, 20), [sectorEntries]);

  if (!isPremium)
    return (
      <div className="p-20 text-center">
        <Radio className="h-20 w-20 mx-auto text-slate-200 animate-pulse" />
        <Button onClick={() => navigate("/plans")} className="mt-6 bg-indigo-600">
          Activate Radar Signal
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: RADAR INTERFACE */}
        <div className="lg:col-span-6 space-y-6">
          {/* CONTROL PANEL HEADER */}
          <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "p-4 rounded-xl transition-all border",
                    isActive
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-400",
                  )}
                >
                  <Radio className={cn("h-7 w-7", isActive && "animate-pulse")} />
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
                    H2 Linker Radar <span className="text-indigo-600 font-normal">Signal</span>
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    {isActive ? (
                      <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                          LIVE TRACKING
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        SYSTEM OFFLINE
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
                disabled={saving}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>
            {hasChanges && (
              <Button
                onClick={() => performSave()}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-xl shadow-lg border-b-4 border-indigo-800 transition-all active:border-b-0 active:translate-y-1"
              >
                <Save className="h-4 w-4 mr-2" /> SALVAR CONFIGURAÇÕES
              </Button>
            )}
          </div>

          {/* AUTOMATION FILTERS */}
          <Card className="border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-row">
              <CardTitle className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-2 tracking-[0.1em]">
                <ShieldCheck className="h-4 w-4 text-indigo-600" /> Inteligência e Filtros
              </CardTitle>
              <div className="flex items-center gap-3 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                <Label className="text-[10px] font-black text-indigo-700 cursor-pointer uppercase">Auto-Enviar</Label>
                <Switch
                  checked={autoSend}
                  onCheckedChange={setAutoSend}
                  className="scale-75 data-[state=checked]:bg-indigo-600"
                />
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-400 uppercase">Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-9 border-slate-200 text-slate-700 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISA_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-400 uppercase">Estado</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-9 border-slate-200 text-slate-700 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">EUA Inteiro</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-400 uppercase">Salário Mín.</Label>
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-9 border-slate-200 text-slate-900 font-black text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-400 uppercase">Exp Máx.</Label>
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-9 border-slate-200 text-slate-900 font-black text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTOR GRID (2 COLUMNS) */}
          <Card className="border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-2 tracking-[0.1em]">
                <LayoutGrid className="h-4 w-4 text-indigo-600" /> 20 Divisões de Trabalho
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-slate-50/20">
              <div className="grid grid-cols-2 gap-4">
                {/* LADO A */}
                <div className="space-y-2">
                  {leftSectors.map(([segment, data]) => (
                    <div
                      key={segment}
                      className="border border-slate-200 bg-white rounded-xl overflow-hidden group hover:border-indigo-400 transition-all shadow-sm"
                    >
                      <div
                        className="p-2.5 cursor-pointer flex items-center justify-between"
                        onClick={() =>
                          setExpandedSegments((p) =>
                            p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                          )
                        }
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-black text-slate-700 uppercase leading-none">
                            {segment}
                          </span>
                          <span className="text-[8px] font-bold text-indigo-600 uppercase mt-1.5">
                            {data.totalJobs} Vagas Disponíveis
                          </span>
                        </div>
                        {expandedSegments.includes(segment) ? (
                          <ChevronDown className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                      {expandedSegments.includes(segment) && (
                        <div className="p-2 bg-slate-50 border-t border-slate-100 flex flex-col gap-1.5">
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
                                "p-2 rounded-lg border text-left text-[9px] font-bold leading-tight transition-all",
                                selectedCategories.includes(cat.raw_category)
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                                  : "bg-white text-slate-500 hover:border-indigo-200",
                              )}
                            >
                              {cat.raw_category}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* LADO B */}
                <div className="space-y-2">
                  {rightSectors.map(([segment, data]) => (
                    <div
                      key={segment}
                      className="border border-slate-200 bg-white rounded-xl overflow-hidden group hover:border-indigo-400 transition-all shadow-sm"
                    >
                      <div
                        className="p-2.5 cursor-pointer flex items-center justify-between"
                        onClick={() =>
                          setExpandedSegments((p) =>
                            p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                          )
                        }
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-black text-slate-700 uppercase leading-none">
                            {segment}
                          </span>
                          <span className="text-[8px] font-bold text-indigo-600 uppercase mt-1.5">
                            {data.totalJobs} Vagas Disponíveis
                          </span>
                        </div>
                        {expandedSegments.includes(segment) ? (
                          <ChevronDown className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                      {expandedSegments.includes(segment) && (
                        <div className="p-2 bg-slate-50 border-t border-slate-100 flex flex-col gap-1.5">
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
                                "p-2 rounded-lg border text-left text-[9px] font-bold leading-tight transition-all",
                                selectedCategories.includes(cat.raw_category)
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                                  : "bg-white text-slate-500 hover:border-indigo-200",
                              )}
                            >
                              {cat.raw_category}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: LIVE MATCHES */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 text-left">
            <div>
              <h2 className="text-xl font-black uppercase italic text-slate-900 flex items-center gap-3">
                <Target className="h-6 w-6 text-indigo-600" /> Detecção de Matches
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                Sincronização em tempo real h2-linker protocol
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={fetchMatches} className="text-slate-400 hover:text-indigo-600">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Badge className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-full shadow-lg">
                {matchCount} Vagas
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[85vh] pr-2 custom-scrollbar">
            {matchedJobs.length > 0 ? (
              matchedJobs.map((match) => {
                const job = match.public_jobs;
                if (!job) return null;
                return (
                  <Card
                    key={match.id}
                    className="group border-slate-200 bg-white hover:border-indigo-400 transition-all shadow-sm overflow-hidden"
                  >
                    <CardContent className="p-0 flex flex-col md:flex-row md:items-stretch">
                      <div className="p-4 flex-1 text-left space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-indigo-50 text-indigo-600 text-[9px] border-indigo-100 uppercase font-black px-2">
                            {job.visa_type}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 font-mono border-l border-slate-100 pl-2">
                            <MapPin className="h-3 w-3 text-slate-400" /> {job.state}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1 border-l border-slate-100 pl-2">
                            <Users className="h-3 w-3 text-indigo-400" /> {job.openings || 1} Vagas
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">
                          {job.category}
                        </h3>
                        <div className="flex items-center gap-2 border-l-2 border-indigo-600 pl-3 py-1 bg-slate-50/50">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-[11px] font-black text-indigo-900 uppercase italic leading-none">
                            {job.company || "Empresa Identificada"}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <CircleDollarSign className="h-3.5 w-3.5 text-indigo-600" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> {job.experience_months || 0}m exp
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-4 flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 min-w-[160px]">
                        <Button
                          onClick={() => handleSendApplication(match.id, job.id)}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] h-9 px-6 rounded-xl shadow-md w-full transition-all active:scale-95 border-b-2 border-indigo-900"
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" /> ENVIAR
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                          className="text-[9px] font-black h-8 w-full border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Eye className="h-3.5 w-3.5" /> VER HUB
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => removeMatch(match.id)}
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 transition-colors mt-1"
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
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Aguardando Sinais...</p>
                  <p className="text-[10px] text-slate-400">Ative o Radar para iniciar a varredura global.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
