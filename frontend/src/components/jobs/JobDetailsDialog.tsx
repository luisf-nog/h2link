import { useState, useEffect } from "react";
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
  Users,
  ArrowLeft,
  GraduationCap,
  Rocket,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  Clock,
  Lock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

export type JobDetails = {
  id: string;
  job_id: string;
  visa_type: string | null;
  company: string;
  email: string;
  phone?: string | null;
  job_title: string;
  city: string;
  state: string;
  openings?: number | null;
  salary: number | null;
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
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
};

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
  const [isBannerExpanded, setIsBannerExpanded] = useState(true);

  // LOGICA DE BLOQUEIO SOMENTE PARA CONTATOS E ID
  const isRegistered = !!planSettings && Object.keys(planSettings).length > 0;
  const planTier = planSettings?.tier || "visitor";
  const canSeeContacts = ["gold", "diamond", "black"].includes(planTier);
  const canSaveJob = isRegistered;

  useEffect(() => {
    if (open) setIsBannerExpanded(true);
  }, [open, job?.id]);

  const handleShare = () => {
    if (!job) return;
    const shareUrl = getJobShareUrl(job.id);
    navigator.clipboard.writeText(shareUrl);
    toast({ title: t("jobs.details.copied"), description: t("jobs.details.copy_success") });
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return d.toLocaleDateString(i18n.language, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  };

  const maskJobId = (id: string) => {
    const base = id.split("-GHOST")[0];
    if (base.length <= 6) return "••••••";
    return (
      <span className="flex items-center">
        {base.slice(0, -6)}
        <span className="blur-[2px] select-none opacity-40 ml-0.5">XXXXXX</span>
      </span>
    );
  };

  const renderMainWage = () => {
    if (!job) return "-";
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.wage_from) return `$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.salary) return formatSalary(job.salary);
    return t("jobs.details.view_details");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-screen sm:h-auto max-h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg border-0 sm:border text-left">
        {/* HEADER */}
        <div className="p-4 sm:p-6 bg-white border-b sticky top-0 z-40 shadow-sm shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {job?.visa_type && <Badge className="text-[10px] uppercase font-bold">{job.visa_type}</Badge>}
                {job?.job_id && (
                  <span className="font-mono text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {canSeeContacts ? job.job_id.split("-GHOST")[0] : maskJobId(job.job_id)}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl sm:text-3xl leading-tight text-primary font-bold truncate uppercase sm:normal-case">
                {job?.job_title}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-lg text-slate-600 font-medium">
                <span className="flex items-center gap-1 text-slate-900">
                  <Briefcase className="h-4 w-4 text-slate-400" /> {job?.company}
                </span>
                <span className="flex items-center gap-1">
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

        <div className="flex-1 overflow-y-auto bg-slate-50/30 touch-auto">
          <div className="p-4 sm:p-6 space-y-6 pb-32 sm:pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                {/* TIMELINE */}
                <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Posted</span>
                    <span className="text-[11px] font-semibold">{formatDate(job?.posted_date)}</span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[9px] font-bold uppercase text-green-600 mb-1">Start</span>
                    <span className="text-[11px] font-bold text-green-700">{formatDate(job?.start_date)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-red-600 mb-1">End</span>
                    <span className="text-[11px] font-semibold text-red-700">{formatDate(job?.end_date)}</span>
                  </div>
                </div>

                {/* SALARIO E DEDUÇÕES */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 space-y-4 text-left">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <span className="font-semibold text-sm text-slate-600">
                        {t("jobs.details.available_positions")}
                      </span>
                      <Badge className="bg-blue-600 font-bold px-3">{job?.openings || "N/A"}</Badge>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                        <DollarSign className="h-5 w-5" /> <span>Remuneração</span>
                      </div>
                      <p className="text-3xl font-extrabold text-green-700 tracking-tight">{renderMainWage()}</p>
                    </div>
                    {job?.wage_additional && (
                      <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-green-800 text-xs font-medium">
                        {job.wage_additional}
                      </div>
                    )}
                  </div>
                  {job?.rec_pay_deductions && (
                    <div className="bg-red-50 border-t border-red-100 p-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase mb-1">
                        <AlertTriangle className="h-3 w-3" /> Deduções
                      </span>
                      <p className="text-xs text-red-800 font-medium">{job.rec_pay_deductions}</p>
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
                      Carga Horária
                    </span>
                    <span className="text-xl font-bold text-slate-800">
                      {job?.weekly_hours ? `${job.weekly_hours}h / semana` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* CONTATOS (BLOQUEADO PARA VISITANTES/FREE) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  {!canSeeContacts && (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                      <div className="bg-white p-3 rounded-full shadow-lg mb-3 border border-slate-100">
                        <Lock className="h-7 w-7 text-amber-500" />
                      </div>
                      <Button
                        className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold h-9 text-xs px-5 shadow-lg animate-pulse"
                        onClick={() => onOpenChange(false)}
                      >
                        <Rocket className="h-3.5 w-3.5 mr-2" /> Upgrade para Visualizar
                      </Button>
                    </div>
                  )}
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 uppercase text-[10px] tracking-widest">
                    <Mail className="h-4 w-4 text-blue-500" /> Contatos da Empresa
                  </h4>
                  <div className="space-y-4 mt-4">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</span>
                      <div className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 break-all">
                        {canSeeContacts ? job?.email : "••••••••@•••••••.com"}
                      </div>
                    </div>
                    {job?.phone && (
                      <div className="space-y-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefone</span>
                        <div className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100">
                          {canSeeContacts ? job.phone : "+1 (XXX) XXX-XXXX"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DESCRIÇÕES (SEMPRE VISÍVEIS AGORA) */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm text-left">
                  <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800 mb-6 border-b pb-4">
                    <Briefcase className="h-6 w-6 text-blue-600" /> Descrição da Vaga
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{job?.job_duties}</p>
                  {job?.job_min_special_req && (
                    <div className="mt-8 bg-amber-50 rounded-xl p-5 border border-amber-100">
                      <h5 className="font-bold text-amber-900 text-sm mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4" /> Requisitos Especiais
                      </h5>
                      <p className="text-xs text-amber-800 leading-relaxed">{job.job_min_special_req}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER MOBILE */}
        <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 z-50 shadow-lg">
          <Button
            className="flex-1 font-bold h-12 text-base"
            disabled={!canSaveJob}
            onClick={() => job && onAddToQueue(job)}
          >
            {!canSaveJob && <Lock className="h-4 w-4 mr-2" />} Salvar Vaga
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleShare}>
            <Share2 className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
