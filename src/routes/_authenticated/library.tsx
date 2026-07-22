import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAccess } from "@/hooks/useAccess";
import { downloadResource } from "@/lib/download";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BookMarked, Download, Search, Filter, Eye,} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState } from "./dashboard";
import { UpgradeDialog } from "@/components/UpgradeDialog";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Library — Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "downloads" | "bookmarks">("newest");

  const { isPremium, isAdmin } = useAccess();

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id, name, slug").order("sort_order")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["library", q, category, sort],
    queryFn: async () => {
      let query = supabase
        .from("resources")
        .select("id, title, description, course_code, department, year, tags, file_path, download_count, bookmark_count, created_at, category:categories(name, slug)")
        .eq("status", "approved");
      if (category !== "all") query = query.eq("category_id", category);
      if (q.trim()) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,course_code.ilike.%${q}%`);
      const orderCol = sort === "newest" ? "created_at" : sort === "downloads" ? "download_count" : "bookmark_count";
      query = query.order(orderCol, { ascending: false }).limit(60);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Library</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Browse approved resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search, filter and download the collective knowledge of the community.</p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search title, course code, description…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]"><Filter className="mr-2 h-3 w-3" /><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="downloads">Most downloaded</SelectItem>
            <SelectItem value="bookmarks">Most bookmarked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => <ResourceCard key={r.id} r={r as unknown as ResourceRow} isPremium={isPremium} isAdmin={isAdmin} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState title="No resources found" desc="Try a different search or clear the filters." />
        </div>
      )}
    </div>
  );
}

export type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  department: string | null;
  year: number | null;
  tags: string[];
  file_path: string;
  download_count: number;
  bookmark_count: number;
  created_at: string;
  category: { name: string | null; slug: string | null } | null;
};

export function ResourceCard({
  r,
  isPremium,
  isAdmin,
}: {
  r: ResourceRow;
  isPremium: boolean;
  isAdmin: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data: bookmarked } = useQuery({
    queryKey: ["bookmarked", r.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("bookmarks").select("id").eq("resource_id", r.id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (bookmarked) {
        await supabase.from("bookmarks").delete().eq("resource_id", r.id).eq("user_id", user.id);
      } else {
        await supabase.from("bookmarks").insert({ resource_id: r.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarked", r.id] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const download = async () => {
  if (!user) {
    toast.error("Sign in to download");
    return;
  }

  // Admins and Premium users can download immediately
  if (!isAdmin && !isPremium) {
    setUpgradeOpen(true);
    return;
  }

  try {
    await downloadResource(r.id);

    qc.invalidateQueries({
      queryKey: ["library"],
    });
  } catch (err: any) {
    toast.error(err.message);
  }
};

  return (
  <>
    <article className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {r.category?.name ?? "General"}
        </span>

        {r.year && (
          <span className="text-xs text-muted-foreground">
            {r.year}
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 font-display text-lg font-semibold">
        {r.title}
      </h3>

      {r.description && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
          {r.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {r.course_code && (
          <span className="rounded-md bg-muted px-2 py-0.5">
            {r.course_code}
          </span>
        )}

        {r.department && (
          <span className="rounded-md bg-muted px-2 py-0.5">
            {r.department}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-5 text-xs text-muted-foreground">
        <span>{new Date(r.created_at).toLocaleDateString()}</span>

        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" />
            {r.download_count}
          </span>

          <span className="inline-flex items-center gap-1">
            <BookMarked className="h-3 w-3" />
            {r.bookmark_count}
          </span>
        </span>
      </div>

      <div className="mt-4 flex gap-2">

  <Button
    asChild
    variant="outline"
    size="sm"
    className="flex-1"
  >
    <Link to="/preview/$resourceId" params={{ resourceId: r.id }}>
      <Eye className="mr-1.5 h-3.5 w-3.5" />
      Preview
    </Link>
  </Button>

  <Button
    onClick={download}
    className="flex-1 bg-gradient-emerald text-primary-foreground"
    size="sm"
  >
    <Download className="mr-1.5 h-3.5 w-3.5" />
    Download
  </Button>

  <Button
    onClick={() => toggleBookmark.mutate()}
    variant={bookmarked ? "default" : "outline"}
    size="sm"
    aria-label="Bookmark"
  >
    <BookMarked className="h-3.5 w-3.5" />
  </Button>

</div>
    </article>

    <UpgradeDialog
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
    />
  </>
);
}