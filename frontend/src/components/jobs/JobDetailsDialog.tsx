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

  // Helper para sim/não
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

  // Timeline Component
  const Timeline = () => (
    <div className="flex items-center justify-between text-xs text-muted-foreground bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center">
        <span className="font-semibold text-slate-700 mb-1">Postada</span>
        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
          {formatDate(job?.posted_date)}
        </span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-3 relative top-[-8px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-400" />
      </div>
      <div className="flex flex-col items-center">
        <span className="font-semibold text-green-700 mb-1">Início</span>
        <span className="bg-green-50 px-2 py-0.5 rounded border border-green-200 text-green-700 font-bold">
          {formatDate(job?.start_date)}
        </span>
      </div>
      <div className="h-px bg-slate-300 flex-1 mx-3 relative top-[-8px]">
        <ArrowRight className="absolute right-0 top-[-5px] h-3 w-3 text-slate-400" />
      </div>
      <div className="flex flex-col items-center">
        <span className="font-semibold text-red-700 mb-1">Fim</span>
        <span className="bg-red-50 px-2 py-0.5 rounded border border-red-200 text-red-700 font-medium">
          {formatDate(job?.end_date)}
        </span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* MUDANÇA AQUI: sm:max-w-7xl para ficar super largo */}
      <DialogContent className="sm:max-w-7xl max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* HEADER */}
        <DialogHeader className="p-6 pb-4 bg-white border-b sticky top-0 z-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  {badgeConfig && (
                    <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                      {badgeConfig.label}
                    </Badge>
                  )}
                  {job?.job_id && (
                    <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {job.job_id}
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between w-full pr-8">
                  <DialogTitle className="text-2xl sm:text-3xl leading-tight text-primary mt-2 font-bold tracking-tight">
                    {job?.job_title}
                  </DialogTitle>
                </div>
                <DialogDescription className="flex flex-wrap items-center gap-2 text-base text-slate-600 mt-1">
                  <span className="font-bold text-foreground flex items-center gap-1">
                    <Briefcase className="h-4 w-4 text-slate-400" /> {job?.company}
                  </span>
                  <span className="hidden sm:inline text-slate-300">|</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-slate-400" /> {job?.city}, {job?.state}
                  </span>
                </DialogDescription>
              </div>

              {/* Desktop Actions */}
              <div className="hidden sm:flex gap-2 shrink-0">
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                </Button>
                {isInQueue ? (
                  <Button variant="destructive" onClick={() => job && onRemoveFromQueue?.(job)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Remover
                  </Button>
                ) : (
                  <Button onClick={() => job && onAddToQueue(job)} className="px-6 font-bold shadow-sm">
                    <Plus className="h-4 w-4 mr-2" /> Salvar Vaga
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {job && isEarlyAccess(job.visa_type) && (
          <Alert
            variant="destructive"
            className="mx-6 mt-4 bg-red-50 border-red-200 text-red-800 flex items-center py-2"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            <AlertDescription className="text-xs font-semibold">
              {getEarlyAccessDisclaimer(i18n.language)}
            </AlertDescription>
          </Alert>
        )}

        {/* LAYOUT GRID */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {/* Ajuste do grid para aproveitar a largura extra */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* --- COLUNA ESQUERDA (Info Rápida) - 35% --- */}
            <div className="lg:col-span-4 space-y-6">
              <Timeline />

              {/* Salário Card */}
              <div className="bg-white p-5 rounded-xl border border-green-100 shadow-sm space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <div className="flex items-center gap-2 text-green-800 font-bold text-lg border-b border-green-100 pb-2">
                  <DollarSign className="h-6 w-6" /> <span>Remuneração</span>
                </div>
                <div>
                  <p className="text-3xl font-extrabold text-green-700 tracking-tight">{renderMainWage()}</p>
                  {job?.pay_frequency && (
                    <p className="text-sm text-slate-500 font-medium capitalize mt-1">{job.pay_frequency}</p>
                  )}
                </div>
                {job?.wage_additional && (
                  <div className="text-xs bg-green-50 p-3 rounded-lg text-green-900 border border-green-200">
                    <span className="font-bold block text-[10px] uppercase text-green-600 mb-1">Bônus / Adicional</span>
                    {job.wage_additional}
                  </div>
                )}
                {job?.rec_pay_deductions && (
                  <div className="text-xs pt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-600 block mb-1">Deduções Previstas:</span>
                    <span className="text-slate-500 leading-relaxed">{job.rec_pay_deductions}</span>
                  </div>
                )}
              </div>

              {/* Turno Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg border-b border-slate-100 pb-2">
                  <Clock className="h-6 w-6 text-slate-500" /> <span>Jornada</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                    <span className="text-slate-500 font-medium">Carga Semanal:</span>
                    <span className="font-bold text-slate-900 text-base">
                      {job?.weekly_hours ? `${job.weekly_hours}h` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                    <span className="text-slate-500 font-medium">Turno:</span>
                    <span className="font-bold text-slate-900">
                      {job?.shift_start ? `${job.shift_start} - ${job.shift_end}` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-amber-50 p-2 rounded border border-amber-100">
                    <span className="text-amber-800 font-medium flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Hora Extra:
                    </span>
                    {overtimeText ? (
                      <span className="font-bold text-amber-700">{overtimeText}</span>
                    ) : (
                      <span className="font-bold text-amber-700">{yesNo(job?.overtime_available)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Badges de Requisitos */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={cn(
                    "p-3 rounded-lg border text-center flex flex-col items-center justify-center h-24 transition-colors hover:bg-slate-50",
                    job?.experience_months ? "bg-blue-50/50 border-blue-200" : "bg-white border-slate-200",
                  )}
                >
                  <Briefcase className="h-5 w-5 mb-1 text-blue-500" />
                  <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Experiência</span>
                  <span className="text-base font-bold text-slate-800">
                    {job?.experience_months ? `${job.experience_months} Meses` : "Não"}
                  </span>
                </div>
                <div
                  className={cn(
                    "p-3 rounded-lg border text-center flex flex-col items-center justify-center h-24 transition-colors hover:bg-slate-50",
                    job?.education_required ? "bg-purple-50/50 border-purple-200" : "bg-white border-slate-200",
                  )}
                >
                  <BookOpen className="h-5 w-5 mb-1 text-purple-500" />
                  <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Educação</span>
                  <span
                    className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight px-1"
                    title={job?.education_required || ""}
                  >
                    {job?.education_required || "N/A"}
                  </span>
                </div>
                <div
                  className={cn(
                    "p-3 rounded-lg border text-center flex flex-col items-center justify-center h-24 transition-colors hover:bg-slate-50",
                    job?.job_is_lifting ? "bg-orange-50/50 border-orange-200" : "bg-white border-slate-200",
                  )}
                >
                  <Weight className="h-5 w-5 mb-1 text-orange-500" />
                  <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Peso</span>
                  <span className="text-sm font-bold text-slate-800">
                    {job?.job_is_lifting ? job.job_lifting_weight || "Sim" : "Não"}
                  </span>
                </div>
                <div
                  className={cn(
                    "p-3 rounded-lg border text-center flex flex-col items-center justify-center h-24 transition-colors hover:bg-slate-50",
                    job?.job_is_driver ? "bg-yellow-50/50 border-yellow-200" : "bg-white border-slate-200",
                  )}
                >
                  <Car className="h-5 w-5 mb-1 text-yellow-600" />
                  <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">CNH/Driver</span>
                  <span className="text-base font-bold text-slate-800">{job?.job_is_driver ? "Sim" : "Não"}</span>
                </div>
              </div>

              {/* Contato Rápido */}
              <div className="bg-white rounded-xl p-4 space-y-3 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Informações de Contato
                </div>
                <div
                  className="group flex items-center gap-3 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer"
                  onClick={() => copyToClipboard(job?.email || "")}
                >
                  <div className="bg-white p-1.5 rounded-full border border-slate-200 text-blue-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[10px] text-slate-400 font-bold">EMAIL</span>
                    <span className="truncate font-medium text-slate-700 select-all">{job?.email}</span>
                  </div>
                </div>
                {job?.phone && (
                  <div className="group flex items-center gap-3 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-green-200 transition-colors">
                    <div className="bg-white p-1.5 rounded-full border border-slate-200 text-green-500">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[10px] text-slate-400 font-bold">TELEFONE</span>
                      <span className="truncate font-medium text-slate-700 select-all">{job.phone}</span>
                    </div>
                  </div>
                )}
                {job?.website && (
                  <a
                    href={job.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-purple-200 transition-colors hover:bg-purple-50"
                  >
                    <div className="bg-white p-1.5 rounded-full border border-slate-200 text-purple-500">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[10px] text-slate-400 font-bold">WEBSITE</span>
                      <span className="truncate font-medium text-purple-700">Visitar site da empresa</span>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* --- COLUNA DIREITA (Textos Longos) - 65% --- */}
            <div className="lg:col-span-8 space-y-6">
              {/* Requisitos Especiais (Destaque Amarelo) */}
              {job?.job_min_special_req && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-amber-800 mb-3 text-lg">
                    <AlertTriangle className="h-5 w-5" /> Requisitos Especiais & Condições
                  </h4>
                  <p className="text-sm text-amber-900/90 whitespace-pre-wrap leading-relaxed">
                    {job.job_min_special_req}
                  </p>
                </div>
              )}

              {/* Deveres (Destaque Principal) */}
              {job?.job_duties && (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 font-bold text-xl text-slate-800">
                    <Briefcase className="h-6 w-6 text-blue-600" /> Descrição e Deveres
                  </h4>
                  <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[200px]">
                    {job.job_duties}
                  </div>
                </div>
              )}

              {/* Logística (Moradia e Transporte) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm h-full">
                  <h4 className="font-bold flex items-center gap-2 text-slate-700 text-lg border-b border-slate-100 pb-2">
                    <Home className="h-5 w-5 text-indigo-500" /> Moradia
                  </h4>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Tipo:</span>
                    <Badge variant="outline" className="bg-slate-50">
                      {job?.housing_type || "N/A"}
                    </Badge>
                  </div>
                  {job?.housing_info && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                      <span className="font-bold block text-slate-400 text-[10px] uppercase mb-1">Detalhes</span>
                      {job.housing_info}
                    </div>
                  )}
                  {job?.housing_addr && (
                    <div className="flex gap-2 text-xs text-slate-500 items-start">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                      <span>
                        {job.housing_addr}, {job.housing_city}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm h-full">
                  <h4 className="font-bold flex items-center gap-2 text-slate-700 text-lg border-b border-slate-100 pb-2">
                    <Car className="h-5 w-5 text-blue-500" /> Transporte
                  </h4>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Fornecido:</span>
                    <span
                      className={cn(
                        "font-bold px-2 py-0.5 rounded",
                        job?.transport_provided ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {yesNo(job?.transport_provided)}
                    </span>
                  </div>
                  {job?.transport_desc && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed max-h-[150px] overflow-y-auto">
                      <span className="font-bold block text-slate-400 text-[10px] uppercase mb-1">Detalhes</span>
                      {job.transport_desc}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE FOOTER ACTIONS (Apenas mobile) */}
        <div className="sm:hidden p-4 border-t bg-white flex gap-3 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <Button className="flex-1 font-bold h-12 text-base" onClick={() => job && onAddToQueue(job)}>
            <Plus className="h-5 w-5 mr-2" /> Salvar Vaga
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 border-slate-300" onClick={handleShare}>
            <Share2 className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
