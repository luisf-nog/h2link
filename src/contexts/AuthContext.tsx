import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlanTier } from '@/config/plans.config';
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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  is_referral_activated?: boolean;
  referral_bonus_limit?: number;
  active_referrals_count?: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
    return data as Profile | null;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
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

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid potential deadlocks
          setTimeout(async () => {
            const profileData = await fetchProfile(session.user.id);
            setProfile(profileData);
            if (session && profileData) {
              tryApplyPendingReferral(session, profileData).catch(() => undefined);
            }
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          setProfile(profileData);
          if (session && profileData) {
            tryApplyPendingReferral(session, profileData).catch(() => undefined);
          }
          setLoading(false);
        });
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
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && profileData) {
      // If we have an active session (auto-confirm enabled), update profile immediately.
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
          // keep local profile in sync
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
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
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
