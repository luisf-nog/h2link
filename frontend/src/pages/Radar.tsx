import { useEffect, useState } from "react";
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
  TrendingUp,
  Rocket,
  ChevronDown,
  ChevronRight,
  SearchCheck,
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
  const [groupedCategories, setGroupedCategories] = useState<Record<string, any[]>>({});
  const [expandedSegments, setExpandedSegments] = useState<string[]>([]);
  const [radarProfile, setRadarProfile] = useState<any>(null);

  // Form state
  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const planTier = profile?.plan_tier || "free";
  const isPremium = planTier === "diamond" || planTier === "black";

  // Lógica de UI para categorias
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const toggleSegment = (segment: string) => {
    setExpandedSegments((prev) => (prev.includes(segment) ? prev.filter((s) => s !== segment) : [...prev, segment]));
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Busca Categorias do Cache via RPC (Retorno: raw_category, segment_name, job_count)
        const { data: catData }: any = await supabase.rpc("get_category_stats_cached" as any);
        if (catData && Array.isArray(catData)) {
          const grouped = catData.reduce((acc: any, curr: any) => {
            if (!acc[curr.segment_name]) acc[curr.segment_name] = [];
            acc[curr.segment_name].push(curr);
            return acc;
          }, {});
          setGroupedCategories(grouped);
        }

        // 2. Busca Perfil do Usuário
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
            setMaxExperience((prof as any).max_experience?.toString() || "");
            setVisaType(prof.visa_type || "all");
            setStateFilter(prof.state || "all");
          }

          // 3. Contagem de Matches Real
          const { count } = await supabase
            .from("radar_matched_jobs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id);
          setMatchCount(count || 0);
        }
      } catch (err) {
        console.error("Radar load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);

    const payload = {
      user_id: profile.id,
      is_active: isActive,
      auto_send: autoSend,
      categories: selectedCategories,
      min_wage: minWage ? Number(minWage) : null,
      max_experience: maxExperience !== "" ? Number(maxExperience) : null,
      visa_type: visaType === "all" ? null : visaType,
      state: stateFilter === "all" ? null : stateFilter,
    };

    const { error } = radarProfile
      ? await supabase.from("radar_profiles").update(payload).eq("user_id", profile.id)
      : await supabase.from("radar_profiles").insert(payload);

    if (!error) {
      toast({
        title: "Radar Armado!",
        description: "Buscando matches imediatos...",
        className: "bg-indigo-600 text-white",
      });

      // DISPARO IMEDIATO (RPC que criamos para não depender do cron agora)
      await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });

      // Atualiza o contador após o trigger
      const { count } = await supabase
        .from("radar_matched_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);
      setMatchCount(count || 0);
      setRadarProfile(payload);
    } else {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 space-y-6">
        <RadarIcon className="h-20 w-20 text-indigo-200 animate-pulse" />
        <h1 className="text-3xl font-black text-slate-900 uppercase">Radar Pro</h1>
        <p className="text-slate-500 max-w-sm">
          Automatize suas candidaturas. Deixe nossa IA monitorar o DOL e aplicar para você.
        </p>
        <Button
          onClick={() => navigate("/plans")}
          className="w-full sm:w-auto bg-indigo-600 h-12 px-10 font-bold rounded-2xl shadow-lg text-white"
        >
          <Rocket className="mr-2 h-5 w-5 text-white" /> Ver Planos Premium
        </Button>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600/50" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 px-4 sm:px-6 text-left">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={cn("p-2.5 rounded-xl", isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}
          >
            <RadarIcon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black tracking-tight uppercase italic">Radar H2 Linker</h1>
            <div className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", isActive ? "bg-emerald-500 animate-ping" : "bg-slate-300")} />
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {isActive ? "Monitorando" : "Offline"}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-md"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Salvar
          Filtros
        </Button>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm bg-indigo-600 text-white group">
          <CardContent className="p-4 text-left">
            <Target className="h-4 w-4 mb-1 opacity-70 text-white" />
            <p className="text-2xl font-black text-white">{matchCount}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white">Matches Detectados</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 text-left">
            <Zap className={cn("h-4 w-4 mb-1", autoSend ? "text-emerald-500" : "text-slate-300")} />
            <p className="text-2xl font-black text-slate-900">{autoSend ? "Automático" : "Manual"}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase">Ação do Bot</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FILTERS PANEL */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/50 text-left">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border">
                <Label className="text-sm font-bold">Ativar Radar</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <Label className="text-sm font-bold text-indigo-700">Auto-Enviar</Label>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5 text-left">
                  <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Visto Pretendido</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-11 rounded-xl font-medium text-left">
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
                <div className="space-y-1.5 text-left">
                  <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado Alvo</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-11 rounded-xl font-medium text-left">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer Estado</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Salário Min.</Label>
                    <Input
                      type="number"
                      placeholder="$/h"
                      value={minWage}
                      onChange={(e) => setMinWage(e.target.value)}
                      className="h-11 rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Exp. Máxima</Label>
                    <Input
                      type="number"
                      placeholder="Meses"
                      value={maxExperience}
                      onChange={(e) => setMaxExperience(e.target.value)}
                      className="h-11 rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CATEGORIES PANEL (DRILL DOWN) */}
        <div className="lg:col-span-8">
          <Card className="border-slate-200 rounded-2xl shadow-sm h-full flex flex-col">
            <CardHeader className="p-5 border-b bg-slate-50/30 flex flex-row items-center justify-between">
              <div className="text-left">
                <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-widest italic">
                  Segmentos de Mercado
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Expanda os grupos para escolher categorias específicas.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"
              >
                LIMPAR
              </Button>
            </CardHeader>
            <CardContent className="p-4 flex-1 space-y-2">
              {Object.entries(groupedCategories).map(([segment, items]) => {
                const isExpanded = expandedSegments.includes(segment);
                const selectedInSegment = items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                const totalInSegment = items.reduce((acc, curr) => acc + curr.job_count, 0);

                return (
                  <div
                    key={segment}
                    className="border rounded-xl overflow-hidden bg-white hover:border-slate-300 transition-all"
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 cursor-pointer",
                        isExpanded && "bg-slate-50 border-b",
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1" onClick={() => toggleSegment(segment)}>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <div className="text-left">
                          <p className="text-xs font-black text-slate-800 uppercase italic tracking-tighter">
                            {segment}
                          </p>
                          <p className="text-[9px] text-indigo-600 font-bold uppercase">
                            {totalInSegment} vagas ativas
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={selectedInSegment === items.length ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectFullSegment(segment);
                        }}
                        className="text-[9px] h-7 font-bold uppercase"
                      >
                        {selectedInSegment === items.length ? "Remover" : `Add Segmento`}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="p-3 bg-white flex flex-wrap gap-2">
                        {items.map((cat) => (
                          <button
                            key={cat.raw_category}
                            onClick={() => toggleCategory(cat.raw_category)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all active:scale-95",
                              selectedCategories.includes(cat.raw_category)
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300",
                            )}
                          >
                            <span translate="no">{cat.raw_category}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[9px] px-1 h-4 border-none",
                                selectedCategories.includes(cat.raw_category)
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-100 text-slate-500",
                              )}
                            >
                              {cat.job_count}
                            </Badge>
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
      </div>

      {/* RESULTADOS IMEDIATOS */}
      <div className="pt-10 space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="text-left">
            <h2 className="text-xl font-black flex items-center gap-2 tracking-tight uppercase italic text-slate-800">
              <SearchCheck className="h-5 w-5 text-indigo-600" /> Vagas Detectadas
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase">
              Últimos matches encontrados para o seu perfil
            </p>
          </div>
        </div>

        {matchCount === 0 ? (
          <div className="py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-3">
            <RadarIcon className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400 font-medium italic">
              Ative o Radar e salve seus filtros para caçar as melhores vagas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <p className="text-[10px] font-black text-emerald-600 uppercase">Match Retroativo</p>
                </div>
                <p className="text-sm font-bold text-slate-700 leading-snug">
                  O Radar já detectou {matchCount} vagas compatíveis que estão na sua fila de processamento.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
