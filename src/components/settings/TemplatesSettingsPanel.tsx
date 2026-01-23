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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      toast({ title: "Erro ao carregar templates", description: error.message, variant: "destructive" });
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
      toast({ title: "Preencha nome, assunto e corpo", variant: "destructive" });
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
        toast({ title: "Template atualizado" });
      } else {
        const { error } = await supabase.from("email_templates").insert(payload);
        if (error) throw error;
        toast({ title: "Template criado" });
      }

      closeEditor();
      await loadTemplates();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao salvar";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    const ok = window.confirm("Excluir este template?");
    if (!ok) return;

    try {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "Template removido" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao remover";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Crie modelos de email para reutilizar no teste e na fila.</CardDescription>
          </div>
          <Dialog open={editor.open} onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px]">
              <DialogHeader>
                <DialogTitle>{editor.open && editor.mode === "edit" ? "Editar template" : "Novo template"}</DialogTitle>
                <DialogDescription>Use texto simples. Quebras de linha serão preservadas no envio.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Primeira abordagem" />
                </div>
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Candidatura" />
                </div>
                <div className="space-y-2">
                  <Label>Corpo</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Olá..." />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeEditor} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={upsertTemplate} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                    Nenhum template ainda.
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
