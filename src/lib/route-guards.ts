
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";

export async function requireRole(
  allowedRoles: AppRole[],
  next?: string,
) {
  // Read the existing session without making a separate
  // network request to Supabase Auth.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("[Route Guard] Session check", {
    path:
      typeof window !== "undefined"
        ? window.location.pathname
        : "server",
    hasSession: Boolean(session),
    hasUser: Boolean(session?.user),
    userId: session?.user?.id ?? null,
  });

  if (!session?.user) {
  const attemptedPath =
    typeof window !== "undefined"
      ? window.location.pathname
      : "server";

  console.error(
    "[Route Guard] Redirecting to login: session or user missing",
    {
      path: attemptedPath,
      hasSession: Boolean(session),
      hasUser: Boolean(session?.user),
    },
  );

  throw redirect({
    to: "/auth",
    search: {
      mode: "login",
      ...(next ? { next } : {}),
      debug: "guard_missing_session",
      debug_path: attemptedPath,
    },
  });
}
  // Continue checking the user's current role in the database.
  const { data: profile, error } = await supabase
    .from("private_profiles")
    .select("primary_role")
    .eq("id", session.user.id)
    .maybeSingle();

  console.log("[Route Guard] Profile check", {
    hasProfile: Boolean(profile),
    error: error?.message ?? null,
    role: profile?.primary_role ?? null,
    allowedRoles,
  });

  if (error || !profile) {
    console.error(
      "[Route Guard] Redirecting to dashboard: profile missing or query failed",
      {
        hasProfile: Boolean(profile),
        error: error?.message ?? null,
      },
    );

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
    console.error(
      "[Route Guard] Redirecting to dashboard: role not allowed",
      {
        role: profile.primary_role,
        allowedRoles,
      },
    );

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
