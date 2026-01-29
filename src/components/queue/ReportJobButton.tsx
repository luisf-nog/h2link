import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type ReportReason = 'invalid_email' | 'inactive_job' | 'wrong_info' | 'spam' | 'other';

interface ReportJobButtonProps {
  jobId: string;
  onReported?: () => void;
  variant?: 'icon' | 'full';
}

export function ReportJobButton({ jobId, onReported, variant = 'icon' }: ReportJobButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const reasons: { value: ReportReason; label: string }[] = [
    { value: 'invalid_email', label: t('reports.reasons.invalid_email') },
    { value: 'inactive_job', label: t('reports.reasons.inactive_job') },
    { value: 'wrong_info', label: t('reports.reasons.wrong_info') },
    { value: 'spam', label: t('reports.reasons.spam') },
    { value: 'other', label: t('reports.reasons.other') },
  ];

  const handleReport = async (reason: ReportReason) => {
    if (!profile?.id || !jobId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('job_reports').insert({
        job_id: jobId,
        user_id: profile.id,
        reason,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: t('reports.toasts.already_reported_title'),
            description: t('reports.toasts.already_reported_desc'),
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: t('reports.toasts.success_title'),
          description: t('reports.toasts.success_desc'),
        });
        onReported?.();
      }
    } catch (err: any) {
      toast({
        title: t('common.errors.save_failed'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon' ? 'icon' : 'sm'}
          className={variant === 'icon' ? 'h-8 w-8 text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-destructive'}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Flag className="h-4 w-4" />
              {variant === 'full' && <span className="ml-2">{t('reports.button')}</span>}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {reasons.map((reason) => (
          <DropdownMenuItem
            key={reason.value}
            onClick={() => handleReport(reason.value)}
            className="cursor-pointer"
          >
            {reason.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
