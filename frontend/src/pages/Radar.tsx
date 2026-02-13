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
  Shield,
  Loader2,
  Save,
  Power,
  PowerOff,
  Eye,
  Send,
  Lock,
  Rocket,
  Target,
  Activity,
  TrendingUp,
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
  visa_type: string | null;
  state: string | null;
  last_scan_at: string | null;
  created_at: string;
  updated_at: string;
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
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const planTier = profile?.plan_tier || "free";
  const isPremium = planTier === "diamond" || planTier === "black";

  // 1. FETCH CATEGORIES (Usando a função RPC profissional para não limitar em 1000)
  useEffect(() => {
    const fetchRadarStats = async () => {
      const { data, error } = await supabase.rpc("get_category_stats");
      if (data) {
        const list = data.map((item: any) => ({
          name: item.category_name,
          count: parseInt(item.job_count),
        }));
        setCategories(list);
      }
    };
    fetchRadarStats();
  }, []);

  // 2. FETCH RADAR PROFILE & MATCHES
  useEffect(() => {
    if (!profile?.id) return;
    const fetchProfile = async () => {
      setLoading(true);
      const { data: profileData } = await supabase
        .from("radar_profiles")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (profileData) {
        const rp = profileData as unknown as RadarProfile;
        setRadarProfile(rp);
        setIsActive(rp.is_active);
        setAutoSend(rp.auto_send);
        setSelectedCategories(rp.categories || []);
        setMinWage(rp.min_wage?.toString() || "");
        setVisaType(rp.visa_type || "all");
        setStateFilter(rp.state || "all");
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
      visa_type: visaType === "all" ? null : visaType,
      state: stateFilter === "all" ? null : stateFilter,
    };

    let error;
    if (radarProfile) {
      ({ error } = await supabase.from("radar_profiles").update(payload).eq("user_id", profile.id));
    } else {
      ({ error } = await supabase.from("radar_profiles").insert(payload));
    }

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("common.saved"), description: "Radar configurado com sucesso!" });
      const { data } = await supabase.from("radar_profiles").select("*").eq("user_id", profile.id).maybeSingle();
      if (data) setRadarProfile(data as unknown as RadarProfile);
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-6 rounded-3xl shadow-2xl shadow-violet-200">
          <RadarIcon className="h-16 w-16 text-white" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-3xl font-black tracking-tight">Radar H2 Linker</h1>
          <p className="text-muted-foreground text-lg">
            O primeiro sistema de inteligência que caça e aplica para vagas por você.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md text-left">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="h-5 w-5 text-amber-600" />
            <span className="font-bold text-amber-900 uppercase text-xs tracking-widest">
              Exclusivo Diamond & Black
            </span>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed font-medium">
            O Radar monitora o mercado 24/7. Ao detectar uma vaga que bate com seu perfil, ele a coloca na fila (ou
            envia o e-mail) instantaneamente.
          </p>
        </div>
        <Button
          onClick={() => navigate("/plans")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg"
        >
          <Rocket className="h-5 w-5 mr-2" /> Desbloquear Radar
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
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* HEADER DINÂMICO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "p-3 rounded-2xl shadow-lg transition-all",
              isActive ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-200 text-slate-500",
            )}
          >
            <RadarIcon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Radar de Inteligência
              {isActive && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Online</Badge>}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              {radarProfile?.last_scan_at
                ? `Última varredura: ${new Date(radarProfile.last_scan_at).toLocaleString()}`
                : "Aguardando primeira varredura..."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configuração
          </Button>
        </div>
      </div>

      {/* STATS PANEL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
          <CardContent className="p-6">
            <Target className="h-5 w-5 mb-2 opacity-80" />
            <p className="text-3xl font-black">{matchCount}</p>
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">Vagas Identificadas</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6">
            <Eye className="h-5 w-5 mb-2 text-blue-600" />
            <p className="text-3xl font-black text-slate-900">{selectedCategories.length || "Todas"}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtros Ativos</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6">
            <div
              className={cn(
                "p-1.5 rounded-full w-fit mb-2",
                autoSend ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400",
              )}
            >
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <p className="text-3xl font-black text-slate-900">{autoSend ? "Automático" : "Manual"}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modo de Ação</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CONFIGURAÇÃO LATERAL */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm uppercase tracking-widest text-slate-500">Controles de Automação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Ativar Radar</Label>
                  <p className="text-[10px] text-muted-foreground text-left italic leading-tight">
                    Busca contínua por novas vagas
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-indigo-600">Envio Automático</Label>
                  <p className="text-[10px] text-muted-foreground text-left italic leading-tight">
                    Dispara e-mails em tempo real
                  </p>
                </div>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm uppercase tracking-widest text-slate-500">Parâmetros de Filtro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Tipo de Visto</Label>
                <Select value={visaType} onValueChange={setVisaType}>
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label className="text-xs font-bold">Estado Preferencial</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label className="text-xs font-bold">Salário Mínimo ($/h)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 15.50"
                  value={minWage}
                  onChange={(e) => setMinWage(e.target.value)}
                  className="font-mono"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SELEÇÃO DE CATEGORIAS (O RADAR REAL) */}
        <div className="lg:col-span-2">
          <Card className="h-full shadow-sm">
            <CardHeader className="border-b bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Segmentos do Mercado H-2
                  </CardTitle>
                  <CardDescription className="text-xs">
                    O Radar monitora {categories.length} categorias em tempo real.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-indigo-600 font-bold hover:text-indigo-700"
                >
                  Limpar Seleção
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => toggleCategory(cat.name)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200 active:scale-95",
                      selectedCategories.includes(cat.name)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/30",
                    )}
                  >
                    <span translate="no">{cat.name}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-lg font-black",
                        selectedCategories.includes(cat.name) ? "bg-white/20" : "bg-slate-100",
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* ALERTA DE FUNCIONAMENTO */}
              <div className="mt-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-4 items-center">
                <div className="bg-white p-2 rounded-full shadow-sm">
                  <Activity className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
                  <strong>Como o Radar funciona:</strong> Ele analisa{" "}
                  {categories.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} vagas ativas e aguarda a
                  entrada de novas. Assim que um empregador registrar uma vaga compatível com seus filtros, o sistema
                  age em segundos.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
