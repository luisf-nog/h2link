import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getJobShareUrl } from "@/lib/shareUtils";
import {
  Mail,
  MapPin,
  Share2,
  AlertTriangle,
  Briefcase,
  DollarSign,
  Phone,
  Rocket,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  MessageCircle,
  MessageSquare,
  CheckCircle2,
  GraduationCap,
  Info,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

export function JobDetailsDialog({
  open,
  onOpenChange,
  job,
  planSettings,
  formatSalary,
  onAddToQueue,
  onRemoveFromQueue,
  isInQueue,
  onShare,
}: any) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  // LÓGICA DE IDENTIFICAÇÃO PREMIUM
  const isRegistered = !!planSettings && Object.keys(planSettings).length > 0;
  const planTier = (planSettings?.plan_tier || planSettings?.tier || "visitor").toLowerCase();
  const canSeeContacts = ["gold", "diamond", "black"].includes(planTier);
  const canSaveJob = isRegistered;

  const handleGoToPlans = () => {
    onOpenChange(false);
    navigate("/plans");
  };

  const handleShare = () => {
    if (!job) return;
    const shareUrl = getJobShareUrl(job.id);
    navigator.clipboard.writeText(shareUrl);
    toast({ title: t("jobs.details.copied"), description: t("jobs.details.copy_success") });
  };

  const maskJobId = (id: string) => {
    const base = id?.split("-GHOST")[0] || "";
    if (base.length <= 6) return <span translate="no">••••••</span>;
    return (
      <span className="flex items-center" translate="no">
        {base.slice(0, -6)}
        <span className="blur-[2px] select-none opacity-40 ml-0.5 font-mono">XXXXXX</span>
      </span>
    );
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return d.toLocaleDateString(i18n.language === "pt" ? "pt-BR" : "en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderMainWage = () => {
    if (!job) return "-";
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
      return (
        <span translate="no">{`$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`}</span>
      );
    if (job.wage_from) return <span translate="no">{`$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`}</span>;
    if (job.salary) return <span translate="no">{formatSalary(job.salary)}</span>;
    return t("jobs.details.view_details");
  };

  const formatExperience = (months: number | null | undefined) => {
    if (!months || months <= 0) return t("jobs.details.no_experience");
    if (months < 12) return t("jobs.table.experience_months", { count: months });
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem === 0
      ? t("jobs.table.experience_years", { count: years })
      : t("jobs.table.experience_years_months", { years, months: rem });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-screen sm:h-auto max-h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg border-0 sm:border text-left">
        {/* HEADER */}
        <div className="p-4 sm:p-6 bg-white border-b sticky top-0 z-40 shadow-sm shrink-0">
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
              <DialogTitle className="text-xl sm:text-3xl leading-tight text-primary font-bold truncate uppercase sm:normal-case">
                <span translate="no">{job?.job_title}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-lg text-slate-600 font-medium text-left">
                <span className="flex items-center gap-1 text-slate-900" translate="no">
                  <Briefcase className="h-4 w-4 text-slate-400" /> {job?.company}
                </span>
                <span className="flex items-center gap-1" translate="no">
                  <MapPin className="h-4 w-4 text-slate-400" /> {job?.city}, {job?.state}
                </span>
              </DialogDescription>
            </div>
            <div className="hidden sm:flex gap-2 shrink-0">
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" /> {t("jobs.details.share")}
              </Button>
              <Button
                onClick={() => job && onAddToQueue(job)}
                className="px-6 font-bold shadow-sm"
                disabled={!canSaveJob}
              >
                {!canSaveJob && <Lock className="h-4 w-4 mr-2" />} {t("jobs.details.save_job")}
              </Button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 touch-auto">
          <div className="p-4 sm:p-6 space-y-6 pb-32 sm:pb-6">
            {/* BLOCO DE PRIORIDADE E ACESSO (O QUE VOCÊ PEDIU) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* EXPLICAÇÃO DO GRUPO */}
              {job?.randomization_group && (
                <div
                  className={cn(
                    "p-4 rounded-xl border flex gap-3 items-start shadow-sm transition-all",
                    job.randomization_group === "A"
                      ? "bg-emerald-50 border-emerald-100"
                      : job.randomization_group === "B"
                        ? "bg-blue-50 border-blue-100"
                        : "bg-amber-50 border-amber-100",
                  )}
                >
                  <Info
                    className={cn(
                      "h-6 w-6 shrink-0 mt-0.5",
                      job.randomization_group === "A"
                        ? "text-emerald-600"
                        : job.randomization_group === "B"
                          ? "text-blue-600"
                          : "text-amber-600",
                    )}
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900 uppercase">
                      {t("jobs.details.group_title", { group: job.randomization_group })}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1 font-medium">
                      {job.randomization_group === "A"
                        ? t("jobs.details.group_a_desc")
                        : t("jobs.details.group_general_desc")}
                    </p>
                  </div>
                </div>
              )}

              {/* EXPLICAÇÃO EARLY ACCESS */}
              {job?.was_early_access && (
                <div className="p-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white flex gap-3 items-start shadow-sm">
                  <Rocket className="h-6 w-6 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 uppercase">{t("jobs.details.early_access_title")}</p>
                    <p className="text-xs text-amber-700 leading-relaxed mt-1 font-medium">
                      {t("jobs.details.early_access_desc")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                {/* TIMELINE */}
                <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                      {t("jobs.details.posted")}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600" translate="no">
                      {formatDate(job?.posted_date)}
                    </span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[9px] font-bold uppercase text-green-600 mb-1">
                      {t("jobs.details.start")}
                    </span>
                    <span className="text-[11px] font-bold text-green-700" translate="no">
                      {formatDate(job?.start_date)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-red-600 mb-1">
                      {t("jobs.details.end")}
                    </span>
                    <span className="text-[11px] font-semibold text-red-700" translate="no">
                      {formatDate(job?.end_date)}
                    </span>
                  </div>
                </div>

                {/* EXPERIÊNCIA */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t("jobs.details.experience")}
                    </span>
                    <span className="text-xl font-bold text-slate-800" translate="no">
                      {formatExperience(job?.experience_months)}
                    </span>
                  </div>
                </div>

                {/* SALARIO, ADIÇÕES E DEDUÇÕES */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <span className="font-semibold text-sm text-slate-600">
                      {t("jobs.details.available_positions")}
                    </span>
                    <Badge className="bg-blue-600 font-bold px-3" translate="no">
                      {job?.openings || "N/A"}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                      <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                    </div>
                    <p className="text-3xl font-extrabold text-green-700 tracking-tight" translate="no">
                      {renderMainWage()}
                    </p>
                  </div>
                  {job?.wage_additional && (
                    <div
                      className="bg-green-50 border border-green-100 p-3 rounded-lg text-green-800 text-xs font-medium"
                      translate="no"
                    >
                      {job.wage_additional}
                    </div>
                  )}
                  {job?.rec_pay_deductions && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg mt-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase mb-1">
                        <AlertTriangle className="h-3 w-3" /> {t("jobs.details.deductions")}
                      </span>
                      <p className="text-xs text-red-800 font-medium" translate="no">
                        {job.rec_pay_deductions}
                      </p>
                    </div>
                  )}
                </div>

                {/* CARGA HORÁRIA */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 text-left">
                  <div className="bg-amber-50 p-3 rounded-full text-amber-600">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t("jobs.details.weekly_hours")}
                    </span>
                    <span className="text-xl font-bold text-slate-800" translate="no">
                      {job?.weekly_hours ? `${job.weekly_hours}h` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* CONTATOS */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden text-left">
                  {!canSeeContacts && (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                      <div className="bg-white p-3 rounded-full shadow-lg mb-3 border border-slate-100">
                        <Lock className="h-7 w-7 text-amber-500" />
                      </div>
                      <Button
                        className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold h-9 text-xs px-5 shadow-lg animate-pulse"
                        onClick={handleGoToPlans}
                      >
                        <Rocket className="h-3.5 w-3.5 mr-2" /> {t("jobs.upgrade.cta")}
                      </Button>
                    </div>
                  )}
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest">
                    <Mail className="h-4 w-4 text-blue-500" /> {t("jobs.details.company_contacts")}
                  </h4>
                  <div className="space-y-4 mt-4">
                    <div translate="no">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1" translate="yes">
                        {t("jobs.details.email_label")}
                      </span>
                      <div className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 break-all">
                        {canSeeContacts ? job?.email : "••••••••@•••••••.com"}
                      </div>
                    </div>
                    {job?.phone && (
                      <div className="space-y-2" translate="no">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1" translate="yes">
                          {t("jobs.details.phone_label")}
                        </span>
                        <div className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100">
                          {canSeeContacts ? job.phone : "+1 (XXX) XXX-XXXX"}
                        </div>
                      </div>
                    )}
                  </div>

                  {canSeeContacts && (
                    <div className="space-y-2 pt-2">
                      <div className="flex gap-2">
                        {job?.phone && (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 font-bold text-xs"
                              onClick={() => window.open(`https://wa.me/${job.phone.replace(/\D/g, "")}`, "_blank")}
                            >
                              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-xs"
                              onClick={() => (window.location.href = `sms:${job.phone}`)}
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> iMessage
                            </Button>
                          </>
                        )}
                      </div>
                      {job?.email && (
                        <Button
                          variant="outline"
                          className="w-full bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs"
                          onClick={() => (window.location.href = `mailto:${job.email}`)}
                        >
                          <Mail className="h-3.5 w-3.5 mr-1.5" /> {t("jobs.details.send_email")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* DESCRIÇÕES */}
              <div className="lg:col-span-8 space-y-6">
                {job?.job_min_special_req && (
                  <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm text-left">
                    <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 mb-6 border-b pb-4">
                      <AlertTriangle className="h-6 w-6 text-amber-500" /> {t("jobs.details.special_reqs")}
                    </h4>
                    <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                      <p className="text-sm text-amber-900 leading-relaxed">
                        <span translate="yes">{job.job_min_special_req}</span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm text-left">
                  <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 mb-6 border-b pb-4">
                    <Briefcase className="h-6 w-6 text-blue-600" /> {t("jobs.details.job_description")}
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    <span translate="yes">{job?.job_duties}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER MOBILE */}
        <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 z-50 shadow-lg">
          <Button
            className="flex-1 font-bold h-12 text-base shadow-lg"
            disabled={!canSaveJob}
            onClick={() => job && onAddToQueue(job)}
          >
            {!canSaveJob && <Lock className="h-4 w-4 mr-2" />} {t("jobs.details.save_job_mobile")}
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleShare}>
            <Share2 className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
