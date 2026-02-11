import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Save, AlertTriangle, ExternalLink, Wifi, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmailWarmupOnboarding, type RiskProfile } from "./EmailWarmupOnboarding";
import { parseSmtpError } from "@/lib/smtpErrorParser";

type Provider = "gmail" | "outlook";

export function EmailSettingsPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);

  // Warmup states (mantido se precisar da lógica de risco no futuro, mas oculto na UI principal)
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const canLoad = useMemo(() => Boolean(user?.id), [user?.id]);

  // Carregar dados salvos
  useEffect(() => {
    if (!canLoad) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("smtp_credentials")
        .select("provider,email,has_password,risk_profile")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // Silently fail or log, user might not have credentials yet
        console.log("No credentials found or error:", error);
      } else if (data) {
        setProvider((data.provider as Provider) ?? "gmail");
        setEmail(data.email ?? "");
        setHasPassword(Boolean(data.has_password));
        setRiskProfile((data as any).risk_profile ?? null);
      }
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [canLoad, user]);

  // Formatação automática da senha de app (blocos de 4 letras)
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (provider === "gmail") {
      // Remove tudo que não for letra
      const clean = val.replace(/[^a-zA-Z]/g, "").toLowerCase();
      let formatted = "";
      for (let i = 0; i < clean.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += " ";
        formatted += clean[i];
      }
      setPassword(formatted);
    } else {
      setPassword(val);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!email) {
      toast({ title: t("smtp.toasts.email_required"), variant: "destructive" });
      return;
    }

    const cleanPass = password.replace(/\s/g, "");

    // Validação rígida para Gmail
    if (provider === "gmail" && password && cleanPass.length !== 16) {
      toast({
        title: "Senha incompleta",
        description: "A Senha de App do Google deve ter exatamente 16 letras.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: payload, error: funcError } = await supabase.functions.invoke("save-smtp-credentials", {
        body: { provider, email, password: cleanPass || undefined },
      });

      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error || "Erro ao salvar");

      if (password.trim().length > 0) {
        setHasPassword(true);
        setPassword("");
      }

      toast({ title: t("smtp.toasts.saved"), description: "Credenciais atualizadas com sucesso." });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao salvar";
      toast({ title: t("smtp.toasts.save_error_title"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!email) {
      toast({ title: "Preencha o email antes de testar", variant: "destructive" });
      return;
    }

    // Se usuário digitou senha nova, usa ela. Senão, tenta usar a salva no backend.
    const passToSend = password.replace(/\s/g, "");

    setTestingConnection(true);
    try {
      const { data: payload, error: funcError } = await supabase.functions.invoke("send-email-custom", {
        body: {
          to: email, // Envia para o próprio usuário
          subject: "✅ Teste de Conexão SMTP - JobFy",
          body: "Parabéns! Se você recebeu este email, seu SMTP está configurado corretamente e pronto para enviar aplicações.",
          provider,
          overridePassword: passToSend || undefined,
        },
      });

      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error || "Falha na conexão");

      toast({
        title: "Conexão Estabelecida! 🚀",
        description: "Email de teste enviado. Verifique sua caixa de entrada.",
        className: "bg-green-600 text-white border-none",
      });
    } catch (e: any) {
      const parsed = parseSmtpError(e.message || "Erro desconhecido");
      toast({
        title: "Falha na conexão",
        description: parsed.descriptionKey ? t(parsed.descriptionKey) : e.message,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Handler para perfil de risco (se necessário no futuro)
  const handleSaveRiskProfile = async (selectedProfile: RiskProfile) => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      await supabase.functions.invoke("save-smtp-credentials", {
        body: { provider, email, risk_profile: selectedProfile },
      });
      setRiskProfile(selectedProfile);
      toast({ title: t("warmup.toasts.profile_saved") });
    } catch (e) {
      toast({ title: t("warmup.toasts.profile_error"), variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[20vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const planTier = profile?.plan_tier || "free";
  const needsWarmupOnboarding = hasPassword && !riskProfile && planTier !== "free";

  return (
    <div className="space-y-6">
      {/* 1. TUTORIAL DE SEGURANÇA (Obrigatório ver) */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-500 text-lg">
            <AlertTriangle className="h-5 w-5" />
            Atenção: Não use sua senha normal
          </CardTitle>
          <CardDescription className="text-amber-700/80 dark:text-amber-400/80 font-medium">
            Sua senha de login pessoal NÃO funcionará. Você precisa gerar uma <strong>Senha de App</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 max-w-[450px]">
              <div className="rounded-lg overflow-hidden border shadow-sm aspect-video bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/Lz6fJChKRtA?si=4Mt-69l3C8NaS8yN"
                  title="Tutorial Senha de App Google"
                  frameBorder="0"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
            <div className="flex-1 space-y-4 text-sm flex flex-col justify-center">
              <p className="text-muted-foreground">Siga os 4 passos obrigatórios:</p>
              <ol className="list-decimal list-inside space-y-2 font-medium text-slate-700 dark:text-slate-300">
                <li>
                  Ative a <strong>Verificação em duas etapas</strong> no Google.
                </li>
                <li>
                  Pesquise por <strong>"Senhas de App"</strong> na sua conta.
                </li>
                <li>Crie uma nova senha com o nome "JobFy".</li>
                <li>Copie o código de 16 letras gerado.</li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto mt-2 gap-2 border-amber-300 hover:bg-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-100"
                asChild
              >
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                  Gerar Senha Agora <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Onboarding de Aquecimento (Opcional) */}
      {needsWarmupOnboarding && <EmailWarmupOnboarding onSelect={handleSaveRiskProfile} loading={savingProfile} />}

      {/* 3. Formulário Limpo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("smtp.title")}
          </CardTitle>
          <CardDescription>Insira seus dados para conectar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{t("smtp.fields.provider")}</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v as Provider);
                  setPassword("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail (Recomendado)</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("smtp.fields.email")}</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu.email@gmail.com" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <Label className="flex flex-col gap-1">
                <span>Senha de App (16 Letras)</span>
                <span className="text-[11px] font-normal text-red-500">
                  * Não coloque sua senha de login aqui. Veja o vídeo acima.
                </span>
              </Label>
              {provider === "gmail" && password.replace(/\s/g, "").length === 16 && (
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Tamanho correto
                </span>
              )}
            </div>

            <div className="relative">
              <Input
                type="text"
                value={password}
                onChange={handlePasswordChange}
                placeholder={hasPassword ? "•••• •••• •••• •••• (Salvo)" : "abcd efgh ijkl mnop"}
                className={provider === "gmail" ? "font-mono text-lg tracking-wider" : ""}
                maxLength={provider === "gmail" ? 19 : 100}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t mt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto min-w-[140px]">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {t("common.save")}
            </Button>

            <Button
              onClick={handleTestConnection}
              disabled={testingConnection || (!hasPassword && !password)}
              variant="outline"
              className="w-full md:w-auto min-w-[160px] border-blue-200 hover:bg-blue-50 text-blue-700"
            >
              {testingConnection ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="mr-2 h-4 w-4" />
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
