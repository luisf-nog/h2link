import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Job = Tables<"public_jobs">;

export interface FeaturedJob {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  hourly_wage: number | null;
  start_date: string | null;
  end_date: string | null;
  num_positions: number | null;
  visa_type: string | null;
  employer_legal_name: string | null;
  priority_level: string;
  is_sponsored: boolean;
  dol_case_number: string | null;
  primary_duties: string | null;
  employer_id: string;
  created_at: string;
  min_experience_months: number | null;
  overtime_rate: number | null;
  additional_compensation: string | null;
  bonuses: string | null;
  deductions: string | null;
  deductions_additional: string | null;
  benefits: string | null;
  housing_provided: boolean | null;
  transportation_provided: boolean | null;
  meals_provided: boolean | null;
  daily_meal_cost: number | null;
  training_provided: boolean | null;
  visa_fee_reimbursement: boolean | null;
  english_level: string | null;
  english_proficiency: string | null;
  drivers_license: string | null;
  prior_experience_required: boolean | null;
  req_background_check: boolean | null;
  req_extreme_weather: boolean | null;
  req_full_contract_availability: boolean | null;
  req_travel_worksite: boolean | null;
  req_lift_lbs: number | null;
  lifting_weight_lbs: number | null;
  equipment_used: string | null;
  equipment_experience: string | null;
  work_environment: string | null;
  skill_level: string | null;
  view_count: number;
  click_count: number;
  wage_rate: string | null;
}

const STALE_MS = 30_000;

interface JobsStore {
  jobs: Job[];
  featuredJobs: FeaturedJob[];
  totalCount: number;
  queuedJobIds: Set<string>;
  lastFetchedAt: number;
  lastFeaturedFetchedAt: number;

  setJobsData: (jobs: Job[], totalCount: number) => void;
  setQueuedJobIds: (ids: Set<string>) => void;

  fetchFeaturedJobs: (force?: boolean) => Promise<void>;
  syncQueue: (userId: string) => Promise<void>;
}

export const useJobsStore = create<JobsStore>((set, get) => ({
  jobs: [],
  featuredJobs: [],
  totalCount: 0,
  queuedJobIds: new Set(),
  lastFetchedAt: 0,
  lastFeaturedFetchedAt: 0,

  setJobsData: (jobs, totalCount) => set({ jobs, totalCount, lastFetchedAt: Date.now() }),

  setQueuedJobIds: (ids) => set({ queuedJobIds: ids }),

  fetchFeaturedJobs: async (force = false) => {
    if (!force && Date.now() - get().lastFeaturedFetchedAt < STALE_MS) return;
    const { data } = await supabase
      .from("sponsored_jobs")
      .select(
        "id, title, description, city, state, hourly_wage, start_date, end_date, num_positions, visa_type, employer_legal_name, priority_level, is_sponsored, dol_case_number, primary_duties, employer_id, created_at, min_experience_months, overtime_rate, additional_compensation, bonuses, deductions, deductions_additional, benefits, housing_provided, transportation_provided, meals_provided, daily_meal_cost, training_provided, visa_fee_reimbursement, english_level, english_proficiency, drivers_license, prior_experience_required, req_background_check, req_extreme_weather, req_full_contract_availability, req_travel_worksite, req_lift_lbs, lifting_weight_lbs, equipment_used, equipment_experience, work_environment, skill_level, view_count, click_count, wage_rate",
      )
      .eq("is_active", true)
      .eq("is_sponsored", true)
      .order("priority_level", { ascending: false });
    if (data) set({ featuredJobs: data as FeaturedJob[], lastFeaturedFetchedAt: Date.now() });
  },

  syncQueue: async (userId: string) => {
    const allJobIds: string[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data } = await supabase
        .from("my_queue")
        .select("job_id")
        .eq("user_id", userId)
        .not("job_id", "is", null)
        .range(from, from + batchSize - 1);
      if (data && data.length > 0) {
        allJobIds.push(...data.map((r) => r.job_id).filter((id): id is string => id !== null));
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
    set({ queuedJobIds: new Set(allJobIds) });
  },
}));
