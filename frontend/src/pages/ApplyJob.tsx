import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Briefcase, MapPin, Plus, Trash2, AlertTriangle } from "lucide-react";
import { PhoneE164Input } from "@/components/inputs/PhoneE164Input";
import { Separator } from "@/components/ui/separator";

interface JobInfo {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  english_proficiency: string | null;
  prior_experience_required: boolean | null;
  drivers_license: string | null;
}

interface WorkExperience {
  company_name: string;
  job_title: string;
  duration_months: number;
  tasks_description: string;
}

const emptyExperience = (): WorkExperience => ({
  company_name: "",
  job_title: "",
  duration_months: 0,
  tasks_description: "",
});

export default function ApplyJob() {
  const { jobId } = useParams<{ jobId: string }>();
  const { t } = useTranslation();
  const [job, setJob] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    candidate_status: "outside_us" as string,
    months_experience: 0,
    english_level: "none",
    drivers_license_type: "none",
    h2b_visa_count: 0,
    company_website: "",
  });

  const [experiences, setExperiences] = useState<WorkExperience[]>([emptyExperience()]);

  useEffect(() => {
    if (!jobId) return;
    supabase
      .from("sponsored_jobs")
      .select("id, title, description, location, english_proficiency, prior_experience_required, drivers_license")
      .eq("id", jobId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        setJob(data as JobInfo | null);
        setLoading(false);
      });
  }, [jobId]);

  const addExperience = () => setExperiences((p) => [...p, emptyExperience()]);
  const removeExperience = (i: number) => {
    if (experiences.length <= 1) return;
    setExperiences((p) => p.filter((_, idx) => idx !== i));
  };
  const updateExperience = (i: number, field: keyof WorkExperience, value: string | number) => {
    setExperiences((p) => p.map((exp, idx) => (idx === i ? { ...exp, [field]: value } : exp)));
  };

  const isStep1Valid = form.full_name.trim() && form.email.trim();
  const isStep2Valid = true;
  const isStep3Valid = experiences.every((e) => {
    const hasAnyField = e.company_name.trim() || e.job_title.trim();
    if (!hasAnyField) return true;
    return e.company_name.trim() && e.job_title.trim();
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;
    setSubmitting(true);
    setError("");

    try {
      // Derive legacy fields from consolidated candidate_status
      const status = form.candidate_status;
      const is_in_us = status !== "outside_us";
      const is_us_worker = status === "in_us_authorized" || status === "us_citizen";
      const work_authorization_status = status === "us_citizen" ? "us_authorized"
        : status === "in_us_authorized" ? "us_authorized"
        : status === "in_us_h2" ? "requires_sponsorship"
        : "outside_us";
      const citizenship_status = status === "us_citizen" ? "us_citizen"
        : status === "in_us_h2" ? "h2_visa"
        : "other";

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-application`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: jobId,
            full_name: form.full_name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim() || null,
            work_authorization_status,
            is_us_worker,
            months_experience: form.months_experience,
            english_level: form.english_level,
            drivers_license_type: form.drivers_license_type,
            h2b_visa_count: form.h2b_visa_count,
            citizenship_status,
            has_english: form.english_level !== "none",
            has_experience: form.months_experience > 0,
            has_license: form.drivers_license_type !== "none",
            is_in_us,
            experiences: experiences.filter((e) => e.company_name.trim()),
            honeypot: form.company_website,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("apply.errors.generic"));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t("apply.errors.network"));
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold">{t("apply.not_found_title")}</p>
            <p className="text-muted-foreground text-sm mt-1">{t("apply.not_found_desc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-bold">{t("apply.success_title")}</h2>
            <p className="text-muted-foreground text-sm">{t("apply.success_desc")}</p>
            <Separator />
            <p className="text-sm text-muted-foreground">{t("apply.success_browse")}</p>
            <Button className="w-full font-bold h-11" onClick={() => window.location.href = "/jobs"}>
              <Briefcase className="h-4 w-4 mr-2" /> {t("apply.view_more_jobs")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-lg space-y-4">
        {/* Job info */}
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{job.title}</h2>
            </div>
            {job.location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </p>
            )}
            {job.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{job.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Step indicator */}
        <div className="flex items-center gap-2 justify-center">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-primary" : s < step ? "w-8 bg-primary/40" : "w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Honeypot */}
          <input
            type="text"
            name="company_website"
            value={form.company_website}
            onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))}
            className="absolute -left-[9999px] opacity-0 h-0 w-0"
            tabIndex={-1}
            autoComplete="off"
          />

          {/* STEP 1: Personal Info */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("apply.step1_title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("apply.full_name")} *</Label>
                  <Input required value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("apply.email")} *</Label>
                  <Input type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("apply.phone")}</Label>
                  <PhoneE164Input id="apply-phone" name="apply-phone" defaultCountry="BR" defaultValue={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t("apply.work_auth_status")} *</Label>
                  <Select value={form.work_authorization_status} onValueChange={(v) => setForm((p) => ({ ...p, work_authorization_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us_authorized">{t("apply.work_auth_us")}</SelectItem>
                      <SelectItem value="requires_sponsorship">{t("apply.work_auth_sponsorship")}</SelectItem>
                      <SelectItem value="outside_us">{t("apply.work_auth_outside")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                    {t("apply.work_auth_warning")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("apply.is_us_worker")} *</Label>
                  <Select value={form.is_us_worker ? "yes" : "no"} onValueChange={(v) => setForm((p) => ({ ...p, is_us_worker: v === "yes" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t("common.yes")}</SelectItem>
                      <SelectItem value="no">{t("common.no")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("apply.citizenship_status")} *</Label>
                  <Select value={form.citizenship_status} onValueChange={(v) => setForm((p) => ({ ...p, citizenship_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us_citizen">{t("apply.citizen_us")}</SelectItem>
                      <SelectItem value="permanent_resident">{t("apply.citizen_permanent")}</SelectItem>
                      <SelectItem value="h2_visa">{t("apply.citizen_h2")}</SelectItem>
                      <SelectItem value="other">{t("apply.citizen_other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="button" className="w-full" disabled={!isStep1Valid} onClick={() => setStep(2)}>
                  {t("apply.continue")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: Qualifications */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("apply.step2_title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("apply.months_experience")} *</Label>
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    value={form.months_experience}
                    onChange={(e) => setForm((p) => ({ ...p, months_experience: Math.max(0, parseInt(e.target.value) || 0) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("apply.english_level")} *</Label>
                  <Select value={form.english_level} onValueChange={(v) => setForm((p) => ({ ...p, english_level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("apply.english_none")}</SelectItem>
                      <SelectItem value="basic">{t("apply.english_basic")}</SelectItem>
                      <SelectItem value="intermediate">{t("apply.english_intermediate")}</SelectItem>
                      <SelectItem value="advanced">{t("apply.english_advanced")}</SelectItem>
                      <SelectItem value="fluent">{t("apply.english_fluent")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("apply.drivers_license")} *</Label>
                  <Select value={form.drivers_license_type} onValueChange={(v) => setForm((p) => ({ ...p, drivers_license_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("apply.license_none")}</SelectItem>
                      <SelectItem value="us">{t("apply.license_us")}</SelectItem>
                      <SelectItem value="foreign">{t("apply.license_foreign")}</SelectItem>
                      <SelectItem value="both">{t("apply.license_both")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("apply.h2b_visa_count")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={form.h2b_visa_count}
                    onChange={(e) => setForm((p) => ({ ...p, h2b_visa_count: Math.max(0, parseInt(e.target.value) || 0) }))}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("apply.back")}</Button>
                  <Button type="button" className="flex-1" disabled={!isStep2Valid} onClick={() => setStep(3)}>{t("apply.continue")}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Work History (Optional) */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("apply.step3_title")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("apply.step3_desc")}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {experiences.map((exp, i) => (
                  <div key={i} className="space-y-3 p-3 border rounded-lg relative">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{t("apply.experience_number", { num: i + 1 })}</span>
                      {experiences.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeExperience(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t("apply.company_name")}</Label>
                      <Input placeholder={t("apply.leave_blank")} value={exp.company_name} onChange={(e) => updateExperience(i, "company_name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("apply.job_title")}</Label>
                      <Input placeholder={t("apply.leave_blank")} value={exp.job_title} onChange={(e) => updateExperience(i, "job_title", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("apply.duration_months")}</Label>
                      <Input type="number" min={0} value={exp.duration_months} onChange={(e) => updateExperience(i, "duration_months", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("apply.tasks")}</Label>
                      <Textarea rows={2} value={exp.tasks_description} onChange={(e) => updateExperience(i, "tasks_description", e.target.value)} />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addExperience}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {t("apply.add_experience")}
                </Button>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>{t("apply.back")}</Button>
                  <Button type="submit" className="flex-1" disabled={submitting || !isStep3Valid}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("apply.submit")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>

        <p className="text-[10px] text-muted-foreground text-center">
          {t("apply.powered_by")}
        </p>
      </div>
    </div>
  );
}
