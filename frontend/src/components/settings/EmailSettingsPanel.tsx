import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Save, AlertTriangle, ExternalLink, Wifi, CheckCircle2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmailWarmupOnboarding, type RiskProfile } from "./EmailWarmupOnboarding";
import { parseSmtpError } from "@/lib/smtpErrorParser";
import { Badge } from "@/components/ui/badge";

type Provider = "gmail" | "outlook";

export function EmailSettingsPanel() {
  const { user, profile, refreshProfile } = useAuth();
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
        title: t("smtp.invalid_password_title"),
        description: t("smtp.invalid_password_desc"),
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

  // --- BOTÃO "TESTAR E ATIVAR" (auto-save, test, then verify) ---
  const handleTestAndActivate = async () => {
    if (!email) {
      toast({ title: t("smtp.email_first"), variant: "destructive" });
      return;
    }

    // If there's an unsaved password, save first
    if (password.trim().length > 0) {
      await handleSave();
    }

    if (!hasPassword) {
      toast({ title: t("smtp.save_first_title"), description: t("smtp.save_first_desc"), variant: "destructive" });
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
        },
      });

      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error);

      // SMTP verified! Update profile
      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ smtp_verified: true, last_smtp_check: new Date().toISOString() })
          .eq("id", user.id);
        await refreshProfile();
      }

      toast({
        title: t("smtp.connection_ok_title"),
        description: t("smtp.verified_activated_desc"),
        className: "bg-green-600 text-white border-none",
      });
    } catch (e: any) {
      const parsed = parseSmtpError(e.message);
      toast({ title: t("smtp.connection_error_title"), description: t(parsed.descriptionKey), variant: "destructive" });
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
            <AlertTriangle className="h-5 w-5" /> {t("smtp.tutorial.warning_title")}
          </CardTitle>
          <CardDescription className="text-amber-700/80 dark:text-amber-400/80 font-medium">
            {t("smtp.tutorial.warning_desc")}
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
                <li dangerouslySetInnerHTML={{ __html: t("smtp.tutorial.step1") }} />
                <li dangerouslySetInnerHTML={{ __html: t("smtp.tutorial.step2") }} />
                <li dangerouslySetInnerHTML={{ __html: t("smtp.tutorial.step3") }} />
                <li>{t("smtp.tutorial.step4")}</li>
              </ol>
              <Button variant="outline" size="sm" className="w-full sm:w-auto gap-2 border-amber-300" asChild>
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                  {t("smtp.tutorial.generate_now")} <ExternalLink className="w-3 h-3" />
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
                  <SelectItem value="gmail">{t("smtp.gmail_recommended")}</SelectItem>
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
              <span>{t("smtp.password_label")}</span>
              {provider === "gmail" && (
                <span className="text-[10px] text-destructive font-bold uppercase">{t("smtp.normal_password_warning")}</span>
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
                ? t("smtp.letters_typed", { count: password.replace(/\s/g, "").length })
                : t("smtp.password_note.empty")}
            </p>
          </div>

          {/* SMTP Verified Badge */}
          {(profile as any)?.smtp_verified && (
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 gap-1.5 px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("smtp.verified_badge")}
              </Badge>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}{" "}
              {t("common.save")}
            </Button>
            <Button
              onClick={handleTestAndActivate}
              disabled={testing || (!hasPassword && !password)}
              variant="outline"
              className="flex-1 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
            >
              {testing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />} {t("smtp.verify_and_activate")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
