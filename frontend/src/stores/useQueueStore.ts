import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  opened_at?: string | null;
  profile_viewed_at?: string | null;
  tracking_id?: string;
  created_at: string;
  processing_started_at?: string | null;
  send_count: number;
  email_open_count?: number | null;
  last_error?: string | null;
  public_jobs: {
    id: string;
    job_title: string;
    company: string;
    email: string;
    city: string;
    state: string;
    visa_type?: string | null;
  } | null;
  manual_jobs: {
    id: string;
    company: string;
    job_title: string;
    email: string;
    eta_number: string | null;
    phone: string | null;
  } | null;
}

const STALE_MS = 30_000;
const STUCK_PROCESSING_MINUTES = 10;

interface QueueStore {
  queue: QueueItem[];
  lastFetchedAt: number;
  smtpReady: boolean | null;

  // Sending state (global so it persists across page navigation)
  sending: boolean;
  sendProgress: { sent: number; total: number };
  sendCancelled: boolean;

  /** Fetch only if data is stale (>30s). Returns immediately if fresh. */
  fetchQueue: () => Promise<void>;
  /** Always fetches, regardless of staleness. */
  forceFetchQueue: () => Promise<void>;
  /** Update queue items (accepts value or updater function). */
  setQueue: (updater: QueueItem[] | ((prev: QueueItem[]) => QueueItem[])) => void;
  setSmtpReady: (ready: boolean | null) => void;
  checkSmtp: (userId: string) => Promise<void>;
  setSending: (v: boolean) => void;
  setSendProgress: (p: { sent: number; total: number }) => void;
  setSendCancelled: (v: boolean) => void;
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  queue: [],
  lastFetchedAt: 0,
  smtpReady: null,

  fetchQueue: async () => {
    const { lastFetchedAt } = get();
    if (Date.now() - lastFetchedAt < STALE_MS) return;
    await get().forceFetchQueue();
  },

  forceFetchQueue: async () => {
    // Auto-recover stale processing items
    const staleCutoffIso = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString();
    await supabase
      .from("my_queue")
      .update({
        status: "paused",
        last_error:
          "[PROCESSING_TIMEOUT] Item pausado automaticamente por travar no processamento (acima do tempo máximo esperado).",
        last_attempt_at: new Date().toISOString(),
        processing_started_at: null,
      })
      .eq("status", "processing")
      .or(
        `processing_started_at.lt.${staleCutoffIso},and(processing_started_at.is.null,created_at.lt.${staleCutoffIso})`,
      );

    const { data, error } = await supabase
      .from("my_queue")
      .select(
        `
        id, status, sent_at, opened_at, profile_viewed_at, tracking_id, created_at, processing_started_at, send_count, email_open_count, last_error,
        public_jobs (id, job_title, company, email, city, state, visa_type),
        manual_jobs (id, company, job_title, email, eta_number, phone)
      `,
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      set({ queue: (data as unknown as QueueItem[]) || [], lastFetchedAt: Date.now() });
    }
  },

  setQueue: (updater) => {
    set((state) => ({
      queue: typeof updater === "function" ? updater(state.queue) : updater,
    }));
  },

  setSmtpReady: (ready) => set({ smtpReady: ready }),

  checkSmtp: async (userId: string) => {
    const { data, error } = await supabase
      .from("smtp_credentials")
      .select("has_password")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error) {
      set({ smtpReady: Boolean(data?.has_password) });
    }
  },
}));
