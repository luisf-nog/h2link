import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  Users,
  Plus,
  AlertTriangle,
  UserCheck,
  Clock,
  Star,
  TrendingUp,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { getTierJobLimit } from "@/config/employer-plans.config";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

interface DashboardMetrics {
  activeJobs: number;
  totalApplicants: number;
  usWorkers: number;
  newApplicants: number;
  shortlisted: number;
  hired: number;
  rejected: number;
  avgMatchScore: number;
  totalViews: number;
  totalClicks: number;
}

async function fetchDashboardMetrics(employerId: string): Promise<DashboardMetrics> {
  // 1. Jobs
  const [activeJobsRes, allJobsRes] = await Promise.all([
    supabase
      .from("sponsored_jobs")
      .select("id", { count: "exact", head: true })
      .eq("employer_id", employerId)
      .eq("is_active", true),
    supabase
      .from("sponsored_jobs")
      .select("id, view_count, click_count")
      .eq("employer_id", employerId),
  ]);

  const jobIds = allJobsRes.data?.map((j) => j.id) ?? [];
  const totalViews = allJobsRes.data?.reduce((s, j) => s + (j.view_count ?? 0), 0) ?? 0;
  const totalClicks = allJobsRes.data?.reduce((s, j) => s + (j.click_count ?? 0), 0) ?? 0;

  if (jobIds.length === 0) {
    return {
      activeJobs: activeJobsRes.count ?? 0,
      totalApplicants: 0,
      usWorkers: 0,
      newApplicants: 0,
      shortlisted: 0,
      hired: 0,
      rejected: 0,
      avgMatchScore: 0,
      totalViews,
      totalClicks,
    };
  }

  // 2. Applications — fetch relevant fields (limit-safe: paginate if needed)
  const { data: apps } = await supabase
    .from("job_applications")
    .select("application_status, work_authorization_status, application_match_score")
    .in("job_id", jobIds);

  const allApps = apps ?? [];
  const usWorkers = allApps.filter((a) => a.work_authorization_status !== "outside_us").length;
  const newApps = allApps.filter((a) => a.application_status === "received").length;
  const shortlisted = allApps.filter((a) => a.application_status === "shortlisted").length;
  const hired = allApps.filter((a) => a.application_status === "hired").length;
  const rejected = allApps.filter((a) => a.application_status === "rejected").length;
  const scores = allApps.map((a) => a.application_match_score ?? 0).filter((s) => s > 0);
  const avgMatchScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return {
    activeJobs: activeJobsRes.count ?? 0,
    totalApplicants: allApps.length,
    usWorkers,
    newApplicants: newApps,
    shortlisted,
    hired,
    rejected,
    avgMatchScore,
    totalViews,
    totalClicks,
  };
}

function MetricCard({
  title,
  value,
  icon: Icon,
  loading,
  subtitle,
  onClick,
  highlight,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading: boolean;
  subtitle?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${highlight ? "border-primary/30 bg-primary/5" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { t } = useTranslation();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["employer-dashboard", employerProfile?.id],
    queryFn: () => fetchDashboardMetrics(employerProfile!.id),
    enabled: !!employerProfile?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const m = metrics ?? {
    activeJobs: 0,
    totalApplicants: 0,
    usWorkers: 0,
    newApplicants: 0,
    shortlisted: 0,
    hired: 0,
    rejected: 0,
    avgMatchScore: 0,
    totalViews: 0,
    totalClicks: 0,
  };

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
          disabled={isInactive || m.activeJobs >= jobLimit}
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

      {/* Primary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title={t("employer.dashboard.active_jobs")}
          value={`${m.activeJobs} / ${jobLimit}`}
          icon={Briefcase}
          loading={isLoading}
          onClick={() => navigate("/employer/jobs")}
        />
        <MetricCard
          title={t("employer.dashboard.total_applicants")}
          value={m.totalApplicants}
          icon={Users}
          loading={isLoading}
        />
        <MetricCard
          title="US Workers"
          value={m.usWorkers}
          icon={UserCheck}
          loading={isLoading}
          subtitle={m.totalApplicants > 0 ? `${Math.round((m.usWorkers / m.totalApplicants) * 100)}% of total` : undefined}
        />
        <MetricCard
          title="Avg Match Score"
          value={m.avgMatchScore > 0 ? `${m.avgMatchScore}%` : "—"}
          icon={Star}
          loading={isLoading}
        />
      </div>

      {/* Pipeline metrics */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Recruitment Pipeline
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="New / Pending"
            value={m.newApplicants}
            icon={Clock}
            loading={isLoading}
            highlight={m.newApplicants > 0}
            subtitle={m.newApplicants > 0 ? "Needs review" : undefined}
          />
          <MetricCard
            title="Shortlisted"
            value={m.shortlisted}
            icon={TrendingUp}
            loading={isLoading}
          />
          <MetricCard
            title="Hired"
            value={m.hired}
            icon={CheckCircle2}
            loading={isLoading}
          />
          <MetricCard
            title="Rejected"
            value={m.rejected}
            icon={AlertTriangle}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Engagement metrics */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Job Posting Performance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Views"
            value={m.totalViews}
            icon={Eye}
            loading={isLoading}
          />
          <MetricCard
            title="Total Clicks"
            value={m.totalClicks}
            icon={TrendingUp}
            loading={isLoading}
          />
          <MetricCard
            title="Click-through Rate"
            value={m.totalViews > 0 ? `${Math.round((m.totalClicks / m.totalViews) * 100)}%` : "—"}
            icon={TrendingUp}
            loading={isLoading}
            subtitle={m.totalViews > 0 ? `${m.totalClicks} of ${m.totalViews} views` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
