import { createFileRoute, Outlet, Link, useRouterState, } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { useAuth } from "@/lib/auth";
import { canManageUsers, } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
  console.log("Entering admin beforeLoad");

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

console.log("Auth object:", auth);

const roles = auth.roles ?? [];

  const tabs = [
    {
      to: "/admin",
      label: "Overview",
    },
    {
      to: "/admin/approvals",
      label: "Approvals",
    },
    ...(canManageUsers(roles)
      ? [
          {
            to: "/admin/users",
            label: "Users",
          },
          {
            to: "/admin/categories",
            label: "Categories",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          Admin
        </p>

        <h1 className="mt-1 font-display text-3xl font-semibold">
          Control room
        </h1>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-soft">
        {tabs.map((tab) => {
          const active = pathname === tab.to;

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                active
                  ? "bg-gradient-emerald text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}