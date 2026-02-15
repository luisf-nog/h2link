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

  // --- VALIDAÇÃO DA SENHA DE APP (16 letras) ---
  const handlePasswordChange = (val: string) => {
    // Remove espaços e números, aceita apenas letras e limita a 16
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
        title: "Senha inválida",
        description: "A Senha de App deve ter exatamente 16 letras.",
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
      if (!res.ok || payload?.success === false) throw new Error(payload?.error);

      toast({ title: "SMTP Configurado!" });
      setStep(3);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
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

  // --- SOLUÇÃO DO LOOPING DE REDIRECIONAMENTO ---
  const handleComplete = async () => {
    setLoading(true);
    try {
      // 1. Força a atualização do estado global no Contexto
      await refreshSmtpStatus?.();
      await refreshProfile?.();

      // 2. Delay estratégico para garantir que o cache do Apollo/Supabase assente
      await new Promise((r) => setTimeout(r, 500));

      // 3. Navega usando replace para limpar a pilha
      navigate("/dashboard", { replace: true });
    } catch (error) {
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSmtp)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="p-6 flex items-center justify-between border-b bg-white">
        <BrandLogo height={28} />
        <Badge variant="outline">
          Passo {step} de {totalSteps}
        </Badge>
      </div>

      <Progress value={progress} className="h-1 rounded-none" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {step === 1 && (
            <Card className="shadow-xl border-none">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
                  <Rocket className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="text-2xl font-black italic uppercase">Bem-vindo Sócio!</CardTitle>
                <CardDescription>Vamos configurar sua máquina de envios em menos de 2 minutos.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setStep(2)} className="w-full h-12 text-lg font-bold">
                  COMEÇAR CONFIGURAÇÃO <ArrowRight className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="shadow-xl border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="text-primary" /> Configuração de E-mail
                </CardTitle>
                <CardDescription>Conecte sua conta para que a IA envie os e-mails por você.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-bold uppercase tracking-tight">Atenção: Use uma "Senha de App"</p>
                    <p className="mt-1">
                      Por segurança, o Google e Outlook não aceitam sua senha normal. Você deve gerar uma senha de 16
                      letras nas configurações da sua conta.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gmail">Gmail</SelectItem>
                        <SelectItem value="outlook">Outlook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Seu E-mail</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@gmail.com" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="font-bold text-primary">Senha de App (16 letras)</Label>
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        password.length === 16 ? "text-emerald-500" : "text-slate-400",
                      )}
                    >
                      {password.length}/16 CARACTERES
                    </span>
                  </div>
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="h-12 text-center text-lg font-mono tracking-[0.3em] uppercase"
                  />
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Info className="h-3 w-3" />
                    <span>Apenas letras são permitidas. Remova espaços se colar.</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button
                    onClick={handleSaveSmtp}
                    disabled={loading || password.length !== 16}
                    className="flex-1 font-bold"
                  >
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Lock className="mr-2 h-4 w-4" />}
                    AUTENTICAR E CONTINUAR
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="shadow-xl border-none">
              <CardHeader>
                <CardTitle>Perfil de Aquecimento</CardTitle>
                <CardDescription>Como você quer que a IA gerencie o volume de envios?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {["conservative", "standard", "aggressive"].map((p) => (
                  <div
                    key={p}
                    onClick={() => setRiskProfile(p as any)}
                    className={cn(
                      "p-4 border-2 rounded-xl cursor-pointer transition-all",
                      riskProfile === p ? "border-primary bg-primary/5" : "border-slate-100",
                    )}
                  >
                    <p className="font-bold capitalize">{p}</p>
                  </div>
                ))}
                <Button onClick={handleSaveRiskProfile} disabled={!riskProfile || loading} className="w-full mt-4">
                  SALVAR PERFIL
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="shadow-xl border-none text-center p-8">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <CardTitle className="text-2xl font-black uppercase">Tudo Pronto!</CardTitle>
              <CardDescription className="mb-6">Sua conta está configurada e pronta para decolar.</CardDescription>
              <Button onClick={handleComplete} disabled={loading} className="w-full h-12 font-bold text-lg">
                {loading ? <Loader2 className="animate-spin mr-2" /> : "IR PARA O DASHBOARD"}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
