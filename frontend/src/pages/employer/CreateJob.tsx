import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

export default function CreateJob() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_date: "",
    end_date: "",
    req_english: false,
    req_experience: false,
    req_drivers_license: false,
    consular_only: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employerProfile) return;

    setLoading(true);

    // Check job limit
    const { data: canCreate } = await supabase.rpc("check_employer_job_limit", {
      p_employer_id: employerProfile.id,
    });

    if (!canCreate) {
      toast({ title: "Job limit reached", description: "Upgrade your plan to post more jobs." });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("sponsored_jobs").insert({
      employer_id: employerProfile.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      req_english: form.req_english,
      req_experience: form.req_experience,
      req_drivers_license: form.req_drivers_license,
      consular_only: form.consular_only,
      priority_level: employerProfile.tier,
    });

    if (error) {
      toast({ title: "Error", description: error.message });
    } else {
      toast({ title: "Job created!", description: "Your posting is now live." });
      navigate("/employer/jobs");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/employer/jobs")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Jobs
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create Job Posting</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Job Title *</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Farmworkers and Laborers"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Job duties, requirements, benefits..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="City, State"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="font-semibold text-sm">Screening Requirements</h3>
              {[
                { key: "req_english" as const, label: "English proficiency required" },
                { key: "req_experience" as const, label: "Prior experience required" },
                { key: "req_drivers_license" as const, label: "Driver's license required" },
                { key: "consular_only" as const, label: "Consular processing only (not in US)" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="font-normal">{label}</Label>
                  <Switch
                    checked={form[key]}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              ⚠️ Compliance notice: Screening criteria must align with your DOL-approved job order.
              Do not use requirements to discriminate against protected classes.
            </p>

            <Button type="submit" className="w-full" disabled={loading || !form.title.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publish Job
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
