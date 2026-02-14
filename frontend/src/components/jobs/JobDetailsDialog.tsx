É pra já, sócio! Vamos organizar essa "parte financeira" para ficar tudo junto e lógico.

Movi as informações de **Adicionais** e **Deduções** para dentro do **Card de Salário** (na barra lateral), criando um bloco financeiro completo.

* **Adicionais:** Ficam logo abaixo do salário, em **Verde**, indicando ganho extra.
* **Deduções:** Ficam abaixo dos adicionais, em **Vermelho**, indicando descontos.

Isso limpa a coluna principal (que fica só para descrição e requisitos) e dá destaque total aos valores monetários.

Aqui está o código completo do `src/components/jobs/JobDetailsDialog.tsx`:

```tsx
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
  Wallet
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

  // --- LÓGICA DE STATUS (MUTUAMENTE EXCLUSIVA) ---
  const isCurrentlyEarlyAccess = job?.visa_type?.includes("Early Access");
  const isCertifiedOpportunity = job?.was_early_access && !isCurrentlyEarlyAccess;

  // --- FUNÇÕES DE CONTATO RÁPIDO ---
  const getMessageBody = () => {
    return `Hello! I saw your job posting for ${job?.job_title} at ${job?.company} on H2 Linker and would like to apply. My name is [My Name].`;
  };

  const handleCall = () => {
    window.location.href = `tel:${job.phone}`;
  };

  const handleSMS = () => {
    window.location.href = `sms:${job.phone}?&body=${encodeURIComponent(getMessageBody())}`;
  };

  const handleWhatsApp = () => {
    const cleanPhone = job.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(getMessageBody())}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-screen sm:h-auto max-h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg border-0 sm:border text-left">
        {/* HEADER */}
        <div className="p-4 sm:p-6 bg-white border-b sticky top-0 z-40 shadow-sm shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {/* BADGE VISA TYPE */}
                {job?.visa_type && (
                  <Badge 
                    className={cn(
                      "text-[10px] uppercase font-bold border px-2 py-0.5",
                      // Cores consistentes
                      job.visa_type === "H-2A" && !job.was_early_access && "bg-green-600 border-green-600 text-white hover:bg-green-700",
                      job.visa_type === "H-2B" && !job.was_early_access && "bg-blue-600 border-blue-600 text-white hover:bg-blue-700",
                      (job.visa_type.includes("Early Access") || (job.was_early_access && isCurrentlyEarlyAccess)) && "bg-amber-50 border-amber-400 text-amber-900"
                    )}
                    translate="no"
                  >
                    {isCurrentlyEarlyAccess && <Zap className="h-3 w-3 mr-1 text-amber-600 fill-amber-600 animate-pulse" />}
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
            <div className="space-y-4">
              
              {/* 1. AVISO EARLY ACCESS ATIVO */}
              {isCurrentlyEarlyAccess && (
                <div className="w-full p-5 rounded-2xl border border-violet-200 bg-violet-50/60 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-sm">
                  <div className="bg-violet-600 p-3 rounded-xl text-white shadow-lg shrink-0">
                    <Zap className="h-7 w-7 fill-white animate-pulse" />
                  </div>
                  <div>
                    <p className="text-base font-black text-violet-900 uppercase tracking-tight">
                      {t("jobs.details.active_early_title")}
                    </p>
                    <p className="text-sm text-violet-700 leading-relaxed font-medium mt-0.5">
                      {t("jobs.details.active_early_desc")}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. EXPLICAÇÃO DO GRUPO */}
              {job?.randomization_group && (
                <div
                  className={cn(
                    "w-full p-5 rounded-2xl border flex gap-4 items-start sm:items-center shadow-sm transition-all",
                    job.randomization_group === "A"
                      ? "bg-emerald-50 border-emerald-100"
                      : job.randomization_group === "B"
                        ? "bg-blue-50 border-blue-100"
                        : "bg-amber-50 border-amber-100",
                  )}
                >
                  <div
                    className={cn(
                      "p-3 rounded-xl shrink-0",
                      job.randomization_group === "A"
                        ? "bg-emerald-600 text-white"
                        : job.randomization_group === "B"
                          ? "bg-blue-600 text-white"
                          : "bg-amber-600 text-white",
                    )}
                  >
                    <Info className="h-7 w-7" />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "text-base font-black uppercase tracking-tight",
                        job.randomization_group === "A"
                          ? "text-emerald-900"
                          : job.randomization_group === "B"
                            ? "text-blue-900"
                            : "text-amber-900",
                      )}
                    >
                      {t("jobs.details.group_title", { group: job.randomization_group })}
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium mt-0.5">
                      {job.randomization_group === "A"
                        ? t("jobs.details.group_a_desc")
                        : t("jobs.details.group_general_desc")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 3. CARD HISTÓRICO */}
            {isCertifiedOpportunity && (
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                <div className="bg-amber-500 p-2.5 rounded-xl text-white shadow-lg">
                  <Rocket className="h-6 w-6 animate-bounce" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-amber-900 text-sm tracking-tight">
                    {t("jobs.details.early_access_evolution_title")}
                  </h4>
                  <p className="text-amber-800 text-xs font-medium">{t("jobs.details.early_access_evolution_text")}</p>
                </div>
                <div className="ml-auto hidden sm:block opacity-30">
                  <CheckCircle2 className="h-8 w-8 text-amber-600" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* SIDEBAR (AGORA COM FINANCEIRO COMPLETO) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* --- DATAS COM FONTE AUMENTADA --- */}
                <div className="grid grid-cols-3 gap-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {t("jobs.details.posted")}
                    </span>
                    <span className="text-base font-bold text-slate-700" translate="no">
                      {formatDate(job?.posted_date)}
                    </span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[10px] font-bold uppercase text-green-600 mb-1">
                      {t("jobs.details.start")}
                    </span>
                    <span className="text-base font-bold text-green-700" translate="no">
                      {formatDate(job?.start_date)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-red-600 mb-1">
                      {t("jobs.details.end")}
                    </span>
                    <span className="text-base font-bold text-red-700" translate="no">
                      {formatDate(job?.end_date)}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t("jobs.details.experience")}
                    </span>
                    <span className="text-xl font-bold text-slate-800" translate="no">
                      {formatExperience(job?.experience_months)}
                    </span>
                  </div>
                </div>

                {/* --- CARD DE SALÁRIO EXPANDIDO (Com Adicionais e Deduções) --- */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <span className="font-semibold text-sm text-slate-600">
                      {t("jobs.details.available_positions")}
                    </span>
                    <Badge className="bg-blue-600 font-bold px-3" translate="no">
                      {job?.openings || "N/A"}
                    </Badge>
                  </div>
                  
                  {/* Salário Principal */}
                  <div>
                    <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                      <DollarSign className="h-5 w-5" /> <span>{t("jobs.details.remuneration")}</span>
                    </div>
                    <p className="text-3xl font-extrabold text-green-700 tracking-tight" translate="no">
                      {renderMainWage()}
                    </p>
                  </div>

                  {/* ADICIONAIS (VERDE) */}
                  {job?.wage_additional && (
                    <div className="mt-4 pt-4 border-t border-dashed border-green-200">
                        <h5 className="flex items-center gap-2 text-xs font-bold uppercase text-green-600 mb-2">
                            <Plus className="h-3 w-3" /> Bonuses & Extras
                        </h5>
                        <p className="text-xs text-green-800 leading-relaxed font-medium bg-green-50/50 p-2 rounded">
                            <span translate="yes">{job.wage_additional}</span>
                        </p>
                    </div>
                  )}

                  {/* DEDUÇÕES (VERMELHO) */}
                  {job?.rec_pay_deductions && (
                    <div className="mt-4 pt-4 border-t border-dashed border-red-200">
                        <h5 className="flex items-center gap-2 text-xs font-bold uppercase text-red-600 mb-2">
                            <Minus className="h-3 w-3" /> Deductions
                        </h5>
                        <p className="text-xs text-red-800 leading-relaxed font-medium bg-red-50/50 p-2 rounded">
                            <span translate="yes">{job.rec_pay_deductions}</span>
                        </p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 text-left">
                  <div className="bg-amber-50 p-3 rounded-full text-amber-600">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t("jobs.details.weekly_hours")}
                    </span>
                    <span className="text-xl font-bold text-slate-800" translate="no">
                      {job?.weekly_hours ? `${job.weekly_hours}h` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* --- CONTATOS --- */}
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
                  <div className="space-y-4 mt-4 text-left">
                    
                    {/* EMAIL */}
                    <div translate="no">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1" translate="yes">
                        {t("jobs.details.email_label")}
                      </span>
                      <div className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 break-all flex justify-between items-center">
                         <span>{canSeeContacts ? job?.email : "••••••••@•••••••.com"}</span>
                         {canSeeContacts && (
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => (window.location.href = `mailto:${job.email}`)}>
                               <Mail className="h-3 w-3 text-slate-500" />
                            </Button>
                         )}
                      </div>
                    </div>

                    {/* TELEFONE COM AÇÕES RÁPIDAS */}
                    <div translate="no">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1" translate="yes">
                        {t("jobs.details.phone_label") || "Phone"}
                      </span>
                      <div className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 flex justify-between items-center">
                         <span>{canSeeContacts && job?.phone ? job.phone : "•••-•••-••••"}</span>
                      </div>
                      
                      {canSeeContacts && job?.phone && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                           <Button 
                              variant="outline" 
                              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 h-8 text-xs font-bold"
                              onClick={handleCall}
                           >
                              <Phone className="h-3 w-3 mr-1" /> Call
                           </Button>
                           <Button 
                              variant="outline" 
                              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 h-8 text-xs font-bold"
                              onClick={handleSMS}
                           >
                              <MessageCircle className="h-3 w-3 mr-1" /> SMS
                           </Button>
                           <Button 
                              variant="outline" 
                              className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 h-8 text-xs font-bold"
                              onClick={handleWhatsApp}
                           >
                              <svg viewBox="0 0 24 24" className="h-3 w-3 mr-1 fill-current" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                              </svg>
                              WhatsApp
                           </Button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>

              {/* COLUNA PRINCIPAL 8 (Ficou só com requisitos e descrição) */}
              <div className="lg:col-span-8 space-y-6 text-left">
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

```