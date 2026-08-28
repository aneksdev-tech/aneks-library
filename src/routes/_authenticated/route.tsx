import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    throw redirect({
      to: "/auth",
      search: {
        mode: "login",
        next: location.pathname,
      },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .single();

  const currentPath = location.pathname;

  const isPendingPage = currentPath === "/pending";
  const isSuspendedPage = currentPath === "/suspended";
  const isRejectedPage = currentPath === "/rejected";
  const isInactivePage = currentPath === "/inactive";

  switch (profile?.status) {
    case "pending":
      if (!isPendingPage) {
        throw redirect({
          to: "/pending",
        });
      }
      break;

    case "suspended":
      if (!isSuspendedPage) {
        throw redirect({
          to: "/suspended",
        });
      }
      break;

    case "rejected":
      if (!isRejectedPage) {
        throw redirect({
          to: "/rejected",
        });
      }
      break;

    case "inactive":
      if (!isInactivePage) {
        throw redirect({
          to: "/inactive",
        });
      }
      break;

    case "active":
      if (
        isPendingPage ||
        isSuspendedPage ||
        isRejectedPage ||
        isInactivePage
      ) {
        throw redirect({
          to: "/dashboard",
        });
      }
      break;

    default:
      if (!isPendingPage) {
        throw redirect({
          to: "/pending",
        });
      }
  }

  return {
    user: data.user,
    profile,
  };
},

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
