import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmailWarmupOnboarding, type RiskProfile } from "./EmailWarmupOnboarding";
import { WarmupStatusWidget } from "@/components/dashboard/WarmupStatusWidget";
import { getPlanLimit } from "@/config/plans.config";

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

  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [currentDailyLimit, setCurrentDailyLimit] = useState<number | null>(null);
  const [emailsSentToday, setEmailsSentToday] = useState(0);
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
        .select("provider,email,has_password,risk_profile,current_daily_limit,emails_sent_today")
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
        setCurrentDailyLimit((data as any).current_daily_limit ?? null);
        setEmailsSentToday((data as any).emails_sent_today ?? 0);
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

    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id,name,subject,body")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        toast({ title: t("smtp.toasts.load_templates_error_title"), description: error.message, variant: "destructive" });
      } else {
        setTemplates((data as EmailTemplate[]) ?? []);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [canLoad, toast, user]);

  useEffect(() => {
    if (selectedTemplateId === "none") return;
    const t = templates.find((x) => x.id === selectedTemplateId);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body);
  }, [selectedTemplateId, templates]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (!email) {
      toast({ title: t("smtp.toasts.email_required"), variant: "destructive" });
      return;
    }

    setSaving(true);
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
        body: JSON.stringify({ provider, email, password: password.trim() || undefined }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

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

  const handleSaveRiskProfile = async (selectedProfile: RiskProfile) => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("common.errors.no_session"));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-smtp-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, email, risk_profile: selectedProfile }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) throw new Error(payload?.error || `HTTP ${res.status}`);

      setRiskProfile(selectedProfile);
      const startLimits: Record<RiskProfile, number> = { conservative: 20, standard: 50, aggressive: 100 };
      setCurrentDailyLimit(startLimits[selectedProfile]);
      setEmailsSentToday(0);
      toast({ title: t("warmup.toasts.profile_saved") });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({ title: t("warmup.toasts.profile_error"), description: message, variant: "destructive" });
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

    if (!profile?.full_name || profile?.age == null || !profile?.phone_e164 || !profile?.contact_email) {
      toast({
        title: t("smtp.toasts.profile_incomplete_title"),
        description: t("smtp.toasts.profile_incomplete_desc"),
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("common.errors.no_session"));

      const vars: Record<string, string> = {
        name: profile.full_name ?? "",
        age: String(profile.age ?? ""),
        phone: profile.phone_e164 ?? "",
        contact_email: profile.contact_email ?? "",
        company: testCompany.trim(),
        position: testPosition.trim(),
        visa_type: testVisaType,
      };

      const finalSubject = applyTemplate(subject, vars);
      const finalBody = applyTemplate(body, vars);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-custom`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, subject: finalSubject, body: finalBody, provider }),
      });

      const text = await res.text();
      const payload = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { error: text };
        }
      })();

      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      toast({ title: t("smtp.toasts.test_sent") });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.send_failed");
      toast({ title: t("smtp.toasts.send_error_title"), description: message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  const planTier = profile?.plan_tier || "free";
  const planMax = getPlanLimit(planTier, "daily_emails");
  // No referral bonus for paid tiers (this panel is for paid users only)

  // Show onboarding if SMTP is configured but no risk profile set (and not free tier)
  const needsWarmupOnboarding = hasPassword && !riskProfile && planTier !== "free";

  return (
    <div className="space-y-6">
      {/* Warmup Status Widget - show if risk profile is set */}
      {riskProfile && planTier !== "free" && (
        <WarmupStatusWidget />
      )}

      {/* Warmup Onboarding - show if SMTP configured but no profile */}
      {needsWarmupOnboarding && (
        <EmailWarmupOnboarding onSelect={handleSaveRiskProfile} loading={savingProfile} />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("smtp.title")}
          </CardTitle>
          <CardDescription>{t("smtp.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("smtp.placeholders.email")} />
          </div>

          <div className="space-y-2">
            <Label>{t("smtp.fields.password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={hasPassword ? t("smtp.placeholders.password_saved") : t("smtp.placeholders.password")}
            />
            <p className="text-xs text-muted-foreground">
              {hasPassword ? t("smtp.password_note.saved") : t("smtp.password_note.empty")}
            </p>

            <Accordion type="single" collapsible className="pt-2">
              <AccordionItem value="help">
                <AccordionTrigger className="text-sm">
                  {t("smtp.help.title")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">{t("smtp.help.intro_title")}</p>
                      <p>{t("smtp.help.intro_body")}</p>
                      <p>{t("smtp.help.security_body")}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="font-medium text-foreground">{t("smtp.help.gmail_title")}</p>
                      <p className="text-xs">{t("smtp.help.gmail_warning")}</p>
                      <ol className="list-decimal pl-5 space-y-1">
                        {String(t("smtp.help.gmail_steps")).split("\n").map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ol>
                      <p className="text-xs">{t("smtp.help.gmail_tip")}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="font-medium text-foreground">{t("smtp.help.outlook_title")}</p>
                      <ol className="list-decimal pl-5 space-y-1">
                        {String(t("smtp.help.outlook_steps")).split("\n").map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <p className="font-medium text-foreground">{t("smtp.help.faq_title")}</p>
                      <p>
                        <span className="font-medium text-foreground">{t("smtp.help.faq_q_safe")}</span> {t("smtp.help.faq_a_safe")}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">{t("smtp.help.faq_q_where")}</span> {t("smtp.help.faq_a_where")}
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("smtp.test.title")}</CardTitle>
          <CardDescription>{t("smtp.test.subtitle")}</CardDescription>
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
            <p className="text-xs text-muted-foreground">{t("smtp.test.template_hint")}</p>
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
              <Input value={testCompany} onChange={(e) => setTestCompany(e.target.value)} placeholder={t("smtp.test.placeholders.company")} />
            </div>
            <div className="space-y-2">
              <Label>{t("smtp.test.fields.position")}</Label>
              <Input value={testPosition} onChange={(e) => setTestPosition(e.target.value)} placeholder={t("smtp.test.placeholders.position")} />
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
