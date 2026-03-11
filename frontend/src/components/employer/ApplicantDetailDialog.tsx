import { useEffect, useState } from "react";
import type { Application } from "@/pages/employer/JobApplicants";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getCountry } from "@/lib/countries";
import { Separator } from "@/components/ui/separator";

interface Experience {
  id: string;
  company_name: string;
  job_title: string;
  duration_months: number;
  tasks_description: string | null;
}

const MATCH_COLORS: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  red: "bg-red-500/15 text-red-700 border-red-500/30",
};

// Format raw DB values into readable labels
const LABELS: Record<string, Record<string, string>> = {
  work_authorization_status: {
    outside_us: "Outside U.S.",
    us_authorized: "U.S. Authorized",
    requires_sponsorship: "Requires Sponsorship",
  },
  citizenship_status: {
    us_citizen: "U.S. Citizen",
    permanent_resident: "Permanent Resident",
    h2_applicant: "H-2 Applicant",
    other: "Other",
  },
  english_level: {
    none: "None",
    basic: "Basic",
    intermediate: "Intermediate",
    advanced: "Advanced",
    fluent: "Fluent",
  },
  drivers_license_type: {
    none: "None",
    us: "U.S. License",
    foreign: "Foreign License",
    both: "U.S. & Foreign",
  },
  application_status: {
    received: "Received",
    shortlisted: "Shortlisted",
    contacted: "Contacted",
    hired: "Hired",
    rejected: "Rejected",
  },
};

function formatValue(category: string, raw: string): string {
  return LABELS[category]?.[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  app: Application | null;
  open: boolean;
  onClose: () => void;
}

export function ApplicantDetailDialog({ app, open, onClose }: Props) {
  const [experiences, setExperiences] = useState<Experience[]>([]);

  useEffect(() => {
    if (!app) return;
    supabase
      .from("candidate_experience")
      .select("*")
      .eq("application_id", app.id)
      .then(({ data }) => setExperiences((data as Experience[]) ?? []));
  }, [app]);

  if (!app) return null;

  const Field = ({ label, value }: { label: string; value: string | number | boolean | null }) => (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{typeof value === "boolean" ? (value ? "Yes" : "No") : value ?? "—"}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {app.full_name}
            <Badge variant="outline" className={MATCH_COLORS[app.match_status ?? "yellow"]}>
              {app.application_match_score ?? 0}%
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Contact</h4>
            <Field label="Email" value={app.email} />
            <Field label="Phone" value={app.phone} />
          </div>

          <Separator />

          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Qualifications</h4>
            <Field label="Work Authorization" value={formatValue("work_authorization_status", app.work_authorization_status)} />
            <Field label="U.S. Worker" value={app.is_us_worker} />
            {app.country_code && (() => {
              const c = getCountry(app.country_code);
              return c ? <Field label="Country" value={`${c.flag} ${c.name}`} /> : <Field label="Country" value={app.country_code} />;
            })()}
            <Field label="Citizenship" value={formatValue("citizenship_status", app.citizenship_status)} />
            <Field label="Experience" value={`${app.months_experience} months`} />
            <Field label="English Level" value={formatValue("english_level", app.english_level)} />
            <Field label="Driver's License" value={formatValue("drivers_license_type", app.drivers_license_type)} />
            <Field label="H-2B Visa Count" value={app.h2b_visa_count} />
          </div>

          {experiences.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Work History</h4>
                {experiences.map((exp) => (
                  <div key={exp.id} className="p-2 border rounded-md space-y-1">
                    <p className="text-sm font-medium">{exp.job_title} — {exp.company_name}</p>
                    <p className="text-xs text-muted-foreground">{exp.duration_months} months</p>
                    {exp.tasks_description && (
                      <p className="text-xs text-muted-foreground">{exp.tasks_description}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Status</h4>
            <Field label="Application Status" value={formatValue("application_status", app.application_status)} />
            {app.rejection_reason && <Field label="Rejection Reason" value={app.rejection_reason} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
