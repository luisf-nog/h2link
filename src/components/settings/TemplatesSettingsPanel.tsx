import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PLANS_CONFIG, PlanTier, usesDynamicAI } from "@/config/plans.config";
import { AIPreferencesPanel } from "@/components/settings/AIPreferencesPanel";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type EditorState =
  | { open: false }
  | { open: true; mode: "create"; template?: undefined }
  | { open: true; mode: "edit"; template: EmailTemplate };

type AILength = "short" | "medium" | "long";
type AITone = "professional" | "friendly" | "direct";

export function TemplatesSettingsPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editor, setEditor] = useState<EditorState>({ open: false });

  // AI Options popup state
  const [aiOptionsOpen, setAiOptionsOpen] = useState(false);
  const [aiLength, setAiLength] = useState<AILength>("medium");
  const [aiTone, setAiTone] = useState<AITone>("direct");

  const canLoad = useMemo(() => Boolean(user?.id), [user?.id]);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [aiUsedToday, setAiUsedToday] = useState<number>(0);
  const aiLimit = 3;

  const planTier = (profile?.plan_tier || "free") as PlanTier;
  const isDynamicPlan = usesDynamicAI(planTier);
  const maxTemplates = PLANS_CONFIG[planTier].limits.max_templates;

  const spamTerms = useMemo(
    () => ["renda extra", "ganhe dinheiro", "clique aqui", "100% garantido", "urgente", "promoção", "$$$", "grátis"],
    [],
  );
  const detectedSpamTerms = useMemo(() => {
    const text = body.toLowerCase();
    return spamTerms.filter((term) => text.includes(term.toLowerCase()));
  }, [body, spamTerms]);

  const loadTemplates = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("id,name,subject,body,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: t("templates.toasts.load_error_title"), description: error.message, variant: "destructive" });
    }
    setTemplates(((data as EmailTemplate[]) ?? []).filter(Boolean));

    // Load AI usage (users can SELECT their own rows)
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await supabase
        .from("ai_daily_usage")
        .select("usage_date,template_generations")
        .eq("user_id", user.id)
        .maybeSingle();
      const rowDate = String((usage as any)?.usage_date ?? today);
      const used = rowDate === today ? Number((usage as any)?.template_generations ?? 0) : 0;
      setAiUsedToday(Number.isFinite(used) ? used : 0);
    } catch {
      // ignore
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!canLoad) return;
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  const openCreate = () => {
    setName("");
    setSubject("");
    setBody("");
    setEditor({ open: true, mode: "create" });
  };

  const openEdit = (t: EmailTemplate) => {
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
    setEditor({ open: true, mode: "edit", template: t });
  };

  const closeEditor = () => setEditor({ open: false });

  const upsertTemplate = async () => {
    if (!user?.id) return;
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: t("templates.toasts.required_fields"), variant: "destructive" });
      return;
    }

    // Check plan limits (skip for dynamic plans with unlimited templates)
    if (editor.open && editor.mode === "create" && maxTemplates < 100) {
      if (templates.length >= maxTemplates) {
        toast({
          title: t("templates.toasts.limit_reached_title"),
          description: t("templates.toasts.limit_reached_desc", { max: maxTemplates }),
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
      };

      if (editor.open && editor.mode === "edit") {
        const { error } = await supabase.from("email_templates").update(payload).eq("id", editor.template.id);
        if (error) throw error;
        toast({ title: t("templates.toasts.updated") });
      } else {
        const { error } = await supabase.from("email_templates").insert(payload);
        if (error) throw error;
        toast({ title: t("templates.toasts.created") });
      }

      closeEditor();
      await loadTemplates();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({ title: t("templates.toasts.save_error_title"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openAiOptionsPopup = () => {
    if (aiUsedToday >= aiLimit) {
      toast({
        title: t("templates.toasts.generate_error_title"),
        description: t("templates.ai_limit_reached"),
        variant: "destructive",
      });
      return;
    }
    setAiOptionsOpen(true);
  };

  const handleRewriteWithAI = async () => {
    if (!user?.id) return;
    setAiOptionsOpen(false);
    setGenerating(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("common.errors.no_session"));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ length: aiLength, tone: aiTone }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setSubject(String(payload.subject ?? ""));
      setBody(String(payload.body ?? ""));

      if (typeof payload.used_today === "number") {
        setAiUsedToday(payload.used_today);
      }

      toast({
        title: t("templates.toasts.generated_title"),
        description: t("templates.ai_counter", { used: payload.used_today ?? aiUsedToday + 1, limit: aiLimit }),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("templates.toasts.generate_error_fallback");
      toast({ title: t("templates.toasts.generate_error_title"), description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    const ok = window.confirm(t("templates.confirm_delete"));
    if (!ok) return;

    try {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: t("templates.toasts.deleted") });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.delete_failed");
      toast({ title: t("templates.toasts.delete_error_title"), description: message, variant: "destructive" });
    }
  };

  // For Black users: show AI preferences panel + info banner + optional fallback templates
  if (isDynamicPlan) {
    return (
      <div className="space-y-6">
        {/* AI Preferences Panel */}
        <AIPreferencesPanel />
        
        {/* Info Banner */}
        <Card className="border-plan-black">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-plan-black/10">
                <Zap className="h-6 w-6 text-plan-black" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {t("templates.ai_writer.title")}
                  <Badge variant="default" className="bg-plan-black">
                    {t("plans.tiers.black.label")}
                  </Badge>
                </CardTitle>
                <CardDescription>{t("templates.ai_writer.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>{t("templates.ai_writer.active_title")}</AlertTitle>
              <AlertDescription>{t("templates.ai_writer.active_desc")}</AlertDescription>
            </Alert>
            
            {/* Optional: Allow Black users to create templates as fallback */}
            <div className="mt-6">
              <p className="text-sm text-muted-foreground mb-4">{t("templates.ai_writer.fallback_note")}</p>
              <Dialog open={editor.open} onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("templates.actions.new_fallback")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[640px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editor.open && editor.mode === "edit" ? t("templates.editor.edit_title") : t("templates.editor.new_title")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("templates.editor.placeholders_help")} {"{{name}}"}, {"{{age}}"}, {"{{phone}}"}, {"{{contact_email}}"}, {"{{company}}"}, {"{{position}}"}, {"{{visa_type}}"}.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>{t("templates.fields.name")}</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("templates.placeholders.name")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("templates.fields.subject")}</Label>
                      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("templates.placeholders.subject")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("templates.fields.body")}</Label>
                      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder={t("templates.placeholders.body")} />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={closeEditor} disabled={saving}>
                      {t("common.cancel")}
                    </Button>
                    <Button onClick={upsertTemplate} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("common.save")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {templates.length > 0 && (
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("templates.table.name")}</TableHead>
                      <TableHead>{t("templates.table.subject")}</TableHead>
                      <TableHead className="text-right">{t("templates.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((tpl) => (
                      <TableRow key={tpl.id}>
                        <TableCell className="font-medium">{tpl.name}</TableCell>
                        <TableCell className="truncate max-w-[380px]">{tpl.subject}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(tpl)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteTemplate(tpl.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // AI Options Dialog (shared between both views)
  const aiOptionsDialog = (
    <Dialog open={aiOptionsOpen} onOpenChange={setAiOptionsOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("templates.ai_options.title")}
          </DialogTitle>
          <DialogDescription>
            {t("templates.ai_options.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>{t("templates.ai_options.length_label")}</Label>
            <Select value={aiLength} onValueChange={(v) => setAiLength(v as AILength)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">{t("templates.ai_options.length_short")}</SelectItem>
                <SelectItem value="medium">{t("templates.ai_options.length_medium")}</SelectItem>
                <SelectItem value="long">{t("templates.ai_options.length_long")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("templates.ai_options.length_hint")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("templates.ai_options.tone_label")}</Label>
            <Select value={aiTone} onValueChange={(v) => setAiTone(v as AITone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">{t("templates.ai_options.tone_direct")}</SelectItem>
                <SelectItem value="professional">{t("templates.ai_options.tone_professional")}</SelectItem>
                <SelectItem value="friendly">{t("templates.ai_options.tone_friendly")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("templates.ai_options.tone_hint")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAiOptionsOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleRewriteWithAI} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {t("templates.ai_options.generate_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Standard template management for static plans (Free, Gold, Diamond)
  return (
    <div className="space-y-6">
      {aiOptionsDialog}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>{t("templates.title")}</CardTitle>
            <CardDescription>
              {t("templates.subtitle")} ({templates.length}/{maxTemplates})
            </CardDescription>
          </div>
          <Dialog open={editor.open} onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} disabled={templates.length >= maxTemplates}>
                <Plus className="h-4 w-4 mr-2" />
                {t("templates.actions.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px]">
              <DialogHeader>
                <DialogTitle>
                  {editor.open && editor.mode === "edit" ? t("templates.editor.edit_title") : t("templates.editor.new_title")}
                </DialogTitle>
                <DialogDescription>
                  {t("templates.editor.placeholders_help")} {"{{name}}"}, {"{{age}}"}, {"{{phone}}"}, {"{{contact_email}}"}, {"{{company}}"}, {"{{position}}"}, {"{{visa_type}}"}.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-muted-foreground">{t("templates.ai_counter", { used: aiUsedToday, limit: aiLimit })}</p>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={openAiOptionsPopup} 
                    disabled={generating || aiUsedToday >= aiLimit}
                  >
                    {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {t("templates.actions.rewrite_ai")}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>{t("templates.fields.name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("templates.placeholders.name")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("templates.fields.subject")}</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("templates.placeholders.subject")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("templates.fields.body")}</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder={t("templates.placeholders.body")} />
                  {detectedSpamTerms.length > 0 ? (
                    <Alert>
                      <AlertTitle>{t("templates.spam_warning.title")}</AlertTitle>
                      <AlertDescription>
                        {t("templates.spam_warning.desc", { term: detectedSpamTerms[0] })}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeEditor} disabled={saving}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={upsertTemplate} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("templates.table.name")}</TableHead>
              <TableHead>{t("templates.table.subject")}</TableHead>
              <TableHead className="text-right">{t("templates.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      {t("templates.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell className="truncate max-w-[380px]">{tpl.subject}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(tpl)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteTemplate(tpl.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}