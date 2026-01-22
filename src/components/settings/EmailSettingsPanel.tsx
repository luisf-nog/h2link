import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Save } from "lucide-react";

type Provider = "gmail" | "outlook";

export function EmailSettingsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [provider, setProvider] = useState<Provider>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);

  // test email
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Teste de envio");
  const [body, setBody] = useState("Olá! Este é um teste.\n\nAtenciosamente,");

  const canLoad = useMemo(() => Boolean(user?.id), [user?.id]);

  useEffect(() => {
    if (!canLoad) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("smtp_credentials")
        .select("provider,email,has_password")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      } else if (data) {
        setProvider((data.provider as Provider) ?? "gmail");
        setEmail(data.email ?? "");
        setHasPassword(Boolean(data.has_password));
      }
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [canLoad, toast, user]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (!email) {
      toast({ title: "Email é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error: upsertError } = await supabase
        .from("smtp_credentials")
        .upsert({ user_id: user.id, provider, email }, { onConflict: "user_id" });
      if (upsertError) throw upsertError;

      if (password.trim().length > 0) {
        const { error: secretError } = await supabase
          .from("smtp_credentials_secrets")
          .upsert({ user_id: user.id, password: password.trim() }, { onConflict: "user_id" });
        if (secretError) throw secretError;

        setHasPassword(true);
        setPassword("");
      }

      toast({ title: "Credenciais salvas" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao salvar";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!user?.id) return;
    if (!to || !subject || !body) {
      toast({ title: "Preencha To/Assunto/Corpo", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sem sessão autenticada");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-custom`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, subject, body, provider }),
      });

      const text = await res.text();
      const payload = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { error: text };
        }
      })();

      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      toast({ title: "Email enviado (teste)" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao enviar";
      toast({ title: "Erro ao enviar", description: message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configuração SMTP
          </CardTitle>
          <CardDescription>Use senha de app (Gmail/Outlook) — não use sua senha normal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="outlook">Outlook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Email SMTP</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>

          <div className="space-y-2">
            <Label>Senha de Aplicativo</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={hasPassword ? "******** (já salva)" : "Cole aqui"}
            />
            <p className="text-xs text-muted-foreground">
              {hasPassword
                ? "Uma senha já está salva. Para trocar, cole uma nova e clique em Salvar."
                : "Nenhuma senha salva ainda."}
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste rápido</CardTitle>
          <CardDescription>Envia um email usando as credenciais salvas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Para</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="destino@email.com" />
          </div>
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Corpo do Email</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          </div>

          <Button onClick={handleSendTest} disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar teste
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
