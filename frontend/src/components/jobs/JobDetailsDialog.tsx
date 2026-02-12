import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getJobShareUrl } from "@/lib/shareUtils";
import { getVisaBadgeConfig } from "@/lib/visaTypes";
import {
  Mail,
  MapPin,
  Share2,
  AlertTriangle,
  Briefcase,
  DollarSign,
  Phone,
  Plus,
  Trash2,
  ArrowLeft,
  GraduationCap,
  Rocket,
  Clock,
  Lock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

export type JobDetails = {
  id: string;
  job_id: string;
  visa_type?: string | null;
  company?: string;
  email?: string;
  phone?: string | null;
  job_title?: string;
  city?: string;
  state?: string;
  openings?: number | null;
  salary?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  posted_date?: string;
  experience_months?: number | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  pay_frequency?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
  weekly_hours?: number | null;
  job_min_special_req?: string | null;
  job_duties?: string | null;
  randomization_group?: string | null;
  was_early_access?: boolean | null;
  [key: string]: any;
};

export function JobDetailsDialog({
  open,
  onOpenChange,
  job,
  planSettings,
  formatSalary,
  onAddToQueue,
  isInQueue,
}: any) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const planTier = planSettings?.plan_tier?.toLowerCase() || "visitor";
  const canSeeContacts = ["gold", "diamond", "black"].includes(planTier);
  const isLoggedOut = !planSettings || Object.keys(planSettings).length === 0;

  const handleGoToPlans = () => {
    onOpenChange(false);
    navigate("/plans");
  };

  const maskJobId = (id: string) => {
    const base = id?.split("-GHOST")[0] || "";
    if (base.length <= 6) return <span translate="no">••••••</span>;
    return (
      <span className="flex items-center" translate="no">
        {base.slice(0, -6)}
        <span className="blur-[2px] select-none opacity-40 ml-0.5">XXXXXX</span>
      </span>
    );
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return d.toLocaleDateString(i18n.language, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  };

  const badgeConfig = job ? getVisaBadgeConfig(job.visa_type) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-screen sm:h-auto max-h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg border-0 sm:border text-left">
        <div className="p-4 sm:p-6 bg-white border-b sticky top-0 z-40 shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {job?.visa_type && (
                  <Badge className="text-[10px] uppercase font-bold" translate="no">
                    {job.visa_type}
                  </Badge>
                )}
                {job?.job_id && (
                  <span
                    className="font-mono text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
                    translate="no"
                  >
                    {canSeeContacts ? job.job_id.split("-GHOST")[0] : maskJobId(job.job_id)}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl sm:text-2xl leading-tight text-primary font-bold truncate">
                <span translate="no">{job?.job_title}</span>
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 font-medium">
                <span className="flex items-center gap-1 text-slate-900" translate="no">
                  <Briefcase className="h-4 w-4 text-slate-400" /> {job?.company}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-slate-400" /> {job?.city}, {job?.state}
                </span>
              </div>
            </div>
            <div className="hidden sm:flex gap-2 shrink-0">
              <Button onClick={() => job && onAddToQueue(job)} className="px-6 font-bold" disabled={isLoggedOut}>
                {isLoggedOut && <Lock className="h-4 w-4 mr-2" />} {t("jobs.details.save_job")}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 touch-auto">
          <div className="p-4 sm:p-6 space-y-6 pb-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                      {t("jobs.table.headers.posted")}
                    </span>
                    <span className="text-xs font-semibold" translate="no">
                      {formatDate(job?.posted_date)}
                    </span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[9px] font-bold uppercase text-green-600 mb-1">
                      {t("jobs.table.headers.start")}
                    </span>
                    <span className="text-xs font-bold text-green-700" translate="no">
                      {formatDate(job?.start_date)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-red-600 mb-1">
                      {t("jobs.table.headers.end")}
                    </span>
                    <span className="text-xs font-semibold text-red-700" translate="no">
                      {formatDate(job?.end_date)}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center border-b pb-4">
                    <span className="text-sm font-semibold text-slate-600">
                      {t("jobs.details.available_positions")}
                    </span>
                    <Badge className="bg-blue-600 px-3" translate="no">
                      {job?.openings || "N/A"}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-green-700 font-bold text-sm mb-1">
                      <DollarSign className="h-4 w-4" /> {t("jobs.details.remuneration")}
                    </div>
                    <p className="text-2xl font-black text-green-700" translate="no">
                      {job?.salary ? formatSalary(job.salary) : "-"}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 relative overflow-hidden">
                  {!canSeeContacts && (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                      <Lock className="h-6 w-6 text-amber-500 mb-2" />
                      <Button
                        className="bg-orange-600 text-white font-bold h-9 text-xs px-5 shadow-lg"
                        onClick={handleGoToPlans}
                      >
                        {t("jobs.upgrade.cta")}
                      </Button>
                    </div>
                  )}
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest">
                    <Mail className="h-4 w-4 text-blue-500" /> {t("jobs.details.company_contacts")}
                  </h4>
                  <div className="space-y-4 mt-2">
                    <div translate="no">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1" translate="yes">
                        {t("jobs.details.email_label")}
                      </span>
                      <div className="font-mono text-xs bg-slate-50 p-2 rounded border break-all">
                        {canSeeContacts ? job?.email : "••••••••@•••••••.com"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 text-left">
                  <h4 className="flex items-center gap-2 font-bold text-lg text-slate-800 mb-6 border-b pb-4">
                    <Briefcase className="h-5 w-5 text-blue-600" /> {t("jobs.details.job_description")}
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    <span translate="yes">{job?.job_duties}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
