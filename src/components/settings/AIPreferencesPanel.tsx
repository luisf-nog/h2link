import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Save, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

type ParagraphStyle = "single" | "multiple";
type EmailLength = "short" | "medium" | "long";
type FormalityLevel = "casual" | "professional" | "formal";
type GreetingStyle = "hello" | "dear_manager" | "dear_team" | "varied";
type ClosingStyle = "best_regards" | "sincerely" | "thank_you" | "varied";

interface AIPreferences {
  paragraph_style: ParagraphStyle;
  email_length: EmailLength;
  formality_level: FormalityLevel;
  greeting_style: GreetingStyle;
  closing_style: ClosingStyle;
  emphasize_availability: boolean;
  emphasize_physical_strength: boolean;
  emphasize_languages: boolean;
  custom_instructions: string | null;
}

const defaultPreferences: AIPreferences = {
  paragraph_style: "multiple",
  email_length: "medium",
  formality_level: "professional",
  greeting_style: "varied",
  closing_style: "best_regards",
  emphasize_availability: true,
  emphasize_physical_strength: true,
  emphasize_languages: true,
  custom_instructions: null,
};

export function AIPreferencesPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<AIPreferences>(defaultPreferences);
  const [hasRecord, setHasRecord] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_generation_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPrefs({
          paragraph_style: data.paragraph_style as ParagraphStyle,
          email_length: data.email_length as EmailLength,
          formality_level: data.formality_level as FormalityLevel,
          greeting_style: data.greeting_style as GreetingStyle,
          closing_style: data.closing_style as ClosingStyle,
          emphasize_availability: data.emphasize_availability,
          emphasize_physical_strength: data.emphasize_physical_strength,
          emphasize_languages: data.emphasize_languages,
          custom_instructions: data.custom_instructions,
        });
        setHasRecord(true);
      }
    } catch (e) {
      console.error("Failed to load AI preferences:", e);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        ...prefs,
      };

      if (hasRecord) {
        const { error } = await supabase
          .from("ai_generation_preferences")
          .update(payload)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_generation_preferences")
          .insert(payload);
        if (error) throw error;
        setHasRecord(true);
      }

      toast({ title: t("ai_preferences.saved") });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      toast({ title: t("ai_preferences.save_error"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setPrefs(defaultPreferences);
    toast({ title: t("ai_preferences.reset") });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>{t("ai_preferences.title")}</CardTitle>
            <CardDescription>{t("ai_preferences.description")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Structure */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("ai_preferences.email_length")}</Label>
            <Select
              value={prefs.email_length}
              onValueChange={(v) => setPrefs({ ...prefs, email_length: v as EmailLength })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">{t("ai_preferences.length_short")}</SelectItem>
                <SelectItem value="medium">{t("ai_preferences.length_medium")}</SelectItem>
                <SelectItem value="long">{t("ai_preferences.length_long")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("ai_preferences.paragraph_style")}</Label>
            <Select
              value={prefs.paragraph_style}
              onValueChange={(v) => setPrefs({ ...prefs, paragraph_style: v as ParagraphStyle })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple">{t("ai_preferences.paragraphs_multiple")}</SelectItem>
                <SelectItem value="single">{t("ai_preferences.paragraphs_single")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tone & Formality */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("ai_preferences.formality")}</Label>
            <Select
              value={prefs.formality_level}
              onValueChange={(v) => setPrefs({ ...prefs, formality_level: v as FormalityLevel })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">{t("ai_preferences.formality_casual")}</SelectItem>
                <SelectItem value="professional">{t("ai_preferences.formality_professional")}</SelectItem>
                <SelectItem value="formal">{t("ai_preferences.formality_formal")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("ai_preferences.greeting_style")}</Label>
            <Select
              value={prefs.greeting_style}
              onValueChange={(v) => setPrefs({ ...prefs, greeting_style: v as GreetingStyle })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="varied">{t("ai_preferences.greeting_varied")}</SelectItem>
                <SelectItem value="hello">{t("ai_preferences.greeting_hello")}</SelectItem>
                <SelectItem value="dear_team">{t("ai_preferences.greeting_dear_team")}</SelectItem>
                <SelectItem value="dear_manager">{t("ai_preferences.greeting_dear_manager")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Closing Style */}
        <div className="space-y-2">
          <Label>{t("ai_preferences.closing_style")}</Label>
          <Select
            value={prefs.closing_style}
            onValueChange={(v) => setPrefs({ ...prefs, closing_style: v as ClosingStyle })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best_regards">{t("ai_preferences.closing_best_regards")}</SelectItem>
              <SelectItem value="sincerely">{t("ai_preferences.closing_sincerely")}</SelectItem>
              <SelectItem value="thank_you">{t("ai_preferences.closing_thank_you")}</SelectItem>
              <SelectItem value="varied">{t("ai_preferences.closing_varied")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Emphasis Toggles */}
        <div className="space-y-4">
          <Label className="text-base">{t("ai_preferences.emphasis_title")}</Label>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-normal">{t("ai_preferences.emphasize_availability")}</Label>
              <p className="text-xs text-muted-foreground">{t("ai_preferences.emphasize_availability_hint")}</p>
            </div>
            <Switch
              checked={prefs.emphasize_availability}
              onCheckedChange={(v) => setPrefs({ ...prefs, emphasize_availability: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-normal">{t("ai_preferences.emphasize_strength")}</Label>
              <p className="text-xs text-muted-foreground">{t("ai_preferences.emphasize_strength_hint")}</p>
            </div>
            <Switch
              checked={prefs.emphasize_physical_strength}
              onCheckedChange={(v) => setPrefs({ ...prefs, emphasize_physical_strength: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-normal">{t("ai_preferences.emphasize_languages")}</Label>
              <p className="text-xs text-muted-foreground">{t("ai_preferences.emphasize_languages_hint")}</p>
            </div>
            <Switch
              checked={prefs.emphasize_languages}
              onCheckedChange={(v) => setPrefs({ ...prefs, emphasize_languages: v })}
            />
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-2">
          <Label>{t("ai_preferences.custom_instructions")}</Label>
          <Textarea
            value={prefs.custom_instructions || ""}
            onChange={(e) => setPrefs({ ...prefs, custom_instructions: e.target.value || null })}
            placeholder={t("ai_preferences.custom_instructions_placeholder")}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {t("ai_preferences.custom_instructions_hint")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button onClick={savePreferences} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t("common.save")}
          </Button>
          <Button variant="outline" onClick={resetToDefaults} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("ai_preferences.reset_defaults")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
