import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: Notifications,
});

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Notifications</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">What's new for you</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()}><Check className="mr-1.5 h-3.5 w-3.5" /> Mark all read</Button>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        {data && data.length ? (
          <ul className="divide-y divide-border">
            {data.map((n) => (
              <li key={n.id} className={`flex gap-3 p-5 ${n.read ? "opacity-70" : ""}`}>
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="You're all caught up" desc="Notifications about your uploads and account will appear here." />
        )}
      </div>
    </div>
  );
}
