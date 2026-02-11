import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, User, Shield, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
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

  // Estados do Admin (mantidos caso precise reativar)
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
      // Lógica de template automático omitida para brevidade (já existe no seu código)
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
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.tabs.profile")}</span>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("settings.profile.fields.full_name")}</Label>
                  <Input id="fullName" name="fullName" type="text" defaultValue={profile?.full_name || ""} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">{t("settings.profile.fields.age")}</Label>
                    <Input id="age" name="age" type="number" min={14} max={90} defaultValue={profile?.age ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("settings.profile.fields.phone")}</Label>
                    <PhoneE164Input id="phone" name="phone" defaultValue={profile?.phone_e164 ?? ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t("settings.profile.fields.contact_email")}</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    defaultValue={profile?.contact_email ?? profile?.email ?? ""}
                  />
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

        <TabsContent value="email" className="space-y-6 max-w-3xl">
          {/* AQUI ESTAVA O ERRO: Removi o card duplicado daqui. 
              Agora só chamamos o componente que resolve tudo. */}
          <EmailSettingsPanel />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplatesSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
