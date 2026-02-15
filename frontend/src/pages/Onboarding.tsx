import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  Mail,
  Shield,
  Clock,
  Zap,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Rocket,
  Settings,
  FileText,
  ExternalLink,
  Info,
  TrendingUp,
  Star,
  Key,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils"; // <-- IMPORTAÇÃO CORRIGIDA

type Provider = "gmail" | "outlook";
type RiskProfile = "conservative" | "standard" | "aggressive";

export default function Onboarding() {
  const { t } = useTranslation();
  const { user, profile, refreshProfile, refreshSmtpStatus } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(true);

  // SMTP fields
  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    if (!user?.id) return;
    const checkExistingSmtp = async () => {
      setCheckingSmtp(true);
      const { data } = await supabase
        .from("smtp_credentials")
        .select("has_password, risk_profile")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.has_password && data?.risk_profile) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (data?.has_password && !data?.risk_profile) {
        setStep(3);
      }
      setCheckingSmtp(false);
    };
    checkExistingSmtp();
  }, [user?.id, navigate]);

  // --- VALIDAÇÃO DA SENHA DE APP (16 letras apenas) ---
  const handlePasswordChange = (val: string) => {
    // Remove espaços, números e símbolos. Aceita apenas letras e trava em 16.
    const sanitized = val
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 16)
      .toLowerCase();
    setPassword(sanitized);
  };

  const handleSaveSmtp = async () => {
    if (!user?.id) return;

    if (password.length !== 16) {
      toast({
        title: "Senha incompleta",
        description: "A Senha de App do Google/Outlook deve ter exatamente 16 letras.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-smtp-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, email, password }),
      });

      const payload = await res.json();
      if (!res.ok || payload?.success === false) throw new Error(payload?.error || "Erro ao salvar");

      toast({ title: "Configuração salva!", description: "E-mail autenticado com sucesso." });
      setStep(3);
    } catch (e: any) {
      toast({ title: "Erro na autenticação", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRiskProfile = async () => {
    if (!user?.id || !riskProfile) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-smtp-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token}` },
        body: JSON.stringify({ provider, email, risk_profile: riskProfile }),
      });
      if (!res.ok) throw new Error("Falha ao salvar perfil");
      setStep(4);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- FINALIZAÇÃO COM DELAY PARA EVITAR LOOPING ---
  const handleComplete = async () => {
    setLoading(true);
    try {
      // 1. Atualiza o contexto global com os novos dados do banco
      await refreshSmtpStatus?.();
      await refreshProfile?.();

      // 2. Delay de 500ms para garantir que o estado do React atualizou
      await new Promise((r) => setTimeout(r, 500));

      // 3. Redireciona
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSmtp)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-slate-500">Verificando status...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="p-6 flex items-center justify-between border-b bg-white shadow-sm">
        <BrandLogo height={28} />
        <Badge variant="secondary" className="font-bold">
          Passo {step} de {totalSteps}
        </Badge>
      </div>

      <Progress value={progress} className="h-1 rounded-none bg-slate-100" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {step === 1 && (
            <Card className="shadow-2xl border-none">
              <CardHeader className="text-center pb-8">
                <div className="mx-auto mb-4 p-5 rounded-full bg-primary/10 w-fit">
                  <Rocket className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">
                  Bem-vindo, Sócio!
                </CardTitle>
                <CardDescription className="text-base">
                  Sua conta foi criada. Agora, vamos conectar seu e-mail para que a IA comece a trabalhar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setStep(2)} className="w-full h-14 text-lg font-bold shadow-lg">
                  INICIAR CONFIGURAÇÃO <ArrowRight className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="shadow-2xl border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  <Key className="text-primary h-6 w-6" /> Conexão SMTP
                </CardTitle>
                <CardDescription>Use os dados da sua conta para habilitar o envio automático.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <p className="font-bold uppercase tracking-wide">O que é a Senha de App?</p>
                    <p className="mt-1">
                      Para sua segurança, o Google e o Outlook exigem uma senha específica de 16 letras gerada nas
                      configurações de segurança da sua conta. **Não use sua senha normal de login.**
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold">Provedor</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gmail">Gmail</SelectItem>
                        <SelectItem value="outlook">Outlook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">E-mail</Label>
                    <Input
                      className="h-11"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <Label className="font-bold text-primary flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Senha de App (16 letras)
                    </Label>
                    <span
                      className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded bg-slate-100",
                        password.length === 16 ? "text-emerald-600 bg-emerald-50" : "text-slate-400",
                      )}
                    >
                      {password.length}/16
                    </span>
                  </div>
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="h-14 text-center text-xl font-mono tracking-[0.4em] uppercase placeholder:tracking-normal placeholder:text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground text-center">
                    Dica: Copie e cole os 16 dígitos sem se preocupar com os espaços.
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="ghost" onClick={() => setStep(1)} className="h-11">
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSaveSmtp}
                    disabled={loading || password.length !== 16}
                    className="flex-1 h-11 font-bold shadow-md"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    VERIFICAR E CONTINUAR
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="shadow-xl border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="text-primary h-6 w-6" /> Perfil de Envio
                </CardTitle>
                <CardDescription>Escolha a intensidade com que a IA deve disparar seus currículos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: "conservative", title: "Conservador", desc: "Foco total em segurança, envios mais lentos." },
                  { id: "standard", title: "Padrão", desc: "Equilíbrio entre volume e segurança (Recomendado)." },
                  { id: "aggressive", title: "Agressivo", desc: "Máximo volume de envios diários." },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setRiskProfile(p.id as any)}
                    className={cn(
                      "p-4 border-2 rounded-2xl cursor-pointer transition-all hover:border-primary/50",
                      riskProfile === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-100",
                    )}
                  >
                    <p className="font-bold text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                ))}
                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSaveRiskProfile}
                    disabled={!riskProfile || loading}
                    className="flex-1 font-bold h-11"
                  >
                    PRÓXIMO PASSO
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="shadow-2xl border-none text-center p-10 animate-in zoom-in-95 duration-500">
              <div className="bg-emerald-100 p-5 rounded-full w-fit mx-auto mb-6">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <CardTitle className="text-3xl font-black uppercase italic tracking-tighter">
                Configuração Finalizada!
              </CardTitle>
              <CardDescription className="text-base mt-2 mb-8">
                Seu e-mail foi conectado com sucesso e o motor de IA está aquecido.
              </CardDescription>
              <Button
                onClick={handleComplete}
                disabled={loading}
                className="w-full h-14 font-black text-lg shadow-xl uppercase italic"
              >
                {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : "ACESSAR MEU DASHBOARD"}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
