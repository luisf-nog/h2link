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
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
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
  const [categories, setCategories] = useState<string[]>([]);

  // Form state
  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const planTier = profile?.plan_tier || "free";
  const isPremium = planTier === "diamond" || planTier === "black";

  // Fetch available categories
  useEffect(() => {
    supabase
      .from("public_jobs")
      .select("category")
      .not("category", "is", null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r) => r.category!))].sort();
          setCategories(unique);
        }
      });
  }, []);

  // Fetch radar profile
  useEffect(() => {
    if (!profile?.id) return;
    const fetchProfile = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("radar_profiles")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (data) {
        const rp = data as unknown as RadarProfile;
        setRadarProfile(rp);
        setIsActive(rp.is_active);
        setAutoSend(rp.auto_send);
        setSelectedCategories(rp.categories || []);
        setMinWage(rp.min_wage?.toString() || "");
        setVisaType(rp.visa_type || "all");
        setStateFilter(rp.state || "all");
      }

      // Count matches
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
      ({ error } = await supabase
        .from("radar_profiles")
        .update(payload)
        .eq("user_id", profile.id));
    } else {
      ({ error } = await supabase.from("radar_profiles").insert(payload));
    }

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("common.saved") || "Saved!", description: "Radar profile updated." });
      // Refresh
      const { data } = await supabase
        .from("radar_profiles")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (data) setRadarProfile(data as unknown as RadarProfile);
    }
    setSaving(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-6 rounded-3xl shadow-2xl shadow-violet-200">
          <RadarIcon className="h-16 w-16 text-white" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-3xl font-black tracking-tight">Radar</h1>
          <p className="text-muted-foreground text-lg">
            Automatize suas candidaturas com matching inteligente de vagas.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="h-5 w-5 text-amber-600" />
            <span className="font-bold text-amber-900">Exclusivo Diamond & Black</span>
          </div>
          <p className="text-sm text-amber-800">
            O Radar está disponível apenas para assinantes dos planos Diamond e Black.
            Faça upgrade para automatizar completamente seu processo de candidatura.
          </p>
        </div>
        <Button
          onClick={() => navigate("/plans")}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold h-12 px-8 rounded-xl shadow-lg"
        >
          <Rocket className="h-5 w-5 mr-2" /> Ver Planos
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-2.5 rounded-xl">
              <RadarIcon className="h-6 w-6 text-white" />
            </div>
            Radar
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure seus critérios e automatize suas candidaturas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {radarProfile?.last_scan_at && (
            <span className="text-xs text-muted-foreground">
              Último scan: {new Date(radarProfile.last_scan_at).toLocaleString()}
            </span>
          )}
          <Badge
            variant={isActive ? "default" : "secondary"}
            className={cn(
              "text-sm font-bold px-4 py-1.5",
              isActive
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-slate-200 text-slate-600"
            )}
          >
            {isActive ? (
              <><Activity className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> Ativo</>
            ) : (
              <><PowerOff className="h-3.5 w-3.5 mr-1.5" /> Inativo</>
            )}
          </Badge>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-violet-100 p-3 rounded-xl">
              <Target className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{matchCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Vagas detectadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <Eye className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{selectedCategories.length}</p>
              <p className="text-xs text-muted-foreground font-medium">Categorias monitoradas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={cn("p-3 rounded-xl", autoSend ? "bg-emerald-100" : "bg-slate-100")}>
              <Send className={cn("h-6 w-6", autoSend ? "text-emerald-600" : "text-slate-400")} />
            </div>
            <div>
              <p className="text-2xl font-black">{autoSend ? "Auto" : "Manual"}</p>
              <p className="text-xs text-muted-foreground font-medium">Modo de envio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONFIGURATION */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-violet-600" /> Configuração do Radar
          </CardTitle>
          <CardDescription>
            Defina os critérios de matching e o modo de operação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* TOGGLES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div className="space-y-1">
                <Label className="font-bold flex items-center gap-2">
                  <Power className="h-4 w-4" /> Radar Ativo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ativa o monitoramento automático de vagas
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div className="space-y-1">
                <Label className="font-bold flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Envio Automático
                </Label>
                <p className="text-xs text-muted-foreground">
                  Envia automaticamente ao detectar match
                </p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>
          </div>

          {/* FILTERS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-sm">Tipo de Visto</Label>
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
              <Label className="font-bold text-sm">Estado (US)</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label className="font-bold text-sm">Salário Mínimo ($/h)</Label>
              <Input
                type="number"
                placeholder="Ex: 15.00"
                value={minWage}
                onChange={(e) => setMinWage(e.target.value)}
              />
            </div>
          </div>

          {/* CATEGORIES */}
          <div className="space-y-3">
            <Label className="font-bold text-sm">Categorias de Interesse</Label>
            <p className="text-xs text-muted-foreground">
              Selecione as categorias de vagas que deseja monitorar. Deixe vazio para todas.
            </p>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-xl border">
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategories.includes(cat) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all text-xs",
                    selectedCategories.includes(cat)
                      ? "bg-violet-600 hover:bg-violet-700 text-white"
                      : "hover:bg-slate-100"
                  )}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
            {selectedCategories.length > 0 && (
              <p className="text-xs text-violet-600 font-medium">
                {selectedCategories.length} categoria(s) selecionada(s)
              </p>
            )}
          </div>

          {/* SAVE */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base shadow-lg"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* INFO BOX */}
      <Card className="border-violet-200 bg-violet-50/50">
        <CardContent className="p-5">
          <div className="flex gap-4 items-start">
            <div className="bg-violet-600 p-2.5 rounded-xl text-white shrink-0">
              <RadarIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1 text-sm text-violet-900">
              <p className="font-bold">Como funciona o Radar?</p>
              <ul className="list-disc list-inside space-y-1 text-violet-800 text-xs">
                <li>O Radar verifica periodicamente novas vagas que correspondem aos seus critérios</li>
                <li>Vagas compatíveis são adicionadas automaticamente à sua fila</li>
                <li>No modo automático, os e-mails são enviados respeitando os limites do seu plano</li>
                <li>Os delays de envio seguem as regras do seu plano ({planTier === "diamond" ? "15-45s" : "1-5min"})</li>
                <li>Duplicatas são ignoradas - cada vaga é processada apenas uma vez</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
