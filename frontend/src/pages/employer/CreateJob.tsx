import { useState, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, ArrowRight, Search, CheckCircle2, Building2,
  Briefcase, DollarSign, Home, FileWarning, Shield, FileText, Eye, AlertTriangle
} from "lucide-react";

const TOTAL_STEPS = 9;

interface DolJob {
  job_title: string;
  company: string;
  city: string;
  state: string;
  salary: number | null;
  start_date: string | null;
  end_date: string | null;
  openings: number | null;
  visa_type: string | null;
  job_duties: string | null;
  job_min_special_req: string | null;
  wage_additional: string | null;
  rec_pay_deductions: string | null;
  housing_info: string | null;
  transport_provided: boolean | null;
  experience_months: number | null;
  education_required: string | null;
  weekly_hours: number | null;
}

interface JobForm {
  // Step 1
  dol_case_number: string;
  dol_found: boolean;
  // Step 2
  title: string;
  visa_type: string;
  employer_legal_name: string;
  city: string;
  state: string;
  start_date: string;
  end_date: string;
  num_positions: number;
  // Step 3
  hourly_wage: string;
  overtime_rate: string;
  pay_frequency: string;
  bonuses: string;
  additional_compensation: string;
  // Step 4
  housing_provided: boolean;
  transportation_provided: boolean;
  visa_fee_reimbursement: boolean;
  meals_provided: boolean;
  daily_meal_cost: string;
  // Step 5
  deductions_standard: boolean;
  deductions_additional: string;
  flsa_compliant: boolean;
  // Step 6
  req_english: string;
  req_experience: boolean;
  req_drivers_license: boolean;
  consular_only: boolean;
  lifting_weight_lbs: string;
  skill_level: string;
  // Step 7
  primary_duties: string;
  equipment_used: string;
  work_environment: string;
  training_provided: boolean;
  additional_notes: string;
  // Step 8
  compliance_acknowledged: boolean;
  // Step 9
  publish_type: string;
}

const initialForm: JobForm = {
  dol_case_number: "",
  dol_found: false,
  title: "",
  visa_type: "H-2B",
  employer_legal_name: "",
  city: "",
  state: "",
  start_date: "",
  end_date: "",
  num_positions: 1,
  hourly_wage: "",
  overtime_rate: "",
  pay_frequency: "weekly",
  bonuses: "",
  additional_compensation: "",
  housing_provided: false,
  transportation_provided: false,
  visa_fee_reimbursement: false,
  meals_provided: false,
  daily_meal_cost: "",
  deductions_standard: true,
  deductions_additional: "",
  flsa_compliant: true,
  req_english: "not_required",
  req_experience: false,
  req_drivers_license: false,
  consular_only: false,
  lifting_weight_lbs: "",
  skill_level: "entry",
  primary_duties: "",
  equipment_used: "",
  work_environment: "",
  training_provided: false,
  additional_notes: "",
  compliance_acknowledged: false,
  publish_type: "standard",
};

const STEP_ICONS = [Search, Briefcase, DollarSign, Home, FileWarning, Shield, FileText, AlertTriangle, Eye];
const STEP_LABELS = [
  "DOL Lookup", "Job Info", "Compensation", "Benefits",
  "Deductions", "Requirements", "Description", "Compliance", "Publish"
];

export default function CreateJob() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchingDol, setSearchingDol] = useState(false);
  const [dolJob, setDolJob] = useState<DolJob | null>(null);
  const [form, setForm] = useState<JobForm>(initialForm);

  const set = useCallback(<K extends keyof JobForm>(key: K, value: JobForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const percent = Math.round((step / TOTAL_STEPS) * 100);

  // ── DOL Search ──
  const searchDol = async () => {
    const caseNum = form.dol_case_number.trim();
    if (!caseNum) return;
    setSearchingDol(true);

    const { data, error } = await supabase
      .from("public_jobs")
      .select("job_title, company, city, state, salary, start_date, end_date, openings, visa_type, job_duties, job_min_special_req, wage_additional, rec_pay_deductions, housing_info, transport_provided, experience_months, education_required, weekly_hours")
      .eq("job_id", caseNum)
      .maybeSingle();

    if (error || !data) {
      setDolJob(null);
      set("dol_found", false);
      toast({ title: "Not found", description: "No DOL job order found with that case number. You can proceed manually." });
    } else {
      setDolJob(data);
      set("dol_found", true);
      // Pre-fill from DOL
      setForm(prev => ({
        ...prev,
        dol_found: true,
        title: data.job_title || prev.title,
        visa_type: data.visa_type || "H-2B",
        employer_legal_name: data.company || prev.employer_legal_name,
        city: data.city || prev.city,
        state: data.state || prev.state,
        start_date: data.start_date || prev.start_date,
        end_date: data.end_date || prev.end_date,
        num_positions: data.openings || 1,
        hourly_wage: data.salary ? String(data.salary) : prev.hourly_wage,
        primary_duties: data.job_duties || prev.primary_duties,
        housing_provided: !!(data.housing_info),
        transportation_provided: !!(data.transport_provided),
        additional_compensation: data.wage_additional || prev.additional_compensation,
        deductions_additional: data.rec_pay_deductions || prev.deductions_additional,
        req_experience: (data.experience_months ?? 0) > 0,
      }));
      toast({ title: "Job found!", description: `${data.job_title} — ${data.company}` });
    }
    setSearchingDol(false);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!employerProfile || !form.compliance_acknowledged) return;
    setLoading(true);

    const { data: canCreate } = await supabase.rpc("check_employer_job_limit", {
      p_employer_id: employerProfile.id,
    });

    if (!canCreate) {
      toast({ title: "Job limit reached", description: "Upgrade your plan to post more jobs." });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("sponsored_jobs").insert({
      employer_id: employerProfile.id,
      title: form.title.trim(),
      description: form.primary_duties.trim() || null,
      location: [form.city, form.state].filter(Boolean).join(", ") || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      req_english: form.req_english === "required",
      req_experience: form.req_experience,
      req_drivers_license: form.req_drivers_license,
      consular_only: form.consular_only,
      priority_level: form.publish_type === "sponsored" ? employerProfile.tier : "free",
      is_sponsored: form.publish_type === "sponsored",
      visa_type: form.visa_type,
      employer_legal_name: form.employer_legal_name.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      hourly_wage: form.hourly_wage ? parseFloat(form.hourly_wage) : null,
      overtime_rate: form.overtime_rate ? parseFloat(form.overtime_rate) : null,
      pay_frequency: form.pay_frequency,
      bonuses: form.bonuses.trim() || null,
      additional_compensation: form.additional_compensation.trim() || null,
      housing_provided: form.housing_provided,
      transportation_provided: form.transportation_provided,
      visa_fee_reimbursement: form.visa_fee_reimbursement,
      meals_provided: form.meals_provided,
      daily_meal_cost: form.daily_meal_cost ? parseFloat(form.daily_meal_cost) : null,
      deductions_standard: form.deductions_standard,
      deductions_additional: form.deductions_additional.trim() || null,
      flsa_compliant: form.flsa_compliant,
      english_level: form.req_english,
      prior_experience_required: form.req_experience,
      lifting_weight_lbs: form.lifting_weight_lbs ? parseInt(form.lifting_weight_lbs) : null,
      skill_level: form.skill_level,
      primary_duties: form.primary_duties.trim() || null,
      equipment_used: form.equipment_used.trim() || null,
      work_environment: form.work_environment.trim() || null,
      training_provided: form.training_provided,
      additional_notes: form.additional_notes.trim() || null,
      compliance_acknowledged: form.compliance_acknowledged,
      source_type: form.dol_found ? "dol" : "platform",
      dol_case_number: form.dol_found ? form.dol_case_number.trim() : null,
      is_claimed: form.dol_found,
      num_positions: form.num_positions,
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message });
    } else {
      toast({ title: "Job created!", description: "Your posting is now live." });
      navigate("/employer/jobs");
    }
    setLoading(false);
  };

  const canAdvance = () => {
    switch (step) {
      case 1: return true; // DOL lookup is optional
      case 2: return !!form.title.trim() && !!form.city.trim() && !!form.state.trim();
      case 3: return true;
      case 4: return true;
      case 5: return form.flsa_compliant;
      case 6: return true;
      case 7: return true;
      case 8: return form.compliance_acknowledged;
      case 9: return true;
      default: return true;
    }
  };

  const isDolLocked = form.dol_found;

  // ── Render Steps ──
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">DOL Case Number</Label>
              <p className="text-sm text-muted-foreground">
                Enter a DOL job order case number (e.g. H-300-XXXXX-XXXXXX) to auto-fill your job details.
              </p>
              <div className="flex gap-2">
                <Input
                  value={form.dol_case_number}
                  onChange={(e) => set("dol_case_number", e.target.value)}
                  placeholder="H-300-25001-012345"
                  className="flex-1"
                />
                <Button onClick={searchDol} disabled={searchingDol || !form.dol_case_number.trim()}>
                  {searchingDol ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                  Search
                </Button>
              </div>
            </div>

            {dolJob && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-primary">DOL Job Order Found</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Employer:</span> <strong>{dolJob.company}</strong></div>
                    <div><span className="text-muted-foreground">Title:</span> <strong>{dolJob.job_title}</strong></div>
                    <div><span className="text-muted-foreground">Location:</span> {dolJob.city}, {dolJob.state}</div>
                    <div><span className="text-muted-foreground">Wage:</span> ${dolJob.salary ?? "N/A"}/hr</div>
                    <div><span className="text-muted-foreground">Start:</span> {dolJob.start_date ?? "N/A"}</div>
                    <div><span className="text-muted-foreground">End:</span> {dolJob.end_date ?? "N/A"}</div>
                    <div><span className="text-muted-foreground">Positions:</span> {dolJob.openings ?? "N/A"}</div>
                    <div><span className="text-muted-foreground">Visa:</span> <Badge variant="secondary">{dolJob.visa_type}</Badge></div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!dolJob && (
              <p className="text-sm text-muted-foreground italic">
                Don't have a case number? Skip this step and fill in the details manually.
              </p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Job Title *</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Farmworkers and Laborers" disabled={isDolLocked} />
            </div>
            <div className="space-y-2">
              <Label>Visa Type</Label>
              <Select value={form.visa_type} onValueChange={(v) => set("visa_type", v)} disabled={isDolLocked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="H-2A">H-2A (Agricultural)</SelectItem>
                  <SelectItem value="H-2B">H-2B (Non-Agricultural)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employer Legal Name</Label>
              <Input value={form.employer_legal_name} onChange={(e) => set("employer_legal_name", e.target.value)}
                placeholder="Legal business name" disabled={isDolLocked} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)}
                  placeholder="City" disabled={isDolLocked} />
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Input value={form.state} onChange={(e) => set("state", e.target.value)}
                  placeholder="e.g. FL" disabled={isDolLocked} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} disabled={isDolLocked} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} disabled={isDolLocked} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Number of Positions</Label>
              <Input type="number" min={1} value={form.num_positions}
                onChange={(e) => set("num_positions", parseInt(e.target.value) || 1)} disabled={isDolLocked} />
            </div>
            {isDolLocked && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Fields locked — sourced from DOL job order for regulatory compliance.
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hourly Wage ($)</Label>
                <Input type="number" step="0.01" min={0} value={form.hourly_wage}
                  onChange={(e) => set("hourly_wage", e.target.value)} disabled={isDolLocked}
                  placeholder="e.g. 15.50" />
              </div>
              <div className="space-y-2">
                <Label>Overtime Rate ($)</Label>
                <Input type="number" step="0.01" min={0} value={form.overtime_rate}
                  onChange={(e) => set("overtime_rate", e.target.value)}
                  placeholder="e.g. 23.25" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pay Frequency</Label>
              <Select value={form.pay_frequency} onValueChange={(v) => set("pay_frequency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bonuses (optional)</Label>
              <Input value={form.bonuses} onChange={(e) => set("bonuses", e.target.value)}
                placeholder="e.g. $200 end-of-season bonus" />
            </div>
            <div className="space-y-2">
              <Label>Additional Compensation</Label>
              <Textarea value={form.additional_compensation} onChange={(e) => set("additional_compensation", e.target.value)}
                placeholder="Any other compensation details..." rows={3} />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            {[
              { key: "housing_provided" as const, label: "Housing Provided?" },
              { key: "transportation_provided" as const, label: "Transportation Provided?" },
              { key: "visa_fee_reimbursement" as const, label: "Visa Fee Reimbursement?" },
              { key: "meals_provided" as const, label: "Meals Provided?" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="font-normal text-sm">{label}</Label>
                <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
              </div>
            ))}
            {form.meals_provided && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <Label>Daily Meal Cost ($)</Label>
                <Input type="number" step="0.01" min={0} value={form.daily_meal_cost}
                  onChange={(e) => set("daily_meal_cost", e.target.value)} placeholder="e.g. 12.50" />
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Standard Deductions Applied?</Label>
              <p className="text-sm text-muted-foreground">Federal tax, FICA, State tax, Court ordered</p>
              <Switch checked={form.deductions_standard} onCheckedChange={(v) => set("deductions_standard", v)} />
            </div>
            <div className="space-y-2">
              <Label>Additional Deductions</Label>
              <Textarea value={form.deductions_additional} onChange={(e) => set("deductions_additional", e.target.value)}
                placeholder="Describe any additional deductions..." rows={3} />
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <Checkbox
                checked={form.flsa_compliant}
                onCheckedChange={(v) => set("flsa_compliant", !!v)}
              />
              <div>
                <Label className="font-semibold text-sm">FLSA Compliance Confirmation *</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  I confirm all deductions are compliant with the Fair Labor Standards Act (FLSA).
                </p>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>English Proficiency</Label>
              <Select value={form.req_english} onValueChange={(v) => set("req_english", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="preferred">Preferred</SelectItem>
                  <SelectItem value="not_required">Not Required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {[
              { key: "req_experience" as const, label: "Prior farm/work experience required?" },
              { key: "req_drivers_license" as const, label: "Driver's license required?" },
              { key: "consular_only" as const, label: "Consular processing only (not in US)?" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="font-normal text-sm">{label}</Label>
                <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lifting Requirement (lbs)</Label>
                <Input type="number" min={0} value={form.lifting_weight_lbs}
                  onChange={(e) => set("lifting_weight_lbs", e.target.value)} placeholder="e.g. 50" />
              </div>
              <div className="space-y-2">
                <Label>Skill Level</Label>
                <Select value={form.skill_level} onValueChange={(v) => set("skill_level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Duties *</Label>
              <Textarea value={form.primary_duties} onChange={(e) => set("primary_duties", e.target.value)}
                placeholder="Describe the main job duties..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Equipment Used</Label>
              <Input value={form.equipment_used} onChange={(e) => set("equipment_used", e.target.value)}
                placeholder="e.g. Tractors, hand tools, ladders" />
            </div>
            <div className="space-y-2">
              <Label>Work Environment</Label>
              <Input value={form.work_environment} onChange={(e) => set("work_environment", e.target.value)}
                placeholder="e.g. Outdoor, field work, all weather conditions" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal text-sm">Training Provided?</Label>
              <Switch checked={form.training_provided} onCheckedChange={(v) => set("training_provided", v)} />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea value={form.additional_notes} onChange={(e) => set("additional_notes", e.target.value)}
                placeholder="Any other relevant information..." rows={3} />
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <div className="p-5 rounded-lg border border-destructive/30 bg-destructive/5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                <Label className="text-base font-semibold">Compliance Acknowledgment</Label>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                By checking this box, I confirm that this job posting aligns with the certified DOL job order
                (if applicable) and does not discriminate against protected classes. All hiring decisions
                remain the sole responsibility of the employer.
              </p>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={form.compliance_acknowledged}
                  onCheckedChange={(v) => set("compliance_acknowledged", !!v)}
                />
                <Label className="text-sm font-semibold leading-tight">
                  I confirm compliance with all federal labor laws and regulations. *
                </Label>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Publication Type</Label>
              {[
                {
                  value: "sponsored",
                  title: "Publish as Sponsored",
                  desc: "Higher visibility, priority placement in the Jobs Hub.",
                  icon: "⭐",
                },
                {
                  value: "standard",
                  title: "Publish as Standard",
                  desc: "Listed in the Jobs Hub with no priority boost.",
                  icon: "📋",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("publish_type", opt.value)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    form.publish_type === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{opt.title}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Job Summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Title:</span> {form.title || "—"}</p>
                <p><span className="text-muted-foreground">Location:</span> {form.city}, {form.state}</p>
                <p><span className="text-muted-foreground">Wage:</span> ${form.hourly_wage || "—"}/hr</p>
                <p><span className="text-muted-foreground">Positions:</span> {form.num_positions}</p>
                <p><span className="text-muted-foreground">Visa:</span> {form.visa_type}</p>
                {form.dol_found && <Badge variant="secondary" className="mt-1">DOL Verified</Badge>}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  const StepIcon = STEP_ICONS[step - 1];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/employer/jobs")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Jobs
      </Button>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{percent}%</span>
        </div>
        <Progress value={percent} className="h-2" />
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STEP_LABELS.map((label, i) => {
            const Icon = STEP_ICONS[i];
            const isActive = i + 1 === step;
            const isDone = i + 1 < step;
            return (
              <button
                key={label}
                onClick={() => { if (isDone) setStep(i + 1); }}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-primary/10 text-primary cursor-pointer"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <StepIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{STEP_LABELS[step - 1]}</CardTitle>
              <CardDescription className="text-xs">Step {step} of {TOTAL_STEPS}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderStep()}

          <div className="flex justify-between mt-8 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading || !form.compliance_acknowledged}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Publish Job
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
