import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
  req_english: boolean;
  req_experience: boolean;
  req_drivers_license: boolean;
  consular_only: boolean;
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
    // Structured fields
    work_authorization_status: "outside_us",
    is_us_worker: false,
    months_experience: 0,
    english_level: "none",
    drivers_license_type: "none",
    h2b_visa_count: 0,
    citizenship_status: "other",
    // Honeypot
    company_website: "",
  });

  const [experiences, setExperiences] = useState<WorkExperience[]>([emptyExperience()]);

  useEffect(() => {
    if (!jobId) return;
    supabase
      .from("sponsored_jobs")
      .select("id, title, description, location, req_english, req_experience, req_drivers_license, consular_only")
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
  const isStep2Valid = true; // All have defaults
  const isStep3Valid = experiences.every((e) => e.company_name.trim() && e.job_title.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;
    setSubmitting(true);
    setError("");

    try {
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
            work_authorization_status: form.work_authorization_status,
            is_us_worker: form.is_us_worker,
            months_experience: form.months_experience,
            english_level: form.english_level,
            drivers_license_type: form.drivers_license_type,
            h2b_visa_count: form.h2b_visa_count,
            citizenship_status: form.citizenship_status,
            // Legacy compat
            has_english: form.english_level !== "none",
            has_experience: form.months_experience > 0,
            has_license: form.drivers_license_type !== "none",
            is_in_us: form.work_authorization_status === "us_authorized",
            experiences: experiences.filter((e) => e.company_name.trim()),
            honeypot: form.company_website,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
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
            <p className="text-lg font-semibold">Job Not Found</p>
            <p className="text-muted-foreground text-sm mt-1">This posting may have been removed or is no longer active.</p>
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
            <h2 className="text-xl font-bold">Application Submitted!</h2>
            <p className="text-muted-foreground text-sm">
              Thank you for applying. The employer will review your application and may contact you directly.
            </p>
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
                <CardTitle className="text-lg">Step 1 — Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input required value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <PhoneE164Input id="apply-phone" name="apply-phone" defaultCountry="BR" defaultValue={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Work Authorization Status *</Label>
                  <Select value={form.work_authorization_status} onValueChange={(v) => setForm((p) => ({ ...p, work_authorization_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us_authorized">U.S. Work Authorized</SelectItem>
                      <SelectItem value="requires_sponsorship">Requires Sponsorship</SelectItem>
                      <SelectItem value="outside_us">Outside the U.S.</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                    Eligibility to obtain an H-2 visa does not qualify as current U.S. work authorization.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Are you a U.S. Worker? *</Label>
                  <Select value={form.is_us_worker ? "yes" : "no"} onValueChange={(v) => setForm((p) => ({ ...p, is_us_worker: v === "yes" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Citizenship Status *</Label>
                  <Select value={form.citizenship_status} onValueChange={(v) => setForm((p) => ({ ...p, citizenship_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us_citizen">U.S. Citizen</SelectItem>
                      <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                      <SelectItem value="h2_visa">H-2 Visa Holder</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="button" className="w-full" disabled={!isStep1Valid} onClick={() => setStep(2)}>
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: Qualifications */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 2 — Qualifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Months of Experience in This Occupation *</Label>
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    value={form.months_experience}
                    onChange={(e) => setForm((p) => ({ ...p, months_experience: Math.max(0, parseInt(e.target.value) || 0) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>English Level *</Label>
                  <Select value={form.english_level} onValueChange={(v) => setForm((p) => ({ ...p, english_level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="fluent">Fluent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Driver's License *</Label>
                  <Select value={form.drivers_license_type} onValueChange={(v) => setForm((p) => ({ ...p, drivers_license_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="us">U.S. License</SelectItem>
                      <SelectItem value="foreign">Foreign License</SelectItem>
                      <SelectItem value="both">Both (U.S. + Foreign)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Total H-2B Visas Obtained</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={form.h2b_visa_count}
                    onChange={(e) => setForm((p) => ({ ...p, h2b_visa_count: Math.max(0, parseInt(e.target.value) || 0) }))}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button type="button" className="flex-1" disabled={!isStep2Valid} onClick={() => setStep(3)}>Continue</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Work History */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 3 — Work History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {experiences.map((exp, i) => (
                  <div key={i} className="space-y-3 p-3 border rounded-lg relative">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Experience #{i + 1}</span>
                      {experiences.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeExperience(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Company Name *</Label>
                      <Input value={exp.company_name} onChange={(e) => updateExperience(i, "company_name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Job Title *</Label>
                      <Input value={exp.job_title} onChange={(e) => updateExperience(i, "job_title", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (months)</Label>
                      <Input type="number" min={0} value={exp.duration_months} onChange={(e) => updateExperience(i, "duration_months", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tasks / Responsibilities</Label>
                      <Textarea rows={2} value={exp.tasks_description} onChange={(e) => updateExperience(i, "tasks_description", e.target.value)} />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addExperience}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Experience
                </Button>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" className="flex-1" disabled={submitting || !isStep3Valid}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>

        <p className="text-[10px] text-muted-foreground text-center">
          Powered by H2 Linker • Your data is shared only with the employer
        </p>
      </div>
    </div>
  );
}
