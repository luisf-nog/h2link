import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';

const HELP_EMAIL = 'help@h2linker.com';

export function HelpButton() {
  const { t } = useTranslation();

  const handleClick = () => {
    window.location.href = `mailto:${HELP_EMAIL}`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleClick}
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label={t('common.help', 'Ajuda')}
        >
          <Mail className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>{HELP_EMAIL}</p>
      </TooltipContent>
    </Tooltip>
  );
}
