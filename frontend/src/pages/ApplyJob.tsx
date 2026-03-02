import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Briefcase, MapPin } from "lucide-react";
import { PhoneE164Input } from "@/components/inputs/PhoneE164Input";

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

export default function ApplyJob() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    has_english: false,
    has_experience: false,
    has_license: false,
    is_in_us: false,
    citizenship_status: "other",
    // Honeypot
    company_website: "",
  });

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
            has_english: form.has_english,
            has_experience: form.has_experience,
            has_license: form.has_license,
            is_in_us: form.is_in_us,
            citizenship_status: form.citizenship_status,
            company_website: form.company_website, // honeypot
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

        {/* Application form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Apply Now</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot - hidden */}
              <input
                type="text"
                name="company_website"
                value={form.company_website}
                onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))}
                className="absolute -left-[9999px] opacity-0 h-0 w-0"
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <PhoneE164Input
                  id="apply-phone"
                  name="apply-phone"
                  defaultCountry="BR"
                  defaultValue={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Citizenship Status *</Label>
                <Select
                  value={form.citizenship_status}
                  onValueChange={(v) => setForm((p) => ({ ...p, citizenship_status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us_citizen">U.S. Citizen</SelectItem>
                    <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                    <SelectItem value="h2_visa">H-2 Visa Holder</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="font-semibold text-sm">Qualifications</h3>
                {[
                  { key: "has_english" as const, label: "I speak English", show: job.req_english },
                  { key: "has_experience" as const, label: "I have relevant work experience", show: job.req_experience },
                  { key: "has_license" as const, label: "I have a valid driver's license", show: job.req_drivers_license },
                  { key: "is_in_us" as const, label: "I am currently in the U.S.", show: job.consular_only },
                ].filter((q) => q.show).map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="font-normal text-sm">{label}</Label>
                    <Switch
                      checked={form[key]}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Application
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground text-center">
          Powered by H2 Linker • Your data is shared only with the employer
        </p>
      </div>
    </div>
  );
}
