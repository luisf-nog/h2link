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
import { VISA_TYPE_OPTIONS } from "@/lib/visaTypes";
import { Radar as RadarIcon, Zap, Save, Loader2, Target, History, Rocket, Search } from "lucide-react";
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

  // Form states
  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Puxa do cache as categorias já agrupadas pelo SQL
        const { data: catData }: any = await supabase.rpc("get_category_stats_cached" as any);
        if (catData) {
          // Agrupamos por segmento para mostrar apenas os 10 nomes limpos
          const uniqueSegments = Array.from(new Set(catData.map((c: any) => c.segment_name))).map((name) => {
            const count = (catData as any[])
              .filter((c) => c.segment_name === name)
              .reduce((acc, curr) => acc + curr.job_count, 0);
            return { name, count };
          });
          setCategories(uniqueSegments as any);
        }

        if (profile?.id) {
          const { data: prof } = await supabase
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
          const { count } = await supabase
            .from("radar_matched_jobs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id);
          setMatchCount(count || 0);
        }
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
      toast({ title: "Radar Armado!", description: "Iniciando busca por vagas retroativas..." });
      setRadarProfile(payload);
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
  };

  if (!isPremium)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <RadarIcon className="h-20 w-20 text-slate-300" />
        <h1 className="text-3xl font-black">Radar Inteligente</h1>
        <Button onClick={() => navigate("/plans")} className="bg-indigo-600 font-bold px-10 h-12">
          Upgrade para Diamond
        </Button>
      </div>
    );

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-left">
      {/* HEADER SIMPLES (LEGADO) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <RadarIcon className="h-8 w-8 text-indigo-600" /> Radar
          </h1>
          <p className="text-slate-500">Configure seus filtros e deixe o robô trabalhar.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Badge variant={isActive ? "default" : "secondary"} className={cn("px-4 py-1", isActive && "bg-emerald-600")}>
            {isActive ? "ATIVO" : "INATIVO"}
          </Badge>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 font-bold flex-1 md:flex-none">
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />} Salvar
            Configurações
          </Button>
        </div>
      </div>

      {/* DASHBOARD DE STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <Target className="text-indigo-600" />
            <div>
              <p className="text-2xl font-black">{matchCount}</p>
              <p className="text-xs text-slate-500 font-bold uppercase">Vagas Detectadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-none shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <Zap className={cn(autoSend ? "text-emerald-500" : "text-slate-300")} />
            <div>
              <p className="text-2xl font-black">{autoSend ? "Automático" : "Manual"}</p>
              <p className="text-xs text-slate-500 font-bold uppercase">Modo de Envio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS (VISUAL LEGADO) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Critérios de Seleção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div className="text-left">
                <Label className="font-bold">Ativar Radar</Label>
                <p className="text-[10px] text-slate-500 italic">O bot buscará vagas para você</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div className="text-left">
                <Label className="font-bold">Envio Automático</Label>
                <p className="text-[10px] text-slate-500 italic">Candidatura imediata no match</p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold uppercase text-slate-500">Visto</Label>
              <Select value={visaType} onValueChange={setVisaType}>
                <SelectTrigger>
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
            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold uppercase text-slate-500">Estado</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger>
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
              <Label className="text-xs font-bold uppercase text-slate-500">Salário Min ($/h)</Label>
              <Input type="number" value={minWage} onChange={(e) => setMinWage(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold uppercase text-slate-500">Exp. Max (Meses)</Label>
              <Input
                type="number"
                value={maxExperience}
                onChange={(e) => setMaxExperience(e.target.value)}
                placeholder="Ex: 6"
              />
            </div>
          </div>

          {/* CATEGORIAS (ESTILO BADGE LEGADO) */}
          <div className="space-y-4 pt-4 border-t text-left">
            <Label className="text-xs font-bold uppercase text-slate-500">Segmentos de Mercado</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge
                  key={cat.name}
                  variant={selectedCategories.includes(cat.name) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-4 py-2 text-sm transition-all",
                    selectedCategories.includes(cat.name) ? "bg-indigo-600 hover:bg-indigo-700" : "hover:bg-indigo-50",
                  )}
                  onClick={() => toggleCategory(cat.name)}
                >
                  <span translate="no">{cat.name}</span>
                  <span className="ml-2 opacity-60 text-[10px]">{cat.count}</span>
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * Selecione os segmentos para filtrar o Radar. Se nenhum for selecionado, o bot monitora todas as
              categorias.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* BOTÃO DE VARREDURA INSTANTÂNEA */}
      <div className="p-6 bg-indigo-50 rounded-2xl border border-dashed border-indigo-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-left">
          <p className="font-bold text-indigo-900 flex items-center gap-2">
            <Search className="h-4 w-4" /> Busca Retroativa
          </p>
          <p className="text-xs text-indigo-700">O Radar encontrou {matchCount} vagas que já estão no sistema.</p>
        </div>
        <Button
          variant="outline"
          className="border-indigo-600 text-indigo-600 font-bold hover:bg-indigo-600 hover:text-white transition-all"
        >
          Ver Matches Atuais
        </Button>
      </div>
    </div>
  );
}
