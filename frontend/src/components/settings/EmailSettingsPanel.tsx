import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Save, AlertTriangle, ExternalLink, Wifi, CheckCircle2 } from "lucide-react";
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
  const [testing, setTesting] = useState(false);

  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const canLoad = useMemo(() => Boolean(user?.id), [user?.id]);

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

      if (data) {
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

  // --- TRAVA DE SEGURANÇA GMAIL (16 LETRAS) ---
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (provider === "gmail") {
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
    if (provider === "gmail" && password && cleanPass.length !== 16) {
      toast({
        title: "Senha inválida",
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

      toast({ title: t("smtp.toasts.saved") });
    } catch (e: any) {
      toast({ title: t("smtp.toasts.save_error_title"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- BOTÃO DE TESTE RÁPIDO ---
  const handleTestConnection = async () => {
    if (!email) {
      toast({ title: "Informe o e-mail primeiro", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const { data: payload, error: funcError } = await supabase.functions.invoke("send-email-custom", {
        body: {
          to: email,
          subject: "✅ Teste de Conexão SMTP - H2 Linker",
          body: "Parabéns! Sua conexão SMTP está funcionando perfeitamente no H2 Linker.",
          provider,
          overridePassword: password.replace(/\s/g, "") || undefined,
        },
      });

      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error);

      toast({
        title: "Conexão OK! 🚀",
        description: "Enviamos um e-mail de teste para você.",
        className: "bg-green-600 text-white border-none",
      });
    } catch (e: any) {
      const parsed = parseSmtpError(e.message);
      toast({ title: "Erro na conexão", description: t(parsed.descriptionKey), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

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

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  const planTier = profile?.plan_tier || "free";
  const needsWarmupOnboarding = hasPassword && !riskProfile && planTier !== "free";

  return (
    <div className="space-y-6">
      {/* 1. TUTORIAL OBRIGATÓRIO */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
        <CardHeader className="pb-3 text-amber-800 dark:text-amber-500">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Atenção: Não use sua senha normal
          </CardTitle>
          <CardDescription className="text-amber-700/80 dark:text-amber-400/80 font-medium">
            Sua senha de login pessoal NÃO funcionará. Siga o passo a passo abaixo:
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
            <div className="flex-1 space-y-3 text-sm flex flex-col justify-center">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground font-medium">
                <li>
                  Ative a <strong>Verificação em duas etapas</strong> no Google.
                </li>
                <li>
                  Pesquise por <strong>"Senhas de App"</strong> na sua conta.
                </li>
                <li>
                  Crie uma senha com o nome <strong>"H2 Linker"</strong>.
                </li>
                <li>Copie o código de 16 letras e cole abaixo.</li>
              </ol>
              <Button variant="outline" size="sm" className="w-full sm:w-auto gap-2 border-amber-300" asChild>
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                  Gerar Senha Agora <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {needsWarmupOnboarding && <EmailWarmupOnboarding onSelect={handleSaveRiskProfile} loading={savingProfile} />}

      {/* 2. FORMULÁRIO DE CONFIGURAÇÃO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> {t("smtp.title")}
          </CardTitle>
          <CardDescription>{t("smtp.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <SelectValue />
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

          <div className="space-y-2">
            <Label className="flex justify-between">
              <span>Senha de App (16 letras)</span>
              {provider === "gmail" && (
                <span className="text-[10px] text-red-500 font-bold uppercase">Senha normal não funciona</span>
              )}
            </Label>
            <Input
              type="text"
              value={password}
              onChange={handlePasswordChange}
              placeholder={hasPassword ? "•••• •••• •••• •••• (Salva)" : "abcd efgh ijkl mnop"}
              className={provider === "gmail" ? "font-mono text-lg tracking-wider" : ""}
              maxLength={provider === "gmail" ? 19 : 100}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {provider === "gmail"
                ? `Letras digitadas: ${password.replace(/\s/g, "").length}/16`
                : t("smtp.password_note.empty")}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}{" "}
              {t("common.save")}
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={testing || (!hasPassword && !password)}
              variant="outline"
              className="flex-1 border-blue-200 text-blue-700"
            >
              {testing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Wifi className="mr-2 h-4 w-4" />} Testar
              Conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
