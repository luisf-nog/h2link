import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getJobShareUrl } from "@/lib/shareUtils";
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
import {
  Calendar,
  Home,
  Mail,
  MapPin,
  Share2,
  AlertTriangle,
  Briefcase,
  Clock,
  DollarSign,
  Car,
  Shield,
  Weight,
  FileCheck,
  BookOpen,
  Wallet,
  ArrowRight,
  Phone,
  MessageCircle,
  PhoneCall,
  Check,
  Plus,
  Trash2,
  Globe,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { isMobileNumber, getWhatsAppUrl, getSmsUrl, getPhoneCallUrl } from "@/lib/phone";

export type JobDetails = {
  id: string;
  job_id: string;
  visa_type: "H-2B" | "H-2A" | string | null;
  company: string;
  email: string;
  phone?: string | null;
  job_title: string;
  category: string | null;
  city: string;
  state: string;
  worksite_address?: string | null;
  worksite_zip?: string | null;
  openings?: number | null;
  salary: number | null;
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
  source_url?: string | null;
  experience_months?: number | null;
  description?: string | null;
  requirements?: string | null;
  wage_from?: number | null;
  wage_to?: number | null;
  wage_unit?: string | null;
  pay_frequency?: string | null;
  overtime_available?: boolean | null;
  overtime_from?: number | null;
  overtime_to?: number | null;
  transport_min_reimburse?: number | null;
  transport_max_reimburse?: number | null;
  transport_desc?: string | null;
  housing_type?: string | null;
  housing_addr?: string | null;
  housing_city?: string | null;
  housing_state?: string | null;
  housing_zip?: string | null;
  housing_capacity?: number | null;
  is_meal_provision?: boolean | null;
  meal_charge?: number | null;
  transport_provided?: boolean | null;
  housing_info?: string | null;
  job_min_special_req?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
  education_required?: string | null;
  job_is_lifting?: boolean | null;
  job_lifting_weight?: string | null;
  job_is_drug_screen?: boolean | null;
  job_is_background?: boolean | null;
  job_is_driver?: boolean | null;
  weekly_hours?: number | null;
  shift_start?: string | null;
  shift_end?: string | null;
  job_duties?: string | null;
  website?: string | null;
};

type PlanSettings = {
  job_db_access: string;
  show_housing_icons: boolean;
  job_db_blur?: boolean;
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDetails | null;
  planSettings: PlanSettings;
  formatSalary: (salary: number | null) => string;
  onAddToQueue: (job: JobDetails) => void;
  onRemoveFromQueue?: (job: JobDetails) => void;
  isInQueue?: boolean;
  onShare?: (job: JobDetails) => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const badgeConfig = job ? getVisaBadgeConfig(job.visa_type) : null;

  const handleShare = () => {
    if (!job) return;
    if (onShare) onShare(job);
    else {
      const shareUrl = getJobShareUrl(job.id);
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Link copiado!", description: "Link de compartilhamento copiado." });
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString(i18n.language, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  };

  // --- A FUNÇÃO QUE FALTAVA ---
  const yesNo = (v: boolean | null | undefined) => {
    if (v === true) return t("common.yes", "Sim");
    if (v === false) return t("common.no", "Não");
    return "-";
  };

  const renderMainWage = () => {
    if (!job) return "-";
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to)
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.wage_from) return `$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`;
    if (job.salary) return formatSalary(job.salary);
    return <span className="text-muted-foreground italic">Ver detalhes</span>;
  };

  const renderOvertimeWage = () => (job?.overtime_from ? `$${job.overtime_from.toFixed(2)}/h` : null);
  const overtimeText = renderOvertimeWage();

  // Componente de Linha do Tempo
  const Timeline = () => (
    <div className="flex items-center justify-between text-xs text-muted-foreground bg-slate-50 p-2 rounded-lg border border-slate-100">
      <div className="flex flex-col items-center">
        <span className="font-semibold text-slate-700">Postada</span>
        <span>{formatDate(job?.posted_date)}</span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-2 relative top-[-6px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-300" />
      </div>
      <div className="flex flex-col items-center">
        <span className="font-semibold text-green-700">Início</span>
        <span>{formatDate(job?.start_date)}</span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-2 relative top-[-6px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-300" />
      </div>
      <div className="flex flex-col items-center">
        <span className="font-semibold text-red-700">Fim</span>
        <span>{formatDate(job?.end_date)}</span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* HEADER */}
        <DialogHeader className="p-5 pb-4 bg-white border-b sticky top-0 z-10">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {badgeConfig && (
                    <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                      {badgeConfig.label}
                    </Badge>
                  )}
                  {job?.job_id && (
                    <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">
                      {job.job_id}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-xl sm:text-2xl leading-tight text-primary mt-1">
                  {job?.job_title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-base text-slate-600">
                  <span className="font-semibold">{job?.company}</span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {job?.city}, {job?.state}
                  </span>
                </DialogDescription>
              </div>

              {/* Actions Header (Desktop) */}
              <div className="hidden sm:flex gap-2">
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                </Button>
                {isInQueue ? (
                  <Button variant="destructive" size="sm" onClick={() => job && onRemoveFromQueue?.(job)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Remover
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => job && onAddToQueue(job)}>
                    <Plus className="h-4 w-4 mr-2" /> Salvar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {job && isEarlyAccess(job.visa_type) && (
          <Alert variant="destructive" className="m-4 mb-0 bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs font-medium">
              {getEarlyAccessDisclaimer(i18n.language)}
            </AlertDescription>
          </Alert>
        )}

        {/* LAYOUT GRID PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* --- COLUNA ESQUERDA (Info Rápida) --- */}
            <div className="lg:col-span-4 space-y-5">
              {/* Timeline (Nova) */}
              <Timeline />

              {/* Salário Card */}
              <div className="bg-green-50/80 p-4 rounded-lg border border-green-100 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-green-800 font-semibold border-b border-green-200 pb-2">
                  <DollarSign className="h-5 w-5" /> <span>Remuneração</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{renderMainWage()}</p>
                  {job?.pay_frequency && (
                    <p className="text-xs text-muted-foreground capitalize">{job.pay_frequency}</p>
                  )}
                </div>
                {job?.wage_additional && (
                  <div className="text-xs bg-white/80 p-2 rounded text-green-900 border border-green-100">
                    <span className="font-bold block text-[10px] uppercase text-green-600 mb-0.5">Adicional</span>
                    {job.wage_additional}
                  </div>
                )}
                {job?.rec_pay_deductions && (
                  <div className="text-xs pt-1 border-t border-green-200/60">
                    <span className="font-bold text-green-800">Deduções:</span>{" "}
                    <span className="text-green-900/80">{job.rec_pay_deductions}</span>
                  </div>
                )}
              </div>

              {/* Turno Card */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-200 pb-2">
                  <Clock className="h-5 w-5" /> <span>Jornada</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Semanal:</span>
                    <span className="font-medium">{job?.weekly_hours ? `${job.weekly_hours}h` : "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Turno:</span>
                    <span className="font-medium">
                      {job?.shift_start ? `${job.shift_start} - ${job.shift_end}` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-100">
                    <span className="text-muted-foreground text-xs">Hora Extra:</span>
                    {overtimeText ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                        {overtimeText}
                      </Badge>
                    ) : (
                      <span className="font-medium text-xs">{yesNo(job?.overtime_available)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Badges de Requisitos */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={cn(
                    "p-2 rounded border text-center flex flex-col items-center justify-center h-20",
                    job?.experience_months ? "bg-blue-50 border-blue-200" : "bg-slate-50",
                  )}
                >
                  <Briefcase className="h-4 w-4 mb-1 text-muted-foreground" />
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Experiência</span>
                  <span className="text-sm font-medium">
                    {job?.experience_months ? `${job.experience_months} Meses` : "Não"}
                  </span>
                </div>
                <div
                  className={cn(
                    "p-2 rounded border text-center flex flex-col items-center justify-center h-20",
                    job?.education_required ? "bg-purple-50 border-purple-200" : "bg-slate-50",
                  )}
                >
                  <BookOpen className="h-4 w-4 mb-1 text-muted-foreground" />
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Educação</span>
                  <span className="text-xs font-medium line-clamp-2 px-1" title={job?.education_required || ""}>
                    {job?.education_required || "N/A"}
                  </span>
                </div>
                <div
                  className={cn(
                    "p-2 rounded border text-center flex flex-col items-center justify-center h-20",
                    job?.job_is_lifting ? "bg-orange-50 border-orange-200" : "bg-slate-50",
                  )}
                >
                  <Weight className="h-4 w-4 mb-1 text-muted-foreground" />
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Peso</span>
                  <span className="text-xs font-medium">
                    {job?.job_lifting_weight || (job?.job_is_lifting ? "Sim" : "Não")}
                  </span>
                </div>
                <div
                  className={cn(
                    "p-2 rounded border text-center flex flex-col items-center justify-center h-20",
                    job?.job_is_driver ? "bg-yellow-50 border-yellow-200" : "bg-slate-50",
                  )}
                >
                  <Car className="h-4 w-4 mb-1 text-muted-foreground" />
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">CNH/Driver</span>
                  <span className="text-sm font-medium">{job?.job_is_driver ? "Sim" : "Não"}</span>
                </div>
              </div>

              {/* Contato Rápido */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Contato
                </div>
                <div className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-slate-200">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="truncate flex-1 select-all">{job?.email}</span>
                </div>
                {job?.phone && (
                  <div className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-slate-200">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="truncate flex-1 select-all">{job.phone}</span>
                  </div>
                )}
                {job?.website && (
                  <a
                    href={job.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-slate-200 hover:bg-slate-50 text-blue-600"
                  >
                    <Globe className="h-4 w-4 text-slate-400" />
                    <span className="truncate flex-1">Website da Vaga</span>
                  </a>
                )}
              </div>
            </div>

            {/* --- COLUNA DIREITA (Textos Longos) --- */}
            <div className="lg:col-span-8 space-y-6">
              {/* Requisitos Especiais (Destaque Amarelo) */}
              {job?.job_min_special_req && (
                <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                  <h4 className="flex items-center gap-2 font-bold text-amber-800 mb-2">
                    <AlertTriangle className="h-5 w-5" /> Requisitos Especiais & Condições
                  </h4>
                  <p className="text-sm text-amber-900/90 whitespace-pre-wrap leading-relaxed">
                    {job.job_min_special_req}
                  </p>
                </div>
              )}

              {/* Deveres (Destaque Principal) */}
              {job?.job_duties && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 font-semibold text-lg text-foreground">
                    <Briefcase className="h-5 w-5 text-primary" /> Descrição e Deveres
                  </h4>
                  <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-lg border border-slate-200 shadow-sm min-h-[150px]">
                    {job.job_duties}
                  </div>
                </div>
              )}

              {/* Logística (Moradia e Transporte) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2 text-slate-700">
                    <Home className="h-4 w-4" /> Moradia
                  </h4>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant="outline" className="bg-white">
                      {job?.housing_type || "N/A"}
                    </Badge>
                  </div>
                  {job?.housing_info && (
                    <p className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-100">
                      {job.housing_info}
                    </p>
                  )}
                  {job?.housing_addr && (
                    <div className="flex gap-2 text-xs text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                      {job.housing_addr}, {job.housing_city}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2 text-slate-700">
                    <Car className="h-4 w-4" /> Transporte
                  </h4>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Fornecido:</span>
                    <span className={cn("font-bold", job?.transport_provided ? "text-green-600" : "text-slate-400")}>
                      {yesNo(job?.transport_provided)}
                    </span>
                  </div>
                  {job?.transport_desc && (
                    <p className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-100 max-h-[80px] overflow-y-auto">
                      {job.transport_desc}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE FOOTER ACTIONS (Apenas mobile) */}
        <div className="sm:hidden p-4 border-t bg-white flex gap-2 sticky bottom-0">
          <Button className="flex-1" onClick={() => job && onAddToQueue(job)}>
            <Plus className="h-4 w-4 mr-2" /> Salvar
          </Button>
          <Button variant="outline" size="icon" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
