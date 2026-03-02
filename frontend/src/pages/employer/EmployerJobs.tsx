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
        // Puxa as aplicações e o status para saber quem é "Novo"
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
      {/* Cabeçalho e Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-brand text-slate-900">My Jobs</h1>
          <p className="text-sm text-slate-500">
            {activeCount} / {jobLimit} active sponsored jobs
          </p>

          {/* Alerta de Limite do Plano */}
          {!canCreate && employerProfile?.status === "active" && (
            <div className="flex items-center gap-2 mt-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
              <AlertCircle className="h-4 w-4" />
              <span>You've reached your plan's limit. Upgrade to post more.</span>
            </div>
          )}
        </div>

        <Button
          onClick={() => navigate("/employer/jobs/new")}
          disabled={!canCreate}
          className="bg-slate-900 hover:bg-slate-800"
        >
          <Plus className="h-4 w-4 mr-2" />
          Post Job
        </Button>
      </div>

      {/* Lista de Vagas */}
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
            <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No jobs posted yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Create your first sponsored job posting to start receiving qualified candidates in your dashboard.
            </p>
            <Button onClick={() => navigate("/employer/jobs/new")} disabled={!canCreate} className="mt-4">
              Create First Job
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
                className="cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
                onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info da Vaga */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </span>
                      <Badge
                        variant={job.is_active ? "default" : "secondary"}
                        className={job.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {job.is_active ? "Active" : "Draft/Inactive"}
                      </Badge>

                      {/* Badge de Novos Candidatos */}
                      {job._new_app_count && job._new_app_count > 0 ? (
                        <Badge variant="destructive" className="bg-blue-600">
                          {job._new_app_count} New
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
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

                  {/* Métricas e Stats */}
                  <div className="flex items-center gap-6 text-sm shrink-0 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-center px-2" title="Total Views">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                        <Eye className="h-4 w-4" />
                        <span className="font-medium text-slate-700">{job.view_count}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Views</div>
                    </div>

                    <div className="w-px h-8 bg-slate-200"></div>

                    <div className="text-center px-2" title="Conversion Rate">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium text-slate-700">{conversionRate}%</span>
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Conv. Rate</div>
                    </div>

                    <div className="w-px h-8 bg-slate-200"></div>

                    <div className="text-center px-2" title="Total Candidates">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-600 mb-0.5">
                        <Users className="h-4 w-4" />
                        <span>{job._app_count ?? 0}</span>
                      </div>
                      <div className="text-[10px] text-blue-400/80 uppercase tracking-wider">Applicants</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Rodapé B2B Escape */}
          {jobs.length > 0 && (
            <div className="pt-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              Need a larger number of jobs?{" "}
              <a href="mailto:help@h2linker.com" className="text-blue-600 hover:underline font-medium">
                Contact our Enterprise team
              </a>
              .
            </div>
          )}
        </div>
      )}
    </div>
  );
}
