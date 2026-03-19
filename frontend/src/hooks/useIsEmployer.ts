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
  const { isEmployer, employerProfile, rolesLoading } = useAuth();
  return { isEmployer, loading: rolesLoading, employerProfile };
}
