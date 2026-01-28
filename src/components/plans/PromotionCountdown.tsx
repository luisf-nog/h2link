import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

// Promotion end date - adjust as needed
const PROMO_END_DATE = new Date('2025-02-28T23:59:59-03:00');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const calculateTimeLeft = (): TimeLeft | null => {
  const now = new Date();
  const difference = PROMO_END_DATE.getTime() - now.getTime();

  if (difference <= 0) {
    return null;
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

export function PromotionCountdown() {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) {
    return null; // Promotion expired
  }

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-background border border-border rounded-lg px-3 py-2 min-w-[60px] text-center shadow-sm">
        <span className="text-2xl font-bold font-mono text-foreground">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className={cn(
        "rounded-xl border-2 border-destructive/50 bg-gradient-to-r from-destructive/10 via-destructive/5 to-destructive/10",
        "px-6 py-5 text-center relative overflow-hidden"
      )}>
        {/* Animated background pulse */}
        <div className="absolute inset-0 bg-destructive/5 animate-pulse" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Flame className="h-5 w-5 text-destructive animate-pulse" />
            <h3 className="text-lg font-bold text-foreground">
              {t('plans.promo.title')}
            </h3>
            <Flame className="h-5 w-5 text-destructive animate-pulse" />
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <TimeBlock value={timeLeft.days} label={t('plans.promo.days')} />
            <span className="text-2xl font-bold text-muted-foreground mt-[-20px]">:</span>
            <TimeBlock value={timeLeft.hours} label={t('plans.promo.hours')} />
            <span className="text-2xl font-bold text-muted-foreground mt-[-20px]">:</span>
            <TimeBlock value={timeLeft.minutes} label={t('plans.promo.minutes')} />
            <span className="text-2xl font-bold text-muted-foreground mt-[-20px]">:</span>
            <TimeBlock value={timeLeft.seconds} label={t('plans.promo.seconds')} />
          </div>

          {/* Subtitle */}
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <Clock className="h-4 w-4" />
            {t('plans.promo.subtitle')}
          </p>
        </div>
      </div>
    </div>
  );
}
