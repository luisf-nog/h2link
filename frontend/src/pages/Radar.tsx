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
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- MAPEAMENTO TÉCNICO (TRADUZ INGLÊS -> SETOR PT) ---
const SECTOR_MAPPING: Record<string, string> = {
  "Construction Laborers": "Construção Civil",
  "Cement Masons": "Construção Civil",
  Painters: "Construção Civil",
  Carpenters: "Carpintaria e Estruturas",
  Roofers: "Carpintaria e Estruturas",
  "Structural Iron": "Carpintaria e Estruturas",
  Electricians: "Instalações e Elétrica",
  Plumbers: "Instalações e Elétrica",
  "Solar Photovoltaic": "Instalações e Elétrica",
  Farmworkers: "Agricultura e Colheita",
  "Graders and Sorters": "Agricultura e Colheita",
  "Agricultural Equipment": "Maquinário Agrícola",
  "Packers and Packagers, Agricultural": "Maquinário Agrícola",
  "Hotel, Motel": "Hotelaria e Recepção",
  Concierges: "Hotelaria e Recepção",
  "Baggage Porters": "Hotelaria e Recepção",
  "Maids and Housekeeping": "Limpeza e Governança",
  "Janitors and Cleaners": "Limpeza e Governança",
  Cooks: "Cozinha e Gastronomia",
  Bakers: "Cozinha e Gastronomia",
  "Food Preparation": "Cozinha e Gastronomia",
  Baristas: "Bar e Cafeteria",
  Bartenders: "Bar e Cafeteria",
  "Waiters and Waitresses": "Atendimento de Salão",
  "Fast Food and Counter": "Atendimento de Salão",
  Dishwashers: "Atendimento de Salão",
  "Laborers and Freight": "Logística e Carga",
  "Packers and Packagers, Hand": "Logística e Carga",
  "Stockers and Order Fillers": "Logística e Carga",
  "Heavy and Tractor-Trailer Truck Drivers": "Transporte de Carga",
  "Light Truck": "Transporte de Carga",
  "Shuttle Drivers": "Transporte de Carga",
  "Team Assemblers": "Manufatura e Produção",
  "Assemblers and Fabricators": "Manufatura e Produção",
  "Production Workers": "Manufatura e Produção",
  "Welders, Cutters": "Soldagem e Metalurgia",
  Woodworking: "Indústria da Madeira",
  "Sawing Machine": "Indústria da Madeira",
  Textile: "Têxtil e Lavanderia",
  Laundry: "Têxtil e Lavanderia",
  "Meat, Poultry": "Setor de Carnes",
  Butchers: "Setor de Carnes",
  Slaughterers: "Setor de Carnes",
  Landscaping: "Paisagismo e Jardinagem",
  "Tree Trimmers": "Paisagismo e Jardinagem",
  "Retail Salespersons": "Vendas e Comércio",
  "Counter and Rental": "Vendas e Comércio",
  "Farm Equipment Mechanics": "Mecânica e Manutenção",
  "Industrial Machinery Mechanics": "Mecânica e Manutenção",
  "Maintenance and Repair": "Mecânica e Manutenção",
  "Amusement and Recreation": "Recreação e Lazer",
  "Animal Trainers": "Recreação e Lazer",
  "Animal Caretakers": "Cuidado Animal",
  "First-Line Supervisors": "Supervisão e Liderança",
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

  const hasChanges = useMemo(() => {
    if (!radarProfile) return false;
    const dbCats = radarProfile.categories || [];
    const catsChanged = JSON.stringify([...selectedCategories].sort()) !== JSON.stringify([...dbCats].sort());
    return (
      isActive !== (radarProfile.is_active ?? false) ||
      autoSend !== (radarProfile.auto_send ?? false) ||
      catsChanged ||
      minWage !== (radarProfile.min_wage?.toString() || "") ||
      maxExperience !== (radarProfile.max_experience?.toString() || "") ||
      visaType !== (radarProfile.visa_type || "all") ||
      stateFilter !== (radarProfile.state || "all")
    );
  }, [isActive, autoSend, selectedCategories, minWage, maxExperience, visaType, stateFilter, radarProfile]);

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
            // Tenta encontrar o setor mapeado usando includes para maior abrangência
            const entry = Object.entries(SECTOR_MAPPING).find(([key]) => raw.includes(key));
            const segment = entry ? entry[1] : "Serviços Gerais";

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
      toast({ title: "Radar System Updated", className: "bg-indigo-600 text-white" });
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
      toast({ title: "Task Routed to Queue", className: "bg-emerald-600 text-white" });
    } catch (err) {
      toast({ title: "Routing Error", variant: "destructive" });
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

  const sortedSectors = useMemo(() => Object.entries(groupedCategories).sort(), [groupedCategories]);
  const leftSectors = useMemo(() => sortedSectors.slice(0, 10), [sortedSectors]);
  const rightSectors = useMemo(() => sortedSectors.slice(10, 20), [sortedSectors]);

  if (!isPremium)
    return (
      <div className="p-20 text-center">
        <Cpu className="h-20 w-20 mx-auto text-slate-200 animate-pulse" />
        <Button onClick={() => navigate("/plans")} className="mt-6">
          Unlock Pro Technology
        </Button>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600/50" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24 px-4 sm:px-6 text-left font-mono">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: SYSTEM CONTROL & CATEGORIES */}
        <div className="lg:col-span-6 space-y-6">
          {/* SYSTEM STATUS HEADER */}
          <div className="flex flex-col gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "p-4 rounded-xl transition-all border",
                    isActive
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-500",
                  )}
                >
                  <RadarIcon className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tighter text-white">
                    H2 Linker Radar <span className="text-indigo-500 font-normal">v2.0</span>
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Activity className={cn("h-3 w-3", isActive ? "text-emerald-500" : "text-slate-600")} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {isActive ? "System Live / Scanning" : "System Standby"}
                    </span>
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
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
            {hasChanges && (
              <Button
                onClick={() => performSave()}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-xl shadow-lg border border-indigo-400/30"
              >
                <Database className="h-4 w-4 mr-2" /> OVERWRITE SYSTEM CONFIG
              </Button>
            )}
          </div>

          {/* INTEL FILTERS */}
          <Card className="border-slate-800 bg-slate-900 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center flex-row">
              <CardTitle className="text-[11px] font-black uppercase text-indigo-400 flex items-center gap-2 tracking-[0.2em]">
                <ShieldCheck className="h-4 w-4" /> Intelligence Filters
              </CardTitle>
              <div className="flex items-center gap-3 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                <Label className="text-[10px] font-bold text-slate-300 cursor-pointer uppercase">Auto-Route</Label>
                <Switch
                  checked={autoSend}
                  onCheckedChange={setAutoSend}
                  className="scale-75 data-[state=checked]:bg-indigo-500"
                />
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Visa Type</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                      <SelectItem value="all">All Protocols</SelectItem>
                      {VISA_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    Geographic Zone
                  </Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                      <SelectItem value="all">Full USA</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    Min Wage ($/h)
                  </Label>
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-9 bg-slate-800 border-slate-700 text-white font-bold text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    Max Exp (Months)
                  </Label>
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-9 bg-slate-800 border-slate-700 text-white font-bold text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 20 SECTOR CONTROL (2 COLUMNS) */}
          <Card className="border-slate-800 bg-slate-900 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-800 bg-slate-950/50">
              <CardTitle className="text-[11px] font-black uppercase text-indigo-400 flex items-center gap-2 tracking-[0.2em]">
                <Settings2 className="h-4 w-4" /> Sector Core Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-slate-900/50">
              <div className="grid grid-cols-2 gap-4">
                {/* COLUMN 1 */}
                <div className="space-y-2">
                  {leftSectors.map(([segment, data]) => (
                    <div
                      key={segment}
                      className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all"
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
                          <span className="text-[10px] font-black text-slate-200 uppercase tracking-tight">
                            {segment}
                          </span>
                          <span className="text-[8px] font-bold text-indigo-500 uppercase">
                            {data.totalJobs} Entries Found
                          </span>
                        </div>
                        {expandedSegments.includes(segment) ? (
                          <ChevronDown className="h-3 w-3 text-indigo-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-700" />
                        )}
                      </div>
                      {expandedSegments.includes(segment) && (
                        <div className="p-2 bg-slate-900/80 border-t border-slate-800 flex flex-col gap-1.5">
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
                                  ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200",
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
                {/* COLUMN 2 */}
                <div className="space-y-2">
                  {rightSectors.map(([segment, data]) => (
                    <div
                      key={segment}
                      className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all"
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
                          <span className="text-[10px] font-black text-slate-200 uppercase tracking-tight">
                            {segment}
                          </span>
                          <span className="text-[8px] font-bold text-indigo-500 uppercase">
                            {data.totalJobs} Entries Found
                          </span>
                        </div>
                        {expandedSegments.includes(segment) ? (
                          <ChevronDown className="h-3 w-3 text-indigo-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-700" />
                        )}
                      </div>
                      {expandedSegments.includes(segment) && (
                        <div className="p-2 bg-slate-900/80 border-t border-slate-800 flex flex-col gap-1.5">
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
                                  ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200",
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

        {/* COLUNA DIREITA: LIVE MATCH STREAM */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 text-left">
            <div>
              <h2 className="text-xl font-black uppercase italic text-white flex items-center gap-3">
                <Target className="h-6 w-6 text-indigo-500" /> Match Detection Stream
              </h2>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
                Real-time database sync for h2-linker protocol
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchMatches}
                className="text-slate-500 hover:text-indigo-400 hover:bg-slate-800"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Badge className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                {matchCount} Signal(s)
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
                    className="group border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-indigo-500/50 transition-all shadow-sm overflow-hidden"
                  >
                    <CardContent className="p-0 flex flex-col md:flex-row md:items-stretch">
                      <div className="p-4 flex-1 text-left space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/10 text-emerald-500 text-[9px] border-emerald-500/20 uppercase font-black px-2">
                            {job.visa_type}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 font-mono border-l border-slate-800 pl-2">
                            <MapPin className="h-3 w-3 text-slate-500" /> {job.state}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1 border-l border-slate-800 pl-2">
                            <Users className="h-3 w-3" /> {job.openings || 1} Vagas
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-100 leading-tight uppercase tracking-tight">
                          {job.category}
                        </h3>
                        <div className="flex items-center gap-2 border-l-2 border-indigo-600 pl-3 py-1 bg-slate-950/40">
                          <Building2 className="h-3.5 w-3.5 text-slate-500" />
                          <p className="text-[11px] font-black text-indigo-300 uppercase italic leading-none">
                            {job.company || "System identified"}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <span className="text-[11px] font-black text-white flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                            <CircleDollarSign className="h-3.5 w-3.5 text-indigo-500" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="text-[11px] font-black text-white flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-100/10">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-500" /> {job.experience_months || 0}m exp
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-950/50 p-4 flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 min-w-[160px]">
                        <Button
                          onClick={() => handleSendApplication(match.id, job.id)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-9 px-6 rounded-xl shadow-md w-full transition-all active:scale-95 border border-emerald-400/30"
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" /> ROUTE TASK
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                          className="text-[9px] font-black h-8 w-full border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                        >
                          <Eye className="h-3.5 w-3.5" /> HUB PREVIEW
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => removeMatch(match.id)}
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-red-500 transition-colors mt-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-32 bg-slate-950/30 rounded-[3rem] border-2 border-dashed border-slate-800 flex flex-col items-center gap-5 text-center">
                <Cpu className="h-14 w-14 text-slate-800 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-600 uppercase tracking-[0.3em]">Scanning Database...</p>
                  <p className="text-[10px] text-slate-700">No new matching protocols detected in current cycle.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
