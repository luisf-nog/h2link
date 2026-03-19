import { useAuth } from "@/contexts/AuthContext";

interface UseIsAdminResult {
  isAdmin: boolean;
  loading: boolean;
}

export function useIsAdmin(): UseIsAdminResult {
  const { isAdmin, rolesLoading } = useAuth();
  return { isAdmin, loading: rolesLoading };
}
