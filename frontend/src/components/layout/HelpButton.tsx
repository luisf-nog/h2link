import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { HELP_EMAIL } from '@/config/app.config';

export function HelpButton() {
  const { t } = useTranslation();

  const handleClick = () => {
    window.location.href = `mailto:${HELP_EMAIL}`;
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-out group overflow-hidden px-3 hover:px-4"
      aria-label={t('common.help', 'Ajuda')}
    >
      <Mail className="h-5 w-5 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[280px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-out text-sm">
        {t('common.helpExpanded', 'Dúvidas ou sugestões? Entre em contato')}
      </span>
    </Button>
  );
}
