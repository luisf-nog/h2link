import { useState } from "react";
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
  Lock,
  MessageCircle,
  CheckCircle2,
  Zap,
  Plus,
  Minus,
  ArrowLeft,
  X,
  FileText,
  ExternalLink,
  Globe,
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

  // ─── Configurações de Acesso ──────────────────────────────────────────────
  const isRegistered = !!planSettings && Object.keys(planSettings).length > 0;
  const planTier = (planSettings?.plan_tier || planSettings?.tier || "visitor").toLowerCase();
  const canSeeContacts = ["gold", "diamond", "black"].includes(planTier);
  const canSaveJob = isRegistered;

  // ─── Lógica de Early Access (Restrita a H-2A) ─────────────────────────────
  // Regra: Só é considerado Early Access se for H-2A.
  const isCurrentlyEarlyAccess = job?.visa_type?.includes("Early Access") && job?.visa_type?.includes("H-2A");
  const isCertifiedOpportunity = job?.was_early_access && !isCurrentlyEarlyAccess;

  // Identificador oficial (Fallback para caseNumber do DOL)
  const officialCaseId = job?.caseNumber || job?.job_id;

  const hasValidPhone =
    job?.phone && job.phone !== "N/A" && job.phone !== "n/a" && job.phone.trim() !== "" && job.phone !== "0";

  // ─── Handlers ─────────────────────────────────────────────────────────────
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

  const getMessageBody = () => {
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
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col gap-1 w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {job?.visa_type && (
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "text-[10px] uppercase font-bold border px-2 py-0.5",
                        job.visa_type.includes("H-2A") &&
                          !isCurrentlyEarlyAccess &&
                          "bg-green-600 border-green-600 text-white",
                        job.visa_type.includes("H-2B") && "bg-blue-600 border-blue-600 text-white",
                        isCurrentlyEarlyAccess && "bg-amber-50 border-amber-400 text-amber-900",
                      )}
                      translate="no"
                    >
                      {isCurrentlyEarlyAccess && (
                        <Zap className="h-3 w-3 mr-1 text-amber-600 fill-amber-600 animate-pulse" />
                      )}
                      {/* Mostra o tipo simplificado se for H-2B para evitar confusão */}
                      {job.visa_type.includes("H-2B") ? "H-2B" : job.visa_type}
                    </Badge>
                    {officialCaseId && (
                      <span className="text-[10px] font-mono text-slate-400" translate="no">
                        {officialCaseId}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <DialogTitle className="text-xl sm:text-3xl leading-tight text-primary font-bold truncate uppercase sm:normal-case">
                <span translate="no">{job?.job_title}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-lg text-slate-600 font-medium">
                <span className="flex items-center gap-1 text-slate-900" translate="no">
                  <Briefcase className="h-4 w-4 text-slate-400" /> {job?.company}
                </span>
                <span className="flex items-center gap-1" translate="no">
                  <MapPin className="h-4 w-4 text-slate-400" /> {job?.city}, {job?.state}
                </span>
              </DialogDescription>
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0">
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
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-10 w-10 ml-2"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-6 w-6 text-slate-500" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden rounded-full shrink-0 h-10 w-10"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-6 w-6 text-slate-500" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 touch-auto text-left">
          <div className="p-4 sm:p-6 space-y-6 pb-32 sm:pb-6">
            {/* Status Cards */}
            {isCurrentlyEarlyAccess && (
              <div className="w-full p-5 rounded-2xl border border-violet-200 bg-violet-50/60 flex gap-4 items-center shadow-sm">
                <div className="bg-violet-600 p-3 rounded-xl text-white shrink-0">
                  <Zap className="h-7 w-7 fill-white animate-pulse" />
                </div>
                <div>
                  <p className="text-base font-black text-violet-900 uppercase tracking-tight">
                    {t("jobs.details.active_early_title")}
                  </p>
                  <p className="text-sm text-violet-700 font-medium">{t("jobs.details.active_early_desc")}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                {/* Datas */}
                <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 mb-1">{t("jobs.details.posted")}</span>
                    <span className="text-base font-bold text-slate-700">{formatDate(job?.posted_date)}</span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[10px] font-bold text-green-600 mb-1">{t("jobs.details.start")}</span>
                    <span className="text-base font-bold text-green-700">{formatDate(job?.start_date)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-red-600 mb-1">{t("jobs.details.end")}</span>
                    <span className="text-base font-bold text-red-700">{formatDate(job?.end_date)}</span>
                  </div>
                </div>

                {/* ── SEÇÃO JOB ORDER (FIXED) ── */}
                {officialCaseId && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2 text-[10px] uppercase tracking-widest">
                      <FileText className="h-4 w-4 text-indigo-500" />{" "}
                      {t("jobs.details.job_order", "Official Job Order")}
                    </h4>
                    <div className="flex flex-col gap-2">
                      <a
                        href={`https://seasonaljobs.dol.gov/job-order/${officialCaseId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full p-3 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-indigo-500" />
                          <span>{t("jobs.details.view_job_order", "View on DOL Portal")}</span>
                        </div>
                        <ExternalLink className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <a
                        href={`https://seasonaljobs.dol.gov/api/job-order/pdf/${officialCaseId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full p-3 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{t("jobs.details.download_pdf", "Download PDF (ETA Form)")}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Financeiro */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex justify-between items-center border-b pb-4">
                    <span className="font-semibold text-sm text-slate-600">
                      {t("jobs.details.available_positions")}
                    </span>
                    <Badge className="bg-blue-600 font-bold px-3">{job?.openings || "N/A"}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                      <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                    </div>
                    <p className="text-3xl font-extrabold text-green-700 tracking-tight" translate="no">
                      {renderMainWage()}
                    </p>
                  </div>
                </div>

                {/* Contatos */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  {!canSeeContacts && (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                      <Lock className="h-7 w-7 text-amber-500 mb-3" />
                      <Button
                        className="bg-amber-600 text-white font-bold h-9 text-xs px-5 shadow-lg"
                        onClick={handleGoToPlans}
                      >
                        {t("jobs.upgrade.cta")}
                      </Button>
                    </div>
                  )}
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest">
                    <Mail className="h-4 w-4 text-blue-500" /> {t("jobs.details.company_contacts")}
                  </h4>
                  <div className="space-y-4 mt-4">
                    <div className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 flex justify-between items-center">
                      <span>{canSeeContacts ? job?.email : "••••••••@•••••••.com"}</span>
                      {canSeeContacts && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => (window.location.href = `mailto:${job.email}`)}
                        >
                          <Mail className="h-3 w-3 text-slate-500" />
                        </Button>
                      )}
                    </div>
                    {hasValidPhone && canSeeContacts && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <Button
                          variant="outline"
                          className="bg-green-50 border-green-200 text-green-700 h-8 text-xs font-bold"
                          onClick={handleCall}
                        >
                          <Phone className="h-3 w-3 mr-1" /> {t("jobs.details.call_action")}
                        </Button>
                        <Button
                          variant="outline"
                          className="bg-blue-50 border-blue-200 text-blue-700 h-8 text-xs font-bold"
                          onClick={handleSMS}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" /> SMS
                        </Button>
                        <Button
                          variant="outline"
                          className="bg-emerald-50 border-emerald-200 text-emerald-700 h-8 text-xs font-bold"
                          onClick={handleWhatsApp}
                        >
                          WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Descrição e Requisitos */}
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
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 mb-6 border-b pb-4">
                    <Briefcase className="h-6 w-6 text-blue-600" /> {t("jobs.details.job_description")}
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    <span>{job?.job_duties}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Mobile */}
        <div className="sm:hidden p-4 border-t bg-white flex flex-col gap-3 sticky bottom-0 z-50 shadow-lg">
          <div className="flex gap-3">
            <Button
              className="flex-1 font-bold h-12 text-base"
              disabled={!canSaveJob}
              onClick={() => job && onAddToQueue(job)}
            >
              {!canSaveJob && <Lock className="h-4 w-4 mr-2" />} {t("jobs.details.save_job_mobile")}
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleShare}>
              <Share2 className="h-5 w-5 text-slate-600" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
