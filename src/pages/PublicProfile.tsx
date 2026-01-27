import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Download, MessageCircle, Loader2, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileData {
  id: string;
  full_name: string | null;
  phone_e164: string | null;
  resume_url: string | null;
  contact_email: string | null;
}

export default function PublicProfile() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const queueId = searchParams.get("q"); // Optional queue ID for per-item tracking
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  // Track view and fetch profile data
  useEffect(() => {
    if (!token) {
      navigate("/404", { replace: true });
      return;
    }

    async function trackAndFetch() {
      try {
        const { data, error } = await supabase.rpc("track_profile_view", {
          p_token: token,
          p_queue_id: queueId || null,
        });

        if (error || !data || data.length === 0) {
          console.error("Profile not found:", error);
          navigate("/404", { replace: true });
          return;
        }

        setProfile(data[0] as ProfileData);
      } catch (err) {
        console.error("Error fetching profile:", err);
        navigate("/404", { replace: true });
      } finally {
        setLoading(false);
      }
    }

    trackAndFetch();
  }, [token, queueId, navigate]);

  // Track WhatsApp click
  const handleWhatsAppClick = () => {
    if (!token || !profile?.phone_e164) return;

    // Track click silently (fire and forget)
    void (async () => {
      try {
        await supabase.rpc("track_whatsapp_click", { p_token: token });
      } catch (e) {
        console.error("Failed to track click:", e);
      }
    })();

    // Format phone number for WhatsApp (remove + if present)
    const phone = profile.phone_e164.replace(/^\+/, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  // Handle PDF download
  const handleDownload = () => {
    if (!profile?.resume_url) return;
    window.open(profile.resume_url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return null; // Will redirect to 404
  }

  const hasResume = !!profile.resume_url;
  const hasPhone = !!profile.phone_e164;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <BrandLogo height={32} className="rounded-md" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {profile.full_name || "Candidate Profile"}
            </h1>
          </div>
        </div>
      </header>

      {/* PDF Viewer Area */}
      <main className="flex-1 flex flex-col p-4 pb-24">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {hasResume ? (
            <div className="flex-1 min-h-[70vh] bg-background rounded-lg border shadow-sm overflow-hidden">
              {!pdfError ? (
                <iframe
                  src={`${profile.resume_url}#toolbar=0&navpanes=0`}
                  className="w-full h-full min-h-[70vh]"
                  title="Resume PDF"
                  onError={() => setPdfError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[70vh] p-6 text-center">
                  <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Preview Unavailable</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your browser doesn't support inline PDF viewing.
                    <br />
                    Click the button below to download.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-[70vh] bg-background rounded-lg border shadow-sm flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Resume Available</h3>
              <p className="text-sm text-muted-foreground">
                This candidate hasn't uploaded a resume yet.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto flex gap-3">
          {hasPhone && (
            <Button
              onClick={handleWhatsAppClick}
              className={cn(
                "flex-1 h-12 text-base font-medium",
                "bg-[#25D366] hover:bg-[#20BD5A] text-white"
              )}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Chat on WhatsApp
            </Button>
          )}
          
          {hasResume && (
            <Button
              onClick={handleDownload}
              variant={hasPhone ? "outline" : "default"}
              className={cn(
                "h-12 text-base font-medium",
                hasPhone ? "flex-1" : "flex-1"
              )}
            >
              <Download className="w-5 h-5 mr-2" />
              Download PDF
            </Button>
          )}

          {!hasPhone && !hasResume && (
            <p className="text-center text-muted-foreground w-full py-2">
              No contact options available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
