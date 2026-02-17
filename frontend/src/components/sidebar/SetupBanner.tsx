import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSetupChecklist } from "@/hooks/useSetupChecklist";
import { Rocket, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

export function SetupBanner() {
  const { steps, completedCount, allDone, percent, loading } = useSetupChecklist();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (loading || allDone) return null;

  const remaining = steps.length - completedCount;
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
              {remaining}
            </span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">{t("checklist.banner_title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("checklist.banner_desc", { remaining })}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
        </button>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <Progress value={percent} className="h-1.5" />
        </div>

        {/* Expanded steps */}
        {expanded && (
          <div className="px-4 pb-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {steps.map((step) => (
              <button
                key={step.key}
                onClick={() => !step.done && navigate(step.route)}
                className={cn(
                  "flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-left transition-colors text-sm",
                  step.done
                    ? "text-emerald-600 cursor-default"
                    : "text-foreground hover:bg-accent cursor-pointer"
                )}
                disabled={step.done}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={cn("truncate", step.done && "line-through opacity-60")}>
                  {t(`checklist.steps.${step.key}`)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
