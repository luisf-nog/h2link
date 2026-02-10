import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { Upload, FileText, Loader2, Download, ArrowRight, CheckCircle, Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf";
import { extractTextFromDOCX } from "@/lib/docx";
import { generateResumePDF, type ResumeData } from "@/lib/resumePdf";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// Tipagem segura para garantir que o TS não reclame
// Se você já tem esse tipo exportado em @/lib/resumePdf, pode remover essa definição local
// mas mantê-la aqui garante que o arquivo funcione sozinho.
interface SafeResumeData {
  personal_info: {
    full_name: string;
    city_state_country: string;
    email: string;
    phone: string;
  };
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    location: string;
    dates: string;
    points: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  languages: string[];
}

type Step = "idle" | "reading" | "translating" | "formatting" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  reading: "Reading file...",
  translating: "Translating & Analyzing...",
  formatting: "Formatting to US Standard...",
  done: "Done!",
  error: "An error occurred.",
};

const STEP_PROGRESS: Record<Step, number> = {
  idle: 0,
  reading: 20,
  translating: 50,
  formatting: 80,
  done: 100,
  error: 0,
};

const emptyResume: SafeResumeData = {
  personal_info: { full_name: "", city_state_country: "", email: "", phone: "" },
  summary: "",
  skills: [],
  experience: [],
  education: [],
  languages: [],
};

export default function ResumeConverter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("idle");
  const [resume, setResume] = useState<SafeResumeData>(emptyResume);

  const processFile = useCallback(async (file: File) => {
    try {
      setStep("reading");
      let rawText = "";

      // 1. Extração de Texto
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        rawText = await extractTextFromPDF(file);
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        rawText = await extractTextFromDOCX(file);
      } else {
        toast({
          title: "Unsupported file",
          description: "Please upload a PDF or DOCX file.",
          variant: "destructive",
        });
        setStep("idle");
        return;
      }

      // 2. Validação de PDF Scaneado (Imagem)
      // Se tiver menos de 50 caracteres, provavelmente é uma imagem salva como PDF.
      if (!rawText || rawText.trim().length < 50) {
        toast({
          title: "Could not read text",
          description:
            "The file appears to be an image or scanned document. Please upload a text-based PDF or Word file.",
          variant: "destructive",
        });
        setStep("idle");
        return;
      }

      setStep("translating");

      // 3. Chamada à Edge Function (IA)
      const { data, error } = await supabase.functions.invoke("convert-resume", {
        body: { raw_text: rawText },
      });

      if (error) {
        console.error("Supabase Function Error:", error);
        throw new Error("Failed to connect to AI service. Please try again.");
      }

      if (!data) {
        throw new Error("Received empty response from AI.");
      }

      setStep("formatting");

      // 4. Sanitização e Proteção de Dados (CRUCIAL)
      // Garante que arrays sejam arrays e strings sejam strings, evitando crash no render.
      const safeData: SafeResumeData = {
        personal_info: {
          full_name: data.personal_info?.full_name || "",
          city_state_country: data.personal_info?.city_state_country || "",
          email: data.personal_info?.email || "",
          phone: data.personal_info?.phone || "",
        },
        summary: data.summary || "",
        skills: Array.isArray(data.skills) ? data.skills : [],
        experience: Array.isArray(data.experience) ? data.experience : [],
        education: Array.isArray(data.education) ? data.education : [],
        languages: Array.isArray(data.languages) ? data.languages : [],
      };

      // Pequeno delay artificial para UX (usuário ver que algo aconteceu)
      await new Promise((r) => setTimeout(r, 600));

      setResume(safeData);
      setStep("done");

      toast({
        title: "Success!",
        description: "Your resume has been converted to US format.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Conversion Failed",
        description: err?.message || "Something went wrong processing your file.",
        variant: "destructive",
      });
      setStep("error");
    }
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) processFile(accepted[0]);
    },
    [processFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    disabled: step === "reading" || step === "translating" || step === "formatting",
  });

  const handleDownload = () => {
    // Casting para ResumeData (assumindo compatibilidade com a lib de PDF)
    const doc = generateResumePDF(resume as unknown as ResumeData);
    const name = resume.personal_info.full_name?.replace(/\s+/g, "_") || "resume";
    doc.save(`${name}_US_Resume.pdf`);
  };

  const updateField = (path: string, value: any) => {
    setResume((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = clone;

      // Navegação segura para update profundo
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {}; // Cria objeto se não existir
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  const isProcessing = step === "reading" || step === "translating" || step === "formatting";

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-2 pt-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Transform your International CV into a US Resume
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Upload your resume from any country. Our AI will translate, sanitize, and reformat it to US standards for
          H-2A/H-2B visa applications.
        </p>
      </div>

      {/* Upload / Progress Section */}
      {step !== "done" && (
        <Card className="border-2 border-dashed border-slate-200 shadow-sm">
          <CardContent className="p-8">
            {!isProcessing ? (
              <div
                {...getRootProps()}
                className={`flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all rounded-xl ${
                  isDragActive ? "bg-primary/5 border-primary scale-105" : "hover:bg-slate-50"
                }`}
              >
                <input {...getInputProps()} />
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="text-xl font-semibold text-foreground mb-2">
                  {isDragActive ? "Drop your file here" : "Drag & drop your resume here"}
                </p>
                <p className="text-sm text-muted-foreground">Supports PDF or DOCX • Any language</p>
                <Button variant="outline" className="mt-6">
                  <FileText className="mr-2 h-4 w-4" /> Browse Files
                </Button>
              </div>
            ) : (
              <div className="space-y-6 py-8">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="text-xl font-medium text-slate-700 animate-pulse">{STEP_LABELS[step]}</span>
                </div>
                <Progress value={STEP_PROGRESS[step]} className="max-w-md mx-auto h-2" />
                <p className="text-center text-xs text-muted-foreground">This may take up to 30 seconds.</p>
              </div>
            )}

            {step === "error" && (
              <div className="text-center mt-6 bg-destructive/10 p-4 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-destructive font-bold mb-2">
                  <AlertCircle className="h-5 w-5" /> Conversion Error
                </div>
                <p className="text-sm text-destructive/80 mb-4">We encountered an issue processing your file.</p>
                <Button onClick={() => setStep("idle")} variant="destructive">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result: Split View */}
      {step === "done" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Editor */}
            <Card className="h-full flex flex-col border-slate-200 shadow-md">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Edit Resume Data
                </CardTitle>
                <CardDescription>Review and adjust the extracted data before downloading.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6 max-h-[70vh] overflow-y-auto">
                {/* Personal Info */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold text-primary">Personal Info</Label>
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Full Name</Label>
                      <Input
                        value={resume.personal_info.full_name || ""}
                        onChange={(e) => updateField("personal_info.full_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">City, State, Country</Label>
                      <Input
                        value={resume.personal_info.city_state_country || ""}
                        onChange={(e) => updateField("personal_info.city_state_country", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          value={resume.personal_info.email || ""}
                          onChange={(e) => updateField("personal_info.email", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          value={resume.personal_info.phone || ""}
                          onChange={(e) => updateField("personal_info.phone", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-primary">Professional Summary</Label>
                  <Textarea
                    rows={4}
                    value={resume.summary || ""}
                    onChange={(e) => updateField("summary", e.target.value)}
                  />
                </div>

                {/* Skills */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-primary">Skills</Label>
                  <Textarea
                    rows={2}
                    value={resume.skills?.join(", ") || ""}
                    onChange={(e) =>
                      updateField(
                        "skills",
                        e.target.value
                          .split(",")
                          .map((s: string) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="Comma-separated skills"
                  />
                </div>

                {/* Experience */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold text-primary">Experience</Label>
                  {resume.experience?.map((exp, i) => (
                    <div key={i} className="border rounded-lg p-4 bg-slate-50 space-y-3 relative group">
                      <div className="absolute top-2 right-2 text-xs font-bold text-slate-300">#{i + 1}</div>
                      <Input
                        placeholder="Job Title"
                        className="font-semibold"
                        value={exp.title || ""}
                        onChange={(e) => updateField(`experience.${i}.title`, e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Company"
                          value={exp.company || ""}
                          onChange={(e) => updateField(`experience.${i}.company`, e.target.value)}
                        />
                        <Input
                          placeholder="Dates"
                          value={exp.dates || ""}
                          onChange={(e) => updateField(`experience.${i}.dates`, e.target.value)}
                        />
                      </div>
                      <Input
                        placeholder="Location"
                        value={exp.location || ""}
                        onChange={(e) => updateField(`experience.${i}.location`, e.target.value)}
                      />
                      <Textarea
                        rows={3}
                        value={exp.points?.join("\n") || ""}
                        onChange={(e) =>
                          updateField(`experience.${i}.points`, e.target.value.split("\n").filter(Boolean))
                        }
                        placeholder="Bullet points (one per line)"
                      />
                    </div>
                  ))}
                </div>

                {/* Education */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold text-primary">Education</Label>
                  {resume.education?.map((edu, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                      <Input
                        placeholder="Degree"
                        value={edu.degree || ""}
                        onChange={(e) => updateField(`education.${i}.degree`, e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="School"
                          value={edu.school || ""}
                          onChange={(e) => updateField(`education.${i}.school`, e.target.value)}
                        />
                        <Input
                          placeholder="Year"
                          value={edu.year || ""}
                          onChange={(e) => updateField(`education.${i}.year`, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Languages */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-primary">Languages</Label>
                  <Textarea
                    rows={2}
                    value={resume.languages?.join(", ") || ""}
                    onChange={(e) =>
                      updateField(
                        "languages",
                        e.target.value
                          .split(",")
                          .map((s: string) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="Comma-separated"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Right: Preview */}
            <Card className="h-full flex flex-col border-slate-200 shadow-md">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-lg">US Resume Preview</CardTitle>
                <CardDescription>Clean, professional, ATS-friendly US format.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 bg-slate-100 flex items-center justify-center py-8">
                {/* Resume Paper Visualization */}
                <div className="bg-white text-black w-full max-w-[210mm] min-h-[297mm] shadow-lg p-[15mm] mx-4 font-serif text-sm leading-relaxed overflow-hidden">
                  {/* Name Header */}
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold uppercase tracking-wide mb-2">
                      {resume.personal_info.full_name}
                    </h2>
                    <p className="text-xs text-gray-600">
                      {[resume.personal_info.city_state_country, resume.personal_info.email, resume.personal_info.phone]
                        .filter(Boolean)
                        .join("  |  ")}
                    </p>
                  </div>

                  <hr className="border-black mb-4" />

                  {/* Sections */}
                  <div className="space-y-6">
                    {/* Summary */}
                    {resume.summary && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-gray-300 mb-2 pb-1">
                          Professional Summary
                        </h3>
                        <p className="text-justify text-gray-800">{resume.summary}</p>
                      </div>
                    )}

                    {/* Skills */}
                    {resume.skills?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-gray-300 mb-2 pb-1">
                          Skills
                        </h3>
                        <p className="text-gray-800">{resume.skills.join("  •  ")}</p>
                      </div>
                    )}

                    {/* Experience */}
                    {resume.experience?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-gray-300 mb-3 pb-1">
                          Experience
                        </h3>
                        {resume.experience.map((exp, i) => (
                          <div key={i} className="mb-4 break-inside-avoid">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="font-bold text-base">{exp.title}</span>
                              <span className="text-xs font-medium whitespace-nowrap">{exp.dates}</span>
                            </div>
                            <div className="text-xs italic text-gray-700 mb-2">
                              {[exp.company, exp.location].filter(Boolean).join(" — ")}
                            </div>
                            <ul className="list-disc pl-5 space-y-1 text-gray-800">
                              {exp.points?.map((pt, j) => (
                                <li key={j} className="pl-1">
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Education */}
                    {resume.education?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-gray-300 mb-3 pb-1">
                          Education
                        </h3>
                        {resume.education.map((edu, i) => (
                          <div key={i} className="mb-2 flex justify-between items-baseline">
                            <div>
                              <span className="font-bold block">{edu.degree}</span>
                              <span className="text-xs italic text-gray-700">{edu.school}</span>
                            </div>
                            <span className="text-xs">{edu.year}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Languages */}
                    {resume.languages?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-gray-300 mb-2 pb-1">
                          Languages
                        </h3>
                        <p className="text-gray-800">{resume.languages.join("  •  ")}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions & Upsell */}
          <div className="space-y-6 pt-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="w-full sm:w-auto h-12 text-lg shadow-md" onClick={handleDownload}>
                <Download className="mr-2 h-5 w-5" /> Download PDF
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 text-lg"
                onClick={() => {
                  setStep("idle");
                  setResume(emptyResume);
                }}
              >
                Convert Another Resume
              </Button>
            </div>

            {/* Upsell Card */}
            <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm max-w-4xl mx-auto">
              <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="bg-emerald-100 p-3 rounded-full flex-shrink-0">
                  <Sparkles className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600" /> Your US Resume is Ready!
                  </h3>
                  <p className="text-slate-600 mt-1">
                    Don't send this manually one by one. Use our Bulk Sender to reach 450 employers instantly.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/plans")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md w-full md:w-auto"
                >
                  Upgrade to Bulk Send <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
