import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Eye, MapPin, Calendar, Power, Trash2, MoreVertical } from "lucide-react";
import { getTierJobLimit } from "@/config/employer-plans.config";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const { toast } = useToast();
  const [jobs, setJobs] = useState<SponsoredJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SponsoredJob | null>(null);

  const loadJobs = async () => {
    if (!employerProfile) return;
    const { data } = await supabase
      .from("sponsored_jobs")
      .select("*")
      .eq("employer_id", employerProfile.id)
      .order("created_at", { ascending: false });

    if (data) {
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

  useEffect(() => {
    if (!employerProfile) return;
    loadJobs();
  }, [employerProfile]);

  const toggleActive = async (job: SponsoredJob, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !job.is_active;
    const { error } = await supabase
      .from("sponsored_jobs")
      .update({ is_active: newStatus })
      .eq("id", job.id);

    if (error) {
      toast({ title: "Error", description: error.message });
    } else {
      toast({ title: newStatus ? "Job activated" : "Job deactivated" });
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, is_active: newStatus } : j));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("sponsored_jobs")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message });
    } else {
      toast({ title: "Job deleted" });
      setJobs((prev) => prev.filter((j) => j.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

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

      {!canCreate && employerProfile?.status !== "active" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm text-destructive font-medium">
              Active subscription required to post jobs.
            </p>
            <Button size="sm" onClick={() => navigate("/employer/plans")}>
              View Plans
            </Button>
          </CardContent>
        </Card>
      )}

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
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    {job.view_count}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    <Users className="h-3.5 w-3.5" />
                    {job._app_count ?? 0}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={(e) => toggleActive(job, e)}>
                        <Power className="h-4 w-4 mr-2" />
                        {job.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(job); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{deleteTarget?.title}"? This will also remove all applicant data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
