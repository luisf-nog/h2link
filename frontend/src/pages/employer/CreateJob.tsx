import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsEmployer } from "@/hooks/useIsEmployer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Search,
  Lock,
  Briefcase,
  DollarSign,
  CheckCircle2,
  Save,
  AlertTriangle,
  Pencil,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  Building2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface FoundJob {
  job_id: string;
  job_title: string;
  company: string;
  city: string;
  state: string;
  salary: number | null;
  start_date: string | null;
  end_date: string | null;
  openings: number | null;
  visa_type: string | null;
  category: string | null;
  description: string | null;
  requirements: string | null;
  education_required: string | null;
  experience_months: number | null;
  housing_info: string | null;
  transport_provided: boolean | null;
  job_duties: string | null;
  job_min_special_req: string | null;
  wage_additional: string | null;
  rec_pay_deductions: string | null;
  weekly_hours: number | null;
  phone: string | null;
  email: string;
}

export default function CreateJob() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [isFetchingDol, setIsFetchingDol] = useState(false);
  const [activeSection, setActiveSection] = useState("dol-lookup");
  const [dolCaseNumber, setDolCaseNumber] = useState("");

  const [searchStatus, setSearchStatus] = useState<"idle" | "success" | "not_found">("idle");
  const [dolOriginalData, setDolOriginalData] = useState<Record<string, any>>({});

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [foundJob, setFoundJob] = useState<FoundJob | null>(null);

  const FORM_SECTIONS = [
    { id: "dol-lookup", label: t("employer.create_job.step1"), icon: Search },
    { id: "job-info", label: t("employer.create_job.step2"), icon: Briefcase },
    { id: "financials", label: t("employer.create_job.step3"), icon: DollarSign },
    { id: "requirements", label: t("employer.create_job.step4"), icon: CheckCircle2 },
  ];

  const [form, setForm] = useState({
    title: "",
    visa_type: "H-2B",
    employer_name: "",
    location_city: "",
    location_state: "",
    start_date: "",
    end_date: "",
    positions: "",
    wage_rate: "",
    benefits: "",
    deductions: "",
    description: "",
    job_duties: "",
    job_min_special_req: "",

    english_proficiency: "none",
    min_experience_months: "0",
    drivers_license: "not_required",
    equipment_experience: "",

    req_lift_lbs: "",
    req_extreme_weather: false,
    req_full_contract_availability: false,
    req_travel_worksite: false,
    req_background_check: false,

    // Eliminatory requirements (affects match score)
    req_english: false,
    req_experience: false,
    req_drivers_license: false,
    consular_only: false,

    // H-2 specific preferences
    returning_worker: "not_required",
    previous_h2_visa: "not_required",
  });

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const isFieldLocked = (fieldName: keyof typeof form) => {
    if (searchStatus === "idle") return true;
    if (searchStatus === "not_found") return false;
    const originalValue = dolOriginalData[fieldName];
    return originalValue !== undefined && originalValue !== null && originalValue !== "";
  };

  const handleDolLookup = async () => {
    if (!dolCaseNumber.trim()) {
      toast({ title: t("employer.create_job.case_required"), description: t("employer.create_job.case_required_desc"), variant: "destructive" });
      return;
    }

    setIsFetchingDol(true);

    try {
      const searchTerm = dolCaseNumber.trim();

      const { data, error } = await supabase
        .from("public_jobs")
        .select("job_id, job_title, company, city, state, salary, start_date, end_date, openings, visa_type, category, description, requirements, education_required, experience_months, housing_info, transport_provided, job_duties, job_min_special_req, wage_additional, rec_pay_deductions, weekly_hours, phone, email")
        .eq("job_id", searchTerm)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFoundJob(data as FoundJob);
        setShowConfirmDialog(true);
      } else {
        setDolOriginalData({});
        setSearchStatus("not_found");
        toast({
          title: t("employer.create_job.not_found_title"),
          description: t("employer.create_job.not_found_desc"),
          variant: "default",
        });
        scrollToSection("job-info");
      }
    } catch (error: any) {
      setDolOriginalData({});
      setSearchStatus("not_found");
      toast({ title: t("employer.create_job.search_error"), description: error.message || "", variant: "destructive" });
      scrollToSection("job-info");
    } finally {
      setIsFetchingDol(false);
    }
  };

  const handleConfirmImport = () => {
    if (!foundJob) return;

    const mapped: Record<string, any> = {};
    const formData: Partial<typeof form> = {};

    if (foundJob.job_title) { mapped.title = foundJob.job_title; formData.title = foundJob.job_title; }
    if (foundJob.visa_type) { mapped.visa_type = foundJob.visa_type; formData.visa_type = foundJob.visa_type; }
    if (foundJob.company) { mapped.employer_name = foundJob.company; formData.employer_name = foundJob.company; }
    if (foundJob.city) { mapped.location_city = foundJob.city; formData.location_city = foundJob.city; }
    if (foundJob.state) { mapped.location_state = foundJob.state; formData.location_state = foundJob.state; }
    if (foundJob.start_date) { mapped.start_date = foundJob.start_date; formData.start_date = foundJob.start_date; }
    if (foundJob.end_date) { mapped.end_date = foundJob.end_date; formData.end_date = foundJob.end_date; }
    if (foundJob.openings) { mapped.positions = String(foundJob.openings); formData.positions = String(foundJob.openings); }
    if (foundJob.salary) { mapped.wage_rate = `$${foundJob.salary.toFixed(2)} / hour`; formData.wage_rate = `$${foundJob.salary.toFixed(2)} / hour`; }
    if (foundJob.housing_info) { mapped.benefits = foundJob.housing_info; formData.benefits = foundJob.housing_info; }
    if (foundJob.rec_pay_deductions) { mapped.deductions = foundJob.rec_pay_deductions; formData.deductions = foundJob.rec_pay_deductions; }
    if (foundJob.description) { mapped.description = foundJob.description; formData.description = foundJob.description; }
    if (foundJob.job_duties) { mapped.job_duties = foundJob.job_duties; formData.job_duties = foundJob.job_duties; }
    if (foundJob.job_min_special_req) { mapped.job_min_special_req = foundJob.job_min_special_req; formData.job_min_special_req = foundJob.job_min_special_req; }
    if (foundJob.experience_months && foundJob.experience_months > 0) {
      const months = foundJob.experience_months;
      const val = months >= 12 ? "12" : months >= 6 ? "6" : months >= 3 ? "3" : "0";
      mapped.min_experience_months = val;
      formData.min_experience_months = val;
    }

    setDolOriginalData(mapped);
    setForm((p) => ({ ...p, ...formData }));
    setSearchStatus("success");
    setShowConfirmDialog(false);
    toast({ title: t("employer.create_job.imported_title"), description: t("employer.create_job.imported_desc") });
    scrollToSection("job-info");
  };

  const handleCancelImport = () => {
    setShowConfirmDialog(false);
    setFoundJob(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!employerProfile) return;
    if (searchStatus === "idle") return;

    setLoading(true);

    const { data: canCreate } = await supabase.rpc("check_employer_job_limit", {
      p_employer_id: employerProfile.id,
    });

    if (!canCreate) {
      toast({ title: t("employer.create_job.limit_reached"), description: t("employer.create_job.limit_reached_desc") });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("sponsored_jobs").insert({
      employer_id: employerProfile.id,
      title: form.title.trim(),
      description: form.description.trim() || form.benefits.trim() || null,
      location: `${form.location_city}, ${form.location_state}`,
      city: form.location_city.trim() || null,
      state: form.location_state.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      num_positions: form.positions ? parseInt(form.positions) : 1,
      wage_rate: form.wage_rate.trim() || null,
      benefits: form.benefits.trim() || null,
      deductions: form.deductions.trim() || null,
      primary_duties: form.job_duties.trim() || null,
      additional_notes: form.job_min_special_req.trim() || null,
      priority_level: employerProfile.tier,
      dol_case_number: dolCaseNumber.trim() || null,
      employer_legal_name: form.employer_name.trim() || null,
      visa_type: form.visa_type || "H-2B",
      is_sponsored: true,

      english_proficiency: form.english_proficiency,
      min_experience_months: parseInt(form.min_experience_months),
      drivers_license: form.drivers_license,
      equipment_experience: form.equipment_experience.trim() || null,
      req_lift_lbs: form.req_lift_lbs ? parseInt(form.req_lift_lbs) : null,
      req_extreme_weather: form.req_extreme_weather,
      req_full_contract_availability: form.req_full_contract_availability,
      req_travel_worksite: form.req_travel_worksite,
      req_background_check: form.req_background_check,

      // Eliminatory requirements
      req_english: form.req_english,
      req_experience: form.req_experience,
      req_drivers_license: form.req_drivers_license,
      consular_only: form.consular_only,

      // H-2 specific preferences
      returning_worker: form.returning_worker,
      previous_h2_visa: form.previous_h2_visa,
    });

    if (error) {
      toast({ title: t("employer.create_job.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("employer.create_job.published"), description: t("employer.create_job.published_desc") });
      navigate("/employer/jobs");
    }
    setLoading(false);
  };

  const fieldLabels: Record<string, string> = {
    title: t("employer.create_job.job_title"),
    visa_type: t("employer.create_job.visa_type"),
    employer_name: t("employer.create_job.employer_name"),
    location_city: t("employer.create_job.city"),
    location_state: t("employer.create_job.state"),
    start_date: t("employer.create_job.start_date"),
    end_date: t("employer.create_job.end_date"),
    positions: t("employer.create_job.num_positions"),
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {t("employer.create_job.found_title")}
            </DialogTitle>
            <DialogDescription>
              {t("employer.create_job.found_desc")}
            </DialogDescription>
          </DialogHeader>

          {foundJob && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Search className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("employer.create_job.case_number")}</p>
                    <p className="font-semibold font-mono text-sm">{foundJob.job_id}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("employer.create_job.company")}</p>
                    <p className="font-semibold">{foundJob.company}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("employer.create_job.position")}</p>
                    <p className="font-semibold">{foundJob.job_title}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("employer.create_job.location")}</p>
                      <p className="text-sm font-semibold">{foundJob.city}, {foundJob.state}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("employer.create_job.salary")}</p>
                      <p className="text-sm font-semibold">
                        {foundJob.salary ? `$${foundJob.salary.toFixed(2)}/hr` : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("employer.create_job.start_date")}</p>
                      <p className="text-sm font-semibold">{foundJob.start_date || "N/A"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("employer.create_job.positions_label")}</p>
                      <p className="text-sm font-semibold">{foundJob.openings || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {foundJob.visa_type && (
                  <div className="pt-2 border-t border-border">
                    <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                      {foundJob.visa_type}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelImport}>
              {t("employer.create_job.cancel")}
            </Button>
            <Button onClick={handleConfirmImport} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {t("employer.create_job.confirm_import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/employer/jobs")} className="-ml-3 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("employer.create_job.back_to_jobs")}
          </Button>
          <h1 className="text-3xl font-bold font-brand">{t("employer.create_job.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("employer.create_job.subtitle")}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/employer/jobs")} disabled={loading}>
            {t("employer.create_job.cancel")}
          </Button>
          <Button
            onClick={() => handleSubmit()}
            disabled={loading || searchStatus === "idle" || employerProfile?.status !== "active"}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("employer.create_job.publish")}
          </Button>
        </div>
      </div>

      {employerProfile?.status !== "active" && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{t("employer.create_job.inactive_title")}</p>
            <p className="text-sm">{t("employer.create_job.inactive_desc")}</p>
            <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate("/employer/plans")}>
              {t("employer.create_job.view_plans")}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        <div className="hidden md:block col-span-1 sticky top-24 space-y-2">
          <h3 className="text-sm font-semibold mb-4 px-2">{t("employer.create_job.steps_label")}</h3>
          {FORM_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${
                  activeSection === section.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        <div className="col-span-1 md:col-span-3 space-y-10 pb-24">
          {/* Step 1: DOL Lookup */}
          <Card id="dol-lookup" className="border-border shadow-sm scroll-mt-24">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-xl">{t("employer.create_job.step1")}</CardTitle>
              <CardDescription>
                {t("employer.create_job.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="case_number">{t("employer.create_job.case_number_label")}</Label>
                  <Input
                    id="case_number"
                    value={dolCaseNumber}
                    onChange={(e) => setDolCaseNumber(e.target.value)}
                    placeholder={t("employer.create_job.case_number_placeholder")}
                    onKeyDown={(e) => e.key === "Enter" && handleDolLookup()}
                  />
                </div>
                <Button
                  onClick={handleDolLookup}
                  disabled={isFetchingDol || !dolCaseNumber.trim()}
                >
                  {isFetchingDol ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {t("employer.create_job.search")}
                </Button>
              </div>

              {searchStatus === "not_found" && (
                <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">
                    <strong>{t("employer.create_job.not_found_title")}.</strong> {t("employer.create_job.not_found_desc")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sections 2-4 only visible after search */}
          {searchStatus !== "idle" && (
            <>
              <Card id="job-info" className="border-border shadow-sm scroll-mt-24">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-xl">{t("employer.create_job.step2")}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {searchStatus === "success" && (
                    <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex items-start gap-3">
                      <Lock className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed">
                        <strong>{t("employer.create_job.imported_title")}</strong> {t("employer.create_job.imported_success_msg")}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {([
                      { key: "title" as const, label: fieldLabels.title, type: "text", cols: 2 },
                      { key: "visa_type" as const, label: fieldLabels.visa_type, type: "text", cols: 1 },
                      { key: "employer_name" as const, label: fieldLabels.employer_name, type: "text", cols: 1 },
                      { key: "location_city" as const, label: fieldLabels.location_city, type: "text", cols: 1 },
                      { key: "location_state" as const, label: fieldLabels.location_state, type: "text", cols: 1 },
                      { key: "start_date" as const, label: fieldLabels.start_date, type: "date", cols: 1 },
                      { key: "end_date" as const, label: fieldLabels.end_date, type: "date", cols: 1 },
                      { key: "positions" as const, label: fieldLabels.positions, type: "number", cols: 1 },
                    ]).map((field) => {
                      const locked = isFieldLocked(field.key);
                      return (
                        <div key={field.key} className={`space-y-2 ${field.cols === 2 ? "col-span-1 md:col-span-2" : ""}`}>
                          <Label className="flex items-center gap-2">
                            {field.label}{" "}
                            {locked ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Pencil className="w-3 h-3 text-blue-500" />}
                          </Label>
                          <Input
                            type={field.type}
                            disabled={locked}
                            value={form[field.key] as string}
                            onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                            className={locked ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t("employer.create_job.job_duties")}
                      {isFieldLocked("job_duties") ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Pencil className="w-3 h-3 text-blue-500" />}
                    </Label>
                    <Textarea
                      disabled={isFieldLocked("job_duties")}
                      value={form.job_duties}
                      onChange={(e) => setForm((p) => ({ ...p, job_duties: e.target.value }))}
                      className={isFieldLocked("job_duties") ? "bg-muted/50 text-muted-foreground cursor-not-allowed resize-none" : "resize-y"}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t("employer.create_job.special_requirements")}
                      {isFieldLocked("job_min_special_req") ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Pencil className="w-3 h-3 text-blue-500" />}
                    </Label>
                    <Textarea
                      disabled={isFieldLocked("job_min_special_req")}
                      value={form.job_min_special_req}
                      onChange={(e) => setForm((p) => ({ ...p, job_min_special_req: e.target.value }))}
                      className={isFieldLocked("job_min_special_req") ? "bg-muted/50 text-muted-foreground cursor-not-allowed resize-none" : "resize-y"}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card id="financials" className="border-border shadow-sm scroll-mt-24">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-xl">{t("employer.create_job.step3")}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2 md:w-1/2">
                    <Label className="flex items-center gap-2">
                      {t("employer.create_job.wage_rate")}
                      {isFieldLocked("wage_rate") ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Pencil className="w-3 h-3 text-blue-500" />}
                    </Label>
                    <Input
                      disabled={isFieldLocked("wage_rate")}
                      value={form.wage_rate}
                      onChange={(e) => setForm((p) => ({ ...p, wage_rate: e.target.value }))}
                      className={isFieldLocked("wage_rate") ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t("employer.create_job.benefits_housing")}
                      {isFieldLocked("benefits") ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Pencil className="w-3 h-3 text-blue-500" />}
                    </Label>
                    <Textarea
                      disabled={isFieldLocked("benefits")}
                      value={form.benefits}
                      onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))}
                      className={isFieldLocked("benefits") ? "bg-muted/50 text-muted-foreground cursor-not-allowed resize-none" : "resize-y"}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t("employer.create_job.deductions")}
                      {isFieldLocked("deductions") ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Pencil className="w-3 h-3 text-blue-500" />}
                    </Label>
                    <Textarea
                      disabled={isFieldLocked("deductions")}
                      value={form.deductions}
                      onChange={(e) => setForm((p) => ({ ...p, deductions: e.target.value }))}
                      className={isFieldLocked("deductions") ? "bg-muted/50 text-muted-foreground cursor-not-allowed resize-none" : "resize-y"}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card id="requirements" className="border-border shadow-sm scroll-mt-24">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-xl">{t("employer.create_job.requirements_title")}</CardTitle>
                  <CardDescription>
                    {t("employer.create_job.requirements_desc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-base">{t("employer.create_job.prior_experience")}</Label>
                      <Select
                        value={form.min_experience_months}
                        onValueChange={(v) => setForm((p) => ({ ...p, min_experience_months: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">{t("employer.create_job.exp_none")}</SelectItem>
                          <SelectItem value="3">{t("employer.create_job.exp_3m")}</SelectItem>
                          <SelectItem value="6">{t("employer.create_job.exp_6m")}</SelectItem>
                          <SelectItem value="12">{t("employer.create_job.exp_12m")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          id="req_experience"
                          checked={form.req_experience}
                          onCheckedChange={(v) => setForm((p) => ({ ...p, req_experience: v }))}
                        />
                        <Label htmlFor="req_experience" className="text-sm text-muted-foreground cursor-pointer">
                          {t("employer.create_job.eliminatory_experience")}
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base">{t("employer.create_job.english_proficiency")}</Label>
                      <Select
                        value={form.english_proficiency}
                        onValueChange={(v) => setForm((p) => ({ ...p, english_proficiency: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("employer.create_job.eng_none")}</SelectItem>
                          <SelectItem value="basic">{t("employer.create_job.eng_basic")}</SelectItem>
                          <SelectItem value="intermediate">{t("employer.create_job.eng_intermediate")}</SelectItem>
                          <SelectItem value="advanced">{t("employer.create_job.eng_advanced")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          id="req_english"
                          checked={form.req_english}
                          onCheckedChange={(v) => setForm((p) => ({ ...p, req_english: v }))}
                        />
                        <Label htmlFor="req_english" className="text-sm text-muted-foreground cursor-pointer">
                          {t("employer.create_job.eliminatory_english")}
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base">{t("employer.create_job.drivers_license")}</Label>
                      <Select
                        value={form.drivers_license}
                        onValueChange={(v) => setForm((p) => ({ ...p, drivers_license: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_required">{t("employer.create_job.dl_not_required")}</SelectItem>
                          <SelectItem value="preferred">{t("employer.create_job.dl_preferred")}</SelectItem>
                          <SelectItem value="required">{t("employer.create_job.dl_required")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          id="req_drivers_license"
                          checked={form.req_drivers_license}
                          onCheckedChange={(v) => setForm((p) => ({ ...p, req_drivers_license: v }))}
                        />
                        <Label htmlFor="req_drivers_license" className="text-sm text-muted-foreground cursor-pointer">
                          {t("employer.create_job.eliminatory_license")}
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-base">{t("employer.create_job.equipment_experience")}</Label>
                        <p className="text-xs text-muted-foreground">{t("employer.create_job.equipment_hint")}</p>
                      </div>
                      <Input
                        placeholder={t("employer.create_job.equipment_placeholder")}
                        value={form.equipment_experience}
                        onChange={(e) => setForm((p) => ({ ...p, equipment_experience: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Consular Only - Only for H-2 visas */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-base font-medium cursor-pointer" htmlFor="consular_only">
                          Visto exclusivo para candidatos no exterior
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Marca esta vaga como disponível apenas para candidatos que ainda estão fora dos EUA (processamento consular). Candidatos já nos EUA serão automaticamente desqualificados.
                        </p>
                      </div>
                      <Switch
                        id="consular_only"
                        checked={form.consular_only}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, consular_only: v }))}
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t space-y-4">
                    <Label className="text-base">{t("employer.create_job.physical_requirements")}</Label>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4">
                        <div className="space-y-1 pr-4">
                          <Label className="text-base font-medium" htmlFor="lift">{t("employer.create_job.lifting_label")}</Label>
                          <p className="text-sm text-muted-foreground">{t("employer.create_job.lifting_desc")}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Input
                            id="lift"
                            type="number"
                            placeholder="e.g. 50"
                            value={form.req_lift_lbs}
                            onChange={(e) => setForm((p) => ({ ...p, req_lift_lbs: e.target.value }))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground font-medium w-32">
                            {form.req_lift_lbs ? `(≈ ${Math.round(parseInt(form.req_lift_lbs) * 0.453592)} kg)` : "lbs"}
                          </span>
                        </div>
                      </div>

                      {[
                        { key: "req_extreme_weather" as const, title: t("employer.create_job.outdoor_title"), desc: t("employer.create_job.outdoor_desc") },
                        { key: "req_full_contract_availability" as const, title: t("employer.create_job.availability_title"), desc: t("employer.create_job.availability_desc") },
                        { key: "req_travel_worksite" as const, title: t("employer.create_job.travel_title"), desc: t("employer.create_job.travel_desc") },
                        { key: "req_background_check" as const, title: t("employer.create_job.background_title"), desc: t("employer.create_job.background_desc") },
                      ].map(({ key, title, desc }) => (
                        <div key={key} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                          <div className="space-y-0.5 pr-4">
                            <Label className="text-base font-medium cursor-pointer" htmlFor={key}>{title}</Label>
                            <p className="text-sm text-muted-foreground">{desc}</p>
                          </div>
                          <Switch
                            id={key}
                            checked={form[key]}
                            onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
