import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Shield, Clock, Zap, AlertTriangle } from "lucide-react";

export type RiskProfile = "conservative" | "standard" | "aggressive";

interface EmailWarmupOnboardingProps {
  onSelect: (profile: RiskProfile) => void;
  loading?: boolean;
}

export function EmailWarmupOnboarding({ onSelect, loading }: EmailWarmupOnboardingProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RiskProfile | null>(null);

  const profiles = [
    {
      id: "conservative" as const,
      icon: Shield,
      title: t("warmup.profiles.conservative.title"),
      description: t("warmup.profiles.conservative.description"),
      details: t("warmup.profiles.conservative.details"),
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      id: "standard" as const,
      icon: Clock,
      title: t("warmup.profiles.standard.title"),
      description: t("warmup.profiles.standard.description"),
      details: t("warmup.profiles.standard.details"),
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
    },
    {
      id: "aggressive" as const,
      icon: Zap,
      title: t("warmup.profiles.aggressive.title"),
      description: t("warmup.profiles.aggressive.description"),
      details: t("warmup.profiles.aggressive.details"),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          {t("warmup.onboarding.title")}
        </CardTitle>
        <CardDescription>{t("warmup.onboarding.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">{t("warmup.onboarding.warning")}</p>
        </div>

        <RadioGroup
          value={selected ?? undefined}
          onValueChange={(v) => setSelected(v as RiskProfile)}
          className="space-y-3"
        >
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`relative flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${
                selected === profile.id ? `${profile.borderColor} ${profile.bgColor}` : "border-border"
              }`}
              onClick={() => setSelected(profile.id)}
            >
              <RadioGroupItem value={profile.id} id={profile.id} className="mt-1" />
              <div className={`p-2 rounded-lg ${profile.bgColor}`}>
                <profile.icon className={`h-5 w-5 ${profile.color}`} />
              </div>
              <div className="flex-1">
                <Label htmlFor={profile.id} className="text-base font-medium cursor-pointer">
                  {profile.title}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">{profile.description}</p>
                <p className="text-xs text-muted-foreground/80 mt-2 italic">{profile.details}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <Button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected || loading}
          className="w-full"
        >
          {loading ? t("common.saving") : t("warmup.onboarding.confirm")}
        </Button>
      </CardContent>
    </Card>
  );
}
