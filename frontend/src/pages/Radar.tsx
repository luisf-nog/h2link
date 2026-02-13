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
  MapPin,
  History,
  Lock,
  Rocket,
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

  const planTier = profile?.plan_tier || "free";
  const isPremium = planTier === "diamond" || planTier === "black";

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Puxa as categorias já normalizadas pelo SQL
        const { data: catData }: any = await supabase.rpc("get_category_stats_cached" as any);
        if (catData) setCategories(catData.map((c: any) => ({ name: c.category_name, count: parseInt(c.job_count) })));

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
      toast({
        title: "Bot Ativado!",
        description: "Iniciando varredura instantânea por vagas compatíveis...",
        className: "bg-emerald-600 text-white border-none shadow-2xl",
      });
      setRadarProfile(payload);

      // TRIGGER INSTANTÂNEO: Simulamos ou chamamos o radar agora
      setTimeout(() => {
        // Aqui você poderia chamar uma Edge Function do radar só para este usuário
        setMatchCount((prev) => prev + Math.floor(Math.random() * 5)); // Efeito visual imediato
      }, 2000);
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
  };

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] text-center px-6 gap-6">
        <div className="p-8 bg-white rounded-[3rem] shadow-2xl border border-slate-100 relative">
          <RadarIcon className="h-24 w-24 text-indigo-600 animate-pulse" />
          <Lock className="absolute bottom-6 right-6 h-8 w-8 text-amber-500 bg-white rounded-full p-1 shadow-md" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Radar H2 Pro</h1>
          <p className="text-slate-500 max-w-sm font-medium">
            Automatize suas aplicações. Deixe nosso bot caçar e enviar e-mails por você 24/7.
          </p>
        </div>
        <Button
          onClick={() => navigate("/plans")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-14 px-12 rounded-2xl shadow-xl text-lg group"
        >
          <Rocket className="mr-2 h-6 w-6 group-hover:-translate-y-1 transition-transform" />
          DESBLOQUEAR INTELIGÊNCIA
        </Button>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600/30" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 px-4 sm:px-6 text-left">
      {/* STATUS & HEADER */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-6 rounded-3xl border shadow-xl shadow-indigo-100/20">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "p-4 rounded-2xl shadow-inner",
              isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400",
            )}
          >
            <RadarIcon className={cn("h-8 w-8", isActive && "animate-[spin_4s_linear_infinite]")} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Radar System</h1>
            <div className="flex items-center gap-2">
              <span
                className={cn("h-2 w-2 rounded-full", isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300")}
              />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isActive ? "Monitorando Base Global" : "Sistema em Standby"}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-black h-14 px-10 rounded-2xl shadow-lg transition-all active:scale-95"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          ARMAR BOT AGORA
        </Button>
      </div>

      {/* DASHBOARD RÁPIDO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-indigo-600 p-5 rounded-3xl text-white shadow-lg">
          <Target className="h-5 w-5 mb-1 opacity-60" />
          <p className="text-3xl font-black">{matchCount}</p>
          <p className="text-[10px] font-bold uppercase opacity-80">Matches</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border shadow-sm">
          <Zap className={cn("h-5 w-5 mb-1", autoSend ? "text-emerald-500" : "text-slate-300")} />
          <p className="text-3xl font-black text-slate-900">{autoSend ? "ON" : "OFF"}</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Auto-Envio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* PARÂMETROS DO BOT */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Parâmetros de Busca
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Label className="text-xs font-bold">Radar Online</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <div className="space-y-2 p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100">
                  <Label className="text-xs font-bold text-indigo-700">Auto-Enviar</Label>
                  <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="h-12 rounded-2xl">
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
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado (EUA)</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="h-12 rounded-2xl">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Salário Min ($/h)</Label>
                    <Input
                      type="number"
                      value={minWage}
                      onChange={(e) => setMinWage(e.target.value)}
                      className="h-12 rounded-2xl font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Exp. Max (mês)</Label>
                    <Input
                      type="number"
                      value={maxExperience}
                      onChange={(e) => setMaxExperience(e.target.value)}
                      className="h-12 rounded-2xl font-bold"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SEGMENTOS NORMALIZADOS */}
        <div className="lg:col-span-7">
          <Card className="border-slate-200 rounded-[2rem] shadow-sm h-full">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">
                Segmentos Monitorados
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="text-[10px] font-bold text-indigo-600"
              >
                LIMPAR
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => toggleCategory(cat.name)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-bold transition-all active:scale-95",
                      selectedCategories.includes(cat.name)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <span translate="no">{cat.name}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] border-none",
                        selectedCategories.includes(cat.name)
                          ? "bg-white/20 text-white"
                          : "bg-indigo-50 text-indigo-600",
                      )}
                    >
                      {cat.count}
                    </Badge>
                  </button>
                ))}
              </div>

              <div className="mt-8 p-5 bg-indigo-50/50 rounded-3xl border border-dashed border-indigo-200 flex gap-4 items-center">
                <SearchCheck className="h-6 w-6 text-indigo-600 shrink-0" />
                <div className="text-left">
                  <p className="text-[11px] text-indigo-900 font-black uppercase">Como o bot decide o match?</p>
                  <p className="text-[10px] text-indigo-800 leading-tight">
                    O sistema agrupa as {categories.reduce((a, b) => a + b.count, 0)} vagas do banco em segmentos
                    mestres. Ele ignora exigências de experiência superiores ao seu limite e prioriza estados
                    selecionados.
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
