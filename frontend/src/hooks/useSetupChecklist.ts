import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface ChecklistStep {
  key: string;
  done: boolean;
  route: string;
}

export function useSetupChecklist() {
  const { profile, smtpStatus, user } = useAuth();
  const [hasQueueItem, setHasQueueItem] = useState(false);
  const [hasSentEmail, setHasSentEmail] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      const [queueRes, sentRes] = await Promise.all([
        supabase
          .from("my_queue")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("queue_send_history")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "success"),
      ]);

      setHasQueueItem((queueRes.count ?? 0) > 0);
      setHasSentEmail((sentRes.count ?? 0) > 0);
      setLoading(false);
    };

    fetchStatus();
  }, [user?.id]);

  const steps: ChecklistStep[] = [
    {
      key: "smtp",
      done: Boolean(smtpStatus?.hasPassword),
      route: "/settings/email",
    },
    {
      key: "smtp_verified",
      done: Boolean((profile as any)?.smtp_verified),
      route: "/settings/email",
    },
    {
      key: "resume",
      done: Boolean((profile as any)?.resume_url),
      route: "/settings",
    },
    {
      key: "resume_data",
      done: Boolean((profile as any)?.resume_data),
      route: "/settings",
    },
    {
      key: "add_queue",
      done: hasQueueItem,
      route: "/jobs",
    },
    {
      key: "send_email",
      done: hasSentEmail,
      route: "/queue",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const percent = Math.round((completedCount / steps.length) * 100);

  return { steps, completedCount, allDone, percent, loading };
}
