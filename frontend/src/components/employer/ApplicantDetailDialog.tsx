import { useEffect, useState } from "react";
import type { Application } from "@/pages/employer/JobApplicants";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getCountry } from "@/lib/countries";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

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

// ─── Match Score Breakdown ─────────────────────────────────────────────────────
// Mirrors the DB function compute_match_score exactly
function computeScoreBreakdown(app: Application) {
  // Experience: 40% (0-40 points)
  let expScore = 0;
  if (app.months_experience >= 24) expScore = 40;
  else if (app.months_experience >= 12) expScore = 30;
  else if (app.months_experience >= 6) expScore = 20;
  else if (app.months_experience >= 3) expScore = 10;

  // English: 20% (0-20 points)
  let engScore = 0;
  switch (app.english_level) {
    case "fluent": engScore = 20; break;
    case "advanced": engScore = 16; break;
    case "intermediate": engScore = 12; break;
    case "basic": engScore = 6; break;
    default: engScore = 0;
  }

  // Driver's License: 15% (0-15 points)
  let licScore = 0;
  switch (app.drivers_license_type) {
    case "both": case "us": licScore = 15; break;
    case "foreign": licScore = 8; break;
    default: licScore = 0;
  }

  // Visa History: 15% (0-15 points)
  let visaScore = 0;
  if (app.h2b_visa_count >= 3) visaScore = 15;
  else if (app.h2b_visa_count >= 1) visaScore = 10;

  // Work Authorization: 10% (0-10 points)
  let authScore = 3;
  switch (app.work_authorization_status) {
    case "us_authorized": authScore = 10; break;
    case "requires_sponsorship": authScore = 5; break;
    default: authScore = 3;
  }

  const total = expScore + engScore + licScore + visaScore + authScore;

  return [
    { label: "Experience", score: expScore, max: 40, detail: `${app.months_experience} months` },
    { label: "English", score: engScore, max: 20, detail: formatValue("english_level", app.english_level) },
    { label: "Driver's License", score: licScore, max: 15, detail: formatValue("drivers_license_type", app.drivers_license_type) },
    { label: "H-2 Visa History", score: visaScore, max: 15, detail: `${app.h2b_visa_count} previous visa(s)` },
    { label: "Work Auth", score: authScore, max: 10, detail: formatValue("work_authorization_status", app.work_authorization_status) },
    { label: "Total", score: total, max: 100, detail: "" },
  ];
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

  const breakdown = computeScoreBreakdown(app);
  const country = getCountry(app.country_code);

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
            {country && (
              country.code !== "OTHER" ? (
                <img src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} alt={country.name} className="w-6 h-auto rounded-sm" />
              ) : (
                <span className="text-lg">🌍</span>
              )
            )}
            {app.full_name}
            <Badge variant="outline" className={MATCH_COLORS[app.match_status ?? "yellow"]}>
              {app.application_match_score ?? 0}%
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Match Score Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Match Score Breakdown</h4>
            <div className="space-y-1.5">
              {breakdown.slice(0, -1).map((item) => (
                <div key={item.label} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">
                      {item.score}/{item.max}
                      <span className="text-muted-foreground ml-1.5">({item.detail})</span>
                    </span>
                  </div>
                  <Progress value={(item.score / item.max) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Contact</h4>
            <Field label="Email" value={app.email} />
            <Field label="Phone" value={app.phone} />
            {country && <Field label="Country" value={`${country.flag} ${country.name}`} />}
          </div>

          <Separator />

          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Qualifications</h4>
            <Field label="Work Authorization" value={formatValue("work_authorization_status", app.work_authorization_status)} />
            <Field label="U.S. Worker" value={app.is_us_worker} />
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
