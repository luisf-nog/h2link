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
  const [radarProfile, setRadarProfile] = useState<any>(null);

  // Form states (Local)
  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

  // --- LÓGICA DE DETECÇÃO DE ALTERAÇÕES (Sócio, aqui estava o erro de comparação string vs number) ---
  const hasChanges = useMemo(() => {
    if (!radarProfile) return false;

    const dbCategories = radarProfile.categories || [];
    const categoriesChanged =
      JSON.stringify([...selectedCategories].sort()) !== JSON.stringify([...dbCategories].sort());

    return (
      isActive !== (radarProfile.is_active ?? false) ||
      autoSend !== (radarProfile.auto_send ?? false) ||
      categoriesChanged ||
      minWage !== (radarProfile.min_wage?.toString() || "") ||
      maxExperience !== (radarProfile.max_experience?.toString() || "") ||
      visaType !== (radarProfile.visa_type || "all") ||
      stateFilter !== (radarProfile.state || "all")
    );
  }, [isActive, autoSend, selectedCategories, minWage, maxExperience, visaType, stateFilter, radarProfile]);

  // --- BUSCA DE DADOS ---
  const fetchMatches = async () => {
    if (!profile?.id) return;
    const { data, count } = await supabase
      .from("radar_matched_jobs")
      .select(`id, job_id, public_jobs (*)`)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (data) setMatchedJobs(data);
    if (count !== null) setMatchCount(count);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data: catData }: any = await supabase.rpc("get_category_stats_cached" as any);
        if (catData && Array.isArray(catData)) {
          const grouped = catData.reduce((acc: any, curr: any) => {
            if (!acc[curr.segment_name]) acc[curr.segment_name] = [];
            acc[curr.segment_name].push(curr);
            return acc;
          }, {});
          setGroupedCategories(grouped);
        }

        if (profile?.id) {
          const { data: prof }: any = await supabase
            .from("radar_profiles")
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
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile?.id]);

  // --- FUNÇÃO CORE DE SALVAMENTO ---
  const performSave = async (overrides = {}) => {
    if (!profile?.id) return false;
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
      ? await supabase.from("radar_profiles").update(payload).eq("user_id", profile.id)
      : await supabase.from("radar_profiles").insert(payload);

    if (!error) {
      setRadarProfile(payload);
      // Se estiver ligando o radar, dispara o match imediato
      if (payload.is_active) {
        await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });
        await fetchMatches();
      }
      return true;
    } else {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    setIsActive(checked);
    const success = await performSave({ is_active: checked });
    if (success) {
      toast({
        title: checked ? "Radar Ativado!" : "Radar Desativado",
        description: checked ? "Buscando todas as vagas compatíveis agora..." : "O robô parou de monitorar.",
        className: checked ? "bg-emerald-600 text-white" : "",
      });
    }
    setSaving(false);
  };

  const selectFullSegment = (segment: string) => {
    const subCats = groupedCategories[segment].map((c) => c.raw_category);
    const allSelected = subCats.every((c) => selectedCategories.includes(c));
    if (allSelected) {
      setSelectedCategories((prev) => prev.filter((c) => !subCats.includes(c)));
    } else {
      setSelectedCategories((prev) => [...new Set([...prev, ...subCats])]);
    }
  };

  const removeMatch = async (matchId: string) => {
    const { error } = await supabase.from("radar_matched_jobs").delete().eq("id", matchId);
    if (!error) {
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => prev - 1);
    }
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
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
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
                    {isActive ? "Varredura Ativa" : "Sistema em Standby"}
                  </span>
                </div>
              </div>
              <Switch checked={isActive} onCheckedChange={handleToggleActive} disabled={saving} />
            </div>

            {hasChanges && (
              <Button
                onClick={() => performSave()}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-xl animate-in fade-in slide-in-from-top-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} APLICAR
                ALTERAÇÕES
              </Button>
            )}
          </div>

          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/30">
              <CardTitle className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Filtros do Robô
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer Visto</SelectItem>
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
                      <SelectItem value="all">Todos os Estados</SelectItem>
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
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Exp. Máxima (mês)</Label>
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

          {/* SELEÇÃO DE CATEGORIAS DRILL DOWN */}
          <Card className="border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b bg-slate-50/30">
              <CardTitle className="text-xs font-black uppercase text-slate-500 italic">Segmentos de Atuação</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
              {Object.entries(groupedCategories).map(([segment, items]) => {
                const isExpanded = expandedSegments.includes(segment);
                const subCats = items.map((c) => c.raw_category);
                const allSelected = subCats.every((c) => selectedCategories.includes(c));

                return (
                  <div key={segment} className="border rounded-xl overflow-hidden mb-1">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
                      onClick={() => toggleSegment(segment)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-[11px] font-black text-slate-700 uppercase italic">{segment}</span>
                      </div>
                      <Button
                        variant={allSelected ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectFullSegment(segment);
                        }}
                        className="h-6 text-[8px] font-black px-2"
                      >
                        {allSelected ? "REMOVER" : "ADD TUDO"}
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="p-2 bg-slate-50/50 flex flex-wrap gap-1 border-t">
                        {items.map((cat) => (
                          <button
                            key={cat.raw_category}
                            onClick={() => toggleCategory(cat.raw_category)}
                            className={cn(
                              "px-2 py-1 rounded-lg border text-[10px] font-bold transition-all",
                              selectedCategories.includes(cat.raw_category)
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                : "bg-white text-slate-600 hover:border-indigo-300",
                            )}
                          >
                            {cat.raw_category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: FILA DE MATCHES */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="text-left">
              <h2 className="text-xl font-black flex items-center gap-2 tracking-tight uppercase italic text-slate-900">
                <Target className="h-6 w-6 text-indigo-600" /> Fila de Matches
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider italic">
                Vagas compatíveis detectadas pelo radar
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
                return (
                  <Card
                    key={match.id}
                    className="group border-slate-200 hover:border-indigo-300 transition-all shadow-sm bg-white overflow-hidden"
                  >
                    <CardContent className="p-0 flex flex-col md:flex-row md:items-stretch">
                      <div className="p-4 flex-1 text-left space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-700 text-[9px] border-emerald-100 uppercase font-black px-2">
                            {job.visa_type}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 font-mono">
                            <MapPin className="h-3 w-3" /> {job.state}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight uppercase">{job.category}</h3>
                        <p className="text-[10px] font-bold text-slate-500 truncate italic">{job.job_title}</p>
                        <div className="flex items-center gap-4 pt-1">
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <CircleDollarSign className="h-3.5 w-3.5 text-indigo-600" /> ${job.salary || "N/A"}/h
                          </span>
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-600" /> {job.experience_months || 0}m exp
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-4 flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-9 px-6 rounded-xl shadow-md w-full md:w-auto"
                        >
                          ENVIAR
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => removeMatch(match.id)}
                          variant="ghost"
                          className="h-9 w-9 p-0 text-slate-300 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-32 bg-slate-50/30 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
                <RadarIcon className="h-12 w-12 text-slate-200 animate-pulse" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-tighter italic">
                    Nenhum Match Encontrado
                  </p>
                  <p className="text-[10px] text-slate-400">Ative o Radar e salve seus filtros para caçar vagas.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
