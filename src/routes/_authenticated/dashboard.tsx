import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ArrowUpRight,
  Bookmark,
  Download,
  FileCheck2,
  Upload,
  TrendingUp,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getContributorLevel,
  getLevelProgress,
  getNextContributorLevel,
} from "@/lib/reputation";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, user, roles } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [uploads, downloads, bookmarks, approved] = await Promise.all([
        supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("uploader_id", user!.id)
          .neq("status", "deleted"),

        supabase
          .from("downloads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),

        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),

        supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("uploader_id", user!.id)
          .eq("status", "approved"),
      ]);

      return {
        uploads: uploads.count ?? 0,
        downloads: downloads.count ?? 0,
        bookmarks: bookmarks.count ?? 0,
        approved: approved.count ?? 0,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-uploads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("resources")
        .select(
          "id, title, status, created_at, download_count, category:categories(name, slug)",
        )
        .eq("uploader_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);

      return data ?? [];
    },
  });

  const contributor = getContributorLevel(profile?.reputation ?? 0);
  const progress = getLevelProgress(profile?.reputation ?? 0);
  const nextLevel = getNextContributorLevel(profile?.reputation ?? 0);

  const cards = [
    {
      label: "My Uploads",
      value: stats?.uploads ?? 0,
      icon: Upload,
      sub: `${stats?.approved ?? 0} approved`,
    },
    {
      label: "Downloads",
      value: stats?.downloads ?? 0,
      icon: Download,
      sub: "All time",
    },
    {
      label: "Bookmarks",
      value: stats?.bookmarks ?? 0,
      icon: Bookmark,
      sub: "Saved for later",
    },
    {
      label: "Reputation",
      value: profile?.reputation ?? 0,
      icon: TrendingUp,
      sub: `${contributor.emoji} ${contributor.name}`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          {roles.includes("admin") ? "Admin" : roles[0] ?? "Member"}
        </p>

        <h1 className="mt-1 font-display text-3xl font-semibold">
          Welcome back, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening in your library.
        </p>
      </div>

      <AnnouncementBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>

              <c.icon className="h-4 w-4 text-primary" />
            </div>

            <div className="mt-4 font-display text-3xl font-semibold">
              {c.value}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {c.sub}
            </div>

            {c.label === "Reputation" && (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-emerald transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground">
                  {nextLevel
                    ? `${nextLevel.pointsNeeded} pts to ${nextLevel.emoji} ${nextLevel.name}`
                    : "Highest contributor level reached 👑"}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Recent uploads
            </h2>

            <p className="text-sm text-muted-foreground">
              Your latest contributions and their current status.
            </p>
          </div>

          <Button asChild variant="ghost" size="sm">
            <Link to="/my-uploads">
              View all
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>

        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-border">
            {recent.map((r) => {
              const needsStatusCheck =
                r.status === "rejected" || r.status === "deleted";

              return (
                <li
                  key={r.id}
                  className={`p-5 transition-colors ${
                    r.status === "deleted"
                      ? "bg-muted/30 hover:bg-muted/50"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div>
                        <StatusPill status={r.status as string} />
                      </div>

                      <p className="mt-2 truncate font-medium">
                        {r.title}
                      </p>

                      <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                        <span>
                          {(r as {
                            category?: {
                              name?: string;
                            };
                          }).category?.name ?? "Uncategorized"}
                        </span>

                        <span className="hidden sm:inline">·</span>

                        <span>
                          {r.download_count} downloads
                        </span>

                        <span className="hidden sm:inline">·</span>

                        <span>
                          {new Date(
                            r.created_at,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {needsStatusCheck && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full shrink-0 sm:w-auto"
                      >
                        <Link to="/notifications">
                          <Bell className="mr-1.5 h-3.5 w-3.5" />
                          Check status
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No uploads yet"
            desc="Contribute your first resource — a past question, project or lecture note."
            cta={
              <Button
                asChild
                className="bg-gradient-emerald text-primary-foreground"
              >
                <Link to="/upload">Upload something</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved:
      "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25",

    pending:
      "bg-amber-500/15 text-amber-500 border border-amber-500/25",

    rejected:
      "bg-red-500/15 text-red-500 border border-red-500/25",

    draft:
      "bg-muted border border-border text-muted-foreground",

    archived:
      "bg-red-500/15 text-red-500 border border-red-500/25",

    deleted:
      "bg-red-500/15 text-red-500 border border-red-500/25",
  };

  const labels: Record<string, string> = {
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    draft: "Draft",
    archived: "Deleted",
    deleted: "Deleted",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-muted"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function EmptyState({
  title,
  desc,
  cta,
}: {
  title: string;
  desc: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center p-12 text-center">
      <FileCheck2 className="h-8 w-8 text-muted-foreground" />

      <p className="mt-3 font-medium">{title}</p>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>

      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}