import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Shield, User, Wrench, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/number";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailSettingsPanel } from "@/components/settings/EmailSettingsPanel";
import { z } from "zod";
import { TemplatesSettingsPanel } from "@/components/settings/TemplatesSettingsPanel";
import { PhoneE164Input } from "@/components/inputs/PhoneE164Input";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ResumeSettingsSection } from "@/components/settings/ResumeSettingsSection";

type SettingsTab = "profile" | "account" | "email" | "templates";

export default function Settings({ defaultTab }: { defaultTab?: SettingsTab }) {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const { isAdmin } = useIsAdmin();

  const [adminTargetEmail, setAdminTargetEmail] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const initialTab = useMemo<SettingsTab>(() => defaultTab ?? "profile", [defaultTab]);

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = String(formData.get("fullName") ?? "");
    const ageRaw = String(formData.get("age") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const contactEmail = String(formData.get("contactEmail") ?? "").trim();

    const schema = z.object({
      fullName: z.string().trim().min(2).max(120),
      age: z
        .string()
        .trim()
        .transform((v) => (v === "" ? null : Number(v)))
        .refine((v) => v === null || (Number.isFinite(v) && v >= 14 && v <= 90), {
          message: t("settings.profile.validation.invalid_age"),
        }),
      phone: z
        .string()
        .trim()
        .refine((v) => Boolean(parsePhoneNumberFromString(v)?.isValid()), {
          message: t("settings.profile.validation.invalid_phone"),
        }),
      contactEmail: z.string().trim().email().max(255),
    });

    const parsed = schema.safeParse({
      fullName,
      age: ageRaw,
      phone,
      contactEmail,
    });

    if (!parsed.success) {
      toast({
        title: t("settings.toasts.update_error_title"),
        description: parsed.error.issues?.[0]?.message ?? t("common.errors.invalid_data"),
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        age: parsed.data.age,
        phone_e164: parsed.data.phone,
        contact_email: parsed.data.contactEmail,
      })
      .eq("id", profile?.id);

    if (error) {
      toast({
        title: t("settings.toasts.update_error_title"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      await refreshProfile();

      try {
        const hasAllFields =
          parsed.data.fullName.trim().length > 0 &&
          parsed.data.age != null &&
          parsed.data.phone.trim().length > 0 &&
          parsed.data.contactEmail.trim().length > 0;

        if (hasAllFields && profile?.id) {
          const { count } = await supabase
            .from("email_templates")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profile.id);

          if ((count ?? 0) === 0) {
            const { data: payload, error: funcError } = await supabase.functions.invoke("generate-template", {
              body: {},
            });

            if (funcError) throw funcError;
            if (payload?.success === false) throw new Error(payload?.error || "Erro na geração");

            await supabase.from("email_templates").insert({
              user_id: profile.id,
              name: "Meu Primeiro Template (IA)",
              subject: String(payload.subject ?? ""),
              body: String(payload.body ?? ""),
            });
          }
        }
      } catch (err) {
        console.error("Erro ao gerar template automático:", err);
      }

      toast({
        title: t("settings.toasts.update_success_title"),
        description: t("settings.toasts.update_success_desc"),
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.tabs.profile")}</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.tabs.account")}</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.tabs.smtp")}</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.tabs.templates")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("settings.profile.title")}
              </CardTitle>
              <CardDescription>{t("settings.profile.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("settings.profile.fields.email")}</Label>
                  <Input id="email" type="email" value={profile?.email || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">{t("settings.profile.email_note")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("settings.profile.fields.full_name")}</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    defaultValue={profile?.full_name || ""}
                    placeholder={t("settings.profile.placeholders.full_name")}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">{t("settings.profile.fields.age")}</Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      min={14}
                      max={90}
                      defaultValue={profile?.age ?? ""}
                      placeholder={t("settings.profile.placeholders.age")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("settings.profile.fields.phone")}</Label>
                    <PhoneE164Input
                      id="phone"
                      name="phone"
                      defaultValue={profile?.phone_e164 ?? ""}
                      placeholder={t("settings.profile.placeholders.phone")}
                      invalidHint={t("settings.profile.validation.invalid_phone")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t("settings.profile.fields.contact_email")}</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    defaultValue={profile?.contact_email ?? profile?.email ?? ""}
                    placeholder={t("settings.profile.placeholders.contact_email")}
                  />
                  <p className="text-xs text-muted-foreground">{t("settings.profile.contact_email_note")}</p>
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("settings.profile.actions.save")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <ResumeSettingsSection />
        </TabsContent>

        <TabsContent value="account" className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("settings.account.title")}
              </CardTitle>
              <CardDescription>{t("settings.account.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">{t("settings.account.current_plan")}</span>
                <span className="font-medium">{t(`plans.tiers.${profile?.plan_tier || "free"}.label`)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">{t("settings.account.credits_used_today")}</span>
                <span className="font-medium">{formatNumber(profile?.credits_used_today || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">{t("settings.account.member_since")}</span>
                <span className="font-medium">
                  {profile?.created_at
                    ? new Date(profile.created_at as unknown as string).toLocaleDateString(i18n.language)
                    : "-"}
                </span>
              </div>

              <Button variant="outline" onClick={() => (window.location.href = "/plans")}>
                {t("settings.account.actions.manage_plan")}
              </Button>
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Admin: Suporte de Pagamento
                </CardTitle>
                <CardDescription>
                  Reprocessa o upgrade do usuário buscando o último Checkout pago e ajustando o plano no banco.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminTargetEmail">Email do usuário</Label>
                  <Input
                    id="adminTargetEmail"
                    value={adminTargetEmail}
                    onChange={(e) => setAdminTargetEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>

                <Button
                  onClick={async () => {
                    const email = adminTargetEmail.trim().toLowerCase();
                    if (!email) {
                      toast({
                        title: "Informe um email",
                        description: "Digite o email do usuário para reprocessar o upgrade.",
                        variant: "destructive",
                      });
                      return;
                    }

                    setAdminLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("reprocess-upgrade", {
                        body: { email },
                      });

                      if (error) throw error;

                      toast({
                        title: "Upgrade reprocessado",
                        description: `Plano atualizado para ${data?.plan_tier ?? "—"} (session ${data?.checkout_session_id ?? "—"}).`,
                      });

                      await refreshProfile();
                    } catch (e: any) {
                      toast({
                        title: "Falha ao reprocessar",
                        description: e?.message ?? "Erro desconhecido",
                        variant: "destructive",
                      });
                    } finally {
                      setAdminLoading(false);
                    }
                  }}
                  disabled={adminLoading}
                >
                  {adminLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reprocessar upgrade
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="email" className="space-y-6 max-w-3xl">
          {/* Tutorial Section - Added for better UX regarding App Passwords */}
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-500">
                <AlertTriangle className="h-5 w-5" />
                Atenção: Não use sua senha normal
              </CardTitle>
              <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                Para conectar seu Gmail/Google, você deve usar uma <strong>Senha de App (App Password)</strong>. Sua
                senha de login pessoal não funcionará.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-3">
                  <div className="rounded-md overflow-hidden border shadow-sm aspect-video bg-black">
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
                <div className="flex-1 space-y-3 text-sm">
                  <div className="flex gap-2 items-start">
                    <Info className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                    <p>O Google exige uma senha de 16 caracteres gerada especificamente para aplicativos externos.</p>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 ml-1 text-muted-foreground">
                    <li>Ative a "Verificação em duas etapas" no Google.</li>
                    <li>Pesquise por "Senhas de App" na sua conta.</li>
                    <li>Gere uma nova senha para "Email".</li>
                    <li>Copie e cole a senha gerada abaixo.</li>
                  </ol>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 gap-2 border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40"
                    asChild
                  >
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                      Gerar Senha agora <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <EmailSettingsPanel />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplatesSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
