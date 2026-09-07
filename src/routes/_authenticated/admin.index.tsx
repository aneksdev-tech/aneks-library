import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  FileCheck2,
  Download,
  BookMarked,
  HardDrive,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Overview | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverview,
});

function formatStorage(bytes: number) {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / Math.pow(1024, index);

  if (index === 0) {
    return `${Math.round(value)} ${units[index]}`;
  }

  if (value >= 100) {
    return `${value.toFixed(0)} ${units[index]}`;
  }

  if (value >= 10) {
    return `${value.toFixed(1)} ${units[index]}`;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}

function AdminOverview() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, resources, pending, downloads, bookmarks, storage] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true }),

          supabase
            .from("resources")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved"),

          supabase
            .from("resources")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),

          supabase.rpc("get_total_active_resource_downloads"),

          supabase.rpc("get_total_bookmarks"),

          supabase.rpc("get_total_resource_storage"),
        ]);

      if (users.error) {
        throw users.error;
      }

      if (resources.error) {
        throw resources.error;
      }

      if (pending.error) {
        throw pending.error;
      }

      if (downloads.error) {
        throw downloads.error;
      }

      if (bookmarks.error) {
        throw bookmarks.error;
      }

      if (storage.error) {
        throw storage.error;
      }

      return {
        users: users.count ?? 0,
        resources: resources.count ?? 0,
        pending: pending.count ?? 0,
        downloads: Number(downloads.data ?? 0),
        bookmarks: Number(bookmarks.data ?? 0),
        storage: Number(storage.data ?? 0),
      };
    },
  });

  const stats = [
    {
      label: "Total Users",
      value: data?.users ?? 0,
      icon: Users,
    },
    {
      label: "Resources",
      value: data?.resources ?? 0,
      icon: FileCheck2,
    },
    {
      label: "Downloads",
      value: data?.downloads ?? 0,
      icon: Download,
    },
    {
      label: "Bookmarks",
      value: data?.bookmarks ?? 0,
      icon: BookMarked,
    },
    {
      label: "Library Storage",
      value: formatStorage(data?.storage ?? 0),
      icon: HardDrive,
    },
  ];

  const pendingCount = data?.pending ?? 0;

  return (
    <section className="space-y-6">
      {/* Primary statistics */}
      <div className="grid gap-0 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className={`group flex min-h-32 flex-col justify-between p-5 transition-colors hover:bg-muted/30 ${
                index > 0
                  ? "border-t border-border sm:border-l sm:border-t-0"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {stat.label}
                </span>

                <Icon className="h-4 w-4 text-primary transition-transform duration-200 group-hover:scale-105" />
              </div>

              <div
                className={`mt-6 font-display font-semibold tracking-tight ${
                  stat.label === "Library Storage"
                    ? "text-2xl sm:text-3xl"
                    : "text-3xl"
                }`}
              >
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending approvals */}
      <div
        className={`flex items-center justify-between gap-4 rounded-lg border p-5 ${
          pendingCount > 0
            ? "border-gold/40 bg-gold/5"
            : "border-border bg-card"
        }`}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
              pendingCount > 0
                ? "border-gold/30 bg-gold/10 text-gold"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold">Pending Approval</p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Resources currently awaiting administrative review.
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 font-display text-2xl font-semibold ${
            pendingCount > 0 ? "text-gold" : "text-foreground"
          }`}
        >
          {pendingCount}
        </span>
      </div>
    </section>
  );
}