import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Same promo end date as in PromotionCountdown
const PROMO_END_DATE = new Date('2026-02-28T23:59:59-03:00');

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

export function PromoBanner() {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Don't show if promotion expired or dismissed
  if (!timeLeft || dismissed) {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  return (
    <div className={cn(
      "relative rounded-xl border-2 border-destructive bg-destructive text-destructive-foreground",
      "px-4 py-4 md:px-6"
    )}>
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-destructive-foreground/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Title and countdown */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 animate-pulse" />
            <span className="font-bold text-lg">
              {t('dashboard.promo.title')}
            </span>
          </div>

          {/* Compact countdown */}
          <div className="flex items-center gap-1 bg-destructive-foreground/10 rounded-lg px-3 py-1.5">
            <span className="font-mono font-bold">
              {formatTime(timeLeft.days)}d : {formatTime(timeLeft.hours)}h : {formatTime(timeLeft.minutes)}m : {formatTime(timeLeft.seconds)}s
            </span>
          </div>
        </div>

        {/* Right: CTA */}
        <Button
          variant="secondary"
          size="sm"
          className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90 font-semibold"
          asChild
        >
          <a href="/plans" className="flex items-center gap-1.5">
            {t('dashboard.promo.cta')}
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-destructive-foreground/80 mt-2 text-center md:text-left">
        {t('dashboard.promo.subtitle')}
      </p>
    </div>
  );
}
