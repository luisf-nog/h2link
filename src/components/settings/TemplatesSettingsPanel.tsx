import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function TemplatesSettingsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [visaType, setVisaType] = useState<"H-2A" | "H-2B">("H-2B");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editor, setEditor] = useState<EditorState>({ open: false });

  const canLoad = useMemo(() => Boolean(user?.id), [user?.id]);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

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

  const handleGenerateWithAI = async () => {
    if (!user?.id) return;
    setGenerating(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("common.errors.no_session"));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-email-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // language is intentionally omitted: AI generation must always be in English
        body: JSON.stringify({ visa_type: visaType }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setSubject(String(payload.subject ?? ""));
      setBody(String(payload.body ?? ""));

      toast({
        title: t("templates.toasts.generated_title"),
        description:
          typeof payload.remaining_today === "number"
            ? t("templates.toasts.remaining_today", { count: payload.remaining_today })
            : undefined,
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>{t("templates.title")}</CardTitle>
            <CardDescription>{t("templates.subtitle")}</CardDescription>
          </div>
          <Dialog open={editor.open} onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("templates.fields.visa_type")}</Label>
                    <Select value={visaType} onValueChange={(v) => setVisaType(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="H-2B">H-2B</SelectItem>
                        <SelectItem value="H-2A">H-2A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="secondary" onClick={handleGenerateWithAI} disabled={generating} className="w-full">
                      {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("templates.actions.generate_ai")}
                    </Button>
                  </div>
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
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="truncate max-w-[380px]">{t.subject}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteTemplate(t.id)}
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
