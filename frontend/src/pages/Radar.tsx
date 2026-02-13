import { useEffect, useState, useMemo } from "react";
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
  Check,
  RefreshCcw,
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
  id?: string;
  user_id?: string;
  is_active?: boolean;
  auto_send?: boolean;
  categories?: string[];
  min_wage?: number | null;
  max_experience?: number | null;
  visa_type?: string | null;
  state?: string | null;
}

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
  const [radarProfile, setRadarProfile] = useState<RadarProfile | null>(null);

  // Form states
  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minWage, setMinWage] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [visaType, setVisaType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  const isPremium = profile?.plan_tier === "diamond" || profile?.plan_tier === "black";

  const hasChanges = useMemo(() => {
    if (!radarProfile) return false;
    const dbCats = radarProfile.categories || [];
    const catsChanged = JSON.stringify([...selectedCategories].sort()) !== JSON.stringify([...dbCats].sort());
    return (
      isActive !== (radarProfile.is_active ?? false) ||
      autoSend !== (radarProfile.auto_send ?? false) ||
      catsChanged ||
      minWage !== (radarProfile.min_wage?.toString() || "") ||
      maxExperience !== (radarProfile.max_experience?.toString() || "") ||
      visaType !== (radarProfile.visa_type || "all") ||
      stateFilter !== (radarProfile.state || "all")
    );
  }, [isActive, autoSend, selectedCategories, minWage, maxExperience, visaType, stateFilter, radarProfile]);

  const fetchMatches = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("radar_matched_jobs" as any)
      .select(`id, job_id, public_jobs!fk_radar_job (*)`)
      .eq("user_id", profile.id);

    if (!error && data) {
      setMatchedJobs(data);
      setMatchCount(data.length);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;
      try {
        setLoading(true);
        const { data: catData } = await supabase.rpc("get_category_stats_cached" as any);
        if (catData) {
          const grouped = (catData as any[]).reduce((acc: any, curr: any) => {
            if (!acc[curr.segment_name]) acc[curr.segment_name] = [];
            acc[curr.segment_name].push(curr);
            return acc;
          }, {});
          setGroupedCategories(grouped);
        }

        const { data: prof }: any = await supabase
          .from("radar_profiles" as any)
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle();
        if (prof) {
          setRadarProfile(prof);
          setIsActive(prof.is_active);
          setAutoSend(prof.auto_send);
          setSelectedCategories(prof.categories || []);
          setMinWage(prof.min_wage?.toString() || "");
          setMaxExperience(prof.max_experience?.toString() || "");
          setVisaType(prof.visa_type || "all");
          setStateFilter(prof.state || "all");
        }
        await fetchMatches();
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile?.id]);

  const performSave = async (overrides = {}) => {
    if (!profile?.id) return;
    setSaving(true);
    const payload = {
      user_id: profile.id,
      is_active: isActive,
      auto_send: autoSend,
      categories: selectedCategories,
      min_wage: minWage !== "" ? Number(minWage) : null,
      max_experience: maxExperience !== "" ? Number(maxExperience) : null,
      visa_type: visaType === "all" ? null : visaType,
      state: stateFilter === "all" ? null : stateFilter,
      ...overrides,
    };

    const { error } = radarProfile
      ? await supabase
          .from("radar_profiles" as any)
          .update(payload)
          .eq("user_id", profile.id)
      : await supabase.from("radar_profiles" as any).insert(payload);

    if (!error) {
      setRadarProfile({ ...radarProfile, ...payload });
      if (payload.is_active) {
        await supabase.rpc("trigger_immediate_radar" as any, { target_user_id: profile.id });
        await fetchMatches();
      }
      toast({ title: "Radar Atualizado!" });
    }
    setSaving(false);
  };

  const handleSendApplication = async (matchId: string, jobId: string) => {
    try {
      // 1. Inserir na tabela sent_jobs usando cast de string literal para evitar erro de cache de schema
      const { error: sendError } = await supabase.from("sent_jobs" as any).insert([
        {
          user_id: profile?.id,
          job_id: jobId,
          status: "pending",
        },
      ]);

      if (sendError) throw sendError;

      // 2. Remover da fila de matches
      await supabase
        .from("radar_matched_jobs" as any)
        .delete()
        .eq("id", matchId);

      setMatchedJobs((prev) => prev.filter((m) => m.id !== matchId));
      setMatchCount((prev) => prev - 1);
      toast({ title: "Sucesso!", description: "Vaga enviada para a fila principal." });
    } catch (err: any) {
      console.error("Erro no envio:", err);
      toast({
        title: "Erro ao enviar",
        description: "O cache do banco falhou. Tente novamente em instantes.",
        variant: "destructive",
      });
    }
  };

  const removeMatch = async (matchId: string) => {
    const { error } = await supabase
      .from("radar_matched_jobs" as any)
      .delete()
      .eq("id", matchId);
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
          Upgrade to Diamond
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-3 rounded-2xl",
                    isActive ? "bg-emerald-500 text-white shadow-lg animate-pulse" : "bg-slate-100 text-slate-400",
                  )}
                >
                  <RadarIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase italic leading-none">Radar Pro</h1>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {isActive ? "Monitorando" : "Standby"}
                  </span>
                </div>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(val) => {
                  setIsActive(val);
                  performSave({ is_active: val });
                }}
                disabled={saving}
              />
            </div>
            {hasChanges && (
              <Button
                onClick={() => performSave()}
                disabled={saving}
                className="w-full bg-indigo-600 text-white font-black h-12 rounded-xl"
              >
                <Save className="h-4 w-4 mr-2" /> APLICAR ALTERAÇÕES
              </Button>
            )}
          </div>

          <Card className="border-slate-200 rounded-2xl shadow-sm">
            <CardHeader className="p-5 border-b bg-slate-50/30">
              <CardTitle className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-center p-3 bg-indigo-50/30 rounded-xl border border-indigo-100">
                <Label className="text-sm font-bold text-indigo-700">Auto-Enviar</Label>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Visto</Label>
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
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Estado</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger>
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
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Salário Mín.</Label>
                  <Input type="number" value={minWage} onChange={(e) => setMinWage(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase">Exp. Máx.</Label>
                  <Input type="number" value={maxExperience} onChange={(e) => setMaxExperience(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="text-left">
              <h2 className="text-xl font-black uppercase italic">
                <Target className="h-6 w-6 text-indigo-600 inline mr-2" /> Fila de Matches
              </h2>
            </div>
            <Badge className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-full shadow-lg">
              {matchCount} Vagas
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[85vh] pr-2 custom-scrollbar">
            {matchedJobs.length > 0 ? (
              matchedJobs.map((match) => {
                const job = match.public_jobs;
                if (!job) return null;
                return (
                  <Card
                    key={match.id}
                    className="group border-slate-200 hover:border-indigo-300 transition-all shadow-sm bg-white overflow-hidden"
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
                        <h3 className="text-sm font-black text-slate-900 leading-tight uppercase">{job.category}</h3>
                        <p className="text-[10px] font-bold text-slate-500 italic truncate">{job.job_title}</p>
                      </div>
                      <div className="flex items-center gap-2 border-l pl-4">
                        <Button
                          size="sm"
                          onClick={() => handleSendApplication(match.id, job.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-9 px-6 rounded-xl shadow-md"
                        >
                          ENVIAR
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => removeMatch(match.id)}
                          variant="ghost"
                          className="h-9 w-9 p-0 text-slate-300 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-32 bg-slate-50/30 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-4 text-center">
                <RadarIcon className="h-12 w-12 text-slate-200 animate-pulse" />
                <p className="text-sm font-black text-slate-400 uppercase italic">Nenhum Match Encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
