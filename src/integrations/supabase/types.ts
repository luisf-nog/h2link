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
          template_generations: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          template_generations?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          template_generations?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
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
          id: string
          job_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          manual_job_id: string | null
          opened_at: string | null
          processing_started_at: string | null
          send_count: number
          sent_at: string | null
          status: string
          tracking_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          manual_job_id?: string | null
          opened_at?: string | null
          processing_started_at?: string | null
          send_count?: number
          sent_at?: string | null
          status?: string
          tracking_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          manual_job_id?: string | null
          opened_at?: string | null
          processing_started_at?: string | null
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
          full_name: string | null
          id: string
          is_referral_activated: boolean
          phone_e164: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          preferred_language: string
          referral_bonus_limit: number
          referral_code: string | null
          referred_by: string | null
          resume_data: Json | null
          resume_url: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          timezone: string
          updated_at: string
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
          full_name?: string | null
          id: string
          is_referral_activated?: boolean
          phone_e164?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          preferred_language?: string
          referral_bonus_limit?: number
          referral_code?: string | null
          referred_by?: string | null
          resume_data?: Json | null
          resume_url?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          updated_at?: string
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
          full_name?: string | null
          id?: string
          is_referral_activated?: boolean
          phone_e164?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          preferred_language?: string
          referral_bonus_limit?: number
          referral_code?: string | null
          referred_by?: string | null
          resume_data?: Json | null
          resume_url?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          updated_at?: string
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
          description: string | null
          education_required: string | null
          email: string
          end_date: string | null
          experience_months: number | null
          housing_info: string | null
          id: string
          job_duties: string | null
          job_id: string
          job_min_special_req: string | null
          job_title: string
          openings: number | null
          overtime_salary: number | null
          phone: string | null
          posted_date: string
          rec_pay_deductions: string | null
          requirements: string | null
          salary: number | null
          source_url: string | null
          start_date: string | null
          state: string
          tools_provided: boolean | null
          transport_provided: boolean | null
          visa_type: string | null
          wage_additional: string | null
          weekly_hours: number | null
          worksite_address: string | null
          worksite_zip: string | null
        }
        Insert: {
          category?: string | null
          city: string
          company: string
          created_at?: string
          description?: string | null
          education_required?: string | null
          email: string
          end_date?: string | null
          experience_months?: number | null
          housing_info?: string | null
          id?: string
          job_duties?: string | null
          job_id: string
          job_min_special_req?: string | null
          job_title: string
          openings?: number | null
          overtime_salary?: number | null
          phone?: string | null
          posted_date?: string
          rec_pay_deductions?: string | null
          requirements?: string | null
          salary?: number | null
          source_url?: string | null
          start_date?: string | null
          state: string
          tools_provided?: boolean | null
          transport_provided?: boolean | null
          visa_type?: string | null
          wage_additional?: string | null
          weekly_hours?: number | null
          worksite_address?: string | null
          worksite_zip?: string | null
        }
        Update: {
          category?: string | null
          city?: string
          company?: string
          created_at?: string
          description?: string | null
          education_required?: string | null
          email?: string
          end_date?: string | null
          experience_months?: number | null
          housing_info?: string | null
          id?: string
          job_duties?: string | null
          job_id?: string
          job_min_special_req?: string | null
          job_title?: string
          openings?: number | null
          overtime_salary?: number | null
          phone?: string | null
          posted_date?: string
          rec_pay_deductions?: string | null
          requirements?: string | null
          salary?: number | null
          source_url?: string | null
          start_date?: string | null
          state?: string
          tools_provided?: boolean | null
          transport_provided?: boolean | null
          visa_type?: string | null
          wage_additional?: string | null
          weekly_hours?: number | null
          worksite_address?: string | null
          worksite_zip?: string | null
        }
        Relationships: []
      }
      queue_send_history: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
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
          id?: string
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
          id?: string
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
        ]
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
      [_ in never]: never
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
      downgrade_smtp_warmup: { Args: { p_user_id: string }; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      get_effective_daily_limit: {
        Args: { p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_smtp_email_count: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      update_smtp_warmup_limit: { Args: { p_user_id: string }; Returns: number }
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
