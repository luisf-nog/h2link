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
  LayoutGrid,
  Columns,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- MAPEAMENTO DOS 20 SETORES ESTRATÉGICOS ---
const SECTOR_MAPPING: Record<string, string> = {
  "Construction Laborers": "Construção e Alvenaria",
  Stonemasons: "Construção e Alvenaria",
  "Painters, Construction and Maintenance": "Construção e Alvenaria",
  "Plasterers and Stucco Masons": "Construção e Alvenaria",
  "Cement Masons and Concrete Finishers": "Construção e Alvenaria",
  Carpenters: "Carpintaria e Estruturas",
  Roofers: "Carpintaria e Estruturas",
  "Structural Iron and Steel Workers": "Carpintaria e Estruturas",
  "Cabinetmakers and Bench Carpenters": "Carpintaria e Estruturas",
  Electricians: "Instalações e Elétrica",
  "Plumbers, Pipefitters, and Steamfitters": "Instalações e Elétrica",
  "Solar Photovoltaic Installers": "Instalações e Elétrica",
  "Farmworkers and Laborers, Crop, Nursery, and Greenhouse": "Agricultura e Colheita",
  "Graders and Sorters, Agricultural Products": "Agricultura e Colheita",
  "Agricultural Equipment Operators": "Maquinário Agrícola",
  "Packers and Packagers, Agricultural": "Maquinário Agrícola",
  "Hotel, Motel, and Resort Desk Clerks": "Hotelaria e Recepção",
  Concierges: "Hotelaria e Recepção",
  "Maids and Housekeeping Cleaners": "Limpeza e Governança",
  "Janitors and Cleaners": "Limpeza e Governança",
  "Cooks, Restaurant": "Cozinha e Gastronomia",
  "Cooks, Fast Food": "Cozinha e Gastronomia",
  Bakers: "Cozinha e Gastronomia",
  Baristas: "Bar e Cafeteria",
  Bartenders: "Bar e Cafeteria",
  "Waiters and Waitresses": "Atendimento de Salão",
  "Fast Food and Counter Workers": "Atendimento de Salão",
  Dishwashers: "Atendimento de Salão",
  "Laborers and Freight, Stock, and Material Movers, Hand": "Logística e Carga",
  "Packers and Packagers, Hand": "Logística e Carga",
  "Heavy and Tractor-Trailer Truck Drivers": "Transporte de Carga",
  "Light Truck or Delivery Services Drivers": "Transporte de Carga",
  "Team Assemblers": "Manufatura e Produção",
  "Assemblers and Fabricators, All Other": "Manufatura e Produção",
  "Welders, Cutters, Solderers, and Brazers": "Soldagem e Metalurgia",
  "Woodworking Machine Setters, Operators, and Tenders": "Indústria da Madeira",
  "Sawing Machine Setters, Operators, and Tenders, Wood": "Indústria da Madeira",
  "Textile Winding, Twisting, and Drawing Out Machine Setters": "Têxtil e Lavanderia",
  "Laundry and Dry-Cleaning Workers": "Têxtil e Lavanderia",
  "Meat, Poultry, and Fish Cutters and Trimmers": "Setor de Carnes",
  "Butchers and Meat Cutters": "Setor de Carnes",
  "Landscaping and Groundskeeping Workers": "Paisagismo e Jardinagem",
  "Tree Trimmers and Pruners": "Paisagismo e Jardinagem",
  "Retail Salespersons": "Vendas e Comércio",
  "Counter and Rental Clerks": "Vendas e Comércio",
  "Farm Equipment Mechanics and Service Technicians": "Mecânica e Manutenção",
  "Industrial Machinery Mechanics": "Mecânica e Manutenção",
  "Amusement and Recreation Attendants": "Recreação e Lazer",
  "Animal Trainers": "Recreação e Lazer",
  "First-Line Supervisors of Construction Trades": "Supervisão e Liderança",
  "First-Line Supervisors of Farming": "Supervisão e Liderança",
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
            const segment = SECTOR_MAPPING[curr.raw_category] || "Outros Serviços Gerais";
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
      toast({ title: "Radar Atualizado!" });
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
      toast({ title: "Enviado!", className: "bg-emerald-600 text-white" });
    } catch (err) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const sectorEntries = useMemo(() => Object.entries(groupedCategories).sort(), [groupedCategories]);
  const leftSectors = useMemo(() => sectorEntries.slice(0, 10), [sectorEntries]);
  const rightSectors = useMemo(() => sectorEntries.slice(10, 20), [sectorEntries]);

  if (!isPremium)
    return (
      <div className="p-20 text-center">
        <RadarIcon className="h-20 w-20 mx-auto text-slate-200 animate-pulse" />
        <Button onClick={() => navigate("/plans")} className="mt-6">
          Upgrade to Diamond
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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24 px-4 sm:px-6 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES E CATEGORIAS */}
        <div className="lg:col-span-6 space-y-6">
          {/* HEADER E AÇÃO */}
          <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-3 rounded-2xl transition-all",
                    isActive ? "bg-emerald-500 text-white shadow-lg animate-pulse" : "bg-slate-100 text-slate-400",
                  )}
                >
                  <RadarIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase italic leading-none text-slate-900">Radar Diamond</h1>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {isActive ? "Monitoramento Ativo" : "Sistema em Standby"}
                  </span>
                </div>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(val) => {
                  setIsActive(val);
                  performSave({ is_active: val });
                }}
                disabled={saving}
              />
            </div>
            {hasChanges && (
              <Button
                onClick={() => performSave()}
                disabled={saving}
                className="w-full bg-indigo-600 text-white font-black h-12 rounded-xl shadow-md transition-all active:scale-95"
              >
                <Save className="h-4 w-4 mr-2" /> APLICAR ALTERAÇÕES
              </Button>
            )}
          </div>

          {/* PAINEL DE INTELIGÊNCIA (FILTROS) */}
          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/30 flex justify-between items-center flex-row">
              <CardTitle className="text-xs font-black uppercase text-slate-500 flex items-center gap-2 italic">
                <ShieldCheck className="h-4 w-4" /> Inteligência e Filtros
              </CardTitle>
              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                <Label className="text-[10px] font-bold text-indigo-700 cursor-pointer">Auto-Enviar</Label>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} className="scale-75" />
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-9 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer</SelectItem>
                      {VISA_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Estado</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-9 rounded-lg">
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
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Salário Mín.</Label>
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="h-9 rounded-lg font-bold"
                    placeholder="$"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Exp Máx.</Label>
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="h-9 rounded-lg font-bold"
                    placeholder="Meses"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SELETOR DE CATEGORIAS (2 COLUNAS) */}
          <Card className="border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b bg-slate-50/30">
              <CardTitle className="text-xs font-black uppercase text-slate-500 flex items-center gap-2 italic">
                <LayoutGrid className="h-4 w-4" /> 20 Divisões Diamond
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 bg-slate-50/20">
              <div className="grid grid-cols-2 gap-3">
                {/* COLUNA 1 */}
                <div className="space-y-2">
                  {leftSectors.map(([segment, data]) => (
                    <div
                      key={segment}
                      className="border bg-white rounded-xl overflow-hidden shadow-sm hover:border-indigo-200 transition-colors"
                    >
                      <div
                        className="p-2 cursor-pointer flex items-center justify-between"
                        onClick={() =>
                          setExpandedSegments((p) =>
                            p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                          )
                        }
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-[9px] font-black text-slate-700 uppercase leading-none">{segment}</span>
                          <span className="text-[7px] font-bold text-indigo-600 uppercase mt-1">
                            {data.totalJobs} Vagas Totais
                          </span>
                        </div>
                        {expandedSegments.includes(segment) ? (
                          <ChevronDown className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                      {expandedSegments.includes(segment) && (
                        <div className="p-2 bg-slate-50/50 border-t flex flex-col gap-1">
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
                                "p-1.5 rounded-lg border text-left text-[8px] font-bold transition-all",
                                selectedCategories.includes(cat.raw_category)
                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                  : "bg-white text-slate-500",
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
                {/* COLUNA 2 */}
                <div className="space-y-2">
                  {rightSectors.map(([segment, data]) => (
                    <div
                      key={segment}
                      className="border bg-white rounded-xl overflow-hidden shadow-sm hover:border-indigo-200 transition-colors"
                    >
                      <div
                        className="p-2 cursor-pointer flex items-center justify-between"
                        onClick={() =>
                          setExpandedSegments((p) =>
                            p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                          )
                        }
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-[9px] font-black text-slate-700 uppercase leading-none">{segment}</span>
                          <span className="text-[7px] font-bold text-indigo-600 uppercase mt-1">
                            {data.totalJobs} Vagas Totais
                          </span>
                        </div>
                        {expandedSegments.includes(segment) ? (
                          <ChevronDown className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                      {expandedSegments.includes(segment) && (
                        <div className="p-2 bg-slate-50/50 border-t flex flex-col gap-1">
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
                                "p-1.5 rounded-lg border text-left text-[8px] font-bold transition-all",
                                selectedCategories.includes(cat.raw_category)
                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                  : "bg-white text-slate-500",
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

        {/* COLUNA DIREITA: FILA DE MATCHES */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4 text-left">
            <div>
              <h2 className="text-xl font-black uppercase italic text-slate-900 flex items-center gap-2">
                <Target className="h-6 w-6 text-indigo-600" /> Fila de Matches
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Vagas compatíveis com seu perfil
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchMatches} className="text-slate-400 hover:text-indigo-600">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Badge className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-full shadow-lg">
                {matchCount} Vagas
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[85vh] pr-2 custom-scrollbar">
            {matchedJobs.length > 0 ? (
              matchedJobs.map((match) => {
                const job = match.public_jobs;
                if (!job) return null;
                return (
                  <Card
                    key={match.id}
                    className="group border-slate-200 hover:border-indigo-300 transition-all shadow-sm bg-white overflow-hidden"
                  >
                    <CardContent className="p-0 flex flex-col md:flex-row md:items-stretch">
                      <div className="p-4 flex-1 text-left space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-700 text-[9px] border-emerald-100 uppercase font-black">
                            {job.visa_type}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 font-mono">
                            <MapPin className="h-3 w-3" /> {job.state}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1">
                            <Users className="h-3 w-3" /> {job.openings || 1} Vagas
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight uppercase">{job.category}</h3>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-[11px] font-black text-slate-700 uppercase italic leading-none">
                            {job.company || "Empresa"}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 pt-1">
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <CircleDollarSign className="h-3.5 w-3.5 text-indigo-600" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> {job.experience_months || 0}m exp
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-4 flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 min-w-[150px]">
                        <Button
                          onClick={() => handleSendApplication(match.id, job.id)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-9 px-6 rounded-xl shadow-md w-full transition-all active:scale-95"
                        >
                          <Send className="h-3 w-3 mr-1" /> ENVIAR
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                          className="text-[9px] font-black h-8 w-full border-slate-300 hover:bg-white flex items-center gap-2"
                        >
                          <Eye className="h-3 w-3" /> VER NO HUB
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => removeMatch(match.id)}
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-300 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-32 bg-slate-50/30 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-4 text-center">
                <RadarIcon className="h-12 w-12 text-slate-200 animate-pulse" />
                <p className="text-sm font-black text-slate-400 uppercase italic">Aguardando Varredura...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
