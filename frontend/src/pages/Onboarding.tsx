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
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Rocket, Info, Key, Lock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "gmail" | "outlook";
type RiskProfile = "conservative" | "standard" | "aggressive";

export default function Onboarding() {
  const { t } = useTranslation();
  const { user, refreshProfile, refreshSmtpStatus } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(true);

  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    if (!user?.id) return;
    const checkStatus = async () => {
      setCheckingSmtp(true);
      const { data } = await supabase
        .from("smtp_credentials")
        .select("has_password, risk_profile")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.has_password && data?.risk_profile) {
        navigate("/dashboard", { replace: true });
      } else if (data?.has_password && !data?.risk_profile) {
        setStep(3);
      }
      setCheckingSmtp(false);
    };
    checkStatus();
  }, [user?.id, navigate]);

  // --- TRATAMENTO DE SENHA (16 LETRAS MINÚSCULAS) ---
  const handlePasswordChange = (val: string) => {
    const sanitized = val
      .replace(/[^a-zA-Z]/g, "")
      .toLowerCase()
      .slice(0, 16);
    setPassword(sanitized);
  };

  const handleSaveSmtp = async () => {
    if (!user?.id) return;
    if (password.length !== 16) {
      toast({ title: t("smtp.toasts.password_invalid"), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-smtp-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session?.access_token}` },
        body: JSON.stringify({ provider, email: email.trim().toLowerCase(), password }),
      });

      const payload = await res.json();
      if (!res.ok || payload?.success === false) throw new Error(payload?.error);

      toast({ title: t("smtp.toasts.saved") });
      setStep(3);
    } catch (e: any) {
      toast({ title: t("smtp.toasts.save_error_title"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRiskProfile = async () => {
    if (!user?.id || !riskProfile) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-smtp-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session?.access_token}` },
        body: JSON.stringify({ provider, email: email.trim().toLowerCase(), risk_profile: riskProfile }),
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
      // Delay de 800ms para garantir que a transação no banco propagou para o cache do Supabase Auth
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="p-6 flex items-center justify-between border-b bg-white shadow-sm">
        <BrandLogo height={28} />
        <Badge variant="outline" className="font-bold">
          {t("onboarding.step", { current: step, total: totalSteps })}
        </Badge>
      </div>
      <Progress value={progress} className="h-1 rounded-none" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
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

          {step === 2 && (
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" /> {t("onboarding.smtp.title")}
                </CardTitle>
                <CardDescription>{t("onboarding.smtp.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <p className="font-bold uppercase tracking-tight">{t("onboarding.smtp.why_app_password_title")}</p>
                    <p className="mt-1 opacity-80">{t("onboarding.smtp.why_app_password_desc")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">{t("smtp.fields.provider")}</Label>
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
                    <Label className="text-xs font-bold uppercase text-slate-500">{t("smtp.fields.email")}</Label>
                    <Input
                      className="h-11"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("smtp.placeholders.email")}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <Label className="font-bold text-primary flex items-center gap-2">
                      <Lock className="h-4 w-4" /> {t("smtp.fields.password")}
                    </Label>
                    <span
                      className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded",
                        password.length === 16 ? "text-emerald-600 bg-emerald-50" : "text-slate-400 bg-slate-100",
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
                    className="h-14 text-center text-xl font-mono tracking-[0.4em] lowercase shadow-inner"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="ghost" onClick={() => setStep(1)} className="h-11">
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.previous")}
                  </Button>
                  <Button
                    onClick={handleSaveSmtp}
                    disabled={loading || password.length !== 16}
                    className="flex-1 h-11 font-bold shadow-lg"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {t("onboarding.smtp.continue")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                      riskProfile === id ? "border-primary bg-primary/5" : "border-slate-100",
                    )}
                  >
                    <p className="font-bold capitalize">{t(`warmup.profiles.${id}.title`)}</p>
                    <p className="text-xs text-slate-500">{t(`warmup.profiles.${id}.description`)}</p>
                  </div>
                ))}
                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    {t("common.previous")}
                  </Button>
                  <Button onClick={handleSaveRiskProfile} disabled={!riskProfile || loading} className="flex-1">
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
