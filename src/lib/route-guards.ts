import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";

export async function requireRole(
  allowedRoles: AppRole[],
  next?: string,
) {
 
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    throw redirect({
      to: "/auth",
      search: {
        mode: "login",
        ...(next ? { next } : {}),
      },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("primary_role")
    .eq("id", auth.user.id)
    .single();

  if (!profile) {
    throw redirect({
        to: "/dashboard",
        replace: true,
    });
    }

  if (!allowedRoles.includes(profile.primary_role as AppRole)) {
    throw redirect({
        to: "/dashboard",
        replace: true,
    });
    }

  return {
    user: auth.user,
    profile,
  };
}