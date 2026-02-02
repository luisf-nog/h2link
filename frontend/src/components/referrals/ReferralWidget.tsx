import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";

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

export function ReferralWidget() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<ReferralLinkRow[]>([]);
  const [copied, setCopied] = useState(false);

  const referralCode = String((profile as any)?.referral_code ?? "");
  const referralLink = referralCode ? `https://h2linker.com/?ref=${referralCode}` : "";
  const activeCount = Number((profile as any)?.active_referrals_count ?? 0);
  const bonus = Number((profile as any)?.referral_bonus_limit ?? 0);
  const progress = Math.min(100, Math.max(0, (activeCount / 10) * 100));

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

  const items = useMemo(() => links.slice(0, 10), [links]);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>{t("referrals.title")}</CardTitle>
        <CardDescription>{t("referrals.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("referrals.active_label")}</p>
              <p className="text-sm font-semibold text-foreground">{activeCount}/10</p>
            </div>
            <Progress value={progress} className="mt-2 h-2" />
            <p className="mt-3 text-sm text-muted-foreground">{t("referrals.explainer")}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("referrals.bonus_label")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">+{bonus}</p>
            <p className="mt-3 text-sm text-muted-foreground">{t("referrals.your_link")}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground">
                {referralLink || "—"}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!referralLink}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(referralLink);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  } catch {
                    // ignore
                  }
                }}
                aria-label={t("referrals.copy")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied ? <p className="mt-2 text-xs text-muted-foreground">{t("referrals.copied")}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t("referrals.list_title")}</p>
            <p className="text-xs text-muted-foreground">{loading ? t("common.loading") : ""}</p>
          </div>

          {items.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">{t("referrals.list_empty")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {items.map((r) => {
                const name = String(r.referred_name ?? "").trim();
                const email = String(r.referred_email ?? "").trim();
                const label = name || (email ? maskEmail(email) : t("referrals.unknown"));
                const active = Boolean(r.activated_at);
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="truncate text-sm text-foreground">{label}</span>
                    <Badge variant={active ? "default" : "secondary"}>
                      {active ? t("referrals.status_active") : t("referrals.status_pending")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
