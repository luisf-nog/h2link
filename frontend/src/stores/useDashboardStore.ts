import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

const STALE_MS = 30_000;

interface DashboardStore {
  // Market data
  visaCounts: { h2a: number; h2b: number; early: number };
  hotCount: number;
  topCategories: Array<{ name: string; count: number; percent: number }>;
  topStates: Array<{ name: string; count: number; percent: number }>;
  topPayingStates: Array<{ name: string; avgSalary: number }>;
  marketDataLastFetchedAt: number;

  // Personal stats
  queueCount: number;
  sentThisMonth: number;
  personalLastFetchedAt: number;

  // Engagement
  totalEmailsSent: number;
  totalOpened: number;
  totalCvViewed: number;
  totalSentItems: number;
  engagementLastFetchedAt: number;

  fetchMarketData: (force?: boolean) => Promise<void>;
  fetchPersonalStats: (userId: string, force?: boolean) => Promise<void>;
  fetchEngagement: (userId: string, emailsSentTotal: number, force?: boolean) => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  visaCounts: { h2a: 0, h2b: 0, early: 0 },
  hotCount: 0,
  topCategories: [],
  topStates: [],
  topPayingStates: [],
  marketDataLastFetchedAt: 0,

  queueCount: 0,
  sentThisMonth: 0,
  personalLastFetchedAt: 0,

  totalEmailsSent: 0,
  totalOpened: 0,
  totalCvViewed: 0,
  totalSentItems: 0,
  engagementLastFetchedAt: 0,

  fetchMarketData: async (force = false) => {
    if (!force && Date.now() - get().marketDataLastFetchedAt < STALE_MS) return;

    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let page = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("public_jobs")
          .select("visa_type, category, state, salary, posted_date, job_id")
          .eq("is_active", true)
          .range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allRows = [...allRows, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      const counts = { h2a: 0, h2b: 0, early: 0 };
      const cats = new Map<string, number>();
      const states = new Map<string, number>();
      const salaries = new Map<string, { sum: number; count: number }>();
      let hot = 0;

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      allRows.forEach((job) => {
        const visa = (job.visa_type || "").trim();
        const jobId = (job.job_id || "").toUpperCase();
        if (jobId.startsWith("JO-") || visa.includes("Early Access")) {
          counts.early++;
        } else if (visa === "H-2B") {
          counts.h2b++;
        } else {
          counts.h2a++;
        }
        const c = job.category?.trim();
        if (c) cats.set(c, (cats.get(c) || 0) + 1);
        const s = job.state?.trim();
        if (s) states.set(s, (states.get(s) || 0) + 1);
        if (job.salary && typeof job.salary === "number" && job.salary > 7 && job.salary < 150) {
          const acc = salaries.get(s || "Unknown") || { sum: 0, count: 0 };
          salaries.set(s || "Unknown", { sum: acc.sum + job.salary, count: acc.count + 1 });
        }
        if (job.posted_date && (job.posted_date === todayStr || job.posted_date === yesterdayStr)) {
          hot++;
        }
      });

      const totalCats = Array.from(cats.values()).reduce((a, b) => a + b, 0);
      const topCategories = Array.from(cats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({ name, count, percent: totalCats > 0 ? (count / totalCats) * 100 : 0 }));

      const totalStates = Array.from(states.values()).reduce((a, b) => a + b, 0);
      const topStates = Array.from(states.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({ name, count, percent: totalStates > 0 ? (count / totalStates) * 100 : 0 }));

      const topPayingStates = Array.from(salaries.entries())
        .map(([name, val]) => ({ name, avgSalary: val.sum / val.count, count: val.count }))
        .filter((x) => x.count >= 5)
        .sort((a, b) => b.avgSalary - a.avgSalary)
        .slice(0, 5);

      set({
        visaCounts: counts,
        hotCount: hot,
        topCategories,
        topStates,
        topPayingStates,
        marketDataLastFetchedAt: Date.now(),
      });
    } catch (error) {
      console.error("Market data error:", error);
    }
  },

  fetchPersonalStats: async (userId, force = false) => {
    if (!force && Date.now() - get().personalLastFetchedAt < STALE_MS) return;

    const { count: pendingCount } = await supabase
      .from("my_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { count: monthCount } = await supabase
      .from("queue_send_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "sent")
      .gte("sent_at", startOfMonth.toISOString());

    set({ queueCount: pendingCount ?? 0, sentThisMonth: monthCount ?? 0, personalLastFetchedAt: Date.now() });
  },

  fetchEngagement: async (userId, emailsSentTotal, force = false) => {
    if (!force && Date.now() - get().engagementLastFetchedAt < STALE_MS) return;

    try {
      let sentCount = 0;
      let openedCount = 0;
      let cvViewedCount = 0;
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data } = await supabase
          .from("my_queue")
          .select("id, opened_at, profile_viewed_at")
          .eq("user_id", userId)
          .eq("status", "sent")
          .range(from, from + batchSize - 1);
        if (data && data.length > 0) {
          sentCount += data.length;
          openedCount += data.filter((r) => r.opened_at != null).length;
          cvViewedCount += data.filter((r) => r.profile_viewed_at != null).length;
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      set({
        totalEmailsSent: emailsSentTotal,
        totalSentItems: sentCount,
        totalOpened: openedCount,
        totalCvViewed: cvViewedCount,
        engagementLastFetchedAt: Date.now(),
      });
    } catch (e) {
      console.error("Engagement fetch error:", e);
    }
  },
}));
