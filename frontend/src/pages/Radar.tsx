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
  ChevronDown,
  ChevronRight,
  Rocket,
  Trash2,
  Send,
  MapPin,
  CircleDollarSign,
  Briefcase,
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
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
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

  const fetchMatches = async () => {
    if (!profile?.id) return;
    const { data, count } = await supabase
      .from("radar_matched_jobs")
      .select(
        `
        id,
        job_id,
        public_jobs (*)
      `,
        { count: "exact" },
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (data) setMatchedJobs(data);
    if (count !== null) setMatchCount(count);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data: catData }: any = await supabase.rpc("get_category_stats_cached" as any);
        if (catData && Array.isArray(catData)) {
          const grouped = catData.reduce((acc: any, curr: any) => {
            if (!acc[curr.segment_name]) acc[curr.segment_name] = [];
            acc[curr.segment_name].push(curr);
            return acc;
          }, {});
          setGroupedCategories(grouped);
        }

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
          await fetchMatches();
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
      await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });
      await fetchMatches();
      setRadarProfile(payload);
    }
    setSaving(false);
  };

  const removeMatch = async (matchId: string) => {
    const { error } = await supabase.from("radar_matched_jobs").delete().eq("id", matchId);
    if (!error) {
      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => prev - 1);
    }
  };

  if (!isPremium)
    return (
      <div className="p-20 text-center">
        <RadarIcon className="h-20 w-20 mx-auto text-slate-200 animate-pulse" />
        <Button onClick={() => navigate("/plans")} className="mt-6">
          Upgrade to Premium
        </Button>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600/50" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24 px-4 sm:px-6 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES (4/12) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl",
                  isActive ? "bg-emerald-500 text-white shadow-lg" : "bg-slate-100 text-slate-400",
                )}
              >
                <RadarIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase italic leading-none">Radar Pro</h1>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isActive ? "Monitorando Base" : "Radar em Standby"}
                </span>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Salvar &
              Scanear
            </Button>
          </div>

          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/30">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Filtros e Regras
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Label className="text-xs font-bold">Radar Ativo</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <Label className="text-xs font-bold text-indigo-700">Auto-Enviar</Label>
                  <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Visto</Label>
                    <Select value={visaType} onValueChange={setVisaType}>
                      <SelectTrigger className="rounded-xl">
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
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Estado</Label>
                    <Select value={stateFilter} onValueChange={setStateFilter}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Qualquer</SelectItem>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Salário Mín.</Label>
                    <Input
                      type="number"
                      value={minWage}
                      onChange={(e) => setMinWage(e.target.value)}
                      className="rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Exp. Máxima</Label>
                    <Input
                      type="number"
                      value={maxExperience}
                      onChange={(e) => setMaxExperience(e.target.value)}
                      className="rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/30">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest italic">
                Categorias
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar">
              {Object.entries(groupedCategories).map(([segment, items]) => (
                <div key={segment} className="border rounded-xl overflow-hidden mb-1">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleSegment(segment)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedSegments.includes(segment) ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="text-[11px] font-black text-slate-700 uppercase italic tracking-tighter">
                        {segment}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[9px]">
                      {items.length}
                    </Badge>
                  </div>
                  {expandedSegments.includes(segment) && (
                    <div className="p-2 bg-slate-50/50 flex flex-wrap gap-1 border-t">
                      {items.map((cat) => (
                        <button
                          key={cat.raw_category}
                          onClick={() => toggleCategory(cat.raw_category)}
                          className={cn(
                            "px-2 py-1 rounded-lg border text-[10px] font-bold transition-all",
                            selectedCategories.includes(cat.raw_category)
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white text-slate-600",
                          )}
                        >
                          {cat.raw_category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: MATCHES (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="text-left">
              <h2 className="text-xl font-black flex items-center gap-2 tracking-tight uppercase italic text-slate-800">
                <Target className="h-5 w-5 text-indigo-600" /> Matches Detectados
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Ações pendentes na fila do robô
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-indigo-600 text-white font-black">{matchCount} Vagas</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[85vh] pr-2 custom-scrollbar">
            {matchedJobs.length > 0 ? (
              matchedJobs.map((match) => {
                const job = match.public_jobs;
                return (
                  <Card
                    key={match.id}
                    className="group border-slate-200 hover:border-indigo-300 transition-all shadow-sm"
                  >
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 text-left space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-700 text-[9px] border-emerald-100 uppercase font-black">
                            {job.visa_type}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {job.state}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 leading-none uppercase">{job.category}</h3>
                        <p className="text-[10px] font-bold text-slate-500 truncate max-w-md italic">{job.job_title}</p>
                        <div className="flex items-center gap-3 pt-2">
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                            <CircleDollarSign className="h-3 w-3 text-indigo-600" /> ${job.salary || "N/A"}/hr
                          </span>
                          <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                            <Briefcase className="h-3 w-3 text-indigo-600" /> {job.experience_months || 0}m exp
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 md:border-l md:pl-4">
                        <Button
                          size="sm"
                          onClick={() => removeMatch(match.id)}
                          variant="ghost"
                          className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-9 px-4 rounded-xl shadow-md flex items-center gap-2"
                        >
                          <Send className="h-3 w-3" /> ENVIAR AGORA
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-32 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-full shadow-sm">
                  <RadarIcon className="h-8 w-8 text-slate-300" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-tighter">
                    Nenhum match no momento
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    Salve as configurações para iniciar uma varredura.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
