import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HELP_EMAIL } from '@/config/app.config';

export function AppFooter() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm py-4 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>© {currentYear}</span>
          <span className="font-brand font-semibold text-foreground">H2 Linker</span>
          <span className="hidden sm:inline">—</span>
          <span className="hidden sm:inline">{t('footer.tagline', 'Smart connections. Real opportunities.')}</span>
        </div>

        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <span>{t('common.helpExpanded', 'Dúvidas ou sugestões? Entre em contato')}: {HELP_EMAIL}</span>
        </div>
      </div>
    </footer>
  );
}
