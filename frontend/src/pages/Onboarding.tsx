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
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Rocket,
  Key,
  Lock,
  Shield,
  AlertTriangle,
  ExternalLink,
  Wifi,
  Save,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseSmtpError } from "@/lib/smtpErrorParser";

type Provider = "gmail" | "outlook";
type RiskProfile = "conservative" | "standard" | "aggressive";

export default function Onboarding() {
  const { t } = useTranslation();
  const { user, refreshProfile, refreshSmtpStatus } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(true);

  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);

  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    if (!user?.id) return;
    const checkStatus = async () => {
      setCheckingSmtp(true);
      const { data } = await supabase
        .from("smtp_credentials")
        .select("has_password, risk_profile, provider, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.has_password && data?.risk_profile) {
        navigate("/dashboard", { replace: true });
      } else if (data?.has_password && !data?.risk_profile) {
        if (data.provider) setProvider(data.provider as Provider);
        if (data.email) setEmail(data.email);
        setHasPassword(true);
        setStep(3);
      } else if (data) {
        if (data.provider) setProvider(data.provider as Provider);
        if (data.email) setEmail(data.email);
      }
      setCheckingSmtp(false);
    };
    checkStatus();
  }, [user?.id, navigate]);

  // Same password handler as Settings — Gmail: 16 letters with spaces every 4
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

  // Save credentials — same as Settings
  const handleSave = async (): Promise<boolean> => {
    if (!user?.id) return false;
    if (!email) {
      toast({ title: t("smtp.toasts.email_required"), variant: "destructive" });
      return false;
    }

    const cleanPass = password.replace(/\s/g, "");
    if (provider === "gmail" && password && cleanPass.length !== 16) {
      toast({
        title: t("smtp.invalid_password_title"),
        description: t("smtp.invalid_password_desc"),
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      const { data: payload, error: funcError } = await supabase.functions.invoke("save-smtp-credentials", {
        body: { provider, email, password: cleanPass || undefined },
      });

      if (funcError) throw funcError;
      if (payload?.success === false) throw new Error(payload?.error || t("smtp.toasts.save_error_title"));

      if (password.trim().length > 0) {
        setHasPassword(true);
        setPassword("");
      }

      toast({ title: t("smtp.toasts.saved") });
      return true;
    } catch (e: any) {
      toast({ title: t("smtp.toasts.save_error_title"), description: e.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Test connection — auto-saves first if password is unsaved
  const handleTestConnection = async () => {
    if (!email) {
      toast({ title: t("smtp.email_first"), variant: "destructive" });
      return;
    }

    // If there's an unsaved password, save first
    if (password.trim().length > 0) {
      const saved = await handleSave();
      if (!saved) return;
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

      toast({
        title: t("smtp.connection_ok_title"),
        description: t("smtp.connection_ok_desc"),
        className: "bg-green-600 text-white border-none",
      });
    } catch (e: any) {
      const parsed = parseSmtpError(e.message);
      toast({ title: t("smtp.connection_error_title"), description: t(parsed.descriptionKey), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  // Save & advance to step 3
  const handleSaveAndContinue = async () => {
    await handleSave();
    if (hasPassword || password.replace(/\s/g, "").length === 16) {
      setStep(3);
    }
  };

  const handleSaveRiskProfile = async () => {
    if (!user?.id || !riskProfile) return;
    setLoading(true);
    try {
      await supabase.functions.invoke("save-smtp-credentials", {
        body: { provider, email: email.trim().toLowerCase(), risk_profile: riskProfile },
      });
      setStep(4);
    } catch (e: any) {
      toast({ title: t("warmup.toasts.profile_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await refreshSmtpStatus?.();
      await refreshProfile?.();
      await new Promise((r) => setTimeout(r, 800));
      navigate("/dashboard", { replace: true });
    } catch (error) {
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSmtp)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="p-6 flex items-center justify-between border-b bg-background shadow-sm">
        <BrandLogo height={28} />
        <Badge variant="outline" className="font-bold">
          {t("onboarding.step", { current: step, total: totalSteps })}
        </Badge>
      </div>
      <Progress value={progress} className="h-1 rounded-none" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <Card className="border-none shadow-2xl">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
                  <Rocket className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">{t("onboarding.welcome.title")}</CardTitle>
                <CardDescription className="text-base">{t("onboarding.welcome.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setStep(2)} className="w-full h-12 text-lg font-bold">
                  {t("onboarding.welcome.start")} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: SMTP — replicated from Settings */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Tutorial card — same as Settings */}
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
                        />
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

              {/* SMTP Form — same as Settings */}
              <Card className="border-none shadow-2xl">
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
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("smtp.placeholders.email")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex justify-between">
                      <span>{t("smtp.password_label")}</span>
                      {provider === "gmail" && (
                        <span className="text-[10px] text-destructive font-bold uppercase">
                          {t("smtp.normal_password_warning")}
                        </span>
                      )}
                    </Label>
                    <Input
                      type="text"
                      value={password}
                      onChange={handlePasswordChange}
                      placeholder={hasPassword ? t("smtp.placeholders.password_saved") : "abcd efgh ijkl mnop"}
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

                  <div className="flex items-center gap-3 pt-2">
                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                      {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                      {t("common.save")}
                    </Button>
                    <Button
                      onClick={handleTestConnection}
                      disabled={testing || (!hasPassword && !password)}
                      variant="outline"
                      className="flex-1 border-blue-200 text-blue-700"
                    >
                      {testing ? (
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      ) : (
                        <Wifi className="mr-2 h-4 w-4" />
                      )}
                      {t("smtp.test_connection")}
                    </Button>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={() => setStep(1)} className="h-11">
                      <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.previous")}
                    </Button>
                    <Button
                      onClick={() => {
                        if (hasPassword) {
                          setStep(3);
                        } else {
                          toast({
                            title: t("smtp.save_first_title"),
                            description: t("smtp.save_first_desc"),
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!hasPassword}
                      className="flex-1 h-11 font-bold shadow-lg"
                    >
                      <ArrowRight className="mr-2 h-4 w-4" /> {t("onboarding.smtp.continue")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Risk Profile */}
          {step === 3 && (
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> {t("onboarding.warmup.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {["conservative", "standard", "aggressive"].map((id) => (
                  <div
                    key={id}
                    onClick={() => setRiskProfile(id as RiskProfile)}
                    className={cn(
                      "p-4 border-2 rounded-xl cursor-pointer transition-all",
                      riskProfile === id ? "border-primary bg-primary/5" : "border-muted",
                    )}
                  >
                    <p className="font-bold capitalize">{t(`warmup.profiles.${id}.title`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`warmup.profiles.${id}.description`)}</p>
                  </div>
                ))}
                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    {t("common.previous")}
                  </Button>
                  <Button onClick={handleSaveRiskProfile} disabled={!riskProfile || loading} className="flex-1">
                    {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                    {t("onboarding.warmup.continue")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <Card className="border-none shadow-2xl text-center p-10">
              <div className="bg-emerald-100 p-5 rounded-full w-fit mx-auto mb-6">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <CardTitle className="text-3xl font-black uppercase tracking-tighter">
                {t("onboarding.complete.title")}
              </CardTitle>
              <CardDescription className="text-base mt-2 mb-8">
                {t("onboarding.complete.description")}
              </CardDescription>
              <Button onClick={handleComplete} disabled={loading} className="w-full h-14 font-black text-lg shadow-xl">
                {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : t("onboarding.complete.go_dashboard")}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
