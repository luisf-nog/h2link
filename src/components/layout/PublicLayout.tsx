import { ReactNode, useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n, { isSupportedLanguage, type SupportedLanguage } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Menu, X } from 'lucide-react';

interface PublicLayoutProps {
  children: ReactNode;
}

type LanguageOption = { value: SupportedLanguage; label: string };

export function PublicLayout({ children }: PublicLayoutProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="text-xl md:text-2xl leading-none truncate font-brand tracking-[-0.03em]">
                <span className="font-bold brand-title-mark">H2</span>
                <span className="font-medium tracking-[-0.02em]"> Linker</span>
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-4">
            <Link 
              to="/jobs" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('nav.jobs')}
            </Link>
            
            <Select value={lang} onValueChange={(v) => handleChangeLanguage(v as SupportedLanguage)}>
              <SelectTrigger className="h-9 w-[140px]">
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

            {user ? (
              <Button size="sm" onClick={() => navigate('/dashboard')}>
                {t('nav.dashboard')}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
                  {t('auth.sign_in')}
                </Button>
                <Button size="sm" onClick={() => navigate('/auth?mode=signup')}>
                  {t('auth.sign_up')}
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card p-4 space-y-4">
          <Link 
            to="/jobs" 
            className="block text-sm text-foreground py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t('nav.jobs')}
          </Link>
          
          <Select value={lang} onValueChange={(v) => handleChangeLanguage(v as SupportedLanguage)}>
            <SelectTrigger className="h-9 w-full">
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

          {user ? (
            <Button className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/dashboard'); }}>
              {t('nav.dashboard')}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/auth'); }}>
                {t('auth.sign_in')}
              </Button>
              <Button className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/auth?mode=signup'); }}>
                {t('auth.sign_up')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-6 px-4">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} H2 Linker. {t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}
