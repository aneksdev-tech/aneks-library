import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({ meta: [{ title: "Approvals | Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: Approvals,
});

function Approvals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pending-resources"],
    queryFn: async () =>
      (await supabase
        .from("resources")
        .select("id, title, description, file_path, file_name, created_at, category:categories(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true })).data ?? [],
  });

  const decide = useMutation({
    mutationFn: async (v: { id: string; approve: boolean; reason?: string }) => {
      const { error } = await supabase
        .from("resources")
        .update({
          status: v.approve ? "approved" : "rejected",
          approved_by: user!.id,
          approved_at: v.approve ? new Date().toISOString() : null,
          rejection_reason: v.approve ? null : v.reason ?? null,
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["pending-resources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = async (path: string) => {
    const { data } = await supabase.storage.from("resources").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      {data && data.length ? (
        <ul className="divide-y divide-border">
          {data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(r as { category?: { name?: string } }).category?.name ?? "Uncategorized"} · {r.file_name} · {new Date(r.created_at).toLocaleString()}
                </p>
                {r.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => preview(r.file_path)}>Preview</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = prompt("Rejection reason (optional):") ?? "";
                    decide.mutate({ id: r.id, approve: false, reason });
                  }}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
                <Button size="sm" className="bg-gradient-emerald text-primary-foreground" onClick={() => decide.mutate({ id: r.id, approve: true })}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Queue empty" desc="No resources are waiting for review right now." />
      )}
    </div>
  );
}
