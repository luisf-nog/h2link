import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Eye, MapPin, Calendar } from "lucide-react";
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
        // Get applicant counts
        const jobIds = data.map((j) => j.id);
        const { data: apps } = await supabase
          .from("job_applications")
          .select("job_id")
          .in("job_id", jobIds);

        const countMap: Record<string, number> = {};
        apps?.forEach((a) => {
          countMap[a.job_id] = (countMap[a.job_id] || 0) + 1;
        });

        setJobs(data.map((j) => ({ ...j, _app_count: countMap[j.id] || 0 })));
      }
      setLoading(false);
    };
    load();
  }, [employerProfile]);

  const activeCount = jobs.filter((j) => j.is_active).length;
  const jobLimit = employerProfile ? getTierJobLimit(employerProfile.tier) : 0;
  const canCreate = activeCount < jobLimit && employerProfile?.status === "active";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-brand">My Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} / {jobLimit} active jobs
          </p>
        </div>
        <Button onClick={() => navigate("/employer/jobs/new")} disabled={!canCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Post Job
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-muted-foreground">No jobs yet. Create your first posting!</p>
            <Button onClick={() => navigate("/employer/jobs/new")} disabled={!canCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{job.title}</span>
                    <Badge variant={job.is_active ? "default" : "secondary"}>
                      {job.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(job.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      {job.view_count}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 font-semibold">
                      <Users className="h-3.5 w-3.5" />
                      {job._app_count ?? 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
