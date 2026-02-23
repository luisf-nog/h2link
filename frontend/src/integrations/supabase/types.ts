export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_daily_usage: {
        Row: {
          job_email_generations: number
          resume_parses: number
          template_generations: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          job_email_generations?: number
          resume_parses?: number
          template_generations?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          job_email_generations?: number
          resume_parses?: number
          template_generations?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_generation_preferences: {
        Row: {
          avoid_cliches: boolean
          closing_style: string
          created_at: string
          custom_instructions: string | null
          email_length: string
          emotional_tone: string
          emphasize_availability: boolean
          emphasize_languages: boolean
          emphasize_physical_strength: boolean
          formality_level: string
          greeting_style: string
          include_ps_line: boolean
          lines_per_paragraph: number
          mention_company_naturally: boolean
          opening_style: string
          paragraph_style: string
          reference_sector: boolean
          start_with_hook: boolean
          updated_at: string
          user_id: string
          vary_bullet_points: boolean
          vary_cta_position: boolean
          vary_email_headers: boolean
          vary_job_title_usage: boolean
          vary_number_format: boolean
          vary_paragraph_count: boolean
          vary_paragraph_length: boolean
          vary_paragraph_order: boolean
          vary_synonyms: boolean
        }
        Insert: {
          avoid_cliches?: boolean
          closing_style?: string
          created_at?: string
          custom_instructions?: string | null
          email_length?: string
          emotional_tone?: string
          emphasize_availability?: boolean
          emphasize_languages?: boolean
          emphasize_physical_strength?: boolean
          formality_level?: string
          greeting_style?: string
          include_ps_line?: boolean
          lines_per_paragraph?: number
          mention_company_naturally?: boolean
          opening_style?: string
          paragraph_style?: string
          reference_sector?: boolean
          start_with_hook?: boolean
          updated_at?: string
          user_id: string
          vary_bullet_points?: boolean
          vary_cta_position?: boolean
          vary_email_headers?: boolean
          vary_job_title_usage?: boolean
          vary_number_format?: boolean
          vary_paragraph_count?: boolean
          vary_paragraph_length?: boolean
          vary_paragraph_order?: boolean
          vary_synonyms?: boolean
        }
        Update: {
          avoid_cliches?: boolean
          closing_style?: string
          created_at?: string
          custom_instructions?: string | null
          email_length?: string
          emotional_tone?: string
          emphasize_availability?: boolean
          emphasize_languages?: boolean
          emphasize_physical_strength?: boolean
          formality_level?: string
          greeting_style?: string
          include_ps_line?: boolean
          lines_per_paragraph?: number
          mention_company_naturally?: boolean
          opening_style?: string
          paragraph_style?: string
          reference_sector?: boolean
          start_with_hook?: boolean
          updated_at?: string
          user_id?: string
          vary_bullet_points?: boolean
          vary_cta_position?: boolean
          vary_email_headers?: boolean
          vary_job_title_usage?: boolean
          vary_number_format?: boolean
          vary_paragraph_count?: boolean
          vary_paragraph_length?: boolean
          vary_paragraph_order?: boolean
          vary_synonyms?: boolean
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          cron_token: string
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron_token?: string
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron_token?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          processed_rows: number
          source: string
          status: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          processed_rows?: number
          source: string
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          processed_rows?: number
          source?: string
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: []
      }
      ip_blacklist: {
        Row: {
          blocked_until: string
          created_at: string | null
          hit_count: number | null
          id: string
          ip: string
          reason: string | null
        }
        Insert: {
          blocked_until: string
          created_at?: string | null
          hit_count?: number | null
          id?: string
          ip: string
          reason?: string | null
        }
        Update: {
          blocked_until?: string
          created_at?: string | null
          hit_count?: number | null
          id?: string
          ip?: string
          reason?: string | null
        }
        Relationships: []
      }
      job_reports: {
        Row: {
          created_at: string
          id: string
          job_id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_history: {
        Row: {
          archived_at: string | null
          category: string | null
          city: string
          company: string
          created_at: string
          crop_activities: string | null
          description: string | null
          education_required: string | null
          email: string
          email_invalid_dns: boolean
          end_date: string | null
          experience_months: number | null
          fingerprint: string | null
          housing_addr: string | null
          housing_capacity: number | null
          housing_city: string | null
          housing_info: string | null
          housing_state: string | null
          housing_type: string | null
          housing_zip: string | null
          id: string
          is_active: boolean | null
          is_banned: boolean
          is_meal_provision: boolean | null
          job_duties: string | null
          job_id: string
          job_is_background: boolean | null
          job_is_driver: boolean | null
          job_is_drug_screen: boolean | null
          job_is_lifting: boolean | null
          job_lifting_weight: string | null
          job_min_special_req: string | null
          job_title: string
          meal_charge: number | null
          openings: number | null
          overtime_available: boolean | null
          overtime_from: number | null
          overtime_salary: number | null
          overtime_to: number | null
          pay_frequency: string | null
          phone: string | null
          posted_date: string | null
          randomization_group: string | null
          rec_pay_deductions: string | null
          requirements: string | null
          salary: number | null
          shift_end: string | null
          shift_start: string | null
          source_url: string | null
          start_date: string | null
          state: string
          tools_provided: boolean | null
          training_months: number | null
          transport_desc: string | null
          transport_max_reimburse: number | null
          transport_min_reimburse: number | null
          transport_provided: boolean | null
          visa_type: string | null
          wage_additional: string | null
          wage_from: number | null
          wage_to: number | null
          wage_unit: string | null
          was_early_access: boolean | null
          website: string | null
          weekly_hours: number | null
          worksite_address: string | null
          worksite_zip: string | null
          zip: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          city: string
          company: string
          created_at?: string
          crop_activities?: string | null
          description?: string | null
          education_required?: string | null
          email: string
          email_invalid_dns?: boolean
          end_date?: string | null
          experience_months?: number | null
          fingerprint?: string | null
          housing_addr?: string | null
          housing_capacity?: number | null
          housing_city?: string | null
          housing_info?: string | null
          housing_state?: string | null
          housing_type?: string | null
          housing_zip?: string | null
          id?: string
          is_active?: boolean | null
          is_banned?: boolean
          is_meal_provision?: boolean | null
          job_duties?: string | null
          job_id: string
          job_is_background?: boolean | null
          job_is_driver?: boolean | null
          job_is_drug_screen?: boolean | null
          job_is_lifting?: boolean | null
          job_lifting_weight?: string | null
          job_min_special_req?: string | null
          job_title: string
          meal_charge?: number | null
          openings?: number | null
          overtime_available?: boolean | null
          overtime_from?: number | null
          overtime_salary?: number | null
          overtime_to?: number | null
          pay_frequency?: string | null
          phone?: string | null
          posted_date?: string | null
          randomization_group?: string | null
          rec_pay_deductions?: string | null
          requirements?: string | null
          salary?: number | null
          shift_end?: string | null
          shift_start?: string | null
          source_url?: string | null
          start_date?: string | null
          state: string
          tools_provided?: boolean | null
          training_months?: number | null
          transport_desc?: string | null
          transport_max_reimburse?: number | null
          transport_min_reimburse?: number | null
          transport_provided?: boolean | null
          visa_type?: string | null
          wage_additional?: string | null
          wage_from?: number | null
          wage_to?: number | null
          wage_unit?: string | null
          was_early_access?: boolean | null
          website?: string | null
          weekly_hours?: number | null
          worksite_address?: string | null
          worksite_zip?: string | null
          zip?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          city?: string
          company?: string
          created_at?: string
          crop_activities?: string | null
          description?: string | null
          education_required?: string | null
          email?: string
          email_invalid_dns?: boolean
          end_date?: string | null
          experience_months?: number | null
          fingerprint?: string | null
          housing_addr?: string | null
          housing_capacity?: number | null
          housing_city?: string | null
          housing_info?: string | null
          housing_state?: string | null
          housing_type?: string | null
          housing_zip?: string | null
          id?: string
          is_active?: boolean | null
          is_banned?: boolean
          is_meal_provision?: boolean | null
          job_duties?: string | null
          job_id?: string
          job_is_background?: boolean | null
          job_is_driver?: boolean | null
          job_is_drug_screen?: boolean | null
          job_is_lifting?: boolean | null
          job_lifting_weight?: string | null
          job_min_special_req?: string | null
          job_title?: string
          meal_charge?: number | null
          openings?: number | null
          overtime_available?: boolean | null
          overtime_from?: number | null
          overtime_salary?: number | null
          overtime_to?: number | null
          pay_frequency?: string | null
          phone?: string | null
          posted_date?: string | null
          randomization_group?: string | null
          rec_pay_deductions?: string | null
          requirements?: string | null
          salary?: number | null
          shift_end?: string | null
          shift_start?: string | null
          source_url?: string | null
          start_date?: string | null
          state?: string
          tools_provided?: boolean | null
          training_months?: number | null
          transport_desc?: string | null
          transport_max_reimburse?: number | null
          transport_min_reimburse?: number | null
          transport_provided?: boolean | null
          visa_type?: string | null
          wage_additional?: string | null
          wage_from?: number | null
          wage_to?: number | null
          wage_unit?: string | null
          was_early_access?: boolean | null
          website?: string | null
          weekly_hours?: number | null
          worksite_address?: string | null
          worksite_zip?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      manual_jobs: {
        Row: {
          company: string
          created_at: string
          email: string
          eta_number: string | null
          id: string
          job_title: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          email: string
          eta_number?: string | null
          id?: string
          job_title: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          email?: string
          eta_number?: string | null
          id?: string
          job_title?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      my_queue: {
        Row: {
          created_at: string
          email_open_count: number
          id: string
          job_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          manual_job_id: string | null
          opened_at: string | null
          processing_started_at: string | null
          profile_viewed_at: string | null
          scheduled_for: string
          send_count: number
          sent_at: string | null
          status: string
          tracking_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_open_count?: number
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          manual_job_id?: string | null
          opened_at?: string | null
          processing_started_at?: string | null
          profile_viewed_at?: string | null
          scheduled_for?: string
          send_count?: number
          sent_at?: string | null
          status?: string
          tracking_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_open_count?: number
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          manual_job_id?: string | null
          opened_at?: string | null
          processing_started_at?: string | null
          profile_viewed_at?: string | null
          scheduled_for?: string
          send_count?: number
          sent_at?: string | null
          status?: string
          tracking_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "my_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "my_queue_manual_job_id_fkey"
            columns: ["manual_job_id"]
            isOneToOne: false
            referencedRelation: "manual_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_open_events: {
        Row: {
          created_at: string | null
          id: string
          ip: string | null
          is_genuine: boolean | null
          queue_id: string | null
          reasons: string[] | null
          suspicion: number | null
          tracking_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip?: string | null
          is_genuine?: boolean | null
          queue_id?: string | null
          reasons?: string[] | null
          suspicion?: number | null
          tracking_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip?: string | null
          is_genuine?: boolean | null
          queue_id?: string | null
          reasons?: string[] | null
          suspicion?: number | null
          tracking_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          browser_info: string | null
          duration_seconds: number | null
          id: string
          opened_at: string | null
          profile_id: string | null
          queue_id: string | null
        }
        Insert: {
          browser_info?: string | null
          duration_seconds?: number | null
          id?: string
          opened_at?: string | null
          profile_id?: string | null
          queue_id?: string | null
        }
        Update: {
          browser_info?: string | null
          duration_seconds?: number | null
          id?: string
          opened_at?: string | null
          profile_id?: string | null
          queue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_referrals_count: number
          age: number | null
          consecutive_errors: number
          contact_email: string | null
          created_at: string
          credits_reset_date: string
          credits_used_today: number
          email: string
          emails_sent_total: number
          full_name: string | null
          id: string
          is_referral_activated: boolean
          last_viewed_at: string | null
          phone_e164: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          preferred_language: string
          public_token: string | null
          referral_bonus_limit: number
          referral_code: string | null
          referred_by: string | null
          resume_data: Json | null
          resume_url: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          timezone: string
          updated_at: string
          views_count: number
          whatsapp_clicks: number
        }
        Insert: {
          active_referrals_count?: number
          age?: number | null
          consecutive_errors?: number
          contact_email?: string | null
          created_at?: string
          credits_reset_date?: string
          credits_used_today?: number
          email: string
          emails_sent_total?: number
          full_name?: string | null
          id: string
          is_referral_activated?: boolean
          last_viewed_at?: string | null
          phone_e164?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          preferred_language?: string
          public_token?: string | null
          referral_bonus_limit?: number
          referral_code?: string | null
          referred_by?: string | null
          resume_data?: Json | null
          resume_url?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          updated_at?: string
          views_count?: number
          whatsapp_clicks?: number
        }
        Update: {
          active_referrals_count?: number
          age?: number | null
          consecutive_errors?: number
          contact_email?: string | null
          created_at?: string
          credits_reset_date?: string
          credits_used_today?: number
          email?: string
          emails_sent_total?: number
          full_name?: string | null
          id?: string
          is_referral_activated?: boolean
          last_viewed_at?: string | null
          phone_e164?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          preferred_language?: string
          public_token?: string | null
          referral_bonus_limit?: number
          referral_code?: string | null
          referred_by?: string | null
          resume_data?: Json | null
          resume_url?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          updated_at?: string
          views_count?: number
          whatsapp_clicks?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_jobs: {
        Row: {
          category: string | null
          city: string
          company: string
          created_at: string
          crop_activities: string | null
          description: string | null
          education_required: string | null
          email: string
          email_invalid_dns: boolean
          end_date: string | null
          experience_months: number | null
          fingerprint: string | null
          housing_addr: string | null
          housing_capacity: number | null
          housing_city: string | null
          housing_info: string | null
          housing_state: string | null
          housing_type: string | null
          housing_zip: string | null
          id: string
          is_active: boolean | null
          is_banned: boolean
          is_meal_provision: boolean | null
          job_duties: string | null
          job_id: string
          job_is_background: boolean | null
          job_is_driver: boolean | null
          job_is_drug_screen: boolean | null
          job_is_lifting: boolean | null
          job_lifting_weight: string | null
          job_min_special_req: string | null
          job_title: string
          meal_charge: number | null
          openings: number | null
          overtime_available: boolean | null
          overtime_from: number | null
          overtime_salary: number | null
          overtime_to: number | null
          pay_frequency: string | null
          phone: string | null
          posted_date: string | null
          randomization_group: string | null
          rec_pay_deductions: string | null
          requirements: string | null
          salary: number | null
          shift_end: string | null
          shift_start: string | null
          source_url: string | null
          start_date: string | null
          state: string
          tools_provided: boolean | null
          training_months: number | null
          transport_desc: string | null
          transport_max_reimburse: number | null
          transport_min_reimburse: number | null
          transport_provided: boolean | null
          visa_type: string | null
          wage_additional: string | null
          wage_from: number | null
          wage_to: number | null
          wage_unit: string | null
          was_early_access: boolean | null
          website: string | null
          weekly_hours: number | null
          worksite_address: string | null
          worksite_zip: string | null
          zip: string | null
          zip_code: string | null
        }
        Insert: {
          category?: string | null
          city: string
          company: string
          created_at?: string
          crop_activities?: string | null
          description?: string | null
          education_required?: string | null
          email: string
          email_invalid_dns?: boolean
          end_date?: string | null
          experience_months?: number | null
          fingerprint?: string | null
          housing_addr?: string | null
          housing_capacity?: number | null
          housing_city?: string | null
          housing_info?: string | null
          housing_state?: string | null
          housing_type?: string | null
          housing_zip?: string | null
          id?: string
          is_active?: boolean | null
          is_banned?: boolean
          is_meal_provision?: boolean | null
          job_duties?: string | null
          job_id: string
          job_is_background?: boolean | null
          job_is_driver?: boolean | null
          job_is_drug_screen?: boolean | null
          job_is_lifting?: boolean | null
          job_lifting_weight?: string | null
          job_min_special_req?: string | null
          job_title: string
          meal_charge?: number | null
          openings?: number | null
          overtime_available?: boolean | null
          overtime_from?: number | null
          overtime_salary?: number | null
          overtime_to?: number | null
          pay_frequency?: string | null
          phone?: string | null
          posted_date?: string | null
          randomization_group?: string | null
          rec_pay_deductions?: string | null
          requirements?: string | null
          salary?: number | null
          shift_end?: string | null
          shift_start?: string | null
          source_url?: string | null
          start_date?: string | null
          state: string
          tools_provided?: boolean | null
          training_months?: number | null
          transport_desc?: string | null
          transport_max_reimburse?: number | null
          transport_min_reimburse?: number | null
          transport_provided?: boolean | null
          visa_type?: string | null
          wage_additional?: string | null
          wage_from?: number | null
          wage_to?: number | null
          wage_unit?: string | null
          was_early_access?: boolean | null
          website?: string | null
          weekly_hours?: number | null
          worksite_address?: string | null
          worksite_zip?: string | null
          zip?: string | null
          zip_code?: string | null
        }
        Update: {
          category?: string | null
          city?: string
          company?: string
          created_at?: string
          crop_activities?: string | null
          description?: string | null
          education_required?: string | null
          email?: string
          email_invalid_dns?: boolean
          end_date?: string | null
          experience_months?: number | null
          fingerprint?: string | null
          housing_addr?: string | null
          housing_capacity?: number | null
          housing_city?: string | null
          housing_info?: string | null
          housing_state?: string | null
          housing_type?: string | null
          housing_zip?: string | null
          id?: string
          is_active?: boolean | null
          is_banned?: boolean
          is_meal_provision?: boolean | null
          job_duties?: string | null
          job_id?: string
          job_is_background?: boolean | null
          job_is_driver?: boolean | null
          job_is_drug_screen?: boolean | null
          job_is_lifting?: boolean | null
          job_lifting_weight?: string | null
          job_min_special_req?: string | null
          job_title?: string
          meal_charge?: number | null
          openings?: number | null
          overtime_available?: boolean | null
          overtime_from?: number | null
          overtime_salary?: number | null
          overtime_to?: number | null
          pay_frequency?: string | null
          phone?: string | null
          posted_date?: string | null
          randomization_group?: string | null
          rec_pay_deductions?: string | null
          requirements?: string | null
          salary?: number | null
          shift_end?: string | null
          shift_start?: string | null
          source_url?: string | null
          start_date?: string | null
          state?: string
          tools_provided?: boolean | null
          training_months?: number | null
          transport_desc?: string | null
          transport_max_reimburse?: number | null
          transport_min_reimburse?: number | null
          transport_provided?: boolean | null
          visa_type?: string | null
          wage_additional?: string | null
          wage_from?: number | null
          wage_to?: number | null
          wage_unit?: string | null
          was_early_access?: boolean | null
          website?: string | null
          weekly_hours?: number | null
          worksite_address?: string | null
          worksite_zip?: string | null
          zip?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      queue_send_history: {
        Row: {
          created_at: string
          error_message: string | null
          first_opened_at: string | null
          id: string
          open_count: number
          opened_at: string | null
          queue_id: string
          sent_at: string
          status: string
          tracking_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          first_opened_at?: string | null
          id?: string
          open_count?: number
          opened_at?: string | null
          queue_id: string
          sent_at?: string
          status?: string
          tracking_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          first_opened_at?: string | null
          id?: string
          open_count?: number
          opened_at?: string | null
          queue_id?: string
          sent_at?: string
          status?: string
          tracking_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_send_history_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "my_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_send_history_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queue_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_matched_jobs: {
        Row: {
          auto_queued: boolean
          created_at: string | null
          id: string
          job_id: string
          matched_at: string
          user_id: string
        }
        Insert: {
          auto_queued?: boolean
          created_at?: string | null
          id?: string
          job_id: string
          matched_at?: string
          user_id: string
        }
        Update: {
          auto_queued?: boolean
          created_at?: string | null
          id?: string
          job_id?: string
          matched_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_radar_job"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_matched_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_profiles: {
        Row: {
          auto_send: boolean
          categories: string[] | null
          created_at: string
          id: string
          is_active: boolean
          last_scan_at: string | null
          max_experience: number | null
          min_wage: number | null
          randomization_group: string | null
          state: string | null
          updated_at: string
          user_id: string
          visa_type: string | null
        }
        Insert: {
          auto_send?: boolean
          categories?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_scan_at?: string | null
          max_experience?: number | null
          min_wage?: number | null
          randomization_group?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          visa_type?: string | null
        }
        Update: {
          auto_send?: boolean
          categories?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_scan_at?: string | null
          max_experience?: number | null
          min_wage?: number | null
          randomization_group?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          visa_type?: string | null
        }
        Relationships: []
      }
      referral_links: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          referred_email: string | null
          referred_id: string
          referred_name: string | null
          referrer_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_id: string
          referred_name?: string | null
          referrer_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_id?: string
          referred_name?: string | null
          referrer_id?: string
        }
        Relationships: []
      }
      smtp_credentials: {
        Row: {
          created_at: string
          current_daily_limit: number | null
          email: string
          emails_sent_today: number
          has_password: boolean
          id: string
          last_usage_date: string | null
          provider: string
          risk_profile: Database["public"]["Enums"]["email_risk_profile"] | null
          updated_at: string
          user_id: string
          warmup_started_at: string | null
        }
        Insert: {
          created_at?: string
          current_daily_limit?: number | null
          email: string
          emails_sent_today?: number
          has_password?: boolean
          id?: string
          last_usage_date?: string | null
          provider: string
          risk_profile?:
            | Database["public"]["Enums"]["email_risk_profile"]
            | null
          updated_at?: string
          user_id: string
          warmup_started_at?: string | null
        }
        Update: {
          created_at?: string
          current_daily_limit?: number | null
          email?: string
          emails_sent_today?: number
          has_password?: boolean
          id?: string
          last_usage_date?: string | null
          provider?: string
          risk_profile?:
            | Database["public"]["Enums"]["email_risk_profile"]
            | null
          updated_at?: string
          user_id?: string
          warmup_started_at?: string | null
        }
        Relationships: []
      }
      smtp_credentials_secrets: {
        Row: {
          created_at: string
          password: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          password: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          password?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smtp_credentials_secrets_user_id_fk"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "smtp_credentials"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ai_usage_summary: {
        Row: {
          total_job_email_generations: number | null
          total_resume_parses: number | null
          total_template_generations: number | null
          unique_users: number | null
          usage_date: string | null
        }
        Relationships: []
      }
      job_report_summary: {
        Row: {
          job_id: string | null
          reasons: string[] | null
          report_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_with_stats: {
        Row: {
          company: string | null
          created_at: string | null
          id: string | null
          job_id: string | null
          job_title: string | null
          last_error: string | null
          last_view_at: string | null
          send_count: number | null
          sent_at: string | null
          status: string | null
          token: string | null
          total_duration_seconds: number | null
          tracking_id: string | null
          user_id: string | null
          view_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "my_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_category_stats: {
        Row: {
          job_count: number | null
          raw_category: string | null
          segment_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_warmup_limit: {
        Args: {
          p_current_limit: number
          p_emails_sent: number
          p_plan_tier: Database["public"]["Enums"]["plan_tier"]
          p_risk_profile: Database["public"]["Enums"]["email_risk_profile"]
        }
        Returns: number
      }
      deactivate_all_jobs: { Args: never; Returns: undefined }
      deactivate_expired_jobs: { Args: never; Returns: number }
      downgrade_smtp_warmup: { Args: { p_user_id: string }; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      get_category_stats_cached: {
        Args: never
        Returns: {
          job_count: number
          raw_category: string
          segment_name: string
        }[]
      }
      get_effective_daily_limit: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_normalized_category: { Args: { raw_cat: string }; Returns: string }
      get_radar_stats:
        | {
            Args: {
              p_group?: string
              p_max_exp?: number
              p_min_wage?: number
              p_state?: string
              p_user_id: string
              p_visa_type?: string
            }
            Returns: {
              count: number
              raw_category: string
            }[]
          }
        | {
            Args: {
              p_max_exp?: number
              p_min_wage?: number
              p_state?: string
              p_visa_type?: string
            }
            Returns: {
              count: number
              raw_category: string
            }[]
          }
        | {
            Args: {
              p_group?: string
              p_max_exp?: number
              p_min_wage?: number
              p_state?: string
              p_visa_type?: string
            }
            Returns: {
              count: number
              raw_category: string
            }[]
          }
      get_unique_categories: {
        Args: never
        Returns: {
          category_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_usage: {
        Args: { p_function_type: string; p_user_id: string }
        Returns: undefined
      }
      increment_blacklist_hit: { Args: { p_ip: string }; Returns: undefined }
      increment_smtp_email_count: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      process_daily_smtp_warmup: { Args: never; Returns: undefined }
      process_jobs_bulk: { Args: { jobs_data: Json }; Returns: undefined }
      track_profile_view: {
        Args: { p_queue_id?: string; p_token: string }
        Returns: {
          contact_email: string
          full_name: string
          id: string
          phone_e164: string
          resume_url: string
        }[]
      }
      track_profile_view_v2: {
        Args: { p_queue_id?: string; p_token: string }
        Returns: {
          full_name: string
          id: string
          phone_e164: string
          resume_url: string
          view_id: string
        }[]
      }
      track_whatsapp_click: { Args: { p_token: string }; Returns: undefined }
      trigger_immediate_radar: {
        Args: { target_user_id: string }
        Returns: number
      }
      update_smtp_warmup_limit: { Args: { p_user_id: string }; Returns: number }
      update_view_duration: { Args: { p_view_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      email_risk_profile: "conservative" | "standard" | "aggressive"
      plan_tier: "free" | "gold" | "diamond" | "black"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      email_risk_profile: ["conservative", "standard", "aggressive"],
      plan_tier: ["free", "gold", "diamond", "black"],
    },
  },
} as const
