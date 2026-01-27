import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ExternalLink, Eye, MessageCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublicProfileSectionProps {
  publicToken: string | null;
  viewsCount: number;
  whatsappClicks: number;
  lastViewedAt: string | null;
}

export function PublicProfileSection({
  publicToken,
  viewsCount,
  whatsappClicks,
  lastViewedAt,
}: PublicProfileSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const publicUrl = publicToken
    ? `${window.location.origin}/v/${publicToken}`
    : null;

  const handleCopy = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast({
        title: t("settings.public_profile.copied", "Link copied!"),
        description: t(
          "settings.public_profile.copied_desc",
          "Share this link with recruiters"
        ),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t("common.error", "Error"),
        description: t("settings.public_profile.copy_failed", "Failed to copy link"),
        variant: "destructive",
      });
    }
  };

  const handleOpen = () => {
    if (!publicUrl) return;
    window.open(publicUrl, "_blank");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t("settings.public_profile.never", "Never");
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          {t("settings.public_profile.title", "Public Profile")}
        </CardTitle>
        <CardDescription>
          {t(
            "settings.public_profile.description",
            "Share your resume with recruiters using this public link"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Public Link */}
        <div className="space-y-2">
          <Label>{t("settings.public_profile.your_link", "Your public link")}</Label>
          <div className="flex gap-2">
            <Input
              value={publicUrl || ""}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={!publicUrl}
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpen}
              disabled={!publicUrl}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Eye className="w-4 h-4" />
              {t("settings.public_profile.views", "Profile Views")}
            </div>
            <p className="text-2xl font-semibold">{viewsCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MessageCircle className="w-4 h-4" />
              {t("settings.public_profile.whatsapp_clicks", "WhatsApp Clicks")}
            </div>
            <p className="text-2xl font-semibold">{whatsappClicks}</p>
          </div>
        </div>

        {/* Last Viewed */}
        <div className="text-sm text-muted-foreground pt-2 border-t">
          {t("settings.public_profile.last_viewed", "Last viewed:")}{" "}
          <span className="font-medium">{formatDate(lastViewedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
