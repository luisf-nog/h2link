import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

type ResumeData = {
  name: string;
  skills: string[];
  experience_years: number;
  previous_jobs: string[];
  bio: string;
};

const emptyResume: ResumeData = {
  name: "",
  skills: [],
  experience_years: 0,
  previous_jobs: [],
  bio: "",
};

export function ResumeSettingsSection() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [resume, setResume] = useState<ResumeData>(emptyResume);

  const canLoad = useMemo(() => Boolean(profile?.id), [profile?.id]);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("resume_data").eq("id", profile.id).maybeSingle();
    if (error) {
      toast({ title: t("common.errors.save_failed"), description: error.message, variant: "destructive" });
    }
    const rd = (data as any)?.resume_data;
    if (rd && typeof rd === "object") {
      setResume({
        name: String(rd.name ?? ""),
        skills: Array.isArray(rd.skills) ? rd.skills.map(String) : [],
        experience_years: Number.isFinite(Number(rd.experience_years)) ? Number(rd.experience_years) : 0,
        previous_jobs: Array.isArray(rd.previous_jobs) ? rd.previous_jobs.map(String) : [],
        bio: String(rd.bio ?? ""),
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canLoad) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  const parseResume = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("common.errors.no_session"));

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const rd = payload?.resume_data;
      setResume({
        name: String(rd?.name ?? ""),
        skills: Array.isArray(rd?.skills) ? rd.skills.map(String) : [],
        experience_years: Number.isFinite(Number(rd?.experience_years)) ? Number(rd.experience_years) : 0,
        previous_jobs: Array.isArray(rd?.previous_jobs) ? rd.previous_jobs.map(String) : [],
        bio: String(rd?.bio ?? ""),
      });

      toast({ title: t("resume.toasts.parsed_title"), description: t("resume.toasts.parsed_desc") });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({ title: t("resume.toasts.parse_error_title"), description: message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const payload: ResumeData = {
        name: resume.name.trim(),
        skills: resume.skills.map((s) => s.trim()).filter(Boolean),
        experience_years: Math.max(0, Math.floor(Number(resume.experience_years || 0))),
        previous_jobs: resume.previous_jobs.map((s) => s.trim()).filter(Boolean),
        bio: resume.bio.trim(),
      };

      const { error } = await supabase.from("profiles").update({ resume_data: payload as any }).eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: t("resume.toasts.saved_title") });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({ title: t("resume.toasts.save_error_title"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resume.title")}</CardTitle>
        <CardDescription>{t("resume.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t("resume.upload.label")}</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={parseResume} disabled={!file || parsing}>
                  {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {t("resume.upload.actions.parse")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("resume.upload.note")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("resume.fields.name")}</Label>
                <Input value={resume.name} onChange={(e) => setResume((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("resume.fields.experience_years")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={resume.experience_years}
                  onChange={(e) => setResume((p) => ({ ...p, experience_years: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("resume.fields.skills")}</Label>
              <Input
                value={resume.skills.join(", ")}
                onChange={(e) =>
                  setResume((p) => ({
                    ...p,
                    skills: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))}
              />
              <p className="text-xs text-muted-foreground">{t("resume.fields.skills_hint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("resume.fields.previous_jobs")}</Label>
              <Input
                value={resume.previous_jobs.join(", ")}
                onChange={(e) =>
                  setResume((p) => ({
                    ...p,
                    previous_jobs: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))}
              />
              <p className="text-xs text-muted-foreground">{t("resume.fields.previous_jobs_hint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("resume.fields.bio")}</Label>
              <Textarea value={resume.bio} onChange={(e) => setResume((p) => ({ ...p, bio: e.target.value }))} rows={5} />
            </div>

            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("resume.actions.save")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
