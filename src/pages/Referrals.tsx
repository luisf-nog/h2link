import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getBaseUrl } from "@/config/app.config";
import { Copy, Users, Gift, Link2, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ReferralLinkRow = {
  id: string;
  referred_name: string | null;
  referred_email: string | null;
  activated_at: string | null;
  created_at: string;
};

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(0, user.length - 2))}@${domain}`;
}

export default function Referrals() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<ReferralLinkRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Redirect paid users away from referrals page
  const isFreeUser = profile?.plan_tier === 'free' || !profile?.plan_tier;
  
  useEffect(() => {
    if (profile && !isFreeUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, isFreeUser, navigate]);

  const referralCode = String((profile as any)?.referral_code ?? "");
  const activeCount = Number((profile as any)?.active_referrals_count ?? 0);
  const bonus = Number((profile as any)?.referral_bonus_limit ?? 0);
  const progress = Math.min(100, Math.max(0, (activeCount / 10) * 100));

  const referralLink = useMemo(() => {
    if (!referralCode) return "";
    return `${getBaseUrl()}/auth?ref=${referralCode}`;
  }, [referralCode]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("referral_links")
          .select("id,referred_name,referred_email,activated_at,created_at")
          .eq("referrer_id", profile.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!cancelled) setLinks((data ?? []) as ReferralLinkRow[]);
      } catch {
        if (!cancelled) setLinks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("referrals.page_title")}</h1>
        <p className="text-muted-foreground">{t("referrals.page_subtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("referrals.stats.active")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}/10</div>
            <Progress value={progress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("referrals.stats.bonus")}</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">+{bonus}</div>
            <p className="text-xs text-muted-foreground">{t("referrals.stats.bonus_desc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("referrals.stats.total")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{links.length}</div>
            <p className="text-xs text-muted-foreground">{t("referrals.stats.total_desc")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Share Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("referrals.share.title")}
          </CardTitle>
          <CardDescription>{t("referrals.share.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t("referrals.your_code")}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-border bg-muted px-4 py-2.5 text-lg font-bold tracking-wider text-foreground">
                {referralCode || "—"}
              </code>
              <Button
                variant="outline"
                size="icon"
                disabled={!referralCode}
                onClick={handleCopyCode}
                aria-label={t("referrals.copy")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied && <p className="text-xs text-primary">{t("referrals.copied")}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t("referrals.share.link_label")}</label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={referralLink}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                disabled={!referralLink}
                onClick={handleCopyLink}
                aria-label={t("referrals.copy")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copiedLink && <p className="text-xs text-primary">{t("referrals.copied")}</p>}
          </div>

          <p className="text-sm text-muted-foreground">{t("referrals.explainer")}</p>
        </CardContent>
      </Card>

      {/* Referral List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("referrals.list_title")}</CardTitle>
              <CardDescription>{t("referrals.list_subtitle")}</CardDescription>
            </div>
            {loading && <span className="text-sm text-muted-foreground">{t("common.loading")}</span>}
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">{t("referrals.list_empty")}</p>
          ) : (
            <div className="space-y-2">
              {links.map((r) => {
                const name = String(r.referred_name ?? "").trim();
                const email = String(r.referred_email ?? "").trim();
                const label = name || (email ? maskEmail(email) : t("referrals.unknown"));
                const active = Boolean(r.activated_at);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <span className="truncate text-sm text-foreground">{label}</span>
                    <Badge variant={active ? "default" : "secondary"}>
                      {active ? t("referrals.status_active") : t("referrals.status_pending")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
