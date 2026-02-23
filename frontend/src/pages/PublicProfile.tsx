import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Loader2, AlertCircle, Phone, MessageSquare,
  Share2, FileText, Sparkles, Briefcase, Globe, Star,
  Clock, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";
import { toast } from "sonner";

// WhatsApp SVG icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="20" height="20">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface ProfileData {
  id: string;
  full_name: string | null;
  phone_e164: string | null;
  resume_url: string | null;
  contact_email: string | null;
  resume_data: any;
}

interface AISummary {
  headline: string;
  strengths: string[];
  experience_years: number;
  summary: string;
  languages: string[];
  availability: string;
}

interface JobInfo {
  job_title: string;
  company: string;
}

export default function PublicProfile() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const queueId = searchParams.get("q");
  const sentAt = searchParams.get("s");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch job info if queueId present
  useEffect(() => {
    if (!queueId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("my_queue")
          .select("job_id")
          .eq("id", queueId)
          .single();
        const jobId = (data as any)?.job_id;
        if (jobId) {
          const { data: job } = await supabase
            .from("public_jobs")
            .select("job_title, company")
            .eq("id", jobId)
            .single();
          if (job) setJobInfo(job);
        }
      } catch {}
    })();
  }, [queueId]);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    async function trackAndFetch() {
      try {
        const now = Date.now();
        const diffInSeconds = sentAt ? (now - parseInt(sentAt)) / 1000 : 999;
        let trackingData: any = null;

        if (diffInSeconds > 60) {
          const { data, error } = await supabase.rpc("track_profile_view_v2", {
            p_token: token, p_queue_id: queueId,
          });
          if (!error && data) {
            trackingData = data[0];
            setViewId(trackingData.view_id);
          }
        } else {
          const { data } = await supabase
            .from("profiles")
            .select("id, full_name, phone_e164, resume_url, contact_email, resume_data")
            .eq("public_token", token)
            .single();
          trackingData = data;
        }

        if (!trackingData) { setNotFound(true); return; }

        // If tracking RPC was used, we need resume_data separately
        if (!trackingData.resume_data && trackingData.id) {
          const { data: extra } = await supabase
            .from("profiles")
            .select("contact_email, resume_data")
            .eq("id", trackingData.id)
            .single();
          if (extra) {
            trackingData.contact_email = extra.contact_email;
            trackingData.resume_data = extra.resume_data;
          }
        }

        setProfile(trackingData as ProfileData);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    }

    trackAndFetch();
    return () => { if (heartbeatInterval.current) clearInterval(heartbeatInterval.current); };
  }, [token, queueId, sentAt]);

  // Heartbeat
  useEffect(() => {
    if (viewId) {
      heartbeatInterval.current = setInterval(async () => {
        await supabase.rpc("update_view_duration", { p_view_id: viewId });
      }, 10000);
    }
    return () => { if (heartbeatInterval.current) clearInterval(heartbeatInterval.current); };
  }, [viewId]);

  // Load AI summary
  const loadAiSummary = useCallback(async () => {
    if (aiSummary || aiLoading || !token) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-resume", {
        body: { token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiSummary(data);
    } catch (e: any) {
      console.error("AI summary error:", e);
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  }, [token, aiSummary, aiLoading]);

  const handleWhatsAppClick = async () => {
    if (!token || !profile?.phone_e164) return;
    try { await supabase.rpc("track_whatsapp_click", { p_token: token }); } catch {}
    const phone = profile.phone_e164.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  const handleSmsClick = () => {
    if (!profile?.phone_e164) return;
    window.open(`sms:${profile.phone_e164}`, "_blank");
  };

  const handleCallClick = () => {
    if (!profile?.phone_e164) return;
    window.location.href = `tel:${profile.phone_e164}`;
  };

  const handleEmailClick = () => {
    const email = profile?.contact_email || "";
    if (email) window.open(`mailto:${email}`, "_blank");
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = `${profile?.full_name || "Candidate"} — Smart Profile`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleDownload = async () => {
    if (!profile?.resume_url) return;
    setDownloading(true);
    try {
      const res = await fetch(profile.resume_url);
      const blob = await res.blob();
      const cleanName = (profile.full_name || "resume").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanName}_Resume.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download resume");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );
  if (notFound || !profile) return <NotFound />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo height={28} />
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate leading-tight">{profile.full_name}</h1>
              {jobInfo && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Briefcase className="h-3 w-3 flex-shrink-0" />
                  Candidate for: {jobInfo.job_title} — {jobInfo.company}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleShare} title="Share">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 pb-44">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="resume" className="w-full" onValueChange={(v) => {
            if (v === "summary") loadAiSummary();
          }}>
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="resume" className="gap-1.5">
                <FileText className="h-4 w-4" /> Resume
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-1.5">
                <Sparkles className="h-4 w-4" /> AI Summary
              </TabsTrigger>
            </TabsList>

            {/* RESUME TAB */}
            <TabsContent value="resume">
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {profile.resume_url ? (
                  <div className="relative">
                    <object
                      data={`${profile.resume_url}#toolbar=1`}
                      type="application/pdf"
                      className="w-full min-h-[600px] md:min-h-[800px]"
                    >
                      <iframe
                        src={`${profile.resume_url}#toolbar=1`}
                        className="w-full min-h-[600px] md:min-h-[800px]"
                        title="Resume"
                      />
                    </object>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-2 opacity-40" />
                    <p>Resume not available</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AI SUMMARY TAB */}
            <TabsContent value="summary">
              <div className="bg-white rounded-xl shadow-sm border p-5">
                {aiLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    <p className="text-sm text-muted-foreground">Analyzing resume with AI...</p>
                  </div>
                )}

                {aiError && !aiLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <AlertCircle className="h-10 w-10 text-destructive/60" />
                    <p className="text-sm text-muted-foreground">
                      {profile.resume_data
                        ? "Could not generate summary. Try again later."
                        : "No resume data available for AI analysis."}
                    </p>
                    {profile.resume_data && (
                      <Button variant="outline" size="sm" onClick={() => { setAiError(false); loadAiSummary(); }}>
                        Retry
                      </Button>
                    )}
                  </div>
                )}

                {aiSummary && !aiLoading && (
                  <div className="space-y-5">
                    {/* Headline */}
                    <div className="text-center pb-4 border-b">
                      <p className="text-lg font-semibold text-foreground">{aiSummary.headline}</p>
                      <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {aiSummary.experience_years}+ yrs experience
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />
                          {aiSummary.languages.join(", ")}
                        </span>
                      </div>
                    </div>

                    {/* Executive Summary */}
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Executive Summary
                      </h3>
                      <p className="text-sm leading-relaxed">{aiSummary.summary}</p>
                    </div>

                    {/* Key Strengths */}
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Key Strengths
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {aiSummary.strengths.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                          >
                            <Star className="h-3 w-3" /> {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Availability */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      <span className="font-medium text-green-800">📅 Availability:</span>{" "}
                      <span className="text-green-700">{aiSummary.availability}</span>
                    </div>

                    <p className="text-[11px] text-muted-foreground/60 text-center pt-2">
                      ✨ Generated by AI • Based on candidate's resume data
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-20">
        <div className="max-w-2xl mx-auto p-3 space-y-2">
          {/* Row 1: Primary actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleWhatsAppClick}
              disabled={!profile.phone_e164}
              className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-11 font-semibold gap-2"
            >
              <WhatsAppIcon className="h-5 w-5" /> WhatsApp
            </Button>
            <Button
              onClick={handleSmsClick}
              disabled={!profile.phone_e164}
              variant="outline"
              className="h-11 font-semibold gap-2"
            >
              <MessageSquare className="h-4 w-4" /> SMS
            </Button>
          </div>

          {/* Row 2: Secondary actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" size="sm" onClick={handleCallClick} disabled={!profile.phone_e164} className="gap-1 text-xs">
              <Phone className="h-3.5 w-3.5" /> Call
            </Button>
            <Button variant="ghost" size="sm" onClick={handleEmailClick} disabled={!profile.contact_email} className="gap-1 text-xs">
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!profile.resume_url || downloading}
              className="gap-1 text-xs"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
