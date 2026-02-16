// Onboarding.tsx
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
  Info,
  ShieldCheck,
  Zap,
  Activity,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseSmtpError } from "@/lib/smtpErrorParser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  const isOutlook = email.toLowerCase().endsWith("@outlook.com") || email.toLowerCase().endsWith("@hotmail.com");

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

  const handleTestConnection = async () => {
    if (!email) {
      toast({ title: t("smtp.email_first"), variant: "destructive" });
      return;
    }
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
        body: { to: email, subject: "✅ SMTP Test", body: "Connection Successful!", provider },
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

  const profileDetails = {
    conservative: {
      icon: <ShieldCheck className="h-6 w-6 text-emerald-500" />,
      activeColor: "border-emerald-500 bg-emerald-50",
    },
    standard: {
      icon: <Activity className="h-6 w-6 text-blue-500" />,
      activeColor: "border-blue-500 bg-blue-50",
    },
    aggressive: {
      icon: <Zap className="h-6 w-6 text-amber-500" />,
      activeColor: "border-amber-500 bg-amber-50",
    },
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="text-center p-4 rounded-xl bg-muted/50">
                      <p className="font-bold text-sm mb-1">{t(`onboarding.welcome.step${num}_title`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`onboarding.welcome.step${num}_desc`)}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setStep(2)} className="w-full h-12 text-lg font-bold">
                  {t("onboarding.welcome.start")} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
                <CardHeader className="pb-3 text-amber-800 dark:text-amber-500">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> {t("smtp.tutorial.warning_title")}
                  </CardTitle>
                  <CardDescription className="text-amber-700/80 dark:text-amber-400/80 font-medium">
                    {t("smtp.tutorial.warning_desc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 max-w-[450px]">
                      <div className="rounded-lg overflow-hidden border shadow-sm aspect-video bg-black">
                        <iframe
                          width="100%"
                          height="100%"
                          src="https://www.youtube.com/embed/Lz6fJChKRtA?si=4Mt-69l3C8NaS8yN"
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
                        <a
                          href={
                            provider === "gmail"
                              ? "https://myaccount.google.com/apppasswords"
                              : "https://account.microsoft.com/security"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("smtp.tutorial.generate_now")} <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isOutlook && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800 font-bold">
                    {t("onboarding.smtp.outlook_guide_title")}
                  </AlertTitle>
                  <AlertDescription className="text-blue-700 text-xs">
                    {t("onboarding.smtp.outlook_step1")} • {t("onboarding.smtp.outlook_step2")}
                  </AlertDescription>
                </Alert>
              )}

              <Card className="border-none shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" /> {t("onboarding.smtp.title")}
                  </CardTitle>
                  <CardDescription>{t("onboarding.smtp.description")}</CardDescription>
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
                      placeholder={
                        hasPassword ? t("smtp.placeholders.password_saved") : t("onboarding.smtp.password_hint")
                      }
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
                      {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}{" "}
                      {t("common.save")}
                    </Button>
                    <Button
                      onClick={handleTestConnection}
                      disabled={testing || (!hasPassword && !password)}
                      variant="outline"
                      className="flex-1 border-blue-200 text-blue-700"
                    >
                      {testing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Wifi className="mr-2 h-4 w-4" />}{" "}
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

          {step === 3 && (
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>{t("onboarding.warmup.title")}</CardTitle>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-blue-900">{t("onboarding.warmup.why_title")}</p>
                      <p className="text-xs text-blue-800/80 leading-relaxed">{t("onboarding.warmup.why_desc")}</p>
                    </div>
                  </div>
                </div>
                <CardDescription>{t("onboarding.warmup.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["conservative", "standard", "aggressive"] as RiskProfile[]).map((id) => (
                  <div
                    key={id}
                    onClick={() => setRiskProfile(id)}
                    className={cn(
                      "relative p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md",
                      riskProfile === id ? profileDetails[id].activeColor : "border-slate-100 bg-white",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-xl", riskProfile === id ? "bg-white shadow-sm" : "bg-slate-50")}>
                        {profileDetails[id].icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-lg text-slate-900">{t(`warmup.profiles.${id}.title`)}</p>
                          {id === "standard" && (
                            <Badge variant={riskProfile === id ? "default" : "secondary"} className="text-[10px]">
                              {t("onboarding.warmup.recommended_badge")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mb-2 leading-relaxed">
                          {t(`warmup.profiles.${id}.description`)}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-medium text-primary">
                          <Check className="h-3 w-3" /> {t(`warmup.profiles.${id}.details`)}
                        </div>
                      </div>
                      {riskProfile === id && (
                        <div className="absolute top-4 right-4 animate-in zoom-in duration-300">
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-dashed">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground">{t("onboarding.warmup.recommendation_title")}:</span>{" "}
                    {t("onboarding.warmup.how_it_works")}
                  </p>
                </div>

                <div className="flex gap-3 pt-6">
                  <Button variant="ghost" onClick={() => setStep(2)} className="px-8">
                    {t("common.previous")}
                  </Button>
                  <Button
                    onClick={handleSaveRiskProfile}
                    disabled={!riskProfile || loading}
                    className="flex-1 h-12 text-lg font-bold shadow-lg"
                  >
                    {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                    {t("onboarding.warmup.continue")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-none shadow-2xl text-center p-10">
              <div className="bg-emerald-100 p-5 rounded-full w-fit mx-auto mb-6">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <CardTitle className="text-3xl font-black uppercase tracking-tighter">
                {t("onboarding.complete.title")}
              </CardTitle>
              <CardDescription className="text-base mt-2 mb-8">{t("onboarding.complete.description")}</CardDescription>

              <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t("onboarding.complete.smtp_ready")}
                </div>
                <div className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t("onboarding.complete.warmup_ready")}
                </div>
                <p className="text-xs text-muted-foreground mt-4 italic">{t("onboarding.complete.next_steps")}</p>
              </div>

              <Button onClick={handleComplete} disabled={loading} className="w-full h-14 font-black text-lg shadow-xl">
                {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : t("onboarding.complete.go_dashboard")}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
