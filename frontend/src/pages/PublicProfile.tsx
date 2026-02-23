import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Download, Loader2, AlertCircle, Phone, MessageSquare,
  Share2, Sparkles, Briefcase, Globe,
  Clock, Mail, CheckCircle2, User,
} from "lucide-react";
import NotFound from "./NotFound";
import { toast } from "sonner";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="18" height="18">
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
  ai_summary: AISummary | null;
}

interface AISummary {
  headline: string;
  strengths: string[];
  experience_years: number;
  experience_domain?: string;
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
            .select("id, full_name, phone_e164, resume_url, contact_email, resume_data, ai_summary")
            .eq("public_token", token)
            .single();
          trackingData = data;
        }

        if (!trackingData) { setNotFound(true); return; }

        // If tracking RPC was used, we need extra fields
        if (!trackingData.resume_data && trackingData.id) {
          const { data: extra } = await supabase
            .from("profiles")
            .select("contact_email, resume_data, ai_summary")
            .eq("id", trackingData.id)
            .single();
          if (extra) {
            trackingData.contact_email = extra.contact_email;
            trackingData.resume_data = extra.resume_data;
            trackingData.ai_summary = extra.ai_summary;
          }
        }

        const profileData = trackingData as ProfileData;
        setProfile(profileData);

        // Use cached summary if available
        if (profileData.ai_summary) {
          setAiSummary(profileData.ai_summary);
        }
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

  // Load AI summary (auto-trigger if no cached version)
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

  // Auto-load AI summary when profile loads
  useEffect(() => {
    if (profile && !aiSummary && !aiLoading && profile.resume_data) {
      loadAiSummary();
    }
  }, [profile, aiSummary, aiLoading, loadAiSummary]);

  const handleWhatsAppClick = async () => {
    if (!token || !profile?.phone_e164) return;
    try { await supabase.rpc("track_whatsapp_click", { p_token: token }); } catch {}
    const phone = profile.phone_e164.replace(/\D/g, "");
    window.location.href = `https://wa.me/${phone}`;
  };

  const handleSmsClick = () => {
    if (!profile?.phone_e164) return;
    window.location.href = `sms:${profile.phone_e164}`;
  };

  const handleCallClick = () => {
    if (!profile?.phone_e164) return;
    window.location.href = `tel:${profile.phone_e164}`;
  };

  const handleEmailClick = () => {
    const email = profile?.contact_email || "";
    if (email) window.location.href = `mailto:${email}`;
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );
  if (notFound || !profile) return <NotFound />;

  const initials = (profile.full_name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER - compact, professional */}
      <header className="bg-card border-b px-4 py-3 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo height={24} />
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold truncate leading-tight text-foreground">{profile.full_name}</h1>
                {jobInfo && (
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <Briefcase className="h-3 w-3 flex-shrink-0" />
                    {jobInfo.job_title} — {jobInfo.company}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Desktop action buttons in header */}
          <div className="hidden md:flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5 text-xs h-8">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={handleDownload}
              disabled={!profile.resume_url || downloading}
              className="gap-1.5 text-xs h-8"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto p-4 flex flex-col lg:flex-row gap-4">

          {/* LEFT: AI Summary + Contact */}
          <div className="w-full lg:w-[380px] lg:flex-shrink-0 space-y-4 order-1 lg:order-1">

            {/* AI Summary Card */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-primary/5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">AI Summary</span>
              </div>

              <div className="p-4">
                {aiLoading && (
                  <div className="flex items-center gap-3 py-6 justify-center">
                    <Loader2 className="animate-spin h-5 w-5 text-primary" />
                    <p className="text-sm text-muted-foreground">Analyzing...</p>
                  </div>
                )}

                {aiError && !aiLoading && (
                  <div className="flex flex-col items-center py-6 gap-2 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">
                      {profile.resume_data ? "Could not generate summary." : "No resume data available."}
                    </p>
                    {profile.resume_data && (
                      <Button variant="outline" size="sm" onClick={() => { setAiError(false); loadAiSummary(); }}>
                        Retry
                      </Button>
                    )}
                  </div>
                )}

                {aiSummary && !aiLoading && (
                  <div className="space-y-3">
                    {/* Headline */}
                    <p className="text-sm font-medium text-foreground leading-snug">{aiSummary.headline}</p>

                    {/* Quick stats row */}
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 bg-muted/60 rounded-full px-2.5 py-1">
                        <Briefcase className="h-3 w-3" />
                        {aiSummary.experience_years}+ yrs {aiSummary.experience_domain ? `in ${aiSummary.experience_domain}` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-muted/60 rounded-full px-2.5 py-1">
                        <Globe className="h-3 w-3" /> {aiSummary.languages.join(", ")}
                      </span>
                    </div>

                    {/* Executive summary */}
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiSummary.summary}</p>

                    {/* Key strengths as bullet points */}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Key Strengths</p>
                      <ul className="space-y-1">
                        {aiSummary.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Availability */}
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-xs">
                      <span className="font-medium text-green-800 dark:text-green-300">Availability:</span>{" "}
                      <span className="text-green-700 dark:text-green-400">{aiSummary.availability}</span>
                    </div>
                  </div>
                )}

                {!aiSummary && !aiLoading && !aiError && !profile.resume_data && (
                  <div className="flex flex-col items-center py-6 gap-2 text-center">
                    <User className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">No resume data uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Card - Desktop */}
            <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b">
                <span className="text-sm font-semibold text-foreground">Contact</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                <Button
                  onClick={handleWhatsAppClick}
                  disabled={!profile.phone_e164}
                  className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-10 text-xs font-medium gap-2"
                >
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                </Button>
                <Button
                  onClick={handleSmsClick}
                  disabled={!profile.phone_e164}
                  variant="outline"
                  className="h-10 text-xs font-medium gap-2"
                >
                  <MessageSquare className="h-4 w-4" /> SMS
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCallClick}
                  disabled={!profile.phone_e164}
                  className="h-10 text-xs font-medium gap-2"
                >
                  <Phone className="h-4 w-4" /> Call
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEmailClick}
                  disabled={!profile.contact_email}
                  className="h-10 text-xs font-medium gap-2"
                >
                  <Mail className="h-4 w-4" /> Email
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT: Resume PDF */}
          <div className="flex-1 order-2 lg:order-2">
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              {profile.resume_url ? (
                <object
                  data={`${profile.resume_url}#toolbar=1`}
                  type="application/pdf"
                  className="w-full"
                  style={{ minHeight: "calc(100vh - 160px)" }}
                >
                  <iframe
                    src={`${profile.resume_url}#toolbar=1`}
                    className="w-full"
                    style={{ minHeight: "calc(100vh - 160px)" }}
                    title="Resume"
                  />
                </object>
              ) : (
                <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-2 opacity-40" />
                  <p>Resume not available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MOBILE BOTTOM BAR - clean 4 icon layout */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t z-20 md:hidden safe-area-bottom">
        <div className="grid grid-cols-5 divide-x divide-border">
          <button
            onClick={handleWhatsAppClick}
            disabled={!profile.phone_e164}
            className="flex flex-col items-center justify-center py-2.5 gap-0.5 text-[#25D366] disabled:opacity-30"
          >
            <WhatsAppIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">WhatsApp</span>
          </button>
          <button
            onClick={handleCallClick}
            disabled={!profile.phone_e164}
            className="flex flex-col items-center justify-center py-2.5 gap-0.5 text-foreground disabled:opacity-30"
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px] font-medium">Call</span>
          </button>
          <button
            onClick={handleSmsClick}
            disabled={!profile.phone_e164}
            className="flex flex-col items-center justify-center py-2.5 gap-0.5 text-foreground disabled:opacity-30"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">SMS</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={!profile.resume_url || downloading}
            className="flex flex-col items-center justify-center py-2.5 gap-0.5 text-foreground disabled:opacity-30"
          >
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            <span className="text-[10px] font-medium">Download</span>
          </button>
          <button
            onClick={handleShare}
            className="flex flex-col items-center justify-center py-2.5 gap-0.5 text-foreground"
          >
            <Share2 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}
