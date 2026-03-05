import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ApplicantsTab } from "@/components/employer/ApplicantsTab";
import { RecruitmentLogTab } from "@/components/employer/RecruitmentLogTab";
import { ComplianceReportTab } from "@/components/employer/ComplianceReportTab";

export interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  citizenship_status: string;
  has_english: boolean;
  has_experience: boolean;
  has_license: boolean;
  is_in_us: boolean;
  score_color: string | null;
  employer_status: string;
  rejection_reason: string | null;
  created_at: string;
  // New structured fields
  work_authorization_status: string;
  is_us_worker: boolean;
  months_experience: number;
  english_level: string;
  drivers_license_type: string;
  h2b_visa_count: number;
  application_match_score: number | null;
  match_status: string | null;
  application_status: string;
}

export interface AuditEntry {
  id: string;
  application_id: string;
  changed_by_user_id: string;
  previous_status: string;
  new_status: string;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
}

export default function JobApplicants() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [dolCaseNumber, setDolCaseNumber] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<{
    employer_legal_name: string | null;
    city: string | null;
    state: string | null;
    hourly_wage: number | null;
    start_date: string | null;
    end_date: string | null;
    wage_rate: string | null;
  }>({} as any);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!jobId) return;
    const [jobRes, appsRes, auditRes] = await Promise.all([
      supabase.from("sponsored_jobs").select("title, dol_case_number, employer_legal_name, city, state, hourly_wage, start_date, end_date, wage_rate").eq("id", jobId).maybeSingle(),
      supabase.from("job_applications").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
      supabase.from("application_audit_log").select("*").order("created_at", { ascending: false }),
    ]);
    setJobTitle(jobRes.data?.title ?? "");
    setDolCaseNumber(jobRes.data?.dol_case_number ?? null);
    setJobDetails({
      employer_legal_name: jobRes.data?.employer_legal_name ?? null,
      city: jobRes.data?.city ?? null,
      state: jobRes.data?.state ?? null,
      hourly_wage: jobRes.data?.hourly_wage ? Number(jobRes.data.hourly_wage) : null,
      start_date: jobRes.data?.start_date ?? null,
      end_date: jobRes.data?.end_date ?? null,
      wage_rate: jobRes.data?.wage_rate ?? null,
    });
    setApps((appsRes.data as Application[]) ?? []);
    // Filter audit logs to only this job's applications
    const appIds = new Set((appsRes.data ?? []).map((a: { id: string }) => a.id));
    setAuditLogs((auditRes.data as AuditEntry[] ?? []).filter((l) => appIds.has(l.application_id)));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [jobId]);

  const handleStatusChange = async (app: Application, newStatus: string, rejectionReason?: string) => {
    if (!session?.user?.id) return;

    // Insert audit log first
    await supabase.from("application_audit_log").insert({
      application_id: app.id,
      changed_by_user_id: session.user.id,
      previous_status: app.application_status,
      new_status: newStatus,
      rejection_reason: rejectionReason || null,
    });

    // Update application
    const updateData: Record<string, string | null> = {
      application_status: newStatus,
      employer_status: newStatus === "rejected" ? "rejected" : newStatus === "hired" ? "contacted" : app.employer_status,
    };
    if (rejectionReason) updateData.rejection_reason = rejectionReason;

    await supabase.from("job_applications").update(updateData).eq("id", app.id);

    // Reload
    await loadData();
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/employer/jobs")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs
      </Button>

      <div>
        <h1 className="text-xl font-bold">{jobTitle}</h1>
        {dolCaseNumber && <p className="text-sm text-muted-foreground">DOL Case: {dolCaseNumber}</p>}
      </div>

      <Tabs defaultValue="applicants">
        <TabsList>
          <TabsTrigger value="applicants">Applicants ({apps.length})</TabsTrigger>
          <TabsTrigger value="recruitment-log">Recruitment Log</TabsTrigger>
          <TabsTrigger value="compliance-report">Compliance Report</TabsTrigger>
        </TabsList>

        <TabsContent value="applicants">
          <ApplicantsTab
            apps={apps}
            loading={loading}
            onStatusChange={handleStatusChange}
            jobId={jobId!}
          />
        </TabsContent>

        <TabsContent value="recruitment-log">
          <RecruitmentLogTab apps={apps} auditLogs={auditLogs} />
        </TabsContent>

        <TabsContent value="compliance-report">
          <ComplianceReportTab
            apps={apps}
            auditLogs={auditLogs}
            jobTitle={jobTitle}
            dolCaseNumber={dolCaseNumber}
            jobId={jobId!}
            jobDetails={jobDetails}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
