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
import { useToast } from "@/hooks/use-toast";
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import {
  Radar as RadarIcon,
  Zap,
  Shield,
  Loader2,
  Save,
  Target,
  TrendingUp,
  Map,
  Briefcase,
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

  // --- ESTADO DO PERFIL DE CAÇA ---
  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState(""); // NOVA VARIÁVEL: Filtro de experiência
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const planTier = profile?.plan_tier || "free";
  const isPremium = planTier === "diamond" || planTier === "black";

  // 1. Carrega categorias reais do mercado
  useEffect(() => {
    const fetchRadarStats = async () => {
      const { data } = await supabase.rpc("get_category_stats");
      if (data) {
        setCategories(
          data.map((item: any) => ({
            name: item.category_name,
            count: parseInt(item.job_count),
          })),
        );
      }
    };
    fetchRadarStats();
  }, []);

  // 2. Carrega o Perfil de Radar do usuário e contagem de matches
  useEffect(() => {
    if (!profile?.id) return;
    const fetchProfile = async () => {
      setLoading(true);
      const { data } = await supabase.from("radar_profiles").select("*").eq("user_id", profile.id).maybeSingle();

      if (data) {
        setRadarProfile(data);
        setIsActive(data.is_active);
        setAutoSend(data.auto_send);
        setSelectedCategories(data.categories || []);
        setMinWage(data.min_wage?.toString() || "");
        setMaxExperience(data.max_experience?.toString() || "");
        setVisaType(data.visa_type || "all");
        setStateFilter(data.state || "all");
      }

      const { count } = await supabase
        .from("radar_matched_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);
      setMatchCount(count || 0);
      setLoading(false);
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
      max_experience: maxExperience ? Number(maxExperience) : null,
      visa_type: visaType === "all" ? null : visaType,
      state: stateFilter === "all" ? null : stateFilter,
    };

    const { error } = radarProfile
      ? await supabase.from("radar_profiles").update(payload).eq("user_id", profile.id)
      : await supabase.from("radar_profiles").insert(payload);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Radar Armado!", description: "Seus critérios foram salvos e o bot está caçando vagas." });
      setRadarProfile(payload); // Atualiza referência local
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
  };

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl shadow-2xl">
          <RadarIcon className="h-16 w-16 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black">Radar H2 Linker</h1>
          <p className="text-muted-foreground max-w-sm">
            Deixe nossa inteligência encontrar e aplicar para as melhores vagas enquanto você descansa.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md text-left">
          <span className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-widest mb-2">
            <Lock className="h-4 w-4" /> Recurso Exclusivo
          </span>
          <p className="text-sm text-amber-900 font-medium">
            O Radar monitora o banco de dados 24h por dia e realiza candidaturas automáticas para planos Diamond e
            Black.
          </p>
        </div>
        <Button onClick={() => navigate("/plans")} className="bg-indigo-600 font-bold h-12 px-8 rounded-xl shadow-lg">
          <Rocket className="mr-2 h-5 w-5" /> Ver Planos Premium
        </Button>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* HEADER E AÇÃO PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4 text-left">
          <div
            className={cn(
              "p-3 rounded-2xl shadow-lg transition-all",
              isActive ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-200 text-slate-500",
            )}
          >
            <RadarIcon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase italic">Radar Automático</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.2em]">
              {isActive ? `📡 Status: Monitorando Mercado` : "🔴 Status: Desativado"}
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-700 hover:bg-indigo-800 font-black px-10 h-14 shadow-xl text-lg group transition-all active:scale-95"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Save className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
          )}
          ARMAR RADAR
        </Button>
      </div>

      {/* DASHBOARD DE MATCHES */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-indigo-700 text-white col-span-1">
          <CardContent className="p-6">
            <Target className="h-5 w-5 mb-2 opacity-70" />
            <p className="text-4xl font-black">{matchCount}</p>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Candidaturas via Radar</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6 text-left">
            <Map className="h-5 w-5 mb-2 text-indigo-600" />
            <p className="text-2xl font-black text-slate-900">{stateFilter === "all" ? "Qualquer" : stateFilter}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Estado Selecionado</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6 text-left">
            <History className="h-5 w-5 mb-2 text-blue-600" />
            <p className="text-2xl font-black text-slate-900">{maxExperience ? `${maxExperience}m` : "Livre"}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Exp. Máxima Alvo</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6 text-left">
            <Zap className={cn("h-5 w-5 mb-2", autoSend ? "text-emerald-500" : "text-slate-300")} />
            <p className="text-2xl font-black text-slate-900">{autoSend ? "Automático" : "Manual"}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Ação Imediata</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PARÂMETROS DO PERFIL (COLUNA ESQUERDA) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-sm border-2 border-indigo-50">
            <CardHeader className="bg-indigo-50/30 pb-4">
              <CardTitle className="text-xs uppercase tracking-[0.2em] font-black text-indigo-900">
                Perfil de Caça
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Ativar Radar</Label>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-indigo-700">Auto-Enviar</Label>
                </div>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2 text-left">
                  <Label className="text-xs font-bold uppercase text-slate-500">Tipo de Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="rounded-xl">
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

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-bold uppercase text-slate-500">Estado Preferencial</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="rounded-xl">
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

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-bold uppercase text-slate-500">Salário Mínimo ($/h)</Label>
                  <Input
                    type="number"
                    placeholder="Qualquer valor"
                    value={minWage}
                    onChange={(e) => setMinWage(e.target.value)}
                    className="rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-bold uppercase text-slate-500 italic">
                    Exp. Máxima Exigida (Meses)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Ex: 6"
                    value={maxExperience}
                    onChange={(e) => setMaxExperience(e.target.value)}
                    className="rounded-xl font-mono border-blue-200"
                  />
                  <p className="text-[9px] text-slate-400">Pula vagas que exigem mais experiência que o definido.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SELEÇÃO DE CATEGORIAS (COLUNA DIREITA) */}
        <div className="lg:col-span-8">
          <Card className="h-full shadow-sm border-2 border-indigo-50">
            <CardHeader className="border-b bg-slate-50/30 flex flex-row items-center justify-between">
              <div className="space-y-1 text-left">
                <CardTitle className="text-lg flex items-center gap-2 font-bold">
                  <Briefcase className="h-5 w-5 text-indigo-600" /> Categorias de Monitoramento
                </CardTitle>
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-indigo-600">
                  Detectamos {categories.length} segmentos ativas no Hub
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="text-[10px] font-black uppercase text-indigo-600"
              >
                Limpar Tudo
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => toggleCategory(cat.name)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-bold transition-all duration-200 active:scale-95 shadow-sm",
                      selectedCategories.includes(cat.name)
                        ? "bg-indigo-600 border-indigo-700 text-white shadow-indigo-200"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50",
                    )}
                  >
                    <span translate="no">{cat.name}</span>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black",
                        selectedCategories.includes(cat.name)
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-12 p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex gap-5 items-center">
                <div className="bg-white p-3 rounded-2xl shadow-sm text-indigo-600">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">
                    Como o Robô H2 Linker age:
                  </p>
                  <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                    O bot escaneia as {categories.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} vagas
                    ativas e todas as novas que entram via DOL. Se houver match, ele adiciona na fila respeitando as{" "}
                    <strong>regras de delay anti-spam</strong> do seu plano atual.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
