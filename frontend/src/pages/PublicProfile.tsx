import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Download, MessageCircle, Loader2, FileText, AlertCircle, Phone, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";

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
  const queueId = searchParams.get("q");
  const sentAt = searchParams.get("s"); // Timestamp de envio

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function trackAndFetch() {
      try {
        // 1. TRAVA ANTI-ANTIVÍRUS (60 Segundos)
        const now = Date.now();
        const diffInSeconds = sentAt ? (now - parseInt(sentAt)) / 1000 : 999;

        let trackingData = null;

        if (diffInSeconds > 60) {
          // Se passou de 60s, registra a visualização e inicia contador
          const { data, error } = await supabase.rpc("track_profile_view_v2", {
            p_token: token,
            p_queue_id: queueId,
          });
          if (!error && data) {
            trackingData = data[0];
            setViewId(trackingData.view_id); // ID desta visualização específica
          }
        } else {
          console.log("Visualização ignorada: Possível bot/antivírus");
          // Apenas busca os dados do perfil sem registrar estatística nova
          const { data } = await supabase
            .from("profiles")
            .select("id, full_name, phone_e164, resume_url, contact_email")
            .eq("public_token", token)
            .single();
          trackingData = data;
        }

        if (!trackingData) {
          setNotFound(true);
          return;
        }

        setProfile(trackingData as ProfileData);
      } catch (err) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    trackAndFetch();

    return () => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [token, queueId, sentAt]);

  // 2. LÓGICA DO CONTADOR DE TEMPO (HEARTBEAT)
  useEffect(() => {
    if (viewId) {
      heartbeatInterval.current = setInterval(async () => {
        await supabase.rpc("update_view_duration", { p_view_id: viewId });
      }, 10000); // Avisa o banco a cada 10 segundos
    }
    return () => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [viewId]);

  const handleWhatsAppClick = async () => {
    if (!token || !profile?.phone_e164) return;
    try {
      await supabase.rpc("track_whatsapp_click", { p_token: token });
    } catch (e) {}
    const phone = profile.phone_e164.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (notFound || !profile) return <NotFound />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <BrandLogo height={32} />
          <h1 className="text-lg font-bold truncate">{profile.full_name}</h1>
        </div>
      </header>

      <main className="flex-1 p-4 pb-40">
        <div className="max-w-lg mx-auto h-full min-h-[500px] bg-white rounded-xl shadow-sm border overflow-hidden">
          {profile.resume_url ? (
            <iframe src={`${profile.resume_url}#toolbar=0`} className="w-full h-full min-h-[600px]" title="Resume" />
          ) : (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <AlertCircle className="h-12 w-12 text-slate-300 mb-2" />
              <p>Currículo não disponível</p>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t">
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-3">
          <Button onClick={handleWhatsAppClick} className="bg-[#25D366] hover:bg-[#20BD5A] h-12 font-bold">
            <MessageCircle className="mr-2" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = `tel:${profile.phone_e164}`)}
            className="h-12 font-bold"
          >
            <Phone className="mr-2" /> Ligar
          </Button>
        </div>
      </div>
    </div>
  );
}
