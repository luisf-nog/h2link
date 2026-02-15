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
  Clock,
  Lock,
  MessageCircle,
  CheckCircle2,
  GraduationCap,
  Info,
  Zap,
  Plus,
  Minus,
  ArrowLeft,
  X,
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

  const isRegistered = !!planSettings && Object.keys(planSettings).length > 0;
  const planTier = (planSettings?.plan_tier || planSettings?.tier || "visitor").toLowerCase();
  const canSeeContacts = ["gold", "diamond", "black"].includes(planTier);
  const canSaveJob = isRegistered;

  const hasValidPhone =
    job?.phone && job.phone !== "N/A" && job.phone !== "n/a" && job.phone.trim() !== "" && job.phone !== "0";

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

  const isCurrentlyEarlyAccess = job?.visa_type?.includes("Early Access");
  const isCertifiedOpportunity = job?.was_early_access && !isCurrentlyEarlyAccess;

  const getMessageBody = () => {
    // Texto de mensagem também traduzível
    return t("jobs.details.contact_msg_template", {
      jobTitle: job?.job_title,
      company: job?.company,
      defaultValue: `Hello! I saw your job posting for ${job?.job_title} at ${job?.company} on H2 Linker and would like to apply.`,
    });
  };

  const handleCall = () => {
    if (job.phone) window.location.href = `tel:${job.phone}`;
  };
  const handleSMS = () => {
    if (job.phone) window.location.href = `sms:${job.phone}?&body=${encodeURIComponent(getMessageBody())}`;
  };
  const handleWhatsApp = () => {
    if (job.phone) {
      const cleanPhone = job.phone.replace(/\D/g, "");
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(getMessageBody())}`, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-screen sm:h-auto max-h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg border-0 sm:border text-left">
        {/* HEADER */}
        <div className="p-4 sm:p-6 bg-white border-b sticky top-0 z-40 shadow-sm shrink-0">
          <div className="flex justify-between items-start gap-4 text-left">
            <div className="flex flex-col gap-1 w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {job?.visa_type && (
                  <Badge
                    className={cn(
                      "text-[10px] uppercase font-bold border px-2 py-0.5",
                      job.visa_type === "H-2A" && !job.was_early_access && "bg-green-600 border-green-600 text-white",
                      job.visa_type === "H-2B" && !job.was_early_access && "bg-blue-600 border-blue-600 text-white",
                      (job.visa_type.includes("Early Access") || (job.was_early_access && isCurrentlyEarlyAccess)) &&
                        "bg-amber-50 border-amber-400 text-amber-900",
                    )}
                    translate="no"
                  >
                    {isCurrentlyEarlyAccess && (
                      <Zap className="h-3 w-3 mr-1 text-amber-600 fill-amber-600 animate-pulse" />
                    )}
                    {job.visa_type}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl sm:text-3xl leading-tight text-primary font-bold truncate uppercase sm:normal-case">
                <span translate="no">{job?.job_title}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-lg text-slate-600 font-medium">
                <span className="flex items-center gap-1 text-slate-900" translate="no">
                  <Briefcase className="h-4 w-4 text-slate-400" /> {job?.company}
                </span>
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0 h-10 w-10"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-6 w-6 text-slate-500" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 touch-auto text-left">
          <div className="p-4 sm:p-6 space-y-6 pb-32 sm:pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                {/* DATAS */}
                <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {t("jobs.details.posted")}
                    </span>
                    <span className="text-base font-bold text-slate-700">{formatDate(job?.posted_date)}</span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[10px] font-bold uppercase text-green-600 mb-1">
                      {t("jobs.details.start")}
                    </span>
                    <span className="text-base font-bold text-green-700">{formatDate(job?.start_date)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-red-600 mb-1">
                      {t("jobs.details.end")}
                    </span>
                    <span className="text-base font-bold text-red-700">{formatDate(job?.end_date)}</span>
                  </div>
                </div>

                {/* FINANCEIRO (TRADUZIDO) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                      <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                    </div>
                    <p className="text-3xl font-extrabold text-green-700 tracking-tight" translate="no">
                      {renderMainWage()}
                    </p>
                  </div>
                  {job?.wage_additional && (
                    <div className="mt-4 pt-4 border-t border-dashed border-green-200">
                      <h5 className="flex items-center gap-2 text-xs font-bold uppercase text-green-600 mb-2">
                        <Plus className="h-3 w-3" /> {t("jobs.details.wage_extra_label", "Bonuses & Extras")}
                      </h5>
                      <p className="text-xs text-green-800 font-medium bg-green-50/50 p-2 rounded">
                        <span>{job.wage_additional}</span>
                      </p>
                    </div>
                  )}
                  {job?.rec_pay_deductions && (
                    <div className="mt-4 pt-4 border-t border-dashed border-red-200">
                      <h5 className="flex items-center gap-2 text-xs font-bold uppercase text-red-600 mb-2">
                        <Minus className="h-3 w-3" /> {t("jobs.details.deductions_label", "Deductions")}
                      </h5>
                      <p className="text-xs text-red-800 font-medium bg-red-50/50 p-2 rounded">
                        <span>{job.rec_pay_deductions}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* CONTATOS (TRADUZIDO) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest">
                    <Mail className="h-4 w-4 text-blue-500" /> {t("jobs.details.company_contacts")}
                  </h4>
                  <div className="space-y-4 mt-4">
                    {hasValidPhone && canSeeContacts && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <Button
                          variant="outline"
                          className="bg-green-50 border-green-200 text-green-700 h-8 text-xs font-bold"
                          onClick={handleCall}
                        >
                          <Phone className="h-3 w-3 mr-1" /> {t("common.call", "Call")}
                        </Button>
                        <Button
                          variant="outline"
                          className="bg-blue-50 border-blue-200 text-blue-700 h-8 text-xs font-bold"
                          onClick={handleSMS}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" /> {t("common.sms", "SMS")}
                        </Button>
                        <Button
                          variant="outline"
                          className="bg-emerald-50 border-emerald-200 text-emerald-700 h-8 text-xs font-bold"
                          onClick={handleWhatsApp}
                        >
                          <Zap className="h-3 w-3 mr-1" /> WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DESCRIÇÃO */}
              <div className="lg:col-span-8 space-y-6">
                {job?.job_min_special_req && (
                  <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 mb-6 border-b pb-4">
                      <AlertTriangle className="h-6 w-6 text-amber-500" /> {t("jobs.details.special_reqs")}
                    </h4>
                    <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                      <p className="text-sm text-amber-900 leading-relaxed">
                        <span>{job.job_min_special_req}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER MOBILE AJUSTADO E TRADUZIDO */}
        <div className="sm:hidden p-4 border-t bg-white flex flex-col gap-3 sticky bottom-0 z-50 shadow-lg">
          <div className="flex gap-3">
            <Button
              className="flex-1 font-bold h-12 text-base shadow-lg"
              disabled={!canSaveJob}
              onClick={() => job && onAddToQueue(job)}
            >
              {!canSaveJob && <Lock className="h-4 w-4 mr-2" />} {t("jobs.details.save_job_mobile")}
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full text-slate-500 font-bold h-10 flex items-center justify-center gap-2"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="h-4 w-4" /> {t("common.back_to_list", "Back to Job List")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
