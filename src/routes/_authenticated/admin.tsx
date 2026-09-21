import {
  createFileRoute,
  Outlet,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardCheck,
  Files,
  Users,
  Tags,
  Megaphone,
} from "lucide-react";
import { requireRole } from "@/lib/route-guards";
import { useAuth } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";

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

    return requireRole(
      ["admin", "co-admin", "staff", "lecturer"],
      location.pathname,
    );
  },

  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({
    select: (r) => r.location.pathname,
  });

  const auth = useAuth();
  const roles = auth.roles ?? [];

  const canManagePlatform = canManageUsers(roles);

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
    {
      to: "/admin/announcements",
      label: "Announcements",
      icon: Megaphone,
    },
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
        className="rounded-lg border border-border bg-card p-1 shadow-soft"
      >
        <div className="grid grid-cols-2 gap-1 sm:flex">
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
                className={`group flex min-h-11 min-w-0 flex-1 items-center justify-start gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 sm:justify-center sm:px-4 ${
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

                <span className="min-w-0 truncate">{tab.label}</span>
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