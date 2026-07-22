import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowUpRight, BookMarked, Download, FileCheck2, Upload, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, user, roles } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [uploads, downloads, bookmarks, approved] = await Promise.all([
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("uploader_id", user!.id),
        supabase.from("downloads").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("uploader_id", user!.id).eq("status", "approved"),
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
        .select("id, title, status, created_at, download_count, category:categories(name, slug)")
        .eq("uploader_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const cards = [
    { label: "My Uploads", value: stats?.uploads ?? 0, icon: Upload, sub: `${stats?.approved ?? 0} approved` },
    { label: "Downloads", value: stats?.downloads ?? 0, icon: Download, sub: "All time" },
    { label: "Bookmarks", value: stats?.bookmarks ?? 0, icon: BookMarked, sub: "Saved for later" },
    { label: "Reputation", value: profile?.reputation ?? 0, icon: TrendingUp, sub: "Contribution score" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">
            {roles.includes("admin") ? "Admin" : roles[0] ?? "Member"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            Welcome back, {profile?.full_name?.split(" ")[0] || "there"}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's what's happening in your library.</p>
        </div>
        <Button asChild className="bg-gradient-emerald text-primary-foreground shadow-soft">
          <Link to="/upload"><Upload className="mr-2 h-4 w-4" /> New upload</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elegant">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-4 font-display text-3xl font-semibold">{c.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Recent uploads</h2>
            <p className="text-sm text-muted-foreground">Your latest contributions and their status.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/my-uploads">View all <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(r as { category?: { name?: string } }).category?.name ?? "Uncategorized"} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={r.status as string} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No uploads yet"
            desc="Contribute your first resource — a past question, project or lecture note."
            cta={<Button asChild className="bg-gradient-emerald text-primary-foreground"><Link to="/upload">Upload something</Link></Button>}
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
    "bg-secondary border border-border text-secondary-foreground",
};
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

export function EmptyState({ title, desc, cta }: { title: string; desc: string; cta?: React.ReactNode }) {
  return (
    <div className="grid place-items-center p-12 text-center">
      <FileCheck2 className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
