import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Users, Plus, AlertTriangle } from "lucide-react";
import { getTierJobLimit } from "@/config/employer-plans.config";
import { useTranslation } from "react-i18next";

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { t } = useTranslation();
  const [activeJobs, setActiveJobs] = useState(0);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employerProfile) return;
    const load = async () => {
      const [jobsRes, appsRes] = await Promise.all([
        supabase
          .from("sponsored_jobs")
          .select("id", { count: "exact", head: true })
          .eq("employer_id", employerProfile.id)
          .eq("is_active", true),
        supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true })
          .in(
            "job_id",
            (
              await supabase
                .from("sponsored_jobs")
                .select("id")
                .eq("employer_id", employerProfile.id)
            ).data?.map((j) => j.id) ?? [],
          ),
      ]);
      setActiveJobs(jobsRes.count ?? 0);
      setTotalApplicants(appsRes.count ?? 0);
      setLoading(false);
    };
    load();
  }, [employerProfile]);

  const isInactive = employerProfile?.status === "inactive";
  const jobLimit = employerProfile ? getTierJobLimit(employerProfile.tier) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-brand">{t("employer.dashboard.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {employerProfile?.company_name ?? ""}
            {employerProfile && (
              <Badge variant="outline" className="ml-2 capitalize">
                {employerProfile.tier}
              </Badge>
            )}
          </p>
        </div>
        <Button
          onClick={() => navigate("/employer/jobs/new")}
          disabled={isInactive || activeJobs >= jobLimit}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("employer.dashboard.post_job")}
        </Button>
      </div>

      {isInactive && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">{t("employer.dashboard.subscription_inactive")}</p>
              <p className="text-sm text-muted-foreground">
                {t("employer.dashboard.subscription_inactive_desc")}
              </p>
            </div>
            <Button variant="destructive" onClick={() => navigate("/employer/plans")}>
              {t("employer.dashboard.reactivate")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/employer/jobs")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("employer.dashboard.active_jobs")}</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading ? "…" : activeJobs}
              <span className="text-lg text-muted-foreground font-normal"> / {jobLimit}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("employer.dashboard.total_applicants")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "…" : totalApplicants}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
