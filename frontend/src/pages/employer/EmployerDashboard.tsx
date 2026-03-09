import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase, Users, Plus, AlertTriangle, UserCheck, Star, TrendingUp, Eye, CheckCircle2, ArrowRight,
} from "lucide-react";
import { getTierJobLimit } from "@/config/employer-plans.config";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  activeJobs: number;
  totalApplicants: number;
  usWorkers: number;
  pipeline: { name: string; value: number; color: string }[];
  scoreDistribution: { range: string; count: number }[];
  avgMatchScore: number;
  totalViews: number;
  totalClicks: number;
  recentApplicants: {
    id: string;
    full_name: string;
    email: string;
    application_status: string;
    application_match_score: number | null;
    created_at: string;
    work_authorization_status: string;
  }[];
  jobPerformance: {
    id: string;
    title: string;
    is_active: boolean;
    view_count: number;
    click_count: number;
    applicant_count: number;
  }[];
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchDashboard(employerId: string): Promise<DashboardData> {
  const [activeJobsRes, allJobsRes] = await Promise.all([
    supabase
      .from("sponsored_jobs")
      .select("id", { count: "exact", head: true })
      .eq("employer_id", employerId)
      .eq("is_active", true),
    supabase
      .from("sponsored_jobs")
      .select("id, title, is_active, view_count, click_count")
      .eq("employer_id", employerId),
  ]);

  const jobs = allJobsRes.data ?? [];
  const jobIds = jobs.map((j) => j.id);
  const totalViews = jobs.reduce((s, j) => s + (j.view_count ?? 0), 0);
  const totalClicks = jobs.reduce((s, j) => s + (j.click_count ?? 0), 0);

  const empty: DashboardData = {
    activeJobs: activeJobsRes.count ?? 0,
    totalApplicants: 0, usWorkers: 0,
    pipeline: [], scoreDistribution: [], avgMatchScore: 0,
    totalViews, totalClicks, recentApplicants: [], jobPerformance: [],
  };

  if (jobIds.length === 0) return empty;

  const { data: apps } = await supabase
    .from("job_applications")
    .select("id, full_name, email, application_status, work_authorization_status, application_match_score, created_at, job_id")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  const allApps = apps ?? [];

  // Pipeline
  const statusMap: Record<string, { label: string; color: string }> = {
    received: { label: "New", color: "hsl(215, 78%, 18%)" },
    contacted: { label: "Contacted", color: "hsl(198, 80%, 40%)" },
    shortlisted: { label: "Shortlisted", color: "hsl(45, 90%, 50%)" },
    interview_scheduled: { label: "Interview", color: "hsl(30, 80%, 55%)" },
    hired: { label: "Hired", color: "hsl(142, 60%, 40%)" },
    rejected: { label: "Rejected", color: "hsl(0, 65%, 50%)" },
  };

  const pipelineCounts: Record<string, number> = {};
  allApps.forEach((a) => {
    const key = a.application_status;
    pipelineCounts[key] = (pipelineCounts[key] || 0) + 1;
  });

  const pipeline = Object.entries(statusMap).map(([key, { label, color }]) => ({
    name: label,
    value: pipelineCounts[key] || 0,
    color,
  }));

  // Score distribution
  const scoreBuckets = [
    { range: "0–30", min: 0, max: 30, count: 0 },
    { range: "31–50", min: 31, max: 50, count: 0 },
    { range: "51–70", min: 51, max: 70, count: 0 },
    { range: "71–85", min: 71, max: 85, count: 0 },
    { range: "86–100", min: 86, max: 100, count: 0 },
  ];
  allApps.forEach((a) => {
    const s = a.application_match_score ?? 0;
    for (const b of scoreBuckets) {
      if (s >= b.min && s <= b.max) { b.count++; break; }
    }
  });

  const scores = allApps.map((a) => a.application_match_score ?? 0).filter((s) => s > 0);
  const avgMatchScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // US Workers
  const usWorkers = allApps.filter((a) => a.work_authorization_status !== "outside_us").length;

  // Recent applicants (top 8)
  const recentApplicants = allApps.slice(0, 8).map((a) => ({
    id: a.id,
    full_name: a.full_name,
    email: a.email,
    application_status: a.application_status,
    application_match_score: a.application_match_score,
    created_at: a.created_at,
    work_authorization_status: a.work_authorization_status,
  }));

  // Job performance
  const appCountByJob: Record<string, number> = {};
  allApps.forEach((a) => { appCountByJob[a.job_id] = (appCountByJob[a.job_id] || 0) + 1; });

  const jobPerformance = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    is_active: j.is_active,
    view_count: j.view_count ?? 0,
    click_count: j.click_count ?? 0,
    applicant_count: appCountByJob[j.id] || 0,
  }));

  return {
    activeJobs: activeJobsRes.count ?? 0,
    totalApplicants: allApps.length,
    usWorkers,
    pipeline,
    scoreDistribution: scoreBuckets.map(({ range, count }) => ({ range, count })),
    avgMatchScore,
    totalViews, totalClicks,
    recentApplicants,
    jobPerformance,
  };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, loading, onClick, accent }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; loading: boolean; onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <Card className={`${onClick ? "cursor-pointer hover:shadow-md" : ""} transition-shadow`} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : (
              <p className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</p>
            )}
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`h-5 w-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status badge helper ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  received: "bg-muted text-muted-foreground",
  contacted: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  shortlisted: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  hired: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-700 border-red-500/20",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.received;
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${style}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["employer-dashboard", employerProfile?.id],
    queryFn: () => fetchDashboard(employerProfile!.id),
    enabled: !!employerProfile?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const m = data ?? {
    activeJobs: 0, totalApplicants: 0, usWorkers: 0,
    pipeline: [], scoreDistribution: [], avgMatchScore: 0,
    totalViews: 0, totalClicks: 0, recentApplicants: [], jobPerformance: [],
  };

  const isInactive = employerProfile?.status === "inactive";
  const jobLimit = employerProfile ? getTierJobLimit(employerProfile.tier) : 0;
  const ctr = m.totalViews > 0 ? Math.round((m.totalClicks / m.totalViews) * 100) : 0;
  const usPercent = m.totalApplicants > 0 ? Math.round((m.usWorkers / m.totalApplicants) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-brand">{t("employer.dashboard.title")}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            {employerProfile?.company_name ?? ""}
            {employerProfile && (
              <Badge variant="outline" className="capitalize">{employerProfile.tier}</Badge>
            )}
          </p>
        </div>
        <Button onClick={() => navigate("/employer/jobs/new")} disabled={isInactive || m.activeJobs >= jobLimit}>
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
              <p className="text-sm text-muted-foreground">{t("employer.dashboard.subscription_inactive_desc")}</p>
            </div>
            <Button variant="destructive" onClick={() => navigate("/employer/plans")}>{t("employer.dashboard.reactivate")}</Button>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title={t("employer.dashboard.active_jobs")} value={`${m.activeJobs}/${jobLimit}`}
          icon={Briefcase} loading={isLoading} onClick={() => navigate("/employer/jobs")} accent />
        <KpiCard title="Total Applicants" value={m.totalApplicants} icon={Users} loading={isLoading} />
        <KpiCard title="US Workers" value={m.usWorkers} icon={UserCheck} loading={isLoading}
          subtitle={m.totalApplicants > 0 ? `${usPercent}% of applicants` : undefined} />
        <KpiCard title="Avg Match" value={m.avgMatchScore > 0 ? `${m.avgMatchScore}%` : "—"}
          icon={Star} loading={isLoading} accent />
        <KpiCard title="CTR" value={`${ctr}%`} icon={Eye} loading={isLoading}
          subtitle={`${m.totalClicks} clicks / ${m.totalViews} views`} />
      </div>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline funnel bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recruitment Pipeline</CardTitle>
            <CardDescription className="text-xs">Applicants by status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={m.pipeline} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [v, "Applicants"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {m.pipeline.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Score distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Match Score Distribution</CardTitle>
            <CardDescription className="text-xs">Applicant quality breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={m.scoreDistribution} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [v, "Applicants"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                    {m.scoreDistribution.map((_, i) => {
                      const colors = ["hsl(0,65%,50%)", "hsl(25,80%,50%)", "hsl(45,90%,48%)", "hsl(142,50%,45%)", "hsl(142,60%,35%)"];
                      return <Cell key={i} fill={colors[i]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tables Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent applicants */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Applicants</CardTitle>
              {m.jobPerformance.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                  const firstJob = m.jobPerformance[0];
                  if (firstJob) navigate(`/employer/jobs/${firstJob.id}/applicants`);
                }}>
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : m.recentApplicants.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No applicants yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Match</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.recentApplicants.map((a) => (
                    <TableRow key={a.id} className="text-xs">
                      <TableCell className="font-medium py-2">
                        <div>
                          {a.full_name}
                          {a.work_authorization_status !== "outside_us" && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">US</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className={`font-semibold ${(a.application_match_score ?? 0) >= 80 ? "text-emerald-600" : (a.application_match_score ?? 0) >= 50 ? "text-amber-600" : "text-red-500"}`}>
                          {a.application_match_score ?? 0}%
                        </span>
                      </TableCell>
                      <TableCell className="py-2"><StatusBadge status={a.application_status} /></TableCell>
                      <TableCell className="py-2 text-right text-muted-foreground">
                        {format(new Date(a.created_at), "MMM d")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Job performance */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Job Performance</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/employer/jobs")}>
                Manage <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1,2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : m.jobPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No jobs posted yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Job Title</TableHead>
                    <TableHead className="text-xs text-center">Views</TableHead>
                    <TableHead className="text-xs text-center">Clicks</TableHead>
                    <TableHead className="text-xs text-center">Applicants</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.jobPerformance.map((j) => (
                    <TableRow key={j.id} className="text-xs cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/employer/jobs/${j.id}/applicants`)}>
                      <TableCell className="py-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          {j.title}
                          {j.is_active ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-center text-muted-foreground">{j.view_count}</TableCell>
                      <TableCell className="py-2 text-center text-muted-foreground">{j.click_count}</TableCell>
                      <TableCell className="py-2 text-center font-semibold">{j.applicant_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* US Workers progress bar */}
      {!isLoading && m.totalApplicants > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">US Worker Ratio</p>
              <p className="text-sm font-bold text-primary">{usPercent}%</p>
            </div>
            <Progress value={usPercent} className="h-2" />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {m.usWorkers} US workers out of {m.totalApplicants} total applicants
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
