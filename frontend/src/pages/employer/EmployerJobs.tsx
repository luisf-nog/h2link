import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Eye, MapPin, Calendar, TrendingUp, AlertCircle, Mail } from "lucide-react";
import { getTierJobLimit } from "@/config/employer-plans.config";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface SponsoredJob {
  id: string;
  title: string;
  location: string | null;
  is_active: boolean;
  view_count: number;
  click_count: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  _app_count?: number;
  _new_app_count?: number;
}

export default function EmployerJobs() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<SponsoredJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employerProfile) return;
    const load = async () => {
      const { data } = await supabase
        .from("sponsored_jobs")
        .select("*")
        .eq("employer_id", employerProfile.id)
        .order("created_at", { ascending: false });

      if (data) {
        const jobIds = data.map((j) => j.id);
        const { data: apps } = await supabase
          .from("job_applications")
          .select("job_id, employer_status")
          .in("job_id", jobIds);

        const countMap: Record<string, { total: number; new: number }> = {};
        apps?.forEach((a) => {
          if (!countMap[a.job_id]) countMap[a.job_id] = { total: 0, new: 0 };
          countMap[a.job_id].total += 1;
          if (a.employer_status === "new") countMap[a.job_id].new += 1;
        });

        setJobs(
          data.map((j) => ({
            ...j,
            _app_count: countMap[j.id]?.total || 0,
            _new_app_count: countMap[j.id]?.new || 0,
          })),
        );
      }
      setLoading(false);
    };
    load();
  }, [employerProfile]);

  const activeCount = jobs.filter((j) => j.is_active).length;
  const jobLimit = employerProfile ? getTierJobLimit(employerProfile.tier) : 0;
  const canCreate = activeCount < jobLimit && employerProfile?.status === "active";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-brand text-foreground">{t("employer.jobs.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("employer.jobs.active_count", { count: activeCount, limit: jobLimit })}
          </p>

          {!canCreate && employerProfile?.status === "active" && (
            <div className="flex items-center gap-2 mt-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
              <AlertCircle className="h-4 w-4" />
              <span>{t("employer.jobs.plan_limit")}</span>
            </div>
          )}
        </div>

        <Button
          onClick={() => navigate("/employer/jobs/new")}
          disabled={!canCreate}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("employer.jobs.post_job")}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("employer.jobs.no_jobs_title")}</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {t("employer.jobs.no_jobs_desc")}
            </p>
            <Button onClick={() => navigate("/employer/jobs/new")} disabled={!canCreate} className="mt-4">
              {t("employer.jobs.create_first")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const conversionRate =
              job.view_count > 0 ? (((job._app_count || 0) / job.view_count) * 100).toFixed(1) : "0.0";

            return (
              <Card
                key={job.id}
                className="cursor-pointer hover:shadow-md hover:border-muted-foreground/30 transition-all group"
                onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {job.title}
                      </span>
                      <Badge
                        variant={job.is_active ? "default" : "secondary"}
                        className={job.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {job.is_active ? t("employer.jobs.active") : t("employer.jobs.inactive")}
                      </Badge>

                      {job._new_app_count && job._new_app_count > 0 ? (
                        <Badge variant="destructive" className="bg-primary">
                          {t("employer.jobs.new_badge", { count: job._new_app_count })}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {job.created_at ? format(new Date(job.created_at), "MMM d, yyyy") : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm shrink-0 bg-muted p-2 rounded-lg border border-border">
                    <div className="text-center px-2">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                        <Eye className="h-4 w-4" />
                        <span className="font-medium text-foreground">{job.view_count}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("employer.jobs.views")}</div>
                    </div>

                    <div className="w-px h-8 bg-border"></div>

                    <div className="text-center px-2">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium text-foreground">{conversionRate}%</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("employer.jobs.conv_rate")}</div>
                    </div>

                    <div className="w-px h-8 bg-border"></div>

                    <div className="text-center px-2">
                      <div className="flex items-center gap-1.5 font-semibold text-primary mb-0.5">
                        <Users className="h-4 w-4" />
                        <span>{job._app_count ?? 0}</span>
                      </div>
                      <div className="text-[10px] text-primary/60 uppercase tracking-wider">{t("employer.jobs.applicants")}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {jobs.length > 0 && (
            <div className="pt-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              {t("employer.jobs.enterprise_cta")}{" "}
              <a href="mailto:help@h2linker.com" className="text-primary hover:underline font-medium">
                {t("employer.jobs.enterprise_link")}
              </a>
              .
            </div>
          )}
        </div>
      )}
    </div>
  );
}
