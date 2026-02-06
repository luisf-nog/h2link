import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { isMobileNumber, getWhatsAppUrl, getSmsUrl, getPhoneCallUrl } from "@/lib/phone";
import {
  Calendar,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  Trash2,
  Share2,
  AlertTriangle,
  Briefcase,
  Clock,
  DollarSign,
  Car,
  Shield,
  Weight,
  FileCheck,
  Utensils,
  BookOpen,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { getVisaBadgeConfig, isEarlyAccess, getEarlyAccessDisclaimer } from "@/lib/visaTypes";
import { getJobShareUrl } from "@/lib/shareUtils";

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

  // Campos Estendidos
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

  // Novos Campos Mapeados (V4)
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
    if (onShare) {
      onShare(job);
    } else {
      const shareUrl = getJobShareUrl(job.id);
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link copiado!",
      description: "Link de compartilhamento copiado.",
    });
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString(i18n.language, { timeZone: "UTC" });
  };

  const yesNo = (v: boolean | null | undefined) => {
    if (v === true) return t("common.yes", "Sim");
    if (v === false) return t("common.no", "Não");
    return "-";
  };

  const renderMainWage = () => {
    if (!job) return "-";
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`;
    }
    if (job.wage_from) {
      return `$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`;
    }
    if (job.salary) {
      return formatSalary(job.salary);
    }
    return <span className="text-muted-foreground italic">Ver detalhes</span>;
  };

  const renderOvertimeWage = () => {
    if (!job) return null;
    if (job.overtime_from) return `$${job.overtime_from.toFixed(2)}/h`;
    return null;
  };

  const overtimeText = renderOvertimeWage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* HEADER */}
        <DialogHeader className="p-6 pb-4 bg-muted/10 border-b">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="mr-2 text-xl leading-tight">{job?.job_title}</DialogTitle>
              {badgeConfig && (
                <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                  {badgeConfig.label}
                </Badge>
              )}
              {job?.job_id && (
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  {job.job_id}
                </Badge>
              )}
            </div>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
              <span className="font-semibold text-foreground">{job?.company}</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {job?.city}, {job?.state}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        {job && isEarlyAccess(job.visa_type) && (
          <Alert variant="destructive" className="mx-6 mt-4 bg-primary/5 border-primary/20 shrink-0 w-auto">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-foreground text-xs">
              {getEarlyAccessDisclaimer(i18n.language)}
            </AlertDescription>
          </Alert>
        )}

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
          {/* 1. SEÇÃO FINANCEIRA (TURBINADA) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {/* Salário e Benefícios */}
            <div className="bg-green-50/50 p-4 rounded-lg border border-green-100 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-green-800">
                <DollarSign className="h-5 w-5" />
                <span>Remuneração</span>
              </div>

              <div>
                <p className="text-2xl font-bold text-green-700">{renderMainWage()}</p>
                {job?.pay_frequency && <p className="text-xs text-muted-foreground capitalize">{job.pay_frequency}</p>}
              </div>

              {/* Wage Additional (NOVO) */}
              {job?.wage_additional && (
                <div className="text-xs text-green-900 bg-white/60 p-2 rounded border border-green-100">
                  <span className="font-bold block mb-1">Adicional / Bônus:</span>
                  {job.wage_additional}
                </div>
              )}

              {/* Deductions (NOVO) */}
              {job?.rec_pay_deductions && (
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-green-200">
                  <div className="flex items-start gap-1">
                    <Wallet className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-foreground">Deduções:</strong> {job.rec_pay_deductions}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Horário e Turno */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <Clock className="h-5 w-5" />
                <span>Jornada</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-muted-foreground">Horas Semanais:</span>
                  <span className="font-medium">{job?.weekly_hours ? `${job.weekly_hours}h` : "-"}</span>
                </div>
                {(job?.shift_start || job?.shift_end) && (
                  <div className="flex justify-between border-b border-slate-200 pb-1">
                    <span className="text-muted-foreground">Turno:</span>
                    <span className="font-medium">
                      {job?.shift_start} - {job?.shift_end}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground">Hora Extra:</span>
                  {overtimeText ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      {overtimeText}
                    </Badge>
                  ) : (
                    <span className="font-medium">{yesNo(job?.overtime_available)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. REQUISITOS (Lifting, Education, Special) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
              <Shield className="h-4 w-4" /> Requisitos da Vaga
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Experiência */}
              <div
                className={cn(
                  "p-2 rounded border text-center",
                  job?.experience_months ? "bg-blue-50 border-blue-200" : "bg-muted/30",
                )}
              >
                <Briefcase className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <span className="block text-[10px] uppercase text-muted-foreground">Experiência</span>
                <span className="text-sm font-medium">
                  {job?.experience_months ? `${job.experience_months} Meses` : "Não"}
                </span>
              </div>

              {/* Educação (NOVO) */}
              <div
                className={cn(
                  "p-2 rounded border text-center",
                  job?.education_required && job.education_required !== "None"
                    ? "bg-purple-50 border-purple-200"
                    : "bg-muted/30",
                )}
              >
                <BookOpen className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <span className="block text-[10px] uppercase text-muted-foreground">Educação</span>
                <span className="text-sm font-medium truncate px-1" title={job?.education_required || ""}>
                  {job?.education_required || "N/A"}
                </span>
              </div>

              {/* Lifting */}
              <div
                className={cn(
                  "p-2 rounded border text-center",
                  job?.job_is_lifting ? "bg-orange-50 border-orange-200" : "bg-muted/30",
                )}
              >
                <Weight className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <span className="block text-[10px] uppercase text-muted-foreground">Peso</span>
                <span className="text-sm font-medium">
                  {job?.job_is_lifting ? job.job_lifting_weight || "Sim" : "Não"}
                </span>
              </div>

              {/* Motorista */}
              <div
                className={cn(
                  "p-2 rounded border text-center",
                  job?.job_is_driver ? "bg-yellow-50 border-yellow-200" : "bg-muted/30",
                )}
              >
                <Car className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <span className="block text-[10px] uppercase text-muted-foreground">Motorista</span>
                <span className="text-sm font-medium">{job?.job_is_driver ? "Sim" : "Não"}</span>
              </div>
            </div>

            {/* Special Requirements Text (NOVO) */}
            {job?.job_min_special_req && (
              <div className="bg-amber-50/50 p-3 rounded border border-amber-100 text-sm">
                <strong className="text-amber-800 block mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Requisitos Especiais / Condições:
                </strong>
                <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed text-xs">
                  {job.job_min_special_req}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* 3. LOGÍSTICA (Moradia e Transporte) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
              <Home className="h-4 w-4" /> Logística
            </h4>

            {/* Housing Info */}
            <div className="bg-muted/20 rounded p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="font-medium flex items-center gap-2">
                  <Home className="h-3 w-3" /> Moradia:
                </span>
                <Badge variant={job?.housing_type ? "default" : "outline"}>{job?.housing_type || "Info"}</Badge>
              </div>
              {job?.housing_info && <p className="text-xs text-muted-foreground">{job.housing_info}</p>}
              {job?.housing_addr && (
                <div className="text-xs flex gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" /> {job.housing_addr}, {job.housing_city}
                </div>
              )}
            </div>

            {/* Transport Info */}
            <div className="bg-muted/20 rounded p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="font-medium flex items-center gap-2">
                  <Car className="h-3 w-3" /> Transporte:
                </span>
                <span className="font-bold">{yesNo(job?.transport_provided)}</span>
              </div>
              {job?.transport_desc && (
                <p className="text-xs text-muted-foreground border-l-2 border-primary/20 pl-2">{job.transport_desc}</p>
              )}
            </div>
          </div>

          {/* 4. DEVERES DO TRABALHO */}
          {job?.job_duties && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Briefcase className="h-4 w-4" /> Deveres / Descrição
              </h4>
              <div className="bg-muted/10 p-4 rounded border text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {job.job_duties}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTION */}
        <div className="p-4 border-t bg-muted/10 flex justify-between items-center gap-4">
          <div className="flex flex-col text-xs text-muted-foreground">
            <span>Postada: {formatDate(job?.posted_date)}</span>
            <span>Início: {formatDate(job?.start_date)}</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" /> Compartilhar
            </Button>
            {isInQueue ? (
              <Button variant="destructive" onClick={() => job && onRemoveFromQueue?.(job)}>
                <Trash2 className="h-4 w-4 mr-2" /> Remover
              </Button>
            ) : (
              <Button onClick={() => job && onAddToQueue(job)}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar à Fila
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
