import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { Upload, FileText, Loader2, Download, ArrowRight, CheckCircle, Sparkles } from "lucide-react";
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

type Step = "idle" | "reading" | "translating" | "formatting" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  reading: "Reading file...",
  translating: "Translating to English...",
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

const emptyResume: ResumeData = {
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
  const [resume, setResume] = useState<ResumeData>(emptyResume);

  const processFile = useCallback(async (file: File) => {
    try {
      setStep("reading");
      let rawText = "";

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        rawText = await extractTextFromPDF(file);
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        rawText = await extractTextFromDOCX(file);
      } else {
        toast({ title: "Unsupported file", description: "Please upload a PDF or DOCX file.", variant: "destructive" });
        setStep("idle");
        return;
      }

      if (rawText.trim().length < 20) {
        toast({ title: "Could not extract text", description: "The file appears to be empty or image-only.", variant: "destructive" });
        setStep("idle");
        return;
      }

      setStep("translating");

      const { data, error } = await supabase.functions.invoke("convert-resume", {
        body: { raw_text: rawText },
      });

      if (error) {
        console.error("convert-resume error:", error);
        toast({ title: "Conversion failed", description: error.message || "Please try again.", variant: "destructive" });
        setStep("error");
        return;
      }

      setStep("formatting");

      // Small artificial delay to show formatting step
      await new Promise((r) => setTimeout(r, 600));

      setResume(data as ResumeData);
      setStep("done");
      toast({ title: "Resume converted!", description: "Review and download your US-formatted resume." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Something went wrong.", variant: "destructive" });
      setStep("error");
    }
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) processFile(accepted[0]);
    },
    [processFile]
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
    const doc = generateResumePDF(resume);
    const name = resume.personal_info.full_name?.replace(/\s+/g, "_") || "resume";
    doc.save(`${name}_US_Resume.pdf`);
  };

  const updateField = (path: string, value: any) => {
    setResume((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  const isProcessing = step === "reading" || step === "translating" || step === "formatting";

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Transform your International CV into a US Resume
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Upload your resume from any country. Our AI will translate, sanitize, and reformat it to US standards for H-2A/H-2B visa applications.
        </p>
      </div>

      {/* Upload / Progress */}
      {step !== "done" && (
        <Card>
          <CardContent className="p-6">
            {!isProcessing ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground">
                  {isDragActive ? "Drop your file here" : "Drag & drop your resume here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">PDF or DOCX • Any language</p>
                <Button variant="outline" className="mt-4">
                  <FileText className="mr-2 h-4 w-4" /> Browse Files
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-lg font-medium">{STEP_LABELS[step]}</span>
                </div>
                <Progress value={STEP_PROGRESS[step]} className="max-w-md mx-auto" />
              </div>
            )}

            {step === "error" && (
              <div className="text-center mt-4">
                <Button onClick={() => setStep("idle")}>Try Again</Button>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Edit Resume Fields</CardTitle>
                <CardDescription>Review and adjust before downloading</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Personal Info */}
                <div className="space-y-3">
                  <Label className="font-semibold">Personal Info</Label>
                  <Input
                    placeholder="Full Name"
                    value={resume.personal_info.full_name}
                    onChange={(e) => updateField("personal_info.full_name", e.target.value)}
                  />
                  <Input
                    placeholder="City, State, Country"
                    value={resume.personal_info.city_state_country}
                    onChange={(e) => updateField("personal_info.city_state_country", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Email"
                      value={resume.personal_info.email}
                      onChange={(e) => updateField("personal_info.email", e.target.value)}
                    />
                    <Input
                      placeholder="Phone"
                      value={resume.personal_info.phone}
                      onChange={(e) => updateField("personal_info.phone", e.target.value)}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-2">
                  <Label className="font-semibold">Professional Summary</Label>
                  <Textarea
                    rows={3}
                    value={resume.summary}
                    onChange={(e) => updateField("summary", e.target.value)}
                  />
                </div>

                {/* Skills */}
                <div className="space-y-2">
                  <Label className="font-semibold">Skills</Label>
                  <Textarea
                    rows={2}
                    value={resume.skills?.join(", ")}
                    onChange={(e) =>
                      updateField("skills", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))
                    }
                    placeholder="Comma-separated skills"
                  />
                </div>

                {/* Experience */}
                <div className="space-y-3">
                  <Label className="font-semibold">Experience</Label>
                  {resume.experience?.map((exp, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <Input
                        placeholder="Job Title"
                        value={exp.title}
                        onChange={(e) => updateField(`experience.${i}.title`, e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Company"
                          value={exp.company}
                          onChange={(e) => updateField(`experience.${i}.company`, e.target.value)}
                        />
                        <Input
                          placeholder="Dates"
                          value={exp.dates}
                          onChange={(e) => updateField(`experience.${i}.dates`, e.target.value)}
                        />
                      </div>
                      <Input
                        placeholder="Location"
                        value={exp.location}
                        onChange={(e) => updateField(`experience.${i}.location`, e.target.value)}
                      />
                      <Textarea
                        rows={3}
                        value={exp.points?.join("\n")}
                        onChange={(e) =>
                          updateField(`experience.${i}.points`, e.target.value.split("\n").filter(Boolean))
                        }
                        placeholder="One bullet point per line"
                      />
                    </div>
                  ))}
                </div>

                {/* Education */}
                <div className="space-y-3">
                  <Label className="font-semibold">Education</Label>
                  {resume.education?.map((edu, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <Input
                        placeholder="Degree"
                        value={edu.degree}
                        onChange={(e) => updateField(`education.${i}.degree`, e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="School"
                          value={edu.school}
                          onChange={(e) => updateField(`education.${i}.school`, e.target.value)}
                        />
                        <Input
                          placeholder="Year"
                          value={edu.year}
                          onChange={(e) => updateField(`education.${i}.year`, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Languages */}
                <div className="space-y-2">
                  <Label className="font-semibold">Languages</Label>
                  <Textarea
                    rows={2}
                    value={resume.languages?.join(", ")}
                    onChange={(e) =>
                      updateField("languages", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))
                    }
                    placeholder="Comma-separated, e.g. Spanish (Native), English (Intermediate)"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Right: Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">US Resume Preview</CardTitle>
                <CardDescription>Clean, professional, US Letter format</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white text-black rounded-lg border shadow-inner p-8 max-h-[70vh] overflow-y-auto font-serif text-sm leading-relaxed">
                  {/* Name */}
                  <h2 className="text-xl font-bold text-center mb-1">{resume.personal_info.full_name}</h2>
                  <p className="text-center text-xs text-gray-600 mb-4">
                    {[resume.personal_info.city_state_country, resume.personal_info.email, resume.personal_info.phone]
                      .filter(Boolean)
                      .join("  |  ")}
                  </p>
                  <hr className="border-black mb-3" />

                  {resume.summary && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-1">Professional Summary</h3>
                      <p className="mb-3">{resume.summary}</p>
                    </>
                  )}

                  {resume.skills?.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-1">Skills</h3>
                      <p className="mb-3">{resume.skills.join("  •  ")}</p>
                    </>
                  )}

                  {resume.experience?.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-1">Professional Experience</h3>
                      {resume.experience.map((exp, i) => (
                        <div key={i} className="mb-3">
                          <div className="flex justify-between">
                            <span className="font-bold">{exp.title}</span>
                            <span className="text-xs">{exp.dates}</span>
                          </div>
                          <div className="text-xs italic text-gray-700">
                            {[exp.company, exp.location].filter(Boolean).join(" — ")}
                          </div>
                          <ul className="list-disc pl-5 mt-1 space-y-0.5">
                            {exp.points?.map((pt, j) => (
                              <li key={j}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </>
                  )}

                  {resume.education?.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-1">Education</h3>
                      {resume.education.map((edu, i) => (
                        <div key={i} className="mb-2">
                          <div className="flex justify-between">
                            <span className="font-bold">{edu.degree}</span>
                            <span className="text-xs">{edu.year}</span>
                          </div>
                          <div className="text-xs italic text-gray-700">{edu.school}</div>
                        </div>
                      ))}
                    </>
                  )}

                  {resume.languages?.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-1">Languages</h3>
                      <p>{resume.languages.join("  •  ")}</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={handleDownload}>
              <Download className="mr-2 h-5 w-5" /> Download PDF
            </Button>
            <Button size="lg" variant="outline" onClick={() => { setStep("idle"); setResume(emptyResume); }}>
              Convert Another Resume
            </Button>
          </div>

          {/* Upsell Card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-shrink-0">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2 justify-center sm:justify-start">
                  <CheckCircle className="h-5 w-5 text-primary" /> Your US Resume is Ready!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Don't send this one by one. Use our Bulk Sender to reach 450 employers today.
                </p>
              </div>
              <Button onClick={() => navigate("/plans")}>
                Upgrade to Bulk Send <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
