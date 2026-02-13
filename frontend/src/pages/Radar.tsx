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
import { Badge } from "@/components/ui/badge"; // Corrigido erro de importação
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
  MapPin,
  History,
  Lock,
  Rocket,
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
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
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

  // Função interna para gerenciar categorias (Corrigido erro TS2304)
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Busca Categorias do Cache (Usando as any para evitar erro TS2345)
        const { data: catData }: any = await supabase.rpc("get_category_stats_cached" as any);
        if (catData && Array.isArray(catData)) {
          setCategories(catData.map((c: any) => ({ name: c.category_name, count: parseInt(c.job_count) })));
        }

        // 2. Busca Perfil
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
            // Usando cast para acessar max_experience com segurança (Corrigido erro TS2339)
            const exp = (prof as any).max_experience;
            setMaxExperience(exp?.toString() || "");
            setVisaType(prof.visa_type || "all");
            setStateFilter(prof.state || "all");
          }

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
      toast({ title: "Radar Configurado!", className: "bg-indigo-600 text-white" });
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
        <h1 className="text-3xl font-black text-slate-900">Radar Inteligente</h1>
        <p className="text-slate-500 max-w-sm">
          Este recurso monitora o mercado e aplica para vagas automaticamente por você.
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
    <div className="space-y-6 max-w-6xl mx-auto pb-24 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={cn("p-2.5 rounded-xl", isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}
          >
            <RadarIcon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black tracking-tight uppercase">Radar Pro</h1>
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Filtros
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm bg-indigo-600 text-white">
          <CardContent className="p-4 text-left">
            <Target className="h-4 w-4 mb-1 opacity-70 text-white" />
            <p className="text-2xl font-black text-white">{matchCount}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white">Matches</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 text-left">
            <Zap className={cn("h-4 w-4 mb-1", autoSend ? "text-emerald-500" : "text-slate-300")} />
            <p className="text-2xl font-black text-slate-900">{autoSend ? "Ativo" : "Off"}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase">Auto-Envio</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/50 text-left">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <Label className="text-sm font-bold">Ativar Radar</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <Label className="text-sm font-bold">Auto-Enviar</Label>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5 text-left">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Tipo de Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-11 rounded-xl font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Vistos</SelectItem>
                      {VISA_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-left">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Estado (EUA)</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-11 rounded-xl font-medium">
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
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Salário Mín.</Label>
                    <Input
                      type="number"
                      placeholder="$/h"
                      value={minWage}
                      onChange={(e) => setMinWage(e.target.value)}
                      className="h-11 rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Exp. Máxima</Label>
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

        <div className="lg:col-span-8">
          <Card className="border-slate-200 rounded-2xl shadow-sm h-full">
            <CardHeader className="p-5 border-b flex flex-row items-center justify-between">
              <div className="text-left">
                <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-widest">
                  Segmentos de Interesse
                </CardTitle>
                <CardDescription className="text-[10px]">
                  As candidaturas serão focadas nos itens abaixo.
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
            <CardContent className="p-5">
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => toggleCategory(cat.name)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95",
                      selectedCategories.includes(cat.name)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50",
                    )}
                  >
                    <span translate="no">{cat.name}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[9px] px-1 h-4",
                        selectedCategories.includes(cat.name)
                          ? "bg-white/20 text-white border-none"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {cat.count}
                    </Badge>
                  </button>
                ))}
              </div>

              <div className="mt-8 p-4 bg-indigo-50/50 rounded-2xl border border-dashed border-indigo-200 flex gap-3 items-center text-left">
                <TrendingUp className="h-5 w-5 text-indigo-600 shrink-0" />
                <p className="text-[10px] text-indigo-800 font-medium leading-tight italic">
                  O Radar ignora vagas que exigem mais experiência que o seu limite. Vagas sem exigência (0 ou Null) são
                  incluídas por padrão.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
