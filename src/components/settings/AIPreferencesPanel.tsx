import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Save, RotateCcw, Eye, Mail, Settings2, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

type ParagraphStyle = "single" | "multiple";
type EmailLength = "short" | "medium" | "long";
type FormalityLevel = "casual" | "professional" | "formal";
type EmotionalTone = "professional" | "enthusiastic" | "confident" | "warm" | "assertive";
type GreetingStyle = "hello" | "dear_manager" | "dear_team" | "varied";
type ClosingStyle = "best_regards" | "sincerely" | "thank_you" | "varied";

interface AIPreferences {
  paragraph_style: ParagraphStyle;
  email_length: EmailLength;
  formality_level: FormalityLevel;
  emotional_tone: EmotionalTone;
  greeting_style: GreetingStyle;
  closing_style: ClosingStyle;
  emphasize_availability: boolean;
  emphasize_physical_strength: boolean;
  emphasize_languages: boolean;
  custom_instructions: string | null;
  // Advanced structure options
  vary_paragraph_order: boolean;
  vary_paragraph_count: boolean;
  start_with_hook: boolean;
  vary_paragraph_length: boolean;
  // Advanced personalization options
  mention_company_naturally: boolean;
  reference_sector: boolean;
  vary_synonyms: boolean;
  vary_job_title_usage: boolean;
  avoid_cliches: boolean;
  include_ps_line: boolean;
  vary_bullet_points: boolean;
  vary_number_format: boolean;
  vary_cta_position: boolean;
  // Technical options
  vary_email_headers: boolean;
}

const defaultPreferences: AIPreferences = {
  paragraph_style: "multiple",
  email_length: "medium",
  formality_level: "professional",
  emotional_tone: "professional",
  greeting_style: "varied",
  closing_style: "best_regards",
  emphasize_availability: true,
  emphasize_physical_strength: true,
  emphasize_languages: true,
  custom_instructions: null,
  vary_paragraph_order: false,
  vary_paragraph_count: false,
  start_with_hook: false,
  vary_paragraph_length: false,
  mention_company_naturally: true,
  reference_sector: false,
  vary_synonyms: false,
  vary_job_title_usage: false,
  avoid_cliches: true,
  include_ps_line: false,
  vary_bullet_points: false,
  vary_number_format: false,
  vary_cta_position: false,
  vary_email_headers: false,
};

// Generate sample preview based on preferences - uses placeholders, never invents qualifications
function generatePreviewEmail(prefs: AIPreferences, t: (key: string) => string, userName?: string): { subject: string; body: string } {
  const greetings: Record<GreetingStyle, string> = {
    hello: "Hello,",
    dear_manager: "Dear Hiring Manager,",
    dear_team: "Dear Hiring Team,",
    varied: "Good morning,",
  };

  const closings: Record<ClosingStyle, string> = {
    best_regards: "Best regards,",
    sincerely: "Sincerely,",
    thank_you: "Thank you for your consideration,",
    varied: "Kind regards,",
  };

  const greeting = greetings[prefs.greeting_style];
  const closing = closings[prefs.closing_style];
  const name = userName || "[Your Name]";

  // Build paragraphs based on preferences - NEVER invent qualifications
  const paragraphs: string[] = [];

  // Opening paragraph - varies by tone and formality
  if (prefs.start_with_hook) {
    paragraphs.push(`Are you looking for a dedicated worker who's ready to start immediately? I'm excited to apply for the [Job Title] position at [Company Name].`);
  } else if (prefs.emotional_tone === "enthusiastic") {
    paragraphs.push(`I am thrilled to apply for the [Job Title] position at [Company Name]! This opportunity perfectly aligns with what I'm looking for.`);
  } else if (prefs.emotional_tone === "confident") {
    paragraphs.push(`I am applying for the [Job Title] position at [Company Name]. I am confident I can contribute immediately to your team.`);
  } else if (prefs.emotional_tone === "warm") {
    paragraphs.push(`I hope this message finds you well. I'm reaching out about the [Job Title] opportunity at [Company Name], and I'd love to be part of your team.`);
  } else if (prefs.emotional_tone === "assertive") {
    paragraphs.push(`I am writing to express my strong interest in the [Job Title] position at [Company Name]. I am ready to deliver results from day one.`);
  } else if (prefs.formality_level === "casual") {
    paragraphs.push(`I'm reaching out about the [Job Title] position at [Company Name]. I'm [your age] years old, and I'm very interested in joining your team.`);
  } else if (prefs.formality_level === "formal") {
    paragraphs.push(`I am writing to express my sincere interest in the [Job Title] position at [Company Name]. I would be honored to contribute to your esteemed organization.`);
  } else {
    paragraphs.push(`I am writing to apply for the [Job Title] position at [Company Name]. I am excited about the opportunity to join your team.`);
  }

  // Reference sector if enabled
  if (prefs.reference_sector) {
    paragraphs.push(`I understand the [industry/sector] demands dedication and attention to detail, and I am fully prepared to meet these expectations.`);
  }

  // Availability paragraph
  if (prefs.emphasize_availability) {
    if (prefs.formality_level === "casual") {
      paragraphs.push(`I'm fully available for any schedule you need — weekends, holidays, overtime, you name it. I can start right away whenever you're ready.`);
    } else {
      paragraphs.push(`I am fully available to work weekends, holidays, and overtime as needed. I am ready to begin immediately upon your convenience.`);
    }
  }

  // Physical strength paragraph - generic statement, no invented numbers
  if (prefs.emphasize_physical_strength) {
    paragraphs.push(`I am physically fit and capable of handling demanding labor. I am known for my punctuality, reliability, and strong work ethic.`);
  }

  // Languages paragraph - placeholder for actual languages
  if (prefs.emphasize_languages) {
    paragraphs.push(`I speak [your languages], allowing me to communicate effectively with diverse teams and follow instructions accurately.`);
  }

  // Closing paragraph with varying CTA position
  if (prefs.vary_cta_position) {
    paragraphs.push(`Please feel free to contact me anytime to discuss how I can contribute to your team. I am eager to learn more about this opportunity.`);
  } else if (prefs.formality_level === "formal") {
    paragraphs.push(`I would greatly appreciate the opportunity to discuss how my qualifications align with your requirements. Please do not hesitate to contact me at your earliest convenience.`);
  } else {
    paragraphs.push(`I would love the opportunity to discuss this position further. Please feel free to contact me anytime.`);
  }

  // Adjust length
  let finalParagraphs = [...paragraphs];
  if (prefs.email_length === "short") {
    finalParagraphs = paragraphs.slice(0, 2);
    finalParagraphs.push(paragraphs[paragraphs.length - 1]);
  } else if (prefs.email_length === "long") {
    // Add extra generic detail - no invented qualifications
    finalParagraphs.splice(2, 0, `I am a dedicated and hardworking individual, always eager to learn and adapt to new challenges. I take pride in delivering quality work consistently.`);
  }

  // Format body based on paragraph style
  let body: string;
  if (prefs.paragraph_style === "single") {
    body = `${greeting}\n\n${finalParagraphs.join(" ")}\n\n${closing}\n${name}`;
  } else {
    body = `${greeting}\n\n${finalParagraphs.join("\n\n")}\n\n${closing}\n${name}`;
  }

  // Add P.S. line if enabled
  if (prefs.include_ps_line) {
    body += `\n\nP.S. I am available for an interview at your earliest convenience and can provide references upon request.`;
  }

  return {
    subject: `Application for [Job Title] Position - ${name}`,
    body,
  };
}

export function AIPreferencesPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<AIPreferences>(defaultPreferences);
  const [hasRecord, setHasRecord] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Generate preview email based on current preferences
  const previewEmail = useMemo(() => {
    return generatePreviewEmail(prefs, t, profile?.full_name || undefined);
  }, [prefs, t, profile?.full_name]);

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
          emotional_tone: (data.emotional_tone as EmotionalTone) || "professional",
          greeting_style: data.greeting_style as GreetingStyle,
          closing_style: data.closing_style as ClosingStyle,
          emphasize_availability: data.emphasize_availability,
          emphasize_physical_strength: data.emphasize_physical_strength,
          emphasize_languages: data.emphasize_languages,
          custom_instructions: data.custom_instructions,
          vary_paragraph_order: data.vary_paragraph_order ?? false,
          vary_paragraph_count: data.vary_paragraph_count ?? false,
          start_with_hook: data.start_with_hook ?? false,
          vary_paragraph_length: data.vary_paragraph_length ?? false,
          mention_company_naturally: data.mention_company_naturally ?? true,
          reference_sector: data.reference_sector ?? false,
          vary_synonyms: data.vary_synonyms ?? false,
          vary_job_title_usage: data.vary_job_title_usage ?? false,
          avoid_cliches: data.avoid_cliches ?? true,
          include_ps_line: data.include_ps_line ?? false,
          vary_bullet_points: data.vary_bullet_points ?? false,
          vary_number_format: data.vary_number_format ?? false,
          vary_cta_position: data.vary_cta_position ?? false,
          vary_email_headers: data.vary_email_headers ?? false,
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

  const updatePref = <K extends keyof AIPreferences>(key: K, value: AIPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
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
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Settings Panel */}
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
                onValueChange={(v) => updatePref("email_length", v as EmailLength)}
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
                onValueChange={(v) => updatePref("paragraph_style", v as ParagraphStyle)}
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
                onValueChange={(v) => updatePref("formality_level", v as FormalityLevel)}
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
              <Label>{t("ai_preferences.emotional_tone")}</Label>
              <Select
                value={prefs.emotional_tone}
                onValueChange={(v) => updatePref("emotional_tone", v as EmotionalTone)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">{t("ai_preferences.tone_professional")}</SelectItem>
                  <SelectItem value="enthusiastic">{t("ai_preferences.tone_enthusiastic")}</SelectItem>
                  <SelectItem value="confident">{t("ai_preferences.tone_confident")}</SelectItem>
                  <SelectItem value="warm">{t("ai_preferences.tone_warm")}</SelectItem>
                  <SelectItem value="assertive">{t("ai_preferences.tone_assertive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Greeting & Closing Style */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("ai_preferences.greeting_style")}</Label>
              <Select
                value={prefs.greeting_style}
                onValueChange={(v) => updatePref("greeting_style", v as GreetingStyle)}
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

            <div className="space-y-2">
              <Label>{t("ai_preferences.closing_style")}</Label>
              <Select
                value={prefs.closing_style}
                onValueChange={(v) => updatePref("closing_style", v as ClosingStyle)}
              >
                <SelectTrigger>
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
                onCheckedChange={(v) => updatePref("emphasize_availability", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-normal">{t("ai_preferences.emphasize_strength")}</Label>
                <p className="text-xs text-muted-foreground">{t("ai_preferences.emphasize_strength_hint")}</p>
              </div>
              <Switch
                checked={prefs.emphasize_physical_strength}
                onCheckedChange={(v) => updatePref("emphasize_physical_strength", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-normal">{t("ai_preferences.emphasize_languages")}</Label>
                <p className="text-xs text-muted-foreground">{t("ai_preferences.emphasize_languages_hint")}</p>
              </div>
              <Switch
                checked={prefs.emphasize_languages}
                onCheckedChange={(v) => updatePref("emphasize_languages", v)}
              />
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label>{t("ai_preferences.custom_instructions")}</Label>
            <Textarea
              value={prefs.custom_instructions || ""}
              onChange={(e) => updatePref("custom_instructions", e.target.value || null)}
              placeholder={t("ai_preferences.custom_instructions_placeholder")}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t("ai_preferences.custom_instructions_hint")}
            </p>
          </div>

          {/* Advanced Settings Collapsible */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  {t("ai_preferences.advanced_title")}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-6">
              {/* Structure Variation */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("ai_preferences.advanced_structure")}</Label>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_paragraph_order"
                      checked={prefs.vary_paragraph_order}
                      onCheckedChange={(v) => updatePref("vary_paragraph_order", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_paragraph_order" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_paragraph_order")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_paragraph_count"
                      checked={prefs.vary_paragraph_count}
                      onCheckedChange={(v) => updatePref("vary_paragraph_count", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_paragraph_count" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_paragraph_count")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="start_with_hook"
                      checked={prefs.start_with_hook}
                      onCheckedChange={(v) => updatePref("start_with_hook", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="start_with_hook" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.start_with_hook")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_paragraph_length"
                      checked={prefs.vary_paragraph_length}
                      onCheckedChange={(v) => updatePref("vary_paragraph_length", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_paragraph_length" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_paragraph_length")}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deep Personalization */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("ai_preferences.advanced_personalization")}</Label>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="mention_company_naturally"
                      checked={prefs.mention_company_naturally}
                      onCheckedChange={(v) => updatePref("mention_company_naturally", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="mention_company_naturally" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.mention_company_naturally")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="reference_sector"
                      checked={prefs.reference_sector}
                      onCheckedChange={(v) => updatePref("reference_sector", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="reference_sector" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.reference_sector")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_synonyms"
                      checked={prefs.vary_synonyms}
                      onCheckedChange={(v) => updatePref("vary_synonyms", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_synonyms" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_synonyms")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_job_title_usage"
                      checked={prefs.vary_job_title_usage}
                      onCheckedChange={(v) => updatePref("vary_job_title_usage", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_job_title_usage" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_job_title_usage")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avoid_cliches"
                      checked={prefs.avoid_cliches}
                      onCheckedChange={(v) => updatePref("avoid_cliches", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="avoid_cliches" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.avoid_cliches")}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Style Variations */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("ai_preferences.advanced_style")}</Label>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="include_ps_line"
                      checked={prefs.include_ps_line}
                      onCheckedChange={(v) => updatePref("include_ps_line", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="include_ps_line" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.include_ps_line")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_bullet_points"
                      checked={prefs.vary_bullet_points}
                      onCheckedChange={(v) => updatePref("vary_bullet_points", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_bullet_points" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_bullet_points")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_number_format"
                      checked={prefs.vary_number_format}
                      onCheckedChange={(v) => updatePref("vary_number_format", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_number_format" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_number_format")}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_cta_position"
                      checked={prefs.vary_cta_position}
                      onCheckedChange={(v) => updatePref("vary_cta_position", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_cta_position" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_cta_position")}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Variations */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("ai_preferences.advanced_technical")}</Label>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="vary_email_headers"
                      checked={prefs.vary_email_headers}
                      onCheckedChange={(v) => updatePref("vary_email_headers", !!v)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor="vary_email_headers" className="text-sm font-normal cursor-pointer">
                        {t("ai_preferences.vary_email_headers")}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {t("ai_preferences.vary_email_headers_hint")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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

      {/* Preview Panel */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {t("ai_preferences.preview_title")}
                <Badge variant="secondary" className="text-xs font-normal">
                  {t("ai_preferences.preview_live")}
                </Badge>
              </CardTitle>
              <CardDescription className="text-sm">
                {t("ai_preferences.preview_description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border bg-card">
            {/* Email Header */}
            <div className="border-b px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">To:</span>
                <span className="text-xs">hr@samplefarms.com</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground mt-0.5">Subject:</span>
                <span className="text-sm font-medium">{previewEmail.subject}</span>
              </div>
            </div>
            
            {/* Email Body */}
            <ScrollArea className="h-[400px]">
              <div className="p-4">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
                  {previewEmail.body}
                </pre>
              </div>
            </ScrollArea>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {t("ai_preferences.preview_note")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
