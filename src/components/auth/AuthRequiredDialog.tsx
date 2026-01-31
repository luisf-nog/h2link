import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Zap, Mail, Bot } from 'lucide-react';

interface AuthRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: 'queue' | 'send';
}

export function AuthRequiredDialog({ open, onOpenChange, action = 'queue' }: AuthRequiredDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSignUp = () => {
    onOpenChange(false);
    navigate('/auth?mode=signup');
  };

  const handleSignIn = () => {
    onOpenChange(false);
    navigate('/auth');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">{t('auth.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('auth.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Zap className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">{t('auth.dialog.benefit1_title')}</p>
              <p className="text-xs text-muted-foreground">{t('auth.dialog.benefit1_desc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Bot className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">{t('auth.dialog.benefit2_title')}</p>
              <p className="text-xs text-muted-foreground">{t('auth.dialog.benefit2_desc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">{t('auth.dialog.benefit3_title')}</p>
              <p className="text-xs text-muted-foreground">{t('auth.dialog.benefit3_desc')}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleSignIn} className="w-full sm:w-auto">
            {t('auth.dialog.sign_in')}
          </Button>
          <Button onClick={handleSignUp} className="w-full sm:w-auto">
            {t('auth.dialog.sign_up')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
