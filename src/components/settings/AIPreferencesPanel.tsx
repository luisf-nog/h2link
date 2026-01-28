import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Save, RotateCcw, Eye, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

type ParagraphStyle = "single" | "multiple";
type EmailLength = "1" | "2" | "3" | "4" | "5" | "6" | "7";
type FormalityLevel = "casual" | "professional" | "formal";
type GreetingStyle = "hello" | "dear_manager" | "dear_team" | "varied";
type ClosingStyle = "best_regards" | "sincerely" | "thank_you" | "varied";
type OpeningStyle = "varied" | "question" | "direct_statement" | "company_mention";
type LinesPerParagraph = 1 | 2 | 3 | 4 | 5;

interface AIPreferences {
  paragraph_style: ParagraphStyle;
  email_length: EmailLength;
  formality_level: FormalityLevel;
  greeting_style: GreetingStyle;
  closing_style: ClosingStyle;
  opening_style: OpeningStyle;
  lines_per_paragraph: LinesPerParagraph;
  emphasize_availability: boolean;
  emphasize_physical_strength: boolean;
  emphasize_languages: boolean;
  custom_instructions: string | null;
}

const defaultPreferences: AIPreferences = {
  paragraph_style: "multiple",
  email_length: "4",
  formality_level: "professional",
  greeting_style: "varied",
  closing_style: "best_regards",
  opening_style: "varied",
  lines_per_paragraph: 3,
  emphasize_availability: true,
  emphasize_physical_strength: true,
  emphasize_languages: true,
  custom_instructions: null,
};

// Sentence bank for building paragraphs with exact line counts
const sentenceBank = {
  opening: {
    question: [
      "Are you looking for a dedicated worker for the [Job Title] position?",
      "I believe my skills and work ethic would be a great fit for [Company Name].",
      "I am eager to contribute to your team and learn new skills.",
      "I can start immediately and am available for any schedule.",
      "My strong work ethic and reliability make me an excellent candidate.",
    ],
    direct_statement: [
      "I am a hardworking professional ready to excel in the [Job Title] position.",
      "I bring dedication, reliability, and a strong work ethic to every role.",
      "I am confident I can contribute positively to [Company Name].",
      "I am available to start immediately and work any schedule needed.",
      "My punctuality and commitment are qualities I take pride in.",
    ],
    company_mention: [
      "[Company Name]'s reputation has inspired me to apply for this position.",
      "I would be honored to contribute to your continued success.",
      "I believe my qualifications align well with your team's needs.",
      "I am ready to bring my dedication to [Company Name].",
      "I look forward to the opportunity to prove my worth.",
    ],
    varied: [
      "I am excited to apply for the [Job Title] position at [Company Name].",
      "I believe my skills and dedication make me a strong candidate.",
      "I am ready to work hard and contribute to your team.",
      "I can adapt quickly to new environments and challenges.",
      "My availability and commitment are my greatest strengths.",
    ],
  },
  availability: [
    "I am fully available to work weekends, holidays, and overtime as needed.",
    "I am ready to begin immediately upon your convenience.",
    "I have no scheduling conflicts and can commit to any hours required.",
    "I am flexible with my schedule and can adapt to your needs.",
    "I am prepared to work extended hours whenever necessary.",
  ],
  strength: [
    "I am physically fit and capable of handling demanding labor.",
    "I am known for my punctuality, reliability, and strong work ethic.",
    "I can handle heavy lifting and extended periods of physical work.",
    "My stamina and endurance allow me to maintain productivity throughout long shifts.",
    "I take pride in completing tasks efficiently and thoroughly.",
  ],
  languages: [
    "I speak [your languages], allowing me to communicate effectively.",
    "I can follow instructions accurately in multiple languages.",
    "My language skills help me work well with diverse teams.",
    "I am committed to clear communication in all my work.",
    "I continuously work to improve my English skills.",
  ],
  closing: [
    "I would love the opportunity to discuss this position further.",
    "Please feel free to contact me anytime.",
    "Thank you for considering my application.",
    "I look forward to hearing from you soon.",
    "I am eager to demonstrate my qualifications in an interview.",
  ],
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

  const linesTarget = prefs.lines_per_paragraph || 3;
  const targetParagraphs = parseInt(prefs.email_length, 10) || 4;

  // Helper to build a paragraph with exact number of sentences
  const buildParagraph = (sentences: string[]): string => {
    return sentences.slice(0, linesTarget).join(" ");
  };

  // Build paragraphs based on preferences
  const paragraphs: string[] = [];

  // Opening paragraph
  const openingSentences = sentenceBank.opening[prefs.opening_style] || sentenceBank.opening.varied;
  paragraphs.push(buildParagraph(openingSentences));

  // Availability paragraph
  if (prefs.emphasize_availability && paragraphs.length < targetParagraphs) {
    paragraphs.push(buildParagraph(sentenceBank.availability));
  }

  // Physical strength paragraph
  if (prefs.emphasize_physical_strength && paragraphs.length < targetParagraphs) {
    paragraphs.push(buildParagraph(sentenceBank.strength));
  }

  // Languages paragraph
  if (prefs.emphasize_languages && paragraphs.length < targetParagraphs) {
    paragraphs.push(buildParagraph(sentenceBank.languages));
  }

  // Add closing paragraph if we have room
  if (paragraphs.length < targetParagraphs) {
    paragraphs.push(buildParagraph(sentenceBank.closing));
  }

  // Adjust to exact paragraph count
  let finalParagraphs = [...paragraphs];
  
  // Add filler paragraphs if needed
  const fillerSentences = [
    "I am a dedicated and hardworking individual.",
    "I am always eager to learn and adapt to new challenges.",
    "I take pride in delivering quality work consistently.",
    "I am committed to contributing positively to your team.",
    "I believe in going above and beyond expectations.",
  ];
  
  while (finalParagraphs.length < targetParagraphs) {
    finalParagraphs.splice(finalParagraphs.length - 1, 0, buildParagraph(fillerSentences));
  }

  // Trim if too many
  if (finalParagraphs.length > targetParagraphs) {
    const closingParagraph = finalParagraphs.pop()!;
    finalParagraphs = finalParagraphs.slice(0, targetParagraphs - 1);
    finalParagraphs.push(closingParagraph);
  }

  // Format body based on paragraph style
  let body: string;
  if (prefs.paragraph_style === "single") {
    body = `${greeting}\n\n${finalParagraphs.join(" ")}\n\n${closing}\n${name}`;
  } else {
    body = `${greeting}\n\n${finalParagraphs.join("\n\n")}\n\n${closing}\n${name}`;
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
          greeting_style: data.greeting_style as GreetingStyle,
          closing_style: data.closing_style as ClosingStyle,
          opening_style: (data as any).opening_style as OpeningStyle || "varied",
          lines_per_paragraph: ((data as any).lines_per_paragraph as LinesPerParagraph) || 3,
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
                onValueChange={(v) => setPrefs({ ...prefs, email_length: v as EmailLength })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {t("ai_preferences.paragraphs_count", { count: n })}
                    </SelectItem>
                  ))}
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

          {/* Lines per paragraph */}
          <div className="space-y-2">
            <Label>{t("ai_preferences.lines_per_paragraph")}</Label>
            <Select
              value={String(prefs.lines_per_paragraph)}
              onValueChange={(v) => setPrefs({ ...prefs, lines_per_paragraph: Number(v) as LinesPerParagraph })}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t("ai_preferences.lines_count", { count: n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("ai_preferences.lines_per_paragraph_hint")}</p>
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

          {/* Opening & Closing Style */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("ai_preferences.opening_style")}</Label>
              <Select
                value={prefs.opening_style}
                onValueChange={(v) => setPrefs({ ...prefs, opening_style: v as OpeningStyle })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="varied">{t("ai_preferences.opening_varied")}</SelectItem>
                  <SelectItem value="question">{t("ai_preferences.opening_question")}</SelectItem>
                  <SelectItem value="direct_statement">{t("ai_preferences.opening_direct")}</SelectItem>
                  <SelectItem value="company_mention">{t("ai_preferences.opening_company")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("ai_preferences.closing_style")}</Label>
              <Select
                value={prefs.closing_style}
                onValueChange={(v) => setPrefs({ ...prefs, closing_style: v as ClosingStyle })}
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
