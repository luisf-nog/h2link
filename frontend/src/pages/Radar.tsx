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

  // 1. Fetch Categories via RPC (Função que criamos para pegar tudo sem limite)
  useEffect(() => {
    const fetchStats = async () => {
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
    fetchStats();
  }, []);

  // 2. Fetch Radar Profile
  useEffect(() => {
    if (!profile?.id) return;
    const fetchProfile = async () => {
      setLoading(true);
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

    let error;
    if (radarProfile) {
      ({ error } = await supabase.from("radar_profiles").update(payload).eq("user_id", profile.id));
    } else {
      ({ error } = await supabase.from("radar_profiles").insert(payload));
    }

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("common.saved") || "Salvo!", description: "Perfil do Radar atualizado." });
      // Refresh local reference
      setRadarProfile(payload as any);
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200">
          <RadarIcon className="h-16 w-16 text-slate-400" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Radar</h1>
          <p className="text-slate-500 text-lg">Automatize suas candidaturas com matching inteligente de vagas.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="h-5 w-5 text-amber-600" />
            <span className="font-bold text-amber-900">Exclusivo Diamond & Black</span>
          </div>
          <p className="text-sm text-amber-800">
            O Radar está disponível apenas para assinantes dos planos Diamond e Black. Faça upgrade para automatizar
            completamente seu processo de candidatura.
          </p>
        </div>
        <Button
          onClick={() => navigate("/plans")}
          className="bg-indigo-600 text-white font-bold h-12 px-8 rounded-xl shadow-lg"
        >
          <Rocket className="h-5 w-5 mr-2" /> Ver Planos
        </Button>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-left">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <RadarIcon className="h-8 w-8 text-indigo-600" />
            Radar
          </h1>
          <p className="text-muted-foreground mt-1">Configure seus critérios e deixe o robô caçar vagas para você.</p>
        </div>
        <div className="flex items-center gap-3">
          {radarProfile?.last_scan_at && (
            <span className="text-xs text-muted-foreground font-mono">
              Scan: {new Date(radarProfile.last_scan_at).toLocaleString()}
            </span>
          )}
          <Badge
            className={cn("text-sm font-bold px-4 py-1.5", isActive ? "bg-emerald-600" : "bg-slate-200 text-slate-600")}
          >
            {isActive ? "ATIVO" : "INATIVO"}
          </Badge>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-slate-100 p-3 rounded-xl">
              <Target className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{matchCount}</p>
              <p className="text-xs text-muted-foreground">Vagas detectadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-slate-100 p-3 rounded-xl">
              <Eye className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{selectedCategories.length || "Todas"}</p>
              <p className="text-xs text-muted-foreground">Categorias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-slate-100 p-3 rounded-xl">
              <Zap className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{autoSend ? "Auto" : "Manual"}</p>
              <p className="text-xs text-muted-foreground">Modo de envio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONFIGURATION */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" /> Configuração do Perfil de Caça
          </CardTitle>
          <CardDescription>
            O Radar monitora {categories.reduce((a, b) => a + b.count, 0)} vagas ativas no momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div className="space-y-1">
                <Label className="font-bold flex items-center gap-2">
                  <Power className="h-4 w-4" /> Radar Ativo
                </Label>
                <p className="text-[10px] text-muted-foreground italic">Ativa o monitoramento automático</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div className="space-y-1">
                <Label className="font-bold flex items-center gap-2 text-indigo-600">
                  <Zap className="h-4 w-4" /> Envio Automático
                </Label>
                <p className="text-[10px] text-muted-foreground italic">Envia imediatamente ao dar match</p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500">Tipo de Visto</Label>
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
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500">Estado (EUA)</Label>
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
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500">Salário Mín. ($/h)</Label>
              <Input
                type="number"
                placeholder="Ex: 15.00"
                value={minWage}
                onChange={(e) => setMinWage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500">Exp. Máxima (Meses)</Label>
              <Input
                type="number"
                placeholder="Ex: 0 ou 6"
                value={maxExperience}
                onChange={(e) => setMaxExperience(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="font-bold text-xs uppercase text-slate-500">Categorias de Interesse</Label>
            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => toggleCategory(cat.name)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all",
                    selectedCategories.includes(cat.name)
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300",
                  )}
                >
                  <span translate="no">{cat.name}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1 rounded",
                      selectedCategories.includes(cat.name) ? "bg-white/20" : "bg-slate-100",
                    )}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
            SALVAR PERFIL DE CAÇA
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
