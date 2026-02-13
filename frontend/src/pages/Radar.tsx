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
  ChevronDown,
  ChevronRight,
  Radar as RadarIcon,
  Zap,
  ShieldCheck,
  Loader2,
  Save,
  Target,
  TrendingUp,
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
  const [groupedCategories, setGroupedCategories] = useState<Record<string, any[]>>({});
  const [expandedSegments, setExpandedSegments] = useState<string[]>([]);
  const [radarProfile, setRadarProfile] = useState<any>(null);

  // States do Formulário
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
        const { data: catData }: any = await supabase.rpc("get_category_stats_cached" as any);
        if (catData) {
          const grouped = catData.reduce((acc: any, curr: any) => {
            if (!acc[curr.segment_name]) acc[curr.segment_name] = [];
            acc[curr.segment_name].push(curr);
            return acc;
          }, {});
          setGroupedCategories(grouped);
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

  const toggleSegment = (segment: string) => {
    setExpandedSegments((prev) => (prev.includes(segment) ? prev.filter((s) => s !== segment) : [...prev, segment]));
  };

  const handleSelectCategory = (catName: string) => {
    setSelectedCategories((prev) => (prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]));
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
        description: "Iniciando varredura instantânea...",
        className: "bg-indigo-600 text-white",
      });
      setRadarProfile(payload);
    }
    setSaving(false);
  };

  if (!isPremium)
    return (
      <div className="p-20 text-center">
        <h1>Conteúdo Exclusivo Premium</h1>
        <Button onClick={() => navigate("/plans")}>Ver Planos</Button>
      </div>
    );
  if (loading)
    return (
      <div className="p-20 text-center text-indigo-600">
        <Loader2 className="animate-spin h-10 w-10 mx-auto" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-2xl", isActive ? "bg-emerald-500 text-white" : "bg-slate-100")}>
            <RadarIcon />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-black uppercase italic">Radar Inteligente</h1>
            <p className="text-xs font-bold text-slate-400">STATUS: {isActive ? "MONITORANDO" : "OFFLINE"}</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-14 px-10 bg-indigo-600 font-bold rounded-2xl w-full md:w-auto"
        >
          {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} SALVAR CONFIGURAÇÃO
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PARÂMETROS ESQUERDA */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-xs uppercase font-black text-slate-500">Parâmetros do Bot</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <Label className="text-sm font-bold">Ativar Radar</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex justify-between items-center p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <Label className="text-sm font-bold text-indigo-700">Auto-Enviar</Label>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
              <div className="space-y-4 text-left">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Visto</Label>
                  <Select value={visaType} onValueChange={setVisaType}>
                    <SelectTrigger className="rounded-xl h-11">
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
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estado</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="rounded-xl h-11">
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Salário Min</Label>
                    <Input
                      type="number"
                      value={minWage}
                      onChange={(e) => setMinWage(e.target.value)}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Exp Max (meses)</Label>
                    <Input
                      type="number"
                      value={maxExperience}
                      onChange={(e) => setMaxExperience(e.target.value)}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CATEGORIAS DIREITA - AGRUPADO POR SEGMENTO */}
        <div className="lg:col-span-8">
          <Card className="rounded-3xl shadow-sm border-slate-200 h-full">
            <CardHeader className="bg-slate-50 border-b py-3 flex flex-row justify-between items-center">
              <CardTitle className="text-xs uppercase font-black text-slate-500">Segmentos e Especialidades</CardTitle>
              <Badge variant="outline" className="text-[10px] font-bold">
                {selectedCategories.length} selecionadas
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {Object.entries(groupedCategories).map(([segment, items]) => {
                const isExpanded = expandedSegments.includes(segment);
                const selectedInSegment = items.filter((i) => selectedCategories.includes(i.raw_category)).length;
                const totalInSegment = items.reduce((acc, curr) => acc + curr.job_count, 0);

                return (
                  <div key={segment} className="border rounded-2xl overflow-hidden transition-all duration-200">
                    <div
                      className={cn(
                        "flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50",
                        isExpanded && "bg-slate-50 border-b",
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1" onClick={() => toggleSegment(segment)}>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-800">{segment}</p>
                          <p className="text-[10px] text-indigo-600 font-bold">{totalInSegment} vagas ativas</p>
                        </div>
                      </div>
                      <Button
                        variant={selectedInSegment === items.length ? "default" : "outline"}
                        size="sm"
                        onClick={() => selectFullSegment(segment)}
                        className="text-[10px] h-7 font-bold"
                      >
                        {selectedInSegment === items.length ? "REMOVER TUDO" : `SELECIONAR ${items.length}`}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-2">
                        {items.map((cat) => (
                          <div
                            key={cat.raw_category}
                            onClick={() => handleSelectCategory(cat.raw_category)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                              selectedCategories.includes(cat.raw_category)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white hover:border-indigo-200",
                            )}
                          >
                            <span className="text-xs font-bold text-left" translate="no">
                              {cat.raw_category}
                            </span>
                            <Badge
                              className={cn(
                                "text-[9px]",
                                selectedCategories.includes(cat.raw_category) ? "bg-white/20" : "bg-slate-100",
                              )}
                            >
                              {cat.job_count}
                            </Badge>
                          </div>
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
    </div>
  );
}
