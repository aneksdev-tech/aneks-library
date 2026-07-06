import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatusPill } from "./dashboard";

export const Route = createFileRoute("/_authenticated/my-uploads")({
  head: () => ({ meta: [{ title: "My Uploads — Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: MyUploads,
});

function MyUploads() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-uploads", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase
        .from("resources")
        .select("id, title, status, file_path, download_count, created_at, category:categories(name)")
        .eq("uploader_id", user!.id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (r: { id: string; file_path: string }) => {
      await supabase.storage.from("resources").remove([r.file_path]);
      const { error } = await supabase.from("resources").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["my-uploads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">My uploads</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Manage your contributions</h1>
        </div>
        <Button asChild className="bg-gradient-emerald text-primary-foreground"><Link to="/upload"><Upload className="mr-2 h-4 w-4" /> New upload</Link></Button>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : data && data.length ? (
          <ul className="divide-y divide-border">
            {data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(r as { category?: { name?: string } }).category?.name ?? "Uncategorized"} · {r.download_count} downloads · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={r.status as string} />
                  {(r.status === "pending" || r.status === "rejected" || r.status === "draft") && (
                    <Button size="sm" variant="ghost" onClick={() => del.mutate({ id: r.id, file_path: r.file_path })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No uploads yet" desc="Contribute your first resource to see it here." />
        )}
      </div>
    </div>
  );
}
