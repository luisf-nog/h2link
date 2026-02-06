import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Emails que são SEMPRE admin (Segurança extra)
const ADMIN_EMAILS = ["seu.email.real@gmail.com"]; // <--- COLOQUE SEU EMAIL AQUI

interface UseIsAdminResult {
  isAdmin: boolean;
  loading: boolean;
}

export function useIsAdmin(): UseIsAdminResult {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Se não tem usuário logado -> NÃO É ADMIN (Garante que visitantes não vejam)
    if (!user || !user.email) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // 2. Se o email estiver na lista fixa -> É ADMIN DIRETO (Mais rápido)
    if (ADMIN_EMAILS.includes(user.email)) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    // 3. Se não, verifica no banco de dados (Supabase)
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao verificar admin:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
        setLoading(false);
      });
  }, [user]);

  return { isAdmin, loading };
}
