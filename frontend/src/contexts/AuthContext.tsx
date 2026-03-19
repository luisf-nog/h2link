import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlanTier } from '@/config/plans.config';
import { getBaseUrl } from '@/config/app.config';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  age?: number | null;
  phone_e164?: string | null;
  contact_email?: string | null;
  plan_tier: PlanTier;
  credits_used_today: number;
  credits_reset_date: string;
  timezone?: string;
  consecutive_errors?: number;
  preferred_language?: string;
  smtp_verified?: boolean;
  last_smtp_check?: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  is_referral_activated?: boolean;
  referral_bonus_limit?: number;
  active_referrals_count?: number;
  created_at: string;
}

interface SmtpStatus {
  hasPassword: boolean;
  hasRiskProfile: boolean;
}

interface EmployerProfile {
  id: string;
  company_name: string;
  tier: "free" | "essential" | "professional" | "enterprise";
  status: "active" | "inactive";
  is_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  smtpStatus: SmtpStatus | null;
  isAdmin: boolean;
  isEmployer: boolean;
  employerProfile: EmployerProfile | null;
  rolesLoading: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    profileData?: { age?: number | null; phone_e164?: string | null; contact_email?: string | null }
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSmtpStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Emails that are always admin (hardcoded safety net)
const ADMIN_EMAILS = ["seu.email.real@gmail.com"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployer, setIsEmployer] = useState(false);
  const [employerProfile, setEmployerProfile] = useState<EmployerProfile | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    
    if (data) {
      const today = new Date().toISOString().slice(0, 10);
      if (data.credits_reset_date && data.credits_reset_date < today) {
        return { ...data, credits_used_today: 0 } as Profile;
      }
    }
    
    return data as Profile | null;
  };

  const fetchSmtpStatus = async (userId: string): Promise<SmtpStatus> => {
    const { data } = await supabase
      .from('smtp_credentials')
      .select('has_password, risk_profile')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      hasPassword: Boolean(data?.has_password),
      hasRiskProfile: Boolean(data?.risk_profile),
    };
  };

  const fetchRoles = async (userId: string, userEmail: string | undefined) => {
    // Check admin via hardcoded list first
    const isEmailAdmin = !!(userEmail && ADMIN_EMAILS.includes(userEmail));

    // Single query to get all roles + employer profile in parallel
    const [rolesRes, empRes] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId),
      supabase
        .from('employer_profiles')
        .select('id, company_name, tier, status, is_verified')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const roles = (rolesRes.data || []).map((r) => r.role);
    setIsAdmin(isEmailAdmin || roles.includes('admin'));
    setIsEmployer(roles.includes('employer'));
    setEmployerProfile(
      empRes.data
        ? {
            id: empRes.data.id,
            company_name: empRes.data.company_name,
            tier: empRes.data.tier as EmployerProfile['tier'],
            status: empRes.data.status as EmployerProfile['status'],
            is_verified: empRes.data.is_verified,
          }
        : null,
    );
    setRolesLoading(false);
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const refreshSmtpStatus = async () => {
    if (user) {
      const status = await fetchSmtpStatus(user.id);
      setSmtpStatus(status);
    }
  };

  const tryApplyPendingReferral = async (session: Session, profileData: Profile) => {
    const code = String(localStorage.getItem('pending_referral_code') ?? '').trim();
    if (!code) return;
    if (profileData.referred_by) {
      localStorage.removeItem('pending_referral_code');
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-referral-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        localStorage.removeItem('pending_referral_code');
        refreshProfile().catch(() => undefined);
      }
    } catch {
      // keep for later
    }
  };

  const loadUserData = async (currentSession: Session) => {
    try {
      const [profileData, smtp] = await Promise.all([
        fetchProfile(currentSession.user.id),
        fetchSmtpStatus(currentSession.user.id),
      ]);
      setProfile(profileData);
      setSmtpStatus(smtp);

      // Fetch roles (cached for entire session)
      fetchRoles(currentSession.user.id, currentSession.user.email).catch(() => {
        setRolesLoading(false);
      });

      if (profileData) {
        tryApplyPendingReferral(currentSession, profileData).catch(() => undefined);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      setSmtpStatus({ hasPassword: false, hasRiskProfile: false });
      setRolesLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const clearUserState = () => {
    setProfile(null);
    setSmtpStatus(null);
    setIsAdmin(false);
    setIsEmployer(false);
    setEmployerProfile(null);
    setRolesLoading(true);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => loadUserData(session), 0);
        } else {
          clearUserState();
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session);
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    profileData?: { age?: number | null; phone_e164?: string | null; contact_email?: string | null }
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getBaseUrl(),
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && profileData) {
      const sessionToUse = data.session ?? (await supabase.auth.getSession()).data.session;
      const userId = data.user?.id ?? sessionToUse?.user?.id;

      if (sessionToUse && userId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            age: typeof profileData.age === "number" ? profileData.age : null,
            phone_e164: profileData.phone_e164?.trim() ? profileData.phone_e164.trim() : null,
            contact_email: profileData.contact_email?.trim() ? profileData.contact_email.trim() : null,
          })
          .eq("id", userId);

        if (!profileError) {
          refreshProfile().catch(() => undefined);
        }
      }
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    clearUserState();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        smtpStatus,
        isAdmin,
        isEmployer,
        employerProfile,
        rolesLoading,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        refreshSmtpStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
