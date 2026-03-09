import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

const STALE_MS = 30_000;

interface RadarStore {
  radarProfile: any | null;
  matchedJobs: any[];
  groupedCategories: Record<string, { items: any[]; totalJobs: number }>;
  matchCount: number;
  queuedFromRadar: number;
  lastFetchedAt: number;

  setRadarProfile: (profile: any) => void;
  setMatchedJobs: (updater: any[] | ((prev: any[]) => any[])) => void;
  setMatchCount: (updater: number | ((prev: number) => number)) => void;
  setQueuedFromRadar: (updater: number | ((prev: number) => number)) => void;
  setGroupedCategories: (cats: Record<string, { items: any[]; totalJobs: number }>) => void;

  /** Full init: loads profile + stats + matches. Stale-checked. */
  initRadar: (userId: string, t: any) => Promise<void>;
  /** Force-refresh matches only */
  fetchMatches: (userId: string) => Promise<void>;
  /** Force-refresh stats */
  updateStats: (
    userId: string,
    params: { visaType: string; stateFilter: string; minWage: string; maxExperience: string; groupFilter: string },
    t: any,
  ) => Promise<void>;
}

function resolveSectorKey(raw: string, keywords: Record<string, string[]>): string {
  for (const [key, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => raw.toLowerCase().includes(kw.toLowerCase()))) return key;
  }
  return "other";
}

const SECTOR_KEYWORDS: Record<string, string[]> = {
  agriculture: ["Farmworkers", "Crop", "Nursery", "Harvest", "Agricultural", "Forest", "Farm"],
  farm_equipment: ["Agricultural Equipment", "Tractor"],
  construction: ["Construction", "Laborers", "Cement", "Masons", "Concrete", "Fence", "Brickmasons", "Iron", "Paving"],
  carpentry: ["Carpenters", "Cabinetmakers", "Bench Carpenters", "Roofers"],
  installation: ["Electricians", "Plumbers", "Installation", "Pipelayers", "Septic", "Repair Workers"],
  mechanics: ["Mechanics", "Service Technicians", "Automotive", "Diesel"],
  cleaning: ["Maids", "Housekeeping", "Janitors", "Cleaners"],
  kitchen: ["Cooks", "Bakers", "Food Preparation", "Kitchen"],
  dining: ["Waiters", "Waitresses", "Dining Room", "Hostess", "Dishwashers"],
  hospitality: ["Hotel", "Resort", "Desk Clerks", "Concierges", "Baggage"],
  bar: ["Baristas", "Bartenders"],
  logistics: ["Laborers and Freight", "Stockers", "Packers", "Material Movers", "Order Fillers"],
  transport: ["Truck Drivers", "Shuttle", "Chauffeurs", "Delivery"],
  manufacturing: ["Assemblers", "Fabricators", "Production Workers", "Machine Feeders"],
  welding: ["Welders", "Cutters", "Solderers", "Brazers"],
  wood: ["Woodworking", "Sawing Machine"],
  textile: ["Textile", "Laundry", "Sewing"],
  meat: ["Meat, Poultry", "Butchers", "Slaughterers"],
  landscaping: ["Landscaping", "Groundskeeping", "Tree Trimmers"],
  sales: ["Salespersons", "Counter", "Cashiers", "Retail"],
};

export const useRadarStore = create<RadarStore>((set, get) => ({
  radarProfile: null,
  matchedJobs: [],
  groupedCategories: {},
  matchCount: 0,
  queuedFromRadar: 0,
  lastFetchedAt: 0,

  setRadarProfile: (profile) => set({ radarProfile: profile }),
  setMatchedJobs: (updater) =>
    set((s) => ({ matchedJobs: typeof updater === "function" ? updater(s.matchedJobs) : updater })),
  setMatchCount: (updater) =>
    set((s) => ({ matchCount: typeof updater === "function" ? updater(s.matchCount) : updater })),
  setQueuedFromRadar: (updater) =>
    set((s) => ({ queuedFromRadar: typeof updater === "function" ? updater(s.queuedFromRadar) : updater })),
  setGroupedCategories: (cats) => set({ groupedCategories: cats }),

  initRadar: async (userId, t) => {
    const { lastFetchedAt } = get();
    if (Date.now() - lastFetchedAt < STALE_MS) return;

    try {
      const { data } = await supabase.from("radar_profiles" as any).select("*").eq("user_id", userId).single();

      if (data) {
        const d = data as any;
        set({ radarProfile: d });

        await get().updateStats(
          userId,
          {
            visaType: d.visa_type || "all",
            stateFilter: d.state || "all",
            minWage: d.min_wage?.toString() || "",
            maxExperience: d.max_experience?.toString() || "",
            groupFilter: d.randomization_group || "all",
          },
          t,
        );

        if (d.is_active) await get().fetchMatches(userId);
      }
    } catch (e) {
      console.error("[RadarStore] initRadar error:", e);
    } finally {
      set({ lastFetchedAt: Date.now() });
    }
  },

  fetchMatches: async (userId) => {
    const { data, error } = await supabase
      .from("radar_matched_jobs" as any)
      .select(`id, job_id, auto_queued, public_jobs!fk_radar_job (*)`)
      .eq("user_id", userId);

    if (error || !data) return;

    const validMatches = (data as any[]).filter((m: any) => {
      const job = m.public_jobs;
      return job && job.is_active !== false && job.is_banned !== true;
    });

    const jobIds = validMatches.map((m: any) => m.job_id);
    if (jobIds.length === 0) {
      set({ matchedJobs: [], matchCount: 0, queuedFromRadar: 0 });
      return;
    }

    const CHUNK_SIZE = 150;
    const allQueuedJobs: any[] = [];
    for (let i = 0; i < jobIds.length; i += CHUNK_SIZE) {
      const chunk = jobIds.slice(i, i + CHUNK_SIZE);
      const { data: queuedChunk } = await supabase
        .from("my_queue")
        .select("job_id")
        .eq("user_id", userId)
        .in("job_id", chunk);
      if (queuedChunk) allQueuedJobs.push(...queuedChunk);
    }

    const queuedSet = new Set(allQueuedJobs.map((q: any) => q.job_id));
    const finalMatches = validMatches.filter((m: any) => !queuedSet.has(m.job_id));
    const queuedCount = validMatches.filter((m: any) => queuedSet.has(m.job_id)).length;

    set({ matchedJobs: finalMatches, matchCount: finalMatches.length, queuedFromRadar: queuedCount });
  },

  updateStats: async (userId, params, t) => {
    try {
      const { data } = await supabase.rpc("get_radar_stats" as any, {
        p_user_id: userId,
        p_visa_type: params.visaType,
        p_state: params.stateFilter,
        p_min_wage: params.minWage !== "" ? Number(params.minWage) : 0,
        p_max_exp: params.maxExperience !== "" ? Number(params.maxExperience) : 999,
        p_group: params.groupFilter,
      });

      if (data) {
        const grouped = (data as any[]).reduce((acc: any, curr: any) => {
          const raw = curr.raw_category || "";
          const sectorKey = resolveSectorKey(raw, SECTOR_KEYWORDS);
          const sectorName = t(`radar.sectors.${sectorKey}`, sectorKey);
          if (!acc[sectorName]) acc[sectorName] = { items: [], totalJobs: 0 };
          acc[sectorName].items.push(curr);
          acc[sectorName].totalJobs += curr.count || 0;
          return acc;
        }, {});
        set({ groupedCategories: grouped });
      }
    } catch (e) {
      console.error("[RadarStore] updateStats error:", e);
    }
  },
}));
