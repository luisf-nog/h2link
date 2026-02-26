import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Lock, Sparkles } from "lucide-react";

const WHATS_NEW_VERSION = "v1_h2resume";
const STORAGE_KEY = "h2linker_whats_new_seen";

export function WhatsNewDialog({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  // Auto-show on first visit
  useEffect(() => {
    if (isControlled) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== WHATS_NEW_VERSION) {
        setInternalOpen(true);
      }
    } catch {
      // ignore
    }
  }, [isControlled]);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    } catch {
      // ignore
    }
    setIsOpen(false);
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

        <div className="space-y-4 pt-2">
          {/* H2 Resume Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider">
                {t("whatsNew.h2resume.badge")}
              </Badge>
              <h3 className="font-bold text-foreground">{t("whatsNew.h2resume.title")}</h3>
            </div>

            <p className="text-sm text-muted-foreground font-medium">
              {t("whatsNew.h2resume.subtitle")}
            </p>

            <p className="text-sm text-foreground leading-relaxed">
              {t("whatsNew.h2resume.intro")}
            </p>

            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">{t("whatsNew.h2resume.not_just")}</p>
              <p className="text-sm text-muted-foreground">{t("whatsNew.h2resume.built_way")}</p>
            </div>

            <div className="space-y-1.5 pl-1">
              {(["check1", "check2", "check3", "check4", "check5"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-foreground">{t(`whatsNew.h2resume.${key}`)}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("whatsNew.h2resume.ats_info")}
            </p>

            <p className="text-sm text-foreground leading-relaxed">
              {t("whatsNew.h2resume.structured")}
            </p>

            <p className="text-sm text-muted-foreground leading-relaxed italic">
              {t("whatsNew.h2resume.value")}
            </p>

            <p className="text-sm font-bold text-foreground">
              {t("whatsNew.h2resume.cta")}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Lock className="h-3.5 w-3.5" />
              <span>{t("whatsNew.h2resume.lock")}</span>
            </div>
          </div>
        </div>

        <Button onClick={handleClose} className="w-full mt-2">
          {t("whatsNew.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
