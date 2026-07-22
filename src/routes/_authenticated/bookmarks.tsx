import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccess } from "@/hooks/useAccess";
import { ResourceCard, type ResourceRow } from "./library";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Bookmarks,
});

function Bookmarks() {
  const { user } = useAuth();
  const { isPremium, isAdmin } = useAccess();

  const { data } = useQuery({
    queryKey: ["bookmarks-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select(
          "resource:resources(id, title, description, course_code, department, year, tags, file_path, download_count, bookmark_count, created_at, category:categories(name, slug))"
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      return (data ?? [])
        .map((b) => (b as { resource: ResourceRow }).resource)
        .filter(Boolean);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          Bookmarks
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          Saved for later
        </h1>
      </div>

      {data && data.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <ResourceCard
              key={r.id}
              r={r}
              isPremium={isPremium}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            title="No bookmarks yet"
            desc="Save resources from the library to find them here."
          />
        </div>
      )}
    </div>
  );
}