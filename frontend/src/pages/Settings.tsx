import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, User, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailSettingsPanel } from "@/components/settings/EmailSettingsPanel"; // O componente que vamos limpar abaixo
import { z } from "zod";
import { TemplatesSettingsPanel } from "@/components/settings/TemplatesSettingsPanel";
import { PhoneE164Input } from "@/components/inputs/PhoneE164Input";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ResumeSettingsSection } from "@/components/settings/ResumeSettingsSection";

type SettingsTab = "profile" | "email" | "templates";

export default function Settings({ defaultTab }: { defaultTab?: SettingsTab }) {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const initialTab = useMemo<SettingsTab>(() => defaultTab ?? "profile", [defaultTab]);

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    // ... (Lógica de atualização de perfil mantida igual ao anterior)
    e.preventDefault();
    setIsLoading(true);
    // ... (código resumido para brevidade, mantenha a lógica original)
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
          {/* ... (Conteúdo da aba Profile mantido igual) ... */}
          {/* Vou omitir aqui para focar na solução do SMTP, mas mantenha seu código de Profile */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Configurações de perfil...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6 max-w-3xl">
          {/* BLOCO DE TUTORIAL E ALERTA (ACIMA DO PAINEL) */}
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-500">
                <AlertTriangle className="h-5 w-5" />
                Atenção: Não use sua senha normal
              </CardTitle>
              <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                Para conectar seu Gmail/Google, você deve usar uma <strong>Senha de App (App Password)</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
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
                <div className="flex-1 space-y-3 text-sm flex flex-col justify-center">
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>
                      Ative a <strong>Verificação em duas etapas</strong> no Google.
                    </li>
                    <li>
                      Pesquise por <strong>"Senhas de App"</strong> na sua conta.
                    </li>
                    <li>Crie uma senha para "Email" e copie o código de 16 letras.</li>
                  </ol>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 gap-2 border-amber-300 hover:bg-amber-100 dark:border-amber-800"
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

          {/* AQUI ENTRA O PAINEL QUE VAMOS LIMPAR */}
          <EmailSettingsPanel />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplatesSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
