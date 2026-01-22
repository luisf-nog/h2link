import { ReactNode, useEffect, useMemo, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import i18n, { isSupportedLanguage, type SupportedLanguage } from '@/i18n';
import { BrandLogo } from '@/components/brand/BrandLogo';

type LanguageOption = { value: SupportedLanguage; label: string };

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const options: LanguageOption[] = useMemo(
    () => [
      { value: 'en', label: t('common.languages.en') },
      { value: 'pt', label: t('common.languages.pt') },
      { value: 'es', label: t('common.languages.es') },
    ],
    [t]
  );

  const profileLang = isSupportedLanguage(profile?.preferred_language) ? (profile!.preferred_language as SupportedLanguage) : null;
  const [lang, setLang] = useState<SupportedLanguage>((i18n.language as SupportedLanguage) || 'en');

  // Sync UI language with profile preference when it loads/changes.
  useEffect(() => {
    if (profileLang && profileLang !== i18n.language) {
      i18n.changeLanguage(profileLang);
      setLang(profileLang);
      try {
        localStorage.setItem('app_language', profileLang);
      } catch {
        // ignore
      }
    }
  }, [profileLang]);

  const handleChangeLanguage = async (next: SupportedLanguage) => {
    setLang(next);
    await i18n.changeLanguage(next);
    try {
      localStorage.setItem('app_language', next);
    } catch {
      // ignore
    }

    // Persist in profile (best-effort).
    if (profile?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: next })
        .eq('id', profile.id);

      if (!error) {
        await refreshProfile();
      }
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />

            <div className="flex items-center gap-3 min-w-0">
              <BrandLogo height={28} className="max-w-[180px]" />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Select value={lang} onValueChange={(v) => handleChangeLanguage(v as SupportedLanguage)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder={t('common.language')} />
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
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
