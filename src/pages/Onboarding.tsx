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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

type Provider = "gmail" | "outlook";
type RiskProfile = "conservative" | "standard" | "aggressive";

export default function Onboarding() {
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(true);

  // SMTP fields
  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Warmup profile
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

      // If SMTP already configured with warmup, redirect to dashboard
      if (data?.has_password && data?.risk_profile) {
        navigate("/dashboard", { replace: true });
        return;
      }

      // If has SMTP but no warmup profile, start at step 3
      if (data?.has_password && !data?.risk_profile) {
        setStep(3);
      }

      setCheckingSmtp(false);
    };

    checkExistingSmtp();
  }, [user?.id, navigate]);

  const handleSaveSmtp = async () => {
    if (!user?.id) return;
    if (!email || !password) {
      toast({ title: t("smtp.toasts.email_required"), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("common.errors.no_session"));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-smtp-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider, email, password }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      toast({ title: t("smtp.toasts.saved") });
      setStep(3);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({ title: t("smtp.toasts.save_error_title"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRiskProfile = async () => {
    if (!user?.id || !riskProfile) return;

    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("common.errors.no_session"));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-smtp-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, email, risk_profile: riskProfile }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) throw new Error(payload?.error || `HTTP ${res.status}`);

      toast({ title: t("warmup.toasts.profile_saved") });
      setStep(4);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({ title: t("warmup.toasts.profile_error"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    await refreshProfile?.();
    navigate("/dashboard", { replace: true });
  };

  if (checkingSmtp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  const profiles = [
    {
      id: "conservative" as const,
      icon: Shield,
      title: t("warmup.profiles.conservative.title"),
      description: t("warmup.profiles.conservative.description"),
      details: t("warmup.profiles.conservative.details"),
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500",
    },
    {
      id: "standard" as const,
      icon: Clock,
      title: t("warmup.profiles.standard.title"),
      description: t("warmup.profiles.standard.description"),
      details: t("warmup.profiles.standard.details"),
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500",
    },
    {
      id: "aggressive" as const,
      icon: Zap,
      title: t("warmup.profiles.aggressive.title"),
      description: t("warmup.profiles.aggressive.description"),
      details: t("warmup.profiles.aggressive.details"),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-border/50">
        <BrandLogo height={32} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("onboarding.step", { current: step, total: totalSteps })}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-6 py-4">
        <Progress value={progress} className="h-2" />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <Card className="border-primary/20">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                  <Rocket className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">{t("onboarding.welcome.title")}</CardTitle>
                <CardDescription className="text-base">
                  {t("onboarding.welcome.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Settings className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t("onboarding.welcome.step1_title")}</p>
                      <p className="text-sm text-muted-foreground">{t("onboarding.welcome.step1_desc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Shield className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t("onboarding.welcome.step2_title")}</p>
                      <p className="text-sm text-muted-foreground">{t("onboarding.welcome.step2_desc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t("onboarding.welcome.step3_title")}</p>
                      <p className="text-sm text-muted-foreground">{t("onboarding.welcome.step3_desc")}</p>
                    </div>
                  </div>
                </div>

                <Button onClick={() => setStep(2)} className="w-full" size="lg">
                  {t("onboarding.welcome.start")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: SMTP Setup */}
          {step === 2 && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t("onboarding.smtp.title")}</CardTitle>
                    <CardDescription>{t("onboarding.smtp.description")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{t("onboarding.smtp.warning")}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t("smtp.fields.provider")}</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.select")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail</SelectItem>
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
                    type="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("smtp.fields.password")}</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("smtp.placeholders.password")}
                  />
                  <p className="text-xs text-muted-foreground">{t("smtp.password_note.empty")}</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("common.previous")}
                  </Button>
                  <Button onClick={handleSaveSmtp} disabled={loading || !email || !password} className="flex-1">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("onboarding.smtp.continue")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Warmup Profile */}
          {step === 3 && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t("warmup.onboarding.title")}</CardTitle>
                    <CardDescription>{t("warmup.onboarding.description")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{t("warmup.onboarding.warning")}</p>
                </div>

                <div className="space-y-3">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className={`relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 ${
                        riskProfile === p.id ? `${p.borderColor} ${p.bgColor}` : "border-border"
                      }`}
                      onClick={() => setRiskProfile(p.id)}
                    >
                      <div className={`p-2 rounded-lg ${p.bgColor}`}>
                        <p.icon className={`h-5 w-5 ${p.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{p.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                        <p className="text-xs text-muted-foreground/80 mt-2 italic">{p.details}</p>
                      </div>
                      {riskProfile === p.id && (
                        <CheckCircle2 className={`h-5 w-5 ${p.color}`} />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("common.previous")}
                  </Button>
                  <Button onClick={handleSaveRiskProfile} disabled={loading || !riskProfile} className="flex-1">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("onboarding.warmup.continue")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <Card className="border-primary/20">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-4 rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl">{t("onboarding.complete.title")}</CardTitle>
                <CardDescription className="text-base">
                  {t("onboarding.complete.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm">{t("onboarding.complete.smtp_ready")}</p>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm">{t("onboarding.complete.warmup_ready")}</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground">{t("onboarding.complete.next_steps")}</p>
                </div>

                <Button onClick={handleComplete} className="w-full" size="lg">
                  {t("onboarding.complete.go_dashboard")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
