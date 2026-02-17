import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSetupChecklist } from "@/hooks/useSetupChecklist";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export function SetupChecklist() {
  const { steps, completedCount, allDone, percent, loading } = useSetupChecklist();
  const { state, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (loading || allDone) return null;

  const handleStepClick = (route: string) => {
    navigate(route);
    if (isMobile) setOpenMobile(false);
  };

  // Collapsed: show only icon with progress
  if (collapsed && !isMobile) {
    return (
      <div className="px-2 py-3">
        <div
          className="relative flex items-center justify-center cursor-pointer group"
          onClick={() => {
            // find next incomplete step
            const next = steps.find((s) => !s.done);
            if (next) handleStepClick(next.route);
          }}
          title={t("checklist.title")}
        >
          <Rocket className="h-5 w-5 text-primary" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-primary-foreground">
            {completedCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-bold text-sidebar-foreground uppercase tracking-wider truncate">
          {t("checklist.title")}
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-semibold text-sidebar-foreground/60">
          <span>{completedCount}/{steps.length}</span>
          <span>{percent}%</span>
        </div>
        <Progress value={percent} className="h-1.5 bg-sidebar-accent" />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step) => (
          <button
            key={step.key}
            onClick={() => !step.done && handleStepClick(step.route)}
            className={cn(
              "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors text-xs",
              step.done
                ? "text-emerald-400 cursor-default"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground cursor-pointer"
            )}
            disabled={step.done}
          >
            {step.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-sidebar-foreground/30 shrink-0" />
            )}
            <span className={cn("truncate", step.done && "line-through opacity-60")}>
              {t(`checklist.steps.${step.key}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
