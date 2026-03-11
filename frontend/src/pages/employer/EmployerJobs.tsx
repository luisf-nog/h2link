import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Users, Eye, MapPin, Calendar, TrendingUp, AlertCircle, Mail, Trash2, Share2, Copy, Check, FileSearch, Briefcase, DollarSign, Shield, Dumbbell, Car, Globe, UserCheck } from "lucide-react";
import { getTierJobLimit } from "@/config/employer-plans.config";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

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

interface JobDetails {
  id: string;
  title: string;
  location: string | null;
  city: string | null;
  state: string | null;
  visa_type: string | null;
  start_date: string | null;
  end_date: string | null;
  num_positions: number | null;
  wage_rate: string | null;
  hourly_wage: number | null;
  benefits: string | null;
  deductions: string | null;
  description: string | null;
  primary_duties: string | null;
  additional_notes: string | null;
  dol_case_number: string | null;
  employer_legal_name: string | null;
  english_proficiency: string | null;
  min_experience_months: number | null;
  drivers_license: string | null;
  equipment_experience: string | null;
  req_lift_lbs: number | null;
  req_extreme_weather: boolean | null;
  req_full_contract_availability: boolean | null;
  req_travel_worksite: boolean | null;
  req_background_check: boolean | null;
  req_english: boolean;
  req_experience: boolean;
  req_drivers_license: boolean;
  consular_only: boolean;
  returning_worker: string;
  previous_h2_visa: string;
}

export default function EmployerJobs() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<SponsoredJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SponsoredJob | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewJob, setViewJob] = useState<JobDetails | null>(null);
  const [loadingView, setLoadingView] = useState(false);

  const getApplyUrl = (jobId: string) => `https://h2linker.com/job/${jobId}`;

  const handleCopyLink = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getApplyUrl(jobId));
      setCopiedId(jobId);
      toast({ title: t("employer.jobs.link_copied", "Link copied!") });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleViewJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingView(true);
    const { data } = await supabase
      .from("sponsored_jobs")
      .select("id, title, location, city, state, visa_type, start_date, end_date, num_positions, wage_rate, hourly_wage, benefits, deductions, description, primary_duties, additional_notes, dol_case_number, employer_legal_name, english_proficiency, min_experience_months, drivers_license, equipment_experience, req_lift_lbs, req_extreme_weather, req_full_contract_availability, req_travel_worksite, req_background_check, req_english, req_experience, req_drivers_license, consular_only, returning_worker, previous_h2_visa")
      .eq("id", jobId)
      .single();
    setLoadingView(false);
    if (data) setViewJob(data as JobDetails);
  };

  const loadJobs = async () => {
    if (!employerProfile) return;
    const { data } = await supabase
      .from("sponsored_jobs")
      .select("id, title, location, is_active, view_count, click_count, start_date, end_date, created_at")
      .eq("employer_id", employerProfile.id)
      .order("created_at", { ascending: false });

    if (data) {
      const jobIds = data.map((j) => j.id);
      let countMap: Record<string, { total: number; new: number }> = {};

      if (jobIds.length > 0) {
        const { data: apps } = await supabase
          .from("job_applications")
          .select("job_id, employer_status")
          .in("job_id", jobIds);

        apps?.forEach((a) => {
          if (!countMap[a.job_id]) countMap[a.job_id] = { total: 0, new: 0 };
          countMap[a.job_id].total += 1;
          if (a.employer_status === "new") countMap[a.job_id].new += 1;
        });
      }

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

  useEffect(() => {
    if (!employerProfile) return;
    loadJobs();
  }, [employerProfile]);

  const handleToggleActive = async (job: SponsoredJob, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingId(job.id);

    const newActive = !job.is_active;

    // If activating, check limit
    if (newActive) {
      const currentActive = jobs.filter((j) => j.is_active && j.id !== job.id).length;
      const limit = employerProfile ? getTierJobLimit(employerProfile.tier) : 0;
      if (currentActive >= limit) {
        toast({
          title: t("employer.jobs.plan_limit"),
          description: t("employer.jobs.cant_activate_limit"),
          variant: "destructive",
        });
        setTogglingId(null);
        return;
      }
    }

    const { error } = await supabase
      .from("sponsored_jobs")
      .update({ is_active: newActive })
      .eq("id", job.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, is_active: newActive } : j)));
      toast({
        title: newActive
          ? t("employer.jobs.activated")
          : t("employer.jobs.deactivated"),
      });
    }
    setTogglingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from("sponsored_jobs")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== deleteTarget.id));
      toast({ title: t("employer.jobs.deleted") });
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const activeCount = jobs.filter((j) => j.is_active).length;
  const jobLimit = employerProfile ? getTierJobLimit(employerProfile.tier) : 0;
  const canCreate = activeCount < jobLimit && employerProfile?.status === "active";

  const BoolBadge = ({ value, label }: { value: boolean | null; label: string }) => (
    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
      <div className={`w-2 h-2 rounded-full shrink-0 ${value ? "bg-green-500" : "bg-muted-foreground/30"}`} />
      <span className="text-sm">{label}</span>
    </div>
  );

  const PrefBadge = ({ value, label }: { value: string; label: string }) => {
    const color = value === "required" ? "bg-red-100 text-red-700" : value === "preferred" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground";
    const text = value === "required" ? "Required" : value === "preferred" ? "Preferred" : "Not required";
    return (
      <div className="flex items-center justify-between p-2 rounded-md border border-border">
        <span className="text-sm">{label}</span>
        <Badge variant="secondary" className={color}>{text}</Badge>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* View Job Requirements Dialog */}
      <Dialog open={!!viewJob} onOpenChange={(open) => !open && setViewJob(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-primary" />
              {viewJob?.title}
            </DialogTitle>
            <DialogDescription>
              {viewJob?.dol_case_number && `DOL Case: ${viewJob.dol_case_number} · `}
              {viewJob?.location || `${viewJob?.city || ""}, ${viewJob?.state || ""}`}
            </DialogDescription>
          </DialogHeader>

          {viewJob && (
            <div className="space-y-6 py-2">
              {/* Job Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Job Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Visa Type:</span> <strong>{viewJob.visa_type || "N/A"}</strong></div>
                  <div><span className="text-muted-foreground">Employer:</span> <strong>{viewJob.employer_legal_name || "N/A"}</strong></div>
                  <div><span className="text-muted-foreground">Positions:</span> <strong>{viewJob.num_positions || "N/A"}</strong></div>
                  <div><span className="text-muted-foreground">Period:</span> <strong>{viewJob.start_date || "?"} → {viewJob.end_date || "?"}</strong></div>
                </div>
              </div>

              {/* Financials */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Compensation
                </h3>
                <div className="text-sm space-y-2">
                  <div><span className="text-muted-foreground">Wage:</span> <strong>{viewJob.wage_rate || (viewJob.hourly_wage ? `$${viewJob.hourly_wage}/hr` : "N/A")}</strong></div>
                  {viewJob.benefits && <div><span className="text-muted-foreground">Benefits/Housing:</span> <p className="mt-1 text-sm bg-muted/50 p-2 rounded">{viewJob.benefits}</p></div>}
                  {viewJob.deductions && <div><span className="text-muted-foreground">Deductions:</span> <p className="mt-1 text-sm bg-muted/50 p-2 rounded">{viewJob.deductions}</p></div>}
                </div>
              </div>

              {/* Description & Duties */}
              {(viewJob.primary_duties || viewJob.description || viewJob.additional_notes) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Description & Duties</h3>
                  {viewJob.primary_duties && <p className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap">{viewJob.primary_duties}</p>}
                  {viewJob.description && !viewJob.primary_duties && <p className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap">{viewJob.description}</p>}
                  {viewJob.additional_notes && (
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">Special Requirements:</span>
                      <p className="text-sm bg-muted/50 p-3 rounded mt-1 whitespace-pre-wrap">{viewJob.additional_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Screening Requirements (affects match score) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Screening Requirements (Match Score)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2 rounded-md border border-border">
                    <span className="text-sm flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> English</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{viewJob.english_proficiency || "none"}</Badge>
                      {viewJob.req_english && <Badge variant="destructive" className="text-[10px]">Eliminatory</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md border border-border">
                    <span className="text-sm flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Experience</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{viewJob.min_experience_months ? `${viewJob.min_experience_months}+ months` : "None"}</Badge>
                      {viewJob.req_experience && <Badge variant="destructive" className="text-[10px]">Eliminatory</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md border border-border">
                    <span className="text-sm flex items-center gap-1.5"><Car className="w-3.5 h-3.5" /> Driver's License</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{viewJob.drivers_license || "not_required"}</Badge>
                      {viewJob.req_drivers_license && <Badge variant="destructive" className="text-[10px]">Eliminatory</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md border border-border">
                    <span className="text-sm flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" /> Consular Only</span>
                    <Badge variant={viewJob.consular_only ? "destructive" : "outline"} className="text-xs">
                      {viewJob.consular_only ? "Yes (Eliminatory)" : "No"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* H-2 Preferences */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">H-2 Preferences</h3>
                <div className="space-y-2">
                  <PrefBadge value={viewJob.returning_worker} label="Returning Worker" />
                  <PrefBadge value={viewJob.previous_h2_visa} label="Previous H-2 Visa" />
                </div>
              </div>

              {/* Physical Requirements */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" /> Physical & Other Requirements
                </h3>
                {viewJob.req_lift_lbs && (
                  <div className="p-2 rounded-md border border-border bg-muted/30 text-sm">
                    Lifting: <strong>{viewJob.req_lift_lbs} lbs</strong> (≈ {Math.round(viewJob.req_lift_lbs * 0.453592)} kg)
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <BoolBadge value={viewJob.req_extreme_weather} label="Outdoor / Extreme Weather" />
                  <BoolBadge value={viewJob.req_full_contract_availability} label="Full Contract Availability" />
                  <BoolBadge value={viewJob.req_travel_worksite} label="Travel to Worksite" />
                  <BoolBadge value={viewJob.req_background_check} label="Background Check" />
                </div>
                {viewJob.equipment_experience && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Equipment:</span> {viewJob.equipment_experience}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("employer.jobs.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("employer.jobs.delete_desc", { title: deleteTarget?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("employer.jobs.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "…" : t("employer.jobs.confirm_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm bg-muted p-2 rounded-lg border border-border">
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

                    {/* Actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                        onClick={(e) => handleViewJob(job.id, e)}
                        aria-label="View requirements"
                      >
                        <FileSearch className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                        onClick={(e) => handleCopyLink(job.id, e)}
                        aria-label={t("employer.jobs.copy_link", "Copy share link")}
                      >
                        {copiedId === job.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>

                      <div className="flex flex-col items-center gap-0.5">
                        <Switch
                          checked={job.is_active}
                          disabled={togglingId === job.id}
                          onCheckedChange={() => {}}
                          onClick={(e) => handleToggleActive(job, e)}
                          aria-label={job.is_active ? t("employer.jobs.deactivate") : t("employer.jobs.activate")}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {job.is_active ? "ON" : "OFF"}
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(job);
                        }}
                        aria-label={t("employer.jobs.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
