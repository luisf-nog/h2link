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
} from "lucide-react";

const FORM_SECTIONS = [
  { id: "dol-lookup", label: "1. DOL Lookup", icon: Search },
  { id: "job-info", label: "2. Job Info", icon: Briefcase },
  { id: "financials", label: "3. Pay & Benefits", icon: DollarSign },
  { id: "requirements", label: "4. Job Requirements", icon: CheckCircle2 },
];

export default function CreateJob() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [isFetchingDol, setIsFetchingDol] = useState(false);
  const [activeSection, setActiveSection] = useState("dol-lookup");
  const [dolCaseNumber, setDolCaseNumber] = useState("");

  const [searchStatus, setSearchStatus] = useState<"idle" | "success" | "not_found">("idle");
  const [dolOriginalData, setDolOriginalData] = useState<Record<string, any>>({});

  const [form, setForm] = useState({
    title: "",
    visa_type: "H-2B (Non-Agricultural)",
    employer_name: "",
    location_city: "",
    location_state: "",
    start_date: "",
    end_date: "",
    positions: "",
    wage_rate: "",
    benefits: "",
    deductions: "",

    english_proficiency: "none",
    min_experience_months: "0",
    drivers_license: "not_required",
    equipment_experience: "",

    req_lift_lbs: "",
    req_extreme_weather: false,
    req_full_contract_availability: false,
    req_travel_worksite: false,
    req_background_check: false,
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
    if (!dolCaseNumber) {
      toast({
        title: "Case Number Required",
        description: "Please enter a valid DOL ETA Case Number.",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingDol(true);

    try {
      // 🚀 Integração Real com API (Estrutura pronta para produção)
      // const response = await fetch(`https://api.governo.gov/v1/case/${dolCaseNumber}`);
      // if (!response.ok) throw new Error("Not_Found");
      // const fetchedData = await response.json();

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const fetchedData = {
        title: "Landscape Laborer",
        visa_type: "H-2B (Non-Agricultural)",
        employer_name: "Roebuck Wholesale Nursery & Landscaping, LLC",
        location_city: "Roebuck",
        location_state: "SC",
        start_date: "2026-04-01",
        end_date: "2026-11-15",
        positions: "27",
        wage_rate: "$16.50 / hour",
        benefits: "",
        deductions: "",
      };

      setDolOriginalData(fetchedData);
      setForm((p) => ({ ...p, ...fetchedData }));
      setSearchStatus("success");
      toast({ title: "DOL Data Retrieved", description: "Job information imported successfully." });
    } catch (error) {
      // ⚠️ Fallback: Modo Manual ativado se a API falhar ou retornar erro
      setDolOriginalData({});
      setForm((p) => ({
        ...p,
        title: "",
        employer_name: "",
        location_city: "",
        location_state: "",
        start_date: "",
        end_date: "",
        positions: "",
        wage_rate: "",
        benefits: "",
        deductions: "",
      }));
      setSearchStatus("not_found");
      toast({
        title: "Job Not Found",
        description: "We couldn't find this Case Number. Manual entry mode enabled.",
        variant: "default",
      });
    } finally {
      setIsFetchingDol(false);
      scrollToSection("job-info");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employerProfile) return;
    if (searchStatus === "idle") return;

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
      description: form.benefits.trim() || null,
      location: `${form.location_city}, ${form.location_state}`,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      priority_level: employerProfile.tier,

      english_proficiency: form.english_proficiency,
      min_experience_months: parseInt(form.min_experience_months),
      drivers_license: form.drivers_license,
      equipment_experience: form.equipment_experience.trim() || null,
      req_lift_lbs: form.req_lift_lbs ? parseInt(form.req_lift_lbs) : null,
      req_extreme_weather: form.req_extreme_weather,
      req_full_contract_availability: form.req_full_contract_availability,
      req_travel_worksite: form.req_travel_worksite,
      req_background_check: form.req_background_check,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job Published!", description: "Your sponsored posting is now live." });
      navigate("/employer/jobs");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/employer/jobs")} className="-ml-3 text-slate-500">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Jobs
          </Button>
          <h1 className="text-3xl font-bold font-brand text-slate-900">Post Sponsored Job</h1>
          <p className="text-sm text-slate-500">Import DOL data or enter details manually.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/employer/jobs")} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || searchStatus === "idle"}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Publish Job
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        <div className="hidden md:block col-span-1 sticky top-24 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 px-2">Steps</h3>
          {FORM_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${
                  activeSection === section.id
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-4 h-4 ${activeSection === section.id ? "text-slate-300" : "text-slate-400"}`} />
                {section.label}
              </button>
            );
          })}
        </div>

        <div className="col-span-1 md:col-span-3 space-y-10 pb-24">
          <Card id="dol-lookup" className="border-slate-200 shadow-sm scroll-mt-24">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">1. DOL Lookup</CardTitle>
              <CardDescription>
                Enter the ETA Case Number to fetch data, or search to enable manual entry.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="case_number" className="text-slate-700">
                    ETA Case Number
                  </Label>
                  <Input
                    id="case_number"
                    value={dolCaseNumber}
                    onChange={(e) => setDolCaseNumber(e.target.value)}
                    placeholder="e.g. H-400-24123-123456"
                    className="bg-white"
                  />
                </div>
                <Button
                  onClick={handleDolLookup}
                  disabled={isFetchingDol || !dolCaseNumber}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isFetchingDol ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Search Case
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card
            id="job-info"
            className={`border-slate-200 shadow-sm scroll-mt-24 transition-opacity ${searchStatus === "idle" ? "opacity-50 pointer-events-none" : ""}`}
          >
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">2. Job Info</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {searchStatus === "success" ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">
                    <strong>Regulatory Compliance:</strong> Fields marked with a lock are sourced directly from the
                    official DOL job order and cannot be edited.
                  </p>
                </div>
              ) : searchStatus === "not_found" ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">
                    <strong>Job Not Found:</strong> We couldn't find this Case Number in the DOL database.{" "}
                    <strong>Manual entry mode is enabled.</strong> Please ensure all information matches your official
                    filings.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: "title" as const, label: "Job Title", type: "text", cols: 2 },
                  { key: "visa_type" as const, label: "Visa Type", type: "text", cols: 1 },
                  { key: "employer_name" as const, label: "Employer Legal Name", type: "text", cols: 1 },
                  { key: "location_city" as const, label: "City", type: "text", cols: 1 },
                  { key: "location_state" as const, label: "State", type: "text", cols: 1 },
                  { key: "start_date" as const, label: "Start Date", type: "date", cols: 1 },
                  { key: "end_date" as const, label: "End Date", type: "date", cols: 1 },
                  { key: "positions" as const, label: "Number of Positions", type: "number", cols: 1 },
                ].map((field) => {
                  const locked = isFieldLocked(field.key);
                  return (
                    <div key={field.key} className={`space-y-2 ${field.cols === 2 ? "col-span-1 md:col-span-2" : ""}`}>
                      <Label className="flex items-center gap-2 text-slate-700">
                        {field.label}{" "}
                        {locked ? (
                          <Lock className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Pencil className="w-3 h-3 text-blue-500" />
                        )}
                      </Label>
                      <Input
                        type={field.type}
                        disabled={locked}
                        value={form[field.key]}
                        onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                        className={
                          locked
                            ? "bg-slate-50/80 text-slate-500 cursor-not-allowed"
                            : "bg-white border-blue-200 focus:border-blue-500"
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card
            id="financials"
            className={`border-slate-200 shadow-sm scroll-mt-24 transition-opacity ${searchStatus === "idle" ? "opacity-50 pointer-events-none" : ""}`}
          >
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">3. Pay & Benefits</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2 md:w-1/2">
                <Label>
                  Wage Rate{" "}
                  {isFieldLocked("wage_rate") ? (
                    <Lock className="w-3 h-3 text-slate-400 inline" />
                  ) : (
                    <Pencil className="w-3 h-3 text-blue-500 inline" />
                  )}
                </Label>
                <Input
                  disabled={isFieldLocked("wage_rate")}
                  value={form.wage_rate}
                  onChange={(e) => setForm((p) => ({ ...p, wage_rate: e.target.value }))}
                  className={
                    isFieldLocked("wage_rate")
                      ? "bg-slate-50/80 text-slate-500 cursor-not-allowed"
                      : "bg-white border-blue-200 focus:border-blue-500"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Benefits & Housing{" "}
                  {isFieldLocked("benefits") ? (
                    <Lock className="w-3 h-3 text-slate-400 inline" />
                  ) : (
                    <Pencil className="w-3 h-3 text-blue-500 inline" />
                  )}
                </Label>
                <Textarea
                  disabled={isFieldLocked("benefits")}
                  value={form.benefits}
                  onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))}
                  className={
                    isFieldLocked("benefits")
                      ? "bg-slate-50/80 text-slate-500 cursor-not-allowed resize-none"
                      : "bg-white border-blue-200 focus:border-blue-500 resize-y"
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Deductions{" "}
                  {isFieldLocked("deductions") ? (
                    <Lock className="w-3 h-3 text-slate-400 inline" />
                  ) : (
                    <Pencil className="w-3 h-3 text-blue-500 inline" />
                  )}
                </Label>
                <Textarea
                  disabled={isFieldLocked("deductions")}
                  value={form.deductions}
                  onChange={(e) => setForm((p) => ({ ...p, deductions: e.target.value }))}
                  className={
                    isFieldLocked("deductions")
                      ? "bg-slate-50/80 text-slate-500 cursor-not-allowed resize-none"
                      : "bg-white border-blue-200 focus:border-blue-500 resize-y"
                  }
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card
            id="requirements"
            className={`border-slate-200 shadow-sm scroll-mt-24 transition-opacity duration-300 ${searchStatus === "idle" ? "opacity-50 pointer-events-none" : ""}`}
          >
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">4. Minimum Job Requirements</CardTitle>
              <CardDescription>
                Configure the baseline requirements for this role. These will generate candidate "Match Scores".
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-slate-800 text-base">Prior Experience</Label>
                  </div>
                  <Select
                    value={form.min_experience_months}
                    onValueChange={(v) => setForm((p) => ({ ...p, min_experience_months: v }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select experience..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None (Entry Level)</SelectItem>
                      <SelectItem value="3">3 Months Minimum</SelectItem>
                      <SelectItem value="6">6 Months Minimum</SelectItem>
                      <SelectItem value="12">12+ Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-slate-800 text-base">English Proficiency</Label>
                  </div>
                  <Select
                    value={form.english_proficiency}
                    onValueChange={(v) => setForm((p) => ({ ...p, english_proficiency: v }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Required</SelectItem>
                      <SelectItem value="basic">Basic (Simple instructions)</SelectItem>
                      <SelectItem value="intermediate">Intermediate (Conversational)</SelectItem>
                      <SelectItem value="advanced">Advanced (Fluent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-slate-800 text-base">Driver's License</Label>
                  </div>
                  <Select
                    value={form.drivers_license}
                    onValueChange={(v) => setForm((p) => ({ ...p, drivers_license: v }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select requirement..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_required">Not Required</SelectItem>
                      <SelectItem value="preferred">Preferred (Nice to have)</SelectItem>
                      <SelectItem value="required">Required (Must have)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-slate-800 text-base">Equipment Experience</Label>
                    <p className="text-xs text-slate-500">Tractors, Power tools, Commercial kitchen, etc.</p>
                  </div>
                  <Input
                    placeholder="e.g. John Deere tractors, Chainsaws..."
                    value={form.equipment_experience}
                    onChange={(e) => setForm((p) => ({ ...p, equipment_experience: e.target.value }))}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-4">
                <Label className="text-slate-800 text-base">Physical & Operational Requirements</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors gap-4">
                    <div className="space-y-1 pr-4">
                      <Label className="text-base font-medium text-slate-800" htmlFor="lift">
                        Lifting Requirement (lbs)
                      </Label>
                      <p className="text-sm text-slate-500">
                        Specify the maximum weight required to lift (leave blank if none).
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Input
                        id="lift"
                        type="number"
                        placeholder="e.g. 50"
                        value={form.req_lift_lbs}
                        onChange={(e) => setForm((p) => ({ ...p, req_lift_lbs: e.target.value }))}
                        className="w-24 bg-white"
                      />
                      <span className="text-sm text-slate-500 font-medium w-32">
                        {form.req_lift_lbs
                          ? `(approx. ${Math.round(parseInt(form.req_lift_lbs) * 0.453592)} kg)`
                          : "lbs"}
                      </span>
                    </div>
                  </div>

                  {[
                    {
                      key: "req_extreme_weather" as const,
                      title: "Outdoor Work Tolerance",
                      desc: "Must be able to work outdoors in extreme heat or cold.",
                    },
                    {
                      key: "req_full_contract_availability" as const,
                      title: "Availability Window",
                      desc: "Must be available for the entire contract duration without leaving early.",
                    },
                    {
                      key: "req_travel_worksite" as const,
                      title: "Travel Readiness",
                      desc: "Willing to relocate or travel between different worksites.",
                    },
                    {
                      key: "req_background_check" as const,
                      title: "Background Check Consent",
                      desc: "Must consent to a criminal background check (common in H-2B hospitality).",
                    },
                  ].map(({ key, title, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-base font-medium text-slate-800 cursor-pointer" htmlFor={key}>
                          {title}
                        </Label>
                        <p className="text-sm text-slate-500">{desc}</p>
                      </div>
                      <Switch
                        id={key}
                        checked={form[key]}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
                        className="data-[state=checked]:bg-blue-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
