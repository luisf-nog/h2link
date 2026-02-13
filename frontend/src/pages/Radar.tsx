import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import {
  Radar as RadarIcon,
  Zap,
  ShieldCheck,
  Loader2,
  Save,
  Power,
  Eye,
  Send,
  Lock,
  Rocket,
  Target,
  Activity,
  History,
  MapPin,
  TrendingUp,
  Circle,
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
  last_scan_at: string | null;
}

export default function Radar() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [radarProfile, setRadarProfile] = useState<RadarProfile | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);

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

  // 1. Busca Categorias e Estatísticas (Garante que apareçam todas as categorias do banco)
  useEffect(() => {
    const fetchRadarData = async () => {
      try {
        const { data, error } = await supabase.rpc("get_category_stats");
        if (error) throw error;
        if (data) {
          setCategories(
            data.map((item: any) => ({
              name: item.category_name,
              count: parseInt(item.job_count),
            })),
          );
        }
      } catch (err) {
        console.error("Erro ao carregar categorias:", err);
      }
    };
    fetchRadarData();
  }, []);

  // 2. Busca Perfil do Usuário
  useEffect(() => {
    if (!profile?.id) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("radar_profiles").select("*").eq("user_id", profile.id).maybeSingle();

        if (data) {
          const rp = data as unknown as RadarProfile;
          setRadarProfile(rp);
          setIsActive(rp.is_active);
          setAutoSend(rp.auto_send);
          setSelectedCategories(rp.categories || []);
          setMinWage(rp.min_wage?.toString() || "");
          setMaxExperience(rp.max_experience?.toString() || "");
          setVisaType(rp.visa_type || "all");
          setStateFilter(rp.state || "all");
        }

        const { count } = await supabase
          .from("radar_matched_jobs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id);
        setMatchCount(count || 0);
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
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

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Radar Configurado!",
        description: "Seus critérios de inteligência foram salvos.",
        className: "bg-indigo-600 text-white border-none shadow-2xl",
      });
      setRadarProfile(payload as any);
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 px-6">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-[80px] opacity-20 animate-pulse"></div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl relative z-10">
            <RadarIcon className="h-20 w-20 text-indigo-600 animate-[spin_10s_linear_infinite]" />
          </div>
        </div>
        <div className="space-y-3 max-w-lg">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase italic">O Radar Inteligente</h1>
          <p className="text-slate-500 text-lg leading-relaxed">
            Nossa IA monitora o DOL 24/7 e aplica para as vagas ideais antes mesmo de elas aparecerem no Hub para os
            outros.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
          <Card className="bg-slate-50/50 border-slate-200 text-left p-4">
            <Zap className="h-5 w-5 text-amber-500 mb-2" />
            <p className="font-bold text-sm text-slate-900">Velocidade Absoluta</p>
            <p className="text-xs text-slate-500">Candidaturas enviadas milissegundos após a aprovação da vaga.</p>
          </Card>
          <Card className="bg-slate-50/50 border-slate-200 text-left p-4">
            <Target className="h-5 w-5 text-indigo-500 mb-2" />
            <p className="font-bold text-sm text-slate-900">Filtro de Precisão</p>
            <p className="text-xs text-slate-500">Apenas vagas que batem com seu visto, estado e pretensão salarial.</p>
          </Card>
        </div>
        <Button
          onClick={() => navigate("/plans")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-14 px-12 rounded-2xl shadow-xl shadow-indigo-100 text-lg group transition-all"
        >
          <Rocket className="h-5 w-5 mr-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          DESBLOQUEAR ACESSO BLACK
        </Button>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600/30" />
      </div>
    );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-24 text-left px-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-3 w-3 rounded-full animate-pulse",
                isActive ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-slate-300",
              )}
            />
            <span className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">
              H2 Linker Intelligence System
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 flex items-center gap-4">
            RADAR <span className="text-indigo-600 italic">PRO</span>
          </h1>
          <p className="text-slate-500 font-medium">
            O robô monitora{" "}
            <span className="text-indigo-600 font-bold">
              {categories.reduce((a, b) => a + b.count, 0).toLocaleString()}
            </span>{" "}
            vagas ativas buscando o seu match.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm">
          {radarProfile?.last_scan_at && (
            <div className="px-4 py-2 flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Última Varredura</span>
              <span className="text-xs font-mono font-bold text-slate-700">
                {new Date(radarProfile.last_scan_at).toLocaleTimeString()}
              </span>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 font-black h-12 px-8 rounded-xl shadow-lg active:scale-95 transition-all"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
            SALVAR CONFIGURAÇÕES
          </Button>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl shadow-indigo-50 bg-white group hover:scale-[1.02] transition-all cursor-default overflow-hidden">
          <div className="h-1 w-full bg-indigo-600"></div>
          <CardContent className="p-6 flex items-center gap-5">
            <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Target className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-black text-slate-900">{matchCount}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Matches Reais</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-emerald-50 bg-white group hover:scale-[1.02] transition-all cursor-default overflow-hidden">
          <div className="h-1 w-full bg-emerald-500"></div>
          <CardContent className="p-6 flex items-center gap-5">
            <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Send className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-black text-slate-900">{autoSend ? "Ativo" : "Manual"}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Disparo Automático</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-blue-50 bg-white group hover:scale-[1.02] transition-all cursor-default overflow-hidden">
          <div className="h-1 w-full bg-blue-500"></div>
          <CardContent className="p-6 flex items-center gap-5">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <TrendingUp className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-black text-slate-900">{selectedCategories.length || "Todas"}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Segmentos Alvo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FILTROS TÉCNICOS */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Parâmetros de Filtro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2",
                    isActive
                      ? "bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10"
                      : "bg-slate-50 border-slate-200",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Power className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-400")} />
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                  <Label className="text-xs font-black uppercase tracking-tighter">Radar Online</Label>
                </div>

                <div
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2",
                    autoSend
                      ? "bg-emerald-50/50 border-emerald-200 ring-2 ring-emerald-500/10"
                      : "bg-slate-50 border-slate-200",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Zap className={cn("h-4 w-4", autoSend ? "text-emerald-600" : "text-slate-400")} />
                    <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                  </div>
                  <Label className="text-xs font-black uppercase tracking-tighter">Auto-Envio</Label>
                </div>
              </div>

              <div className="space-y-5 pt-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                    <Circle className="h-2 w-2 fill-indigo-500 text-indigo-500" /> Visto Pretendido
                  </div>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
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

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase ml-1">
                    <MapPin className="h-3 w-3 text-slate-400" /> Estado Alvo
                  </div>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Estados (EUA)</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Salário Mínimo</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={minWage}
                        onChange={(e) => setMinWage(e.target.value)}
                        className="pl-8 h-12 rounded-xl border-slate-200 font-bold"
                      />
                      <span className="absolute left-3 top-3.5 text-slate-400 font-bold">$</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 text-indigo-600">
                      Exp. Máxima
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="Meses"
                        value={maxExperience}
                        onChange={(e) => setMaxExperience(e.target.value)}
                        className="pl-8 h-12 rounded-xl border-indigo-200 bg-indigo-50/20 font-bold"
                      />
                      <History className="absolute left-3 top-3.5 h-4 w-4 text-indigo-400" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GRID DE CATEGORIAS */}
        <div className="lg:col-span-7">
          <Card className="border-slate-200 shadow-sm rounded-3xl h-full flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div className="space-y-1">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">
                  Segmentos de Mercado
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="text-[10px] font-black text-indigo-600 hover:bg-indigo-50"
              >
                LIMPAR SELEÇÃO
              </Button>
            </CardHeader>
            <CardContent className="p-6 flex-1">
              <div className="flex flex-wrap gap-2">
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => toggleCategory(cat.name)}
                      className={cn(
                        "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-sm font-bold transition-all active:scale-95",
                        selectedCategories.includes(cat.name)
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/30",
                      )}
                    >
                      <span translate="no">{cat.name}</span>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-lg font-black",
                          selectedCategories.includes(cat.name)
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-400",
                        )}
                      >
                        {cat.count}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="w-full py-20 flex flex-col items-center justify-center gap-4 text-slate-400 italic">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    Buscando categorias no servidor...
                  </div>
                )}
              </div>

              <div className="mt-auto pt-10">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-dashed border-slate-300 flex gap-5 items-center">
                  <div className="bg-white p-3 rounded-2xl shadow-sm">
                    <Activity className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="text-left space-y-1">
                    <p className="text-xs font-black text-slate-900 uppercase">Lógica de Inteligência</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      O Radar agrupa vagas que exigem experiência igual ou inferior ao seu limite. Vagas sem exigência
                      especificada (0 ou Null) são incluídas automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
