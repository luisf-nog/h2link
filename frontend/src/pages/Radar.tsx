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
  Rocket,
  Trash2,
  Send,
  MapPin,
  CircleDollarSign,
  Briefcase,
  Check,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

// Interface para evitar erros de Build
interface RadarProfile {
  id: string;
  user_id: string;
  is_active: boolean;
  auto_send: boolean;
  categories: string[];
  min_wage: number | null;
  max_experience: number | null;
  visa_type: string | null;
  state: string | null;
  last_scan_at?: string;
}

export default function Radar() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [groupedCategories, setGroupedCategories] = useState<Record<string, any[]>>({});
  const [expandedSegments, setExpandedSegments] = useState<string[]>([]);
  const [radarProfile, setRadarProfile] = useState<RadarProfile | null>(null);

  // Estados Locais do Form
  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

  // --- LÓGICA DE DETECÇÃO DE ALTERAÇÕES ---
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

  // --- BUSCA OS MATCHES (COLUNA DIREITA) ---
  const fetchMatches = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from("radar_matched_jobs")
        .select(
          `
          id,
          job_id,
          public_jobs!fk_radar_job (*)
        `,
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMatchedJobs(data || []);
      setMatchCount(data?.length || 0);
    } catch (err) {
      console.error("Erro ao buscar matches:", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;
      try {
        setLoading(true);
        // Categorias Agrupadas
        const { data: catData } = await supabase.rpc("get_category_stats_cached" as any);
        if (catData) {
          const grouped = catData.reduce((acc: any, curr: any) => {
            if (!acc[curr.segment_name]) acc[curr.segment_name] = [];
            acc[curr.segment_name].push(curr);
            return acc;
          }, {});
          setGroupedCategories(grouped);
        }

        // Perfil
        const { data: prof } = await supabase
          .from("radar_profiles")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle();
        if (prof) {
          setRadarProfile(prof as RadarProfile);
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

  // --- FUNÇÃO DE SALVAMENTO ---
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

    try {
      const { error } = radarProfile
        ? await supabase.from("radar_profiles").update(payload).eq("user_id", profile.id)
        : await supabase.from("radar_profiles").insert(payload);

      if (error) throw error;

      setRadarProfile({ ...radarProfile, ...payload } as RadarProfile);

      if (payload.is_active) {
        // Gatilho Manual
        await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });
        await fetchMatches();
        toast({ title: "Radar Armado!", description: "Buscando histórico de vagas compatíveis..." });
      } else {
        toast({ title: "Radar Atualizado!" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectFullSegment = (segment: string) => {
    const subCats = groupedCategories[segment].map((c) => c.raw_category);
    const allSelected = subCats.every((c) => selectedCategories.includes(c));
    setSelectedCategories((prev) =>
      allSelected ? prev.filter((c) => !subCats.includes(c)) : [...new Set([...prev, ...subCats])],
    );
  };

  if (!isPremium)
    return (
      <div className="p-20 text-center">
        <RadarIcon className="h-20 w-20 mx-auto text-slate-200 animate-pulse" />
        <Button onClick={() => navigate("/plans")} className="mt-6">
          Upgrade to Premium
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
        {/* ESQUERDA: CONTROLES */}
        <div className="lg:col-span-5 space-y-6">
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
                  <h1 className="text-xl font-black uppercase italic leading-none">Radar H2 Linker</h1>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {isActive ? "Varredura Habilitada" : "Radar Desligado"}
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
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-xl"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} APLICAR
                ALTERAÇÕES
              </Button>
            )}
          </div>

          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/30">
              <CardTitle className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Inteligência
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="flex justify-between items-center p-4 bg-indigo-50/30 rounded-xl border border-indigo-100">
                <div className="text-left">
                  <Label className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Envio Automático
                  </Label>
                  <p className="text-[10px] text-slate-500">O robô aplicará no momento do match.</p>
                </div>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
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
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Salário Mín ($/h)</Label>
                  <Input
                    type="number"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Sua Exp Max (Meses)</Label>
                  <Input
                    type="number"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="rounded-xl font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b bg-slate-50/30 flex justify-between items-center">
              <CardTitle className="text-xs font-black uppercase text-slate-500 italic">Áreas Alvo</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1 max-h-[400px] overflow-y-auto">
              {Object.entries(groupedCategories).map(([segment, items]) => (
                <div key={segment} className="border rounded-xl overflow-hidden mb-1">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
                    onClick={() =>
                      setExpandedSegments((p) =>
                        p.includes(segment) ? p.filter((s) => s !== segment) : [...p, segment],
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      {expandedSegments.includes(segment) ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="text-[11px] font-black text-slate-700 uppercase italic">{segment}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectFullSegment(segment);
                      }}
                      className="h-6 text-[8px] font-black"
                    >
                      ADD TUDO
                    </Button>
                  </div>
                  {expandedSegments.includes(segment) && (
                    <div className="p-2 bg-slate-50/50 flex flex-wrap gap-1 border-t">
                      {items.map((cat) => (
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
                            "px-2 py-1 rounded-lg border text-[10px] font-bold",
                            selectedCategories.includes(cat.raw_category) ? "bg-indigo-600 text-white" : "bg-white",
                          )}
                        >
                          {cat.raw_category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* DIREITA: MATCHES */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="text-left">
              <h2 className="text-xl font-black flex items-center gap-2 uppercase italic text-slate-900">
                <Target className="h-6 w-6 text-indigo-600" /> Matches Detectados
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider italic">
                O robô encontrou {matchCount} vagas para você
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
                          <Badge className="bg-emerald-50 text-emerald-700 text-[9px] font-black">
                            {job.visa_type}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {job.state}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{job.category}</h3>
                        <p className="text-[10px] font-bold text-slate-500 italic truncate">{job.job_title}</p>
                        <div className="flex items-center gap-4 pt-1">
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <CircleDollarSign className="h-3.5 w-3.5 text-indigo-600" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> {job.experience_months || 0}m exp
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-4 flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l">
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white font-black text-[10px] h-9 px-6 rounded-xl w-full"
                        >
                          ENVIAR
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            supabase
                              .from("radar_matched_jobs")
                              .delete()
                              .eq("id", match.id)
                              .then(() => fetchMatches())
                          }
                          variant="ghost"
                          className="h-9 w-9 p-0 text-slate-300 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-32 bg-slate-50/30 rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-4 text-center">
                <RadarIcon className="h-12 w-12 text-slate-200 animate-pulse" />
                <p className="text-sm font-black text-slate-400 uppercase italic">Aguardando Sinais...</p>
                <p className="text-[10px] text-slate-400">Ative o radar para povoar sua fila de matches.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
