import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardCheck,
  Files,
  Users,
  Tags,
  Megaphone,
  Loader2,
} from "lucide-react";
import { requireRole } from "@/lib/route-guards";
import { useAuth } from "@/lib/auth";
import {
  canManageAnnouncements,
  canManageUsers,
} from "@/lib/permissions";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
    const restrictedToAdmin = [
      "/admin/resources",
      "/admin/categories",
      "/admin/users",
    ].some(
      (path) =>
        location.pathname === path ||
        location.pathname.startsWith(`${path}/`),
    );

    if (restrictedToAdmin) {
      return requireRole(
        ["admin", "co-admin"],
        location.pathname,
      );
    }

    const announcementsPath =
      location.pathname === "/admin/announcements" ||
      location.pathname.startsWith("/admin/announcements/");

    if (announcementsPath) {
      return requireRole(
        ["admin", "co-admin", "staff"],
        location.pathname,
      );
    }

    return requireRole(
      ["admin", "co-admin", "staff"],
      location.pathname,
    );
  },

  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({
    select: (r) => r.location.pathname,
  });

  const navigate = useNavigate();

  const auth = useAuth();
  const user = auth.user;
  const roles = auth.roles ?? [];

  const canManagePlatform = canManageUsers(roles);
  const canManageAnnouncementAccess =
    canManageAnnouncements(roles);

  const hasAdminWorkspaceAccess =
    roles.includes("admin") ||
    roles.includes("co-admin") ||
    roles.includes("staff");

  const {
    data: approvalCount = 0,
  } = useQuery({
    queryKey: [
      "approval-attention-count",
      user?.id,
      roles,
    ],
    enabled: !!user,
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase.rpc(
        "get_approval_attention_count",
      );

      if (error) {
        throw error;
      }

      return data ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;

    if (!hasAdminWorkspaceAccess) {
      void navigate({
        to: "/",
        replace: true,
      });
    }
  }, [user, hasAdminWorkspaceAccess, navigate]);

  const tabs = [
    {
      to: "/admin",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      to: "/admin/approvals",
      label: "Approvals",
      icon: ClipboardCheck,
    },
    ...(canManagePlatform
      ? [
          {
            to: "/admin/resources",
            label: "Resources",
            icon: Files,
          },
        ]
      : []),
    ...(canManageAnnouncementAccess
      ? [
          {
            to: "/admin/announcements",
            label: "Announcements",
            icon: Megaphone,
          },
        ]
      : []),
    ...(canManagePlatform
      ? [
          {
            to: "/admin/categories",
            label: "Categories",
            icon: Tags,
          },
          {
            to: "/admin/users",
            label: "Users",
            icon: Users,
          },
        ]
      : []),
  ];

  if (user && !hasAdminWorkspaceAccess) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            Administration
          </p>

          <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {roles[0] ?? "Member"}
          </span>
        </div>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Control Room
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage library operations, review submissions, and maintain
          the platform from one central workspace.
        </p>
      </section>

      {/* Admin Navigation */}
      <nav
        aria-label="Administration navigation"
        className="rounded-lg border border-border bg-card p-1.5 shadow-soft"
      >
        <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
          {tabs.map((tab) => {
            const active =
              tab.to === "/admin"
                ? pathname === "/admin"
                : pathname === tab.to ||
                  pathname.startsWith(`${tab.to}/`);

            const Icon = tab.icon;

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`group flex min-h-11 min-w-0 items-center justify-start gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 sm:flex-1 sm:justify-center sm:px-4 ${
                  active
                    ? "bg-gradient-emerald text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                    active ? "" : "group-hover:scale-105"
                  }`}
                />

                <span className="min-w-0 truncate">
                  {tab.label}
                </span>

                {tab.to === "/admin/approvals" &&
                approvalCount > 0 ? (
                  <span
                    className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-gold-foreground sm:ml-0"
                    aria-label={`${approvalCount} pending approval items`}
                  >
                    {approvalCount > 99
                      ? "99+"
                      : approvalCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Active Admin Page */}
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}