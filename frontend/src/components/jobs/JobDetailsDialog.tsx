import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { isMobileNumber, getWhatsAppUrl, getSmsUrl, getPhoneCallUrl } from "@/lib/phone";
import {
  Bus,
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
  overtime_salary?: number | null;
  start_date: string | null;
  end_date?: string | null;
  posted_date: string;
  source_url?: string | null;
  experience_months?: number | null;
  description?: string | null;
  requirements?: string | null;
  education_required?: string | null;
  housing_info: string | null;
  transport_provided: boolean | null;
  tools_provided: boolean | null;
  weekly_hours: number | null;
  job_duties?: string | null;
  job_min_special_req?: string | null;
  wage_additional?: string | null;
  rec_pay_deductions?: string | null;
  crop_activities?: string | null;

  // Novos Campos
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
  training_months?: number | null;
  job_is_lifting?: boolean | null;
  job_lifting_weight?: string | null;
  job_is_drug_screen?: boolean | null;
  job_is_background?: boolean | null;
  job_is_driver?: boolean | null;
  shift_start?: string | null;
  shift_end?: string | null;
  website?: string | null;
};

type PlanSettings = {
  job_db_access: string;
  show_housing_icons: boolean;
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

      if (navigator.share) {
        navigator
          .share({
            title: `${job.job_title} - ${job.company}`,
            text: `${t("jobs.shareText")}: ${job.job_title}`,
            url: shareUrl,
          })
          .catch(() => {
            copyToClipboard(shareUrl);
          });
      } else {
        copyToClipboard(shareUrl);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    const locale = i18n.resolvedLanguage || i18n.language;
    toast({
      title: locale === "pt" ? "Link copiado!" : locale === "es" ? "¡Enlace copiado!" : "Link copied!",
      description:
        locale === "pt"
          ? "Link de compartilhamento copiado para área de transferência"
          : locale === "es"
            ? "Enlace copiado al portapapeles"
            : "Share link copied to clipboard",
    });
  };

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString(i18n.language, { timeZone: "UTC" });
  };

  const yesNo = (v: boolean | null | undefined) => {
    if (v === true) return t("common.yes");
    if (v === false) return t("common.no");
    return "-";
  };

  // 1. Lógica para Salário Base (Com Faixa)
  const renderMainWage = () => {
    if (!job) return "-";

    // Se tem faixa (ex: $15 - $20)
    if (job.wage_from && job.wage_to && job.wage_from !== job.wage_to) {
      return `$${job.wage_from.toFixed(2)} - $${job.wage_to.toFixed(2)} / ${job.wage_unit || "hr"}`;
    }
    // Se tem apenas valor inicial (ex: $15)
    if (job.wage_from) {
      return `$${job.wage_from.toFixed(2)} / ${job.wage_unit || "hr"}`;
    }
    // Fallback para o campo antigo
    if (job.salary) {
      return formatSalary(job.salary);
    }
    return <span className="text-muted-foreground italic">Ver detalhes</span>;
  };

  // 2. Lógica para Hora Extra (Com Faixa "Up To")
  const renderOvertimeWage = () => {
    if (!job) return null;

    // Cenário Ideal: Temos o range completo ($20 - $30)
    if (job.overtime_from && job.overtime_to && job.overtime_from !== job.overtime_to) {
      return `$${job.overtime_from.toFixed(2)} - $${job.overtime_to.toFixed(2)}/h`;
    }
    // Cenário B: Temos apenas o valor base ($20)
    if (job.overtime_from) {
      return `$${job.overtime_from.toFixed(2)}/h`;
    }
    // Cenário C: Legado (Campo antigo)
    if (job.overtime_salary) {
      return `$${Number(job.overtime_salary).toFixed(2)}/h`;
    }

    return null;
  };

  const overtimeText = renderOvertimeWage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="mr-2 text-xl">{job?.job_title}</DialogTitle>
              {badgeConfig && (
                <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                  {badgeConfig.label}
                </Badge>
              )}
              {job?.category && <Badge variant="outline">{job.category}</Badge>}
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
          <Alert variant="destructive" className="bg-purple-50 border-purple-200 shrink-0">
            <AlertTriangle className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-900">{getEarlyAccessDisclaimer(i18n.language)}</AlertDescription>
          </Alert>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <div className="space-y-6 py-2">
            {/* 1. SEÇÃO DE REMUNERAÇÃO E TURNO (Destaque) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <DollarSign className="h-5 w-5" />
                  <span>{t("job_details.sections.wages")}</span>
                </div>
                <div className="pl-7 space-y-1">
                  <p className="text-lg font-bold text-foreground">{renderMainWage()}</p>
                  {job?.pay_frequency && (
                    <p className="text-sm text-muted-foreground capitalize">{job.pay_frequency}</p>
                  )}
                  {job?.wage_additional && (
                    <p className="text-xs text-muted-foreground mt-2 border-l-2 pl-2 border-primary/20">
                      {job.wage_additional}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <Clock className="h-5 w-5" />
                  <span>{t("job_details.sections.schedule")}</span>
                </div>
                <div className="pl-7 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("job_details.fields.weekly_hours")}:</span>
                    <span className="font-medium">{job?.weekly_hours ? `${job.weekly_hours}h` : "-"}</span>
                  </div>
                  {(job?.shift_start || job?.shift_end) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("job_details.fields.shift")}:</span>
                      <span className="font-medium">
                        {job?.shift_start || "?"} - {job?.shift_end || "?"}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("job_details.fields.overtime_available")}:</span>
                    <span className="font-medium">{yesNo(job?.overtime_available)}</span>
                  </div>
                  {/* Exibe Hora Extra com Range se disponível */}
                  {overtimeText && (
                    <div className="flex justify-between text-green-700 font-bold bg-green-50 px-2 py-1 rounded -mx-2">
                      <span>{t("job_details.fields.overtime")}:</span>
                      <span>{overtimeText}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. DATAS E VAGAS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-b pb-6">
              <div>
                <span className="block text-muted-foreground text-xs uppercase">
                  {t("job_details.fields.start_date")}
                </span>
                <span className="font-medium">{formatDate(job?.start_date)}</span>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs uppercase">
                  {t("job_details.fields.end_date")}
                </span>
                <span className="font-medium">{formatDate(job?.end_date)}</span>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs uppercase">
                  {t("job_details.fields.openings")}
                </span>
                <span className="font-medium">{job?.openings || "-"} Vagas</span>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs uppercase">{t("job_details.fields.job_id")}</span>
                <span className="font-mono text-xs">{job?.job_id}</span>
              </div>
            </div>

            {/* 3. LOGÍSTICA (MORADIA E TRANSPORTE) */}
            {(planSettings.job_db_access === "text_only" || planSettings.job_db_access === "visual_premium") && (
              <>
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" />
                    {t("job_details.sections.housing")} & {t("job_details.sections.transport_tools")}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Moradia Card */}
                    <div className="bg-slate-50 p-3 rounded border space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-medium flex items-center gap-2 text-sm">
                          <Home className="h-3 w-3" /> {job?.housing_type || "Moradia"}
                        </span>
                        <Badge variant={job?.housing_type ? "default" : "outline"} className="text-[10px]">
                          {job?.housing_capacity ? `${job.housing_capacity} Cap.` : "Info"}
                        </Badge>
                      </div>

                      {job?.housing_addr || job?.housing_city ? (
                        <div className="text-xs text-muted-foreground flex gap-1 mt-1">
                          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>
                            {job.housing_addr}, {job.housing_city}, {job.housing_state} {job.housing_zip}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{job?.housing_info || "Detalhes sob consulta"}</p>
                      )}

                      {job?.is_meal_provision && (
                        <div className="text-xs flex items-center gap-1 text-green-700">
                          <Utensils className="h-3 w-3" />
                          {job.meal_charge ? `Refeições: $${job.meal_charge}/dia` : "Refeições Fornecidas"}
                        </div>
                      )}
                    </div>

                    {/* Transporte Card */}
                    <div className="bg-slate-50 p-3 rounded border space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium flex items-center gap-2 text-sm">
                          <Car className="h-3 w-3" /> Transporte
                        </span>
                        <span className="text-xs font-bold">{yesNo(job?.transport_provided)}</span>
                      </div>

                      {(job?.transport_min_reimburse || job?.transport_max_reimburse) && (
                        <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block">
                          Reembolso: ${job?.transport_min_reimburse} - ${job?.transport_max_reimburse}
                        </div>
                      )}

                      {job?.transport_desc && (
                        <p className="text-xs text-muted-foreground line-clamp-2" title={job.transport_desc}>
                          {job.transport_desc}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* 4. REQUISITOS FÍSICOS E ESPECIAIS */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                {t("job_details.sections.requirements")}
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div
                  className={cn(
                    "flex flex-col items-center p-3 rounded border text-center gap-2",
                    job?.job_is_lifting ? "bg-red-50 border-red-200" : "bg-slate-50",
                  )}
                >
                  <Weight className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">Levantar Peso</span>
                  <span className="text-[10px] text-muted-foreground">
                    {job?.job_is_lifting ? job.job_lifting_weight || "Sim" : "Não"}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex flex-col items-center p-3 rounded border text-center gap-2",
                    job?.job_is_driver ? "bg-blue-50 border-blue-200" : "bg-slate-50",
                  )}
                >
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">Motorista</span>
                  <span className="text-[10px] text-muted-foreground">{job?.job_is_driver ? "Requer CNH" : "Não"}</span>
                </div>

                <div
                  className={cn(
                    "flex flex-col items-center p-3 rounded border text-center gap-2",
                    job?.job_is_drug_screen ? "bg-yellow-50 border-yellow-200" : "bg-slate-50",
                  )}
                >
                  <FileCheck className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">Anti-Drogas</span>
                  <span className="text-[10px] text-muted-foreground">
                    {job?.job_is_drug_screen ? "Obrigatório" : "Não"}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex flex-col items-center p-3 rounded border text-center gap-2",
                    job?.experience_months ? "bg-green-50 border-green-200" : "bg-slate-50",
                  )}
                >
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">Experiência</span>
                  <span className="text-[10px] text-muted-foreground">
                    {job?.experience_months ? `${job.experience_months} meses` : "Nenhuma"}
                  </span>
                </div>
              </div>

              {/* Textos Longos (Descrição, Deveres, etc) */}
              <div className="space-y-4 mt-4 text-sm text-foreground/80">
                {job?.job_duties && (
                  <div className="bg-muted/20 p-3 rounded">
                    <strong className="block mb-1 text-foreground">{t("job_details.fields.job_duties")}</strong>
                    <p className="whitespace-pre-wrap">{job.job_duties}</p>
                  </div>
                )}

                {job?.requirements && (
                  <div>
                    <strong className="block mb-1 text-foreground">{t("job_details.fields.requirements")}</strong>
                    <p className="whitespace-pre-wrap">{job.requirements}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 5. CONTATO */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{t("job_details.sections.contact")}</h3>
              <div className="rounded-md border p-4 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium select-all">{job?.email}</span>
                  </div>
                  {job?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium select-all">{job.phone}</span>
                    </div>
                  )}
                  {job?.website && (
                    <a
                      href={job.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Visitar Site da Empresa
                    </a>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* Botões de Ação Rápida */}
                  {job?.phone && (
                    <>
                      {getSmsUrl(job.phone) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" className="rounded-full h-10 w-10" asChild>
                              <a href={getSmsUrl(job.phone)!}>
                                <MessageCircle className="h-5 w-5" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>SMS</TooltipContent>
                        </Tooltip>
                      )}
                      {getPhoneCallUrl(job.phone) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="secondary" className="rounded-full h-10 w-10" asChild>
                              <a href={getPhoneCallUrl(job.phone)!}>
                                <PhoneCall className="h-5 w-5" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ligar</TooltipContent>
                        </Tooltip>
                      )}
                      {isMobileNumber(job.phone) && getWhatsAppUrl(job.phone) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              className="rounded-full h-10 w-10 bg-[#25D366] hover:bg-[#128C7E] text-white"
                              asChild
                            >
                              <a href={getWhatsAppUrl(job.phone)!} target="_blank" rel="noreferrer">
                                {/* Ícone SVG WhatsApp Inline */}
                                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>WhatsApp</TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}
                  <Button variant="outline" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              {isInQueue ? (
                <Button className="w-full" variant="destructive" onClick={() => job && onRemoveFromQueue?.(job)}>
                  <Trash2 className="h-4 w-4 mr-2" /> {t("job_details.actions.remove_from_queue")}
                </Button>
              ) : (
                <Button className="w-full" onClick={() => job && onAddToQueue(job)}>
                  <Plus className="h-4 w-4 mr-2" /> {t("job_details.actions.add_to_queue")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
