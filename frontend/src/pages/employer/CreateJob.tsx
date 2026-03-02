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
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Search, Lock, Briefcase, DollarSign, Filter, Save, AlertTriangle } from "lucide-react";

// Navegação Lateral com todos os passos originais integrados
const FORM_SECTIONS = [
  { id: "dol-lookup", label: "1. DOL Lookup", icon: Search },
  { id: "job-info", label: "2. Job Info", icon: Briefcase },
  { id: "financials", label: "3. Pay & Benefits", icon: DollarSign },
  { id: "screening", label: "4. Screening Criteria", icon: Filter },
];

export default function CreateJob() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [isFetchingDol, setIsFetchingDol] = useState(false);
  const [activeSection, setActiveSection] = useState("dol-lookup");
  const [dolCaseNumber, setDolCaseNumber] = useState("");
  const [dolDataFetched, setDolDataFetched] = useState(false);

  // Estado unificado com os campos extras (Compensation, Benefits, etc)
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
    req_english: false,
    req_experience: false,
    req_drivers_license: false,
    consular_only: false,
  });

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // Simulação de busca no DOL (Aqui você conectará sua API real)
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
    // Simula delay de rede
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Preenche com dados mockados (Substitua pela resposta da sua API)
    setForm((p) => ({
      ...p,
      title: "Landscape Laborer",
      employer_name: "Roebuck Wholesale Nursery & Landscaping, LLC",
      location_city: "Roebuck",
      location_state: "SC",
      start_date: "2026-04-01",
      end_date: "2026-11-15",
      positions: "27",
      wage_rate: "$16.50 / hour",
    }));

    setDolDataFetched(true);
    setIsFetchingDol(false);
    toast({ title: "DOL Data Retrieved", description: "Job information successfully imported." });
    scrollToSection("job-info");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employerProfile) return;
    if (!dolDataFetched) {
      toast({
        title: "Missing DOL Data",
        description: "Please look up a DOL Case Number first.",
        variant: "destructive",
      });
      return;
    }

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
      description: form.benefits.trim() || null, // Você pode juntar tudo num campo description se preferir
      location: `${form.location_city}, ${form.location_state}`,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      req_english: form.req_english,
      req_experience: form.req_experience,
      req_drivers_license: form.req_drivers_license,
      consular_only: form.consular_only,
      priority_level: employerProfile.tier,
      // Se tiver criado as colunas extras no Supabase, adicione-as aqui:
      // wage_rate: form.wage_rate,
      // positions_count: parseInt(form.positions) || null
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
      {/* Cabeçalho Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/employer/jobs")} className="-ml-3 text-slate-500">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Jobs
          </Button>
          <h1 className="text-3xl font-bold font-brand text-slate-900">Post Sponsored Job</h1>
          <p className="text-sm text-slate-500">Import DOL data and configure your screening rules.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/employer/jobs")} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !dolDataFetched}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Publish Job
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* 🧭 NAVEGAÇÃO LATERAL (Sticky Sidebar) */}
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

        {/* 📄 CONTEÚDO DO FORMULÁRIO */}
        <div className="col-span-1 md:col-span-3 space-y-10 pb-24">
          {/* SECÃO 1: DOL Lookup */}
          <Card id="dol-lookup" className="border-slate-200 shadow-sm scroll-mt-24">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">1. DOL Lookup</CardTitle>
              <CardDescription>Enter the ETA Case Number to import verified job data.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="case_number" className="text-slate-700">
                    ETA Case Number
                  </Label>
                  <Input
                    id="case_number"
                    placeholder="e.g. H-400-24123-123456"
                    value={dolCaseNumber}
                    onChange={(e) => setDolCaseNumber(e.target.value)}
                    className="bg-white border-slate-300"
                  />
                </div>
                <Button
                  onClick={handleDolLookup}
                  disabled={isFetchingDol || !dolCaseNumber}
                  className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                >
                  {isFetchingDol ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Fetch Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SECÃO 2: Job Info (Locked Data) */}
          <Card
            id="job-info"
            className={`border-slate-200 shadow-sm scroll-mt-24 transition-opacity duration-300 ${!dolDataFetched ? "opacity-50 pointer-events-none" : ""}`}
          >
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">2. Job Info</CardTitle>
              <CardDescription>Basic details imported from the Department of Labor.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">
                  <strong>Regulatory Compliance:</strong> Fields below are locked and sourced directly from the official
                  DOL job order.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    Job Title <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input
                    disabled
                    value={form.title}
                    placeholder="Pending DOL Import..."
                    className="bg-slate-50/80 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    Visa Type <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input disabled value={form.visa_type} className="bg-slate-50/80 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    Employer Legal Name <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input
                    disabled
                    value={form.employer_name}
                    placeholder="Pending DOL Import..."
                    className="bg-slate-50/80 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    City <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input disabled value={form.location_city} className="bg-slate-50/80 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    State <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input disabled value={form.location_state} className="bg-slate-50/80 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    Start Date <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input type="date" disabled value={form.start_date} className="bg-slate-50/80 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    End Date <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input type="date" disabled value={form.end_date} className="bg-slate-50/80 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700">
                    Number of Positions <Lock className="w-3 h-3 text-slate-400" />
                  </Label>
                  <Input disabled value={form.positions} className="bg-slate-50/80 cursor-not-allowed" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECÃO 3: Pay & Benefits */}
          <Card
            id="financials"
            className={`border-slate-200 shadow-sm scroll-mt-24 transition-opacity duration-300 ${!dolDataFetched ? "opacity-50 pointer-events-none" : ""}`}
          >
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">3. Pay & Benefits</CardTitle>
              <CardDescription>Compensation, housing, and deductions information.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2 md:w-1/2">
                <Label className="text-slate-700">Wage Rate</Label>
                <Input
                  value={form.wage_rate}
                  onChange={(e) => setForm((p) => ({ ...p, wage_rate: e.target.value }))}
                  placeholder="e.g. $16.50 / hour"
                  className="bg-white border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Benefits & Housing</Label>
                <Textarea
                  value={form.benefits}
                  onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))}
                  placeholder="Describe housing arrangements, transportation, and other benefits..."
                  rows={3}
                  className="bg-white border-slate-300 resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Deductions</Label>
                <Textarea
                  value={form.deductions}
                  onChange={(e) => setForm((p) => ({ ...p, deductions: e.target.value }))}
                  placeholder="Specify any payroll deductions (taxes, housing, etc.)..."
                  rows={2}
                  className="bg-white border-slate-300 resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* SECÃO 4: Filtros de Triagem */}
          <Card
            id="screening"
            className={`border-slate-200 shadow-sm scroll-mt-24 transition-opacity duration-300 ${!dolDataFetched ? "opacity-50 pointer-events-none" : ""}`}
          >
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">4. Screening Criteria</CardTitle>
              <CardDescription>Candidates will be filtered based on these requirements.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    key: "req_english" as const,
                    title: "English Proficiency",
                    desc: "Requires candidates to speak basic English.",
                  },
                  {
                    key: "req_experience" as const,
                    title: "Prior Experience",
                    desc: "Requires previous experience in this specific role.",
                  },
                  {
                    key: "req_drivers_license" as const,
                    title: "Driver's License",
                    desc: "Requires a valid driver's license.",
                  },
                  {
                    key: "consular_only" as const,
                    title: "Consular Processing Only",
                    desc: "Rejects candidates already inside the US (in-country transfers).",
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
