import { ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WhatsNewDialog } from "@/components/dialogs/WhatsNewDialog";
import { AppSidebar } from "./AppSidebar";
import { AppFooter } from "./AppFooter";
import { SetupBanner } from "@/components/sidebar/SetupBanner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import i18n, { isSupportedLanguage, type SupportedLanguage } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, LogIn } from "lucide-react";

type LanguageOption = { value: SupportedLanguage; label: string };

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, refreshProfile, user } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const options: LanguageOption[] = useMemo(
    () => [
      { value: "en", label: t("common.languages.en") },
      { value: "pt", label: t("common.languages.pt") },
      { value: "es", label: t("common.languages.es") },
    ],
    [t],
  );

  const profileLang = isSupportedLanguage(profile?.preferred_language)
    ? (profile!.preferred_language as SupportedLanguage)
    : null;
  const [lang, setLang] = useState<SupportedLanguage>((i18n.language as SupportedLanguage) || "en");

  // Sync UI language with profile preference when it loads/changes.
  useEffect(() => {
    if (profileLang && profileLang !== i18n.language) {
      i18n.changeLanguage(profileLang);
      setLang(profileLang);
      try {
        localStorage.setItem("app_language", profileLang);
      } catch {
        // ignore
      }
    }
  }, [profileLang]);

  const handleChangeLanguage = async (next: SupportedLanguage) => {
    setLang(next);
    await i18n.changeLanguage(next);
    try {
      localStorage.setItem("app_language", next);
    } catch {
      // ignore
    }

    // Persist in profile (best-effort).
    if (profile?.id) {
      const { error } = await supabase.from("profiles").update({ preferred_language: next }).eq("id", profile.id);

      if (!error) {
        await refreshProfile();
      }
    }
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            {/* Mobile: Hamburger menu trigger */}
            {isMobile && (
              <SidebarTrigger className="mr-3 h-9 w-9">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
            )}

            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="text-xl md:text-2xl leading-none truncate font-brand tracking-[-0.03em]">
                  <span className="font-bold brand-title-mark">H2</span>
                  <span className="font-medium tracking-[-0.02em]"> Linker</span>
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!user && (
                <Button onClick={() => navigate("/auth")} size="sm" variant="default" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("auth.actions.signin")}</span>
                </Button>
              )}

              <Select value={lang} onValueChange={(v) => handleChangeLanguage(v as SupportedLanguage)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder={t("common.language")} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>
          <div className="flex-1 p-4 md:p-6 overflow-auto">{children}</div>
          <AppFooter />
          <SetupBanner />
          <WhatsNewDialog />
        </main>
      </div>
    </SidebarProvider>
  );
}
