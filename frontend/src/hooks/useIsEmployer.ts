import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UseIsEmployerResult {
  isEmployer: boolean;
  loading: boolean;
  employerProfile: {
    id: string;
    company_name: string;
    tier: "free" | "essential" | "professional" | "enterprise";
    status: "active" | "inactive";
    is_verified: boolean;
  } | null;
}

export function useIsEmployer(): UseIsEmployerResult {
  const { user } = useAuth();
  const [isEmployer, setIsEmployer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employerProfile, setEmployerProfile] = useState<UseIsEmployerResult["employerProfile"]>(null);

  useEffect(() => {
    if (!user) {
      setIsEmployer(false);
      setEmployerProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "employer")
        .maybeSingle(),
      supabase
        .from("employer_profiles")
        .select("id, company_name, tier, status, is_verified")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([roleRes, profileRes]) => {
      const hasRole = !!roleRes.data;
      setIsEmployer(hasRole);
      setEmployerProfile(
        profileRes.data
          ? {
              id: profileRes.data.id,
              company_name: profileRes.data.company_name,
              tier: profileRes.data.tier as "essential" | "professional" | "enterprise",
              status: profileRes.data.status as "active" | "inactive",
              is_verified: profileRes.data.is_verified,
            }
          : null,
      );
      setLoading(false);
    });
  }, [user]);

  return { isEmployer, loading, employerProfile };
}
