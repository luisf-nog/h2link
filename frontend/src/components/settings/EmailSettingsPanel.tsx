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
import { Loader2, Mail, Save, AlertTriangle, ExternalLink, Wifi, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmailWarmupOnboarding, type RiskProfile } from "./EmailWarmupOnboarding";
import { getPlanLimit } from "@/config/plans.config";
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

  // Limpeza: Removidas variáveis de warmup que não vamos exibir
  const [savingProfile, setSavingProfile] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");

  // test email
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

      if (error) {
        toast({ title: t("smtp.toasts.load_error_title"), description: error.message, variant: "destructive" });
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

  // --- TRAVA DE SENHA DO GOOGLE ---
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    // Se for Gmail, aplicamos a máscara
    if (provider === "gmail") {
      // Remove tudo que não for letra (App Passwords são só letras)
      const clean = val.replace(/[^a-zA-Z]/g, "").toLowerCase();

      // Formata em blocos de 4 para ficar igual ao que o Google mostra
      // Ex: wxyz abcd efgh ijkl
      let formatted = "";
      for (let i = 0; i < clean.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += " ";
        formatted += clean[i];
      }
      setPassword(formatted);
    } else {
      // Outlook ou outros aceitam caracteres normais
      setPassword(val);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!email) {
      toast({ title: t("smtp.toasts.email_required"), variant: "destructive" });
      return;
    }

    // Validação extra antes de salvar
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
      if (payload?.success === false) throw new Error(payload?.error || "Erro ao salvar credenciais");

      if (password.trim().length > 0) {
        setHasPassword(true);
        setPassword("");
      }

      toast({ title: t("smtp.toasts.saved") });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({ title: t("smtp.toasts.save_error_title"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- NOVA FUNÇÃO: TESTAR CONEXÃO ---
  const handleTestConnection = async () => {
    if (!email) {
      toast({ title: "Preencha o email antes de testar", variant: "destructive" });
      return;
    }

    // Se o usuário digitou uma senha nova, usamos ela. Se não, tentamos usar a salva (backend decide).
    // Nota: Como não enviamos a senha salva para o front, se o campo estiver vazio,
    // o backend precisa tentar usar a credencial salva.
    const passToSend = password.replace(/\s/g, "");

    setTestingConnection(true);
    try {
      const { data: payload, error: funcError } = await supabase.functions.invoke("send-email-custom", {
        body: {
          to: email, // Manda para o próprio usuário
          subject: "✅ Teste de Conexão SMTP - JobFy",
          body: "Se você recebeu este email, sua configuração SMTP está perfeita! O robô consegue enviar emails usando sua conta.",
          provider,
          // Passamos a senha explicitamente se o usuário digitou, para testar ANTES de salvar
          overridePassword: passToSend || undefined,
        },
      });

      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error || "Falha na conexão");

      toast({
        title: "Conexão Estabelecida!",
        description: "Email de teste enviado para você com sucesso.",
        className: "bg-green-600 text-white border-none",
      });
    } catch (e: any) {
      const parsed = parseSmtpError(e.message || "Erro desconhecido");
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
      const { data: payload, error: funcError } = await supabase.functions.invoke("save-smtp-credentials", {
        body: { provider, email, risk_profile: selectedProfile },
      });

      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error || "Erro ao salvar perfil");

      setRiskProfile(selectedProfile);
      toast({ title: t("warmup.toasts.profile_saved") });
    } catch (e: unknown) {
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
      const vars: Record<string, string> = {
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
      if (payload?.success === false) throw new Error(payload?.error || "Erro ao enviar");

      toast({ title: t("smtp.toasts.test_sent") });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.send_failed");
      const parsed = parseSmtpError(message);
      toast({
        title: t(parsed.titleKey),
        description: t(parsed.descriptionKey),
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setSending(false);
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
      {/* 1. Tutorial Card - O primeiro item visível */}
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
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
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
                <li>O Google vai gerar um código de 16 letras. Copie ele.</li>
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

      {/* 2. Onboarding Condicional (Se precisar configurar perfil de risco) */}
      {needsWarmupOnboarding && <EmailWarmupOnboarding onSelect={handleSaveRiskProfile} loading={savingProfile} />}

      {/* 3. Card de Configuração SMTP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("smtp.title")}
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
                  setPassword(""); // Limpa senha ao trocar provider para evitar confusão
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

            <div className="relative">
              <Input
                type="text"
                value={password}
                onChange={handlePasswordChange}
                placeholder={hasPassword ? "•••• •••• •••• •••• (Salvo)" : "xxxx xxxx xxxx xxxx"}
                className={provider === "gmail" ? "font-mono tracking-wide" : ""}
                maxLength={provider === "gmail" ? 19 : 100} // 16 chars + 3 spaces
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground flex justify-between">
              <span>
                {hasPassword
                  ? t("smtp.password_note.saved")
                  : provider === "gmail"
                    ? "Digite apenas as 16 letras geradas pelo Google."
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

            <Accordion type="single" collapsible className="pt-2 border-none">
              <AccordionItem value="help" className="border-none">
                <AccordionTrigger className="text-sm py-2 text-muted-foreground hover:no-underline hover:text-foreground">
                  Precisa de ajuda com Outlook ou erros?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
                    <p>
                      Para Outlook, use sua senha normal. Se falhar, verifique se o SMTP está ativado na sua conta
                      Microsoft.
                    </p>
                    <p>
                      Erros comuns: <strong>Invalid Credentials</strong> (Senha errada ou 2FA ativo sem senha de app),{" "}
                      <strong>Username and Password not accepted</strong> (Conta bloqueada por segurança).
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
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
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Card de Envio de Teste (Completo) - Mantido para testes avançados */}
      <Card>
        <CardHeader>
          <CardTitle>{t("smtp.test.title")}</CardTitle>
          <CardDescription>Envie um email simulando uma aplicação real para validar templates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("smtp.test.fields.template")}</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("smtp.test.template_none")}</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("smtp.test.fields.visa_type")}</Label>
              <Select value={testVisaType} onValueChange={(v) => setTestVisaType(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="H-2B">H-2B</SelectItem>
                  <SelectItem value="H-2A">H-2A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("smtp.test.fields.company")}</Label>
              <Input
                value={testCompany}
                onChange={(e) => setTestCompany(e.target.value)}
                placeholder={t("smtp.test.placeholders.company")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("smtp.test.fields.position")}</Label>
              <Input
                value={testPosition}
                onChange={(e) => setTestPosition(e.target.value)}
                placeholder={t("smtp.test.placeholders.position")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("smtp.test.fields.to")}</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("smtp.test.placeholders.to")} />
          </div>
          <div className="space-y-2">
            <Label>{t("smtp.test.fields.subject")}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("smtp.test.fields.body")}</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          </div>

          <Button onClick={handleSendTest} disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("smtp.test.actions.send")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
