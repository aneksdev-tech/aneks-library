
import { useAuth } from "@/lib/auth";

export function useAccess() {
  const { user, profile, loading } = useAuth();

  const isAdmin =
    profile?.primary_role === "admin" ||
    profile?.primary_role === "co-admin";

  const isPremium =
    profile?.subscription_plan === "premium";

  return {
    loading,
    isAdmin,
    isPremium,
    canDownload: isAdmin || isPremium,
    user,
  };
}
