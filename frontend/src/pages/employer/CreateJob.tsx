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
import { Loader2, ArrowLeft, Briefcase, Filter, AlertTriangle, Save } from "lucide-react";

const FORM_SECTIONS = [
  { id: "job-details", label: "1. Job Details", icon: Briefcase },
  { id: "screening", label: "2. Screening Criteria", icon: Filter },
];

export default function CreateJob() {
  const navigate = useNavigate();
  const { employerProfile } = useIsEmployer();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("job-details");

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_date: "",
    end_date: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employerProfile) return;

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
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      req_english: form.req_english,
      req_experience: form.req_experience,
      req_drivers_license: form.req_drivers_license,
      consular_only: form.consular_only,
      priority_level: employerProfile.tier,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job created!", description: "Your posting is now live." });
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
          <h1 className="text-3xl font-bold font-brand text-slate-900">Create Job Posting</h1>
          <p className="text-sm text-slate-500">Configure your sponsored job details and screening rules.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/employer/jobs")} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.title.trim()}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Publish Job
          </Button>
        </div>
      </div>

      <form id="create-job-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* 🧭 NAVEGAÇÃO LATERAL (Sticky Sidebar) */}
        <div className="hidden md:block col-span-1 sticky top-24 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 px-2">Navigation</h3>
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
          {/* SECÃO 1: Detalhes da Vaga */}
          <Card id="job-details" className="border-slate-200 shadow-sm scroll-mt-24">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">Job Details</CardTitle>
              <CardDescription>Basic information about the position and location.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-700">
                  Job Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Farmworkers and Laborers"
                  className="bg-slate-50 border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Job duties, requirements, benefits..."
                  rows={5}
                  className="bg-slate-50 border-slate-200 resize-y"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Orlando, FL"
                  className="bg-slate-50 border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700">Start Date</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">End Date</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECÃO 2: Filtros de Triagem */}
          <Card id="screening" className="border-slate-200 shadow-sm scroll-mt-24">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xl">Screening Criteria</CardTitle>
              <CardDescription>Candidates will be filtered based on these requirements.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Alerta Legal */}
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Compliance Notice</p>
                  <p className="text-sm leading-relaxed opacity-90">
                    Screening criteria must align with your DOL-approved job order. Do not use requirements to
                    discriminate against protected classes.
                  </p>
                </div>
              </div>

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
      </form>
    </div>
  );
}
