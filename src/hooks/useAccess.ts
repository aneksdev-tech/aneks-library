import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useAccess() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);

  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setIsAdmin(false);
      setIsPremium(false);
      return;
    }

    async function loadAccess() {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("primary_role, subscription_plan")
        .eq("id", user!.id)
        .single();

      if (!error && data) {
        setIsAdmin(data.primary_role === "admin");
        setIsPremium(data.subscription_plan === "premium");
      }

      setLoading(false);
    }

    loadAccess();
  }, [user]);

  return {
    loading,
    isAdmin,
    isPremium,
    canDownload: isAdmin || isPremium,
    user,
  };
}