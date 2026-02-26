import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Lock, Sparkles, Calendar } from "lucide-react";

/**
 * Each update has a unique key and a date.
 * Add new entries at the TOP — newest first.
 * The STORAGE_KEY tracks the latest version the user has seen.
 */
interface UpdateEntry {
  key: string;       // i18n namespace under whatsNew.updates.<key>
  date: string;      // ISO date string for display
  isPremium: boolean; // show premium badge
}

const UPDATES: UpdateEntry[] = [
  { key: "h2resume", date: "2026-02-26", isPremium: true },
  // Future updates go here ↑
];

const LATEST_VERSION = UPDATES[0]?.key ?? "";
const STORAGE_KEY = "h2linker_whats_new_seen";

export function WhatsNewDialog({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  useEffect(() => {
    if (isControlled) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== LATEST_VERSION) {
        setInternalOpen(true);
      }
    } catch {
      // ignore
    }
  }, [isControlled]);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, LATEST_VERSION);
    } catch {
      // ignore
    }
    setIsOpen(false);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const lang = i18n.language;
      const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en-US";
      return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); else setIsOpen(true); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("whatsNew.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {UPDATES.map((update, idx) => (
            <UpdateCard
              key={update.key}
              update={update}
              t={t}
              formatDate={formatDate}
              isLatest={idx === 0}
            />
          ))}
        </div>

        <Button onClick={handleClose} className="w-full mt-4">
          {t("whatsNew.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function UpdateCard({
  update,
  t,
  formatDate,
  isLatest,
}: {
  update: UpdateEntry;
  t: (key: string) => string;
  formatDate: (iso: string) => string;
  isLatest: boolean;
}) {
  const prefix = `whatsNew.updates.${update.key}`;
  const checks = ["check1", "check2", "check3", "check4", "check5"] as const;

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${isLatest ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
      {/* Header row: date + badges */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(update.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLatest && (
            <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider">
              {t(`${prefix}.badge`)}
            </Badge>
          )}
          {update.isPremium && (
            <Badge className="relative border border-yellow-400/40 bg-gradient-to-r from-yellow-500 via-plan-gold to-yellow-600 text-white font-extrabold text-[10px] uppercase tracking-[0.15em] px-3 py-0.5 shadow-[0_0_12px_-4px_hsl(45_100%_50%/0.5)]">
              Premium
            </Badge>
          )}
        </div>
      </div>

      {/* Headline — large, scannable */}
      <h3 className="text-lg font-bold text-foreground leading-tight">
        {t(`${prefix}.title`)}
      </h3>

      {/* Problem context — the hook */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t(`${prefix}.problem`)}
      </p>

      {/* Solution intro */}
      <p className="text-sm font-semibold text-foreground">
        {t(`${prefix}.solution`)}
      </p>

      {/* Compact bullet checks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-0.5">
        {checks.map((key) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="text-foreground">{t(`${prefix}.${key}`)}</span>
          </div>
        ))}
      </div>

      {/* Value proposition — short */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t(`${prefix}.value`)}
      </p>

      {/* CTA line */}
      <p className="text-sm font-bold text-foreground">
        {t(`${prefix}.cta`)}
      </p>

      {/* Lock notice */}
      {update.isPremium && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
          <Lock className="h-3.5 w-3.5" />
          <span className="font-medium">{t(`${prefix}.lock`)}</span>
        </div>
      )}
    </div>
  );
}
