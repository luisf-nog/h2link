import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PLANS_CONFIG } from "@/config/plans.config";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const manualJobSchema = z.object({
  company: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  job_title: z.string().trim().min(1).max(120),
  eta_number: z.string().trim().max(64).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
});

type ManualJobForm = z.infer<typeof manualJobSchema>;

export function AddManualJobDialog({
  onAdded,
}: {
  onAdded: () => void | Promise<void>;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaults = useMemo<ManualJobForm>(
    () => ({ company: "", email: "", job_title: "", eta_number: "", phone: "" }),
    [],
  );

  const form = useForm<ManualJobForm>({
    resolver: zodResolver(manualJobSchema),
    defaultValues: defaults,
    mode: "onSubmit",
  });

  const submit = form.handleSubmit(async (values) => {
    if (!profile?.id) {
      toast({ title: t("common.errors.no_session"), variant: "destructive" });
      return;
    }

    const planTier = profile.plan_tier || "free";
    const requiresDnsCheck = PLANS_CONFIG[planTier].features.dns_bounce_check;
    if (requiresDnsCheck) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          toast({ title: t("common.errors.no_session"), variant: "destructive" });
          return;
        }

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-dns-mx`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: values.email }),
        });

        const payload = await res.json().catch(() => null);
        if (!payload?.ok) {
          toast({
            title: t("queue.toasts.mx_invalid_title"),
            description: t("queue.toasts.mx_invalid_desc", { domain: String(payload?.domain ?? "") }),
            variant: "destructive",
          });
          return;
        }
      } catch (_e) {
        toast({
          title: t("queue.toasts.mx_invalid_title"),
          description: t("queue.toasts.mx_invalid_desc", { domain: "" }),
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const { data: manual, error: manualErr } = await supabase
        .from("manual_jobs")
        .insert({
          user_id: profile.id,
          company: values.company,
          job_title: values.job_title,
          email: values.email,
          eta_number: values.eta_number || null,
          phone: values.phone || null,
        } as any)
        .select("id")
        .single();

      if (manualErr) throw manualErr;

      const { error: queueErr } = await supabase
        .from("my_queue")
        .insert({
          user_id: profile.id,
          manual_job_id: manual.id,
          job_id: null,
          status: "pending",
        } as any);

      if (queueErr) throw queueErr;

      toast({
        title: t("queue.manual_dialog.toasts.add_success_title"),
        description: t("queue.manual_dialog.toasts.add_success_desc"),
      });

      setOpen(false);
      form.reset(defaults);
      await onAdded();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("common.errors.save_failed");
      toast({
        title: t("queue.manual_dialog.toasts.add_error_title"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("queue.actions.add_manual")}
      </Button>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("queue.manual_dialog.title")}</DialogTitle>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual_company">{t("queue.manual_dialog.fields.company")}</Label>
              <Input
                id="manual_company"
                placeholder={t("queue.manual_dialog.placeholders.company")}
                {...form.register("company")}
              />
              {form.formState.errors.company?.message ? (
                <p className="text-sm text-destructive">{form.formState.errors.company.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_email">{t("queue.manual_dialog.fields.email")}</Label>
              <Input
                id="manual_email"
                placeholder={t("queue.manual_dialog.placeholders.email")}
                inputMode="email"
                autoComplete="email"
                {...form.register("email")}
              />
              {form.formState.errors.email?.message ? (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual_job_title">{t("queue.manual_dialog.fields.job_title")}</Label>
              <Input
                id="manual_job_title"
                placeholder={t("queue.manual_dialog.placeholders.job_title")}
                {...form.register("job_title")}
              />
              {form.formState.errors.job_title?.message ? (
                <p className="text-sm text-destructive">{form.formState.errors.job_title.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_eta">{t("queue.manual_dialog.fields.eta_number")}</Label>
              <Input
                id="manual_eta"
                placeholder={t("queue.manual_dialog.placeholders.eta_number")}
                {...form.register("eta_number")}
              />
              {form.formState.errors.eta_number?.message ? (
                <p className="text-sm text-destructive">{form.formState.errors.eta_number.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual_phone">{t("queue.manual_dialog.fields.phone")}</Label>
            <Input
              id="manual_phone"
              placeholder={t("queue.manual_dialog.placeholders.phone")}
              inputMode="tel"
              autoComplete="tel"
              {...form.register("phone")}
            />
            {form.formState.errors.phone?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("queue.manual_dialog.actions.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
