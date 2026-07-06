import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileCheck2, Download, BookMarked, HardDrive, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, resources, pending, downloads, bookmarks] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("resources").select("id", { count: "exact", head: true }),
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("downloads").select("id", { count: "exact", head: true }),
        supabase.from("bookmarks").select("id", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        resources: resources.count ?? 0,
        pending: pending.count ?? 0,
        downloads: downloads.count ?? 0,
        bookmarks: bookmarks.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Total Users", value: data?.users ?? 0, icon: Users },
    { label: "Resources", value: data?.resources ?? 0, icon: FileCheck2 },
    { label: "Pending Approval", value: data?.pending ?? 0, icon: ShieldAlert, highlight: true },
    { label: "Downloads", value: data?.downloads ?? 0, icon: Download },
    { label: "Bookmarks", value: data?.bookmarks ?? 0, icon: BookMarked },
    { label: "Storage", value: "—", icon: HardDrive },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border p-5 shadow-soft ${c.highlight ? "border-gold/40 bg-gold/5" : "border-border bg-card"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
            <c.icon className={`h-4 w-4 ${c.highlight ? "text-gold" : "text-primary"}`} />
          </div>
          <div className="mt-4 font-display text-3xl font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
