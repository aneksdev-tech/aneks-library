
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";

export async function requireRole(
  allowedRoles: AppRole[],
  next?: string,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw redirect({
      to: "/auth",
      search: {
        mode: "login",
        ...(next ? { next } : {}),
      },
    });
  }

  const { data: profile, error } = await supabase
    .from("private_profiles")
    .select("primary_role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profile) {
    throw redirect({
      to: "/dashboard",
      replace: true,
    });
  }

  if (
    !allowedRoles.includes(
      profile.primary_role as AppRole,
    )
  ) {
    throw redirect({
      to: "/dashboard",
      replace: true,
    });
  }

  return {
    user: session.user,
    profile,
  };
}