import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Save, AlertTriangle, ExternalLink, Wifi, FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmailWarmupOnboarding, type RiskProfile } from "./EmailWarmupOnboarding";
import { parseSmtpError } from "@/lib/smtpErrorParser";

type Provider = "gmail" | "outlook";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export function EmailSettingsPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");

  // test email states
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(() => t("smtp.test.defaults.subject"));
  const [body, setBody] = useState(() => t("smtp.test.defaults.body"));
  const [testCompany, setTestCompany] = useState("");
  const [testPosition, setTestPosition] = useState("");
  const [testVisaType, setTestVisaType] = useState<"H-2A" | "H-2B">("H-2B");

  const applyTemplate = (text: string, vars: Record<string, string>) => {
    let out = text;
    for (const [k, v] of Object.entries(vars)) {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
      out = out.replace(re, v);
    }
    return out;
  };

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
  }, [canLoad, toast, user]);

  useEffect(() => {
    if (!canLoad) return;
    const run = async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("id,name,subject,body")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (data) setTemplates((data as EmailTemplate[]) ?? []);
    };
    run();
  }, [canLoad, user]);

  useEffect(() => {
    if (selectedTemplateId === "none") return;
    const t = templates.find((x) => x.id === selectedTemplateId);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body);
  }, [selectedTemplateId, templates]);

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
      toast({ title: "Senha inválida", description: "A Senha de App deve ter 16 letras.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: payload, error: funcError } = await supabase.functions.invoke("save-smtp-credentials", {
        body: { provider, email, password: cleanPass || undefined },
      });
      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error);

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

  const handleTestConnection = async () => {
    if (!email) {
      toast({ title: "Preencha o email", variant: "destructive" });
      return;
    }
    const passToSend = password.replace(/\s/g, "");
    setTestingConnection(true);
    try {
      const { data: payload, error: funcError } = await supabase.functions.invoke("send-email-custom", {
        body: {
          to: email,
          subject: "✅ Teste de Conexão SMTP - JobFy",
          body: "Conexão bem sucedida!",
          provider,
          overridePassword: passToSend || undefined,
        },
      });
      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error);
      toast({
        title: "Conexão OK!",
        description: "Email de teste enviado.",
        className: "bg-green-600 text-white border-none",
      });
    } catch (e: any) {
      const parsed = parseSmtpError(e.message || "Erro");
      toast({
        title: "Falha na conexão",
        description: parsed.descriptionKey ? t(parsed.descriptionKey) : e.message,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
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

  const handleSendTest = async () => {
    if (!user?.id) return;
    if (!to || !subject || !body) {
      toast({ title: t("smtp.toasts.test_required_fields"), variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const vars = {
        name: profile?.full_name ?? "",
        age: String(profile?.age ?? ""),
        phone: profile?.phone_e164 ?? "",
        contact_email: profile?.contact_email ?? "",
        company: testCompany.trim(),
        position: testPosition.trim(),
        visa_type: testVisaType,
      };
      const finalSubject = applyTemplate(subject, vars);
      const finalBody = applyTemplate(body, vars);
      const { data: payload, error: funcError } = await supabase.functions.invoke("send-email-custom", {
        body: { to, subject: finalSubject, body: finalBody, provider },
      });
      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error);
      toast({ title: t("smtp.toasts.test_sent") });
    } catch (e: any) {
      const parsed = parseSmtpError(e.message);
      toast({ title: t(parsed.titleKey), description: t(parsed.descriptionKey), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-[20vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const planTier = profile?.plan_tier || "free";
  const needsWarmupOnboarding = hasPassword && !riskProfile && planTier !== "free";

  return (
    <div className="space-y-6">
      {/* 1. Tutorial (Só aqui, removido do arquivo pai) */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-500 text-lg">
            <AlertTriangle className="h-5 w-5" />
            Atenção: Não use sua senha normal
          </CardTitle>
          <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
            Para conectar seu Gmail, é obrigatório usar uma <strong>Senha de App (16 letras)</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 max-w-[400px]">
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
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>
                  Acesse sua conta Google e ative a <strong>Verificação em duas etapas</strong>.
                </li>
                <li>
                  Na busca da conta, digite <strong>"Senhas de App"</strong>.
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

      {/* 2. Onboarding Condicional */}
      {needsWarmupOnboarding && <EmailWarmupOnboarding onSelect={handleSaveRiskProfile} loading={savingProfile} />}

      {/* 3. Card de Configuração (Limpo) */}
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
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("smtp.placeholders.email")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>{t("smtp.fields.password")}</Label>
              {provider === "gmail" && (
                <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  Use a Senha de App
                </span>
              )}
            </div>
            <Input
              type="text"
              value={password}
              onChange={handlePasswordChange}
              placeholder={hasPassword ? "•••• •••• •••• •••• (Salvo)" : "xxxx xxxx xxxx xxxx"}
              className={provider === "gmail" ? "font-mono tracking-wide" : ""}
              maxLength={provider === "gmail" ? 19 : 100}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground flex justify-between">
              <span>
                {hasPassword
                  ? t("smtp.password_note.saved")
                  : provider === "gmail"
                    ? "Digite apenas as 16 letras."
                    : t("smtp.password_note.empty")}
              </span>
              {provider === "gmail" && (
                <span
                  className={`${password.replace(/\s/g, "").length === 16 ? "text-green-600 font-medium" : "text-muted-foreground"}`}
                >
                  {password.replace(/\s/g, "").length}/16
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} <Save className="mr-2 h-4 w-4" />{" "}
              {t("common.save")}
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection || (!hasPassword && !password)}
              variant="outline"
              className="flex-1 border-blue-200 hover:bg-blue-50 text-blue-700"
            >
              {testingConnection ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="mr-2 h-4 w-4" />
              )}{" "}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Card de Teste Avançado (ESCONDIDO NO ACCORDION) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced-test" className="border rounded-lg bg-card px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FlaskConical className="h-4 w-4" />
              <span>Teste de Template (Avançado)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Preencha os campos abaixo para simular o envio real de um template com variáveis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Campos de simulação */}
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Para (Email)</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Empresa (Simulação)</Label>
                <Input value={testCompany} onChange={(e) => setTestCompany(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Corpo do Email</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </div>
            <Button onClick={handleSendTest} disabled={sending} size="sm" variant="secondary">
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar Simulação
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
