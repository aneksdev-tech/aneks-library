import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit3,
  Filter,
  Loader2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState, StatusPill } from "./dashboard";

export const Route = createFileRoute(
  "/_authenticated/my-uploads",
)({
  head: () => ({
    meta: [
      {
        title: "My Uploads | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: MyUploads,
});

type SortOption = "newest" | "oldest" | "status";

type StatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "deleted"
  | "draft";

const STATUS_ORDER: Record<string, number> = {
  pending: 1,
  approved: 2,
  rejected: 3,
  deleted: 4,
  draft: 5,
};

function MyUploads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [sortBy, setSortBy] =
    useState<SortOption>("newest");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [pendingDelete, setPendingDelete] =
    useState<{
      id: string;
      title: string;
    } | null>(null);

  const [deletingDraftId, setDeletingDraftId] =
    useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-uploads", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("resources")
          .select(
            "id, title, status, download_count, created_at, category:categories(name)",
          )
          .eq("uploader_id", user!.id)
          .order("created_at", {
            ascending: false,
          })
      ).data ?? [],
  });

  const filteredAndSortedData = useMemo(() => {
    if (!data) {
      return [];
    }

    const filteredData =
      statusFilter === "all"
        ? [...data]
        : data.filter(
            (resource) =>
              resource.status === statusFilter,
          );

    return filteredData.sort((a, b) => {
      if (sortBy === "oldest") {
        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      }

      if (sortBy === "status") {
        const statusDifference =
          (STATUS_ORDER[a.status] ?? 99) -
          (STATUS_ORDER[b.status] ?? 99);

        if (statusDifference !== 0) {
          return statusDifference;
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
  }, [data, sortBy, statusFilter]);

  const handleDeleteDraft = async () => {
    if (!user || !pendingDelete) {
      return;
    }

    const draftId = pendingDelete.id;

    setDeletingDraftId(draftId);

    try {
      const { data: draft, error: draftError } =
        await supabase
          .from("resources")
          .select("id, file_path")
          .eq("id", draftId)
          .eq("uploader_id", user.id)
          .eq("status", "draft")
          .maybeSingle();

      if (draftError) {
        throw draftError;
      }

      if (!draft) {
        throw new Error("Draft not found.");
      }

      if (draft.file_path) {
        const { error: storageError } =
          await supabase.storage
            .from("resources")
            .remove([draft.file_path]);

        if (storageError) {
          throw storageError;
        }
      }

      const { error: deleteError } =
        await supabase
          .from("resources")
          .delete()
          .eq("id", draftId)
          .eq("uploader_id", user.id)
          .eq("status", "draft");

      if (deleteError) {
        throw deleteError;
      }

      await queryClient.invalidateQueries({
        queryKey: ["my-uploads", user.id],
      });

      toast.success("Draft deleted successfully.");
      setPendingDelete(null);
    } catch (error) {
      console.error(
        "Failed to delete draft:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete draft.",
      );
    } finally {
      setDeletingDraftId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">
          My uploads
        </p>

        <h1 className="mt-1 font-display text-3xl font-semibold">
          Manage your contributions
        </h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />

          <p className="text-sm font-semibold">
            Find uploads
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <label
              htmlFor="upload-status"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Status
            </label>

            <select
              id="upload-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter,
                )
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-label="Filter uploads by status"
            >
              <option value="all">
                All statuses
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="approved">
                Approved
              </option>

              <option value="rejected">
                Rejected
              </option>

              <option value="deleted">
                Deleted
              </option>

              <option value="draft">
                Draft
              </option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="upload-sort"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Sort by
            </label>

            <select
              id="upload-sort"
              value={sortBy}
              onChange={(event) =>
                setSortBy(
                  event.target.value as SortOption,
                )
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-label="Sort uploads"
            >
              <option value="newest">
                Newest first
              </option>

              <option value="oldest">
                Oldest first
              </option>

              <option value="status">
                Status
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : filteredAndSortedData.length ? (
          <ul className="divide-y divide-border">
            {filteredAndSortedData.map((resource) => (
              <li
                key={resource.id}
                className="p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <StatusPill
                      status={
                        resource.status as string
                      }
                    />

                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {resource.title}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {(resource as {
                          category?: {
                            name?: string;
                          };
                        }).category?.name ??
                          "Uncategorized"}{" "}
                        · {resource.download_count} downloads
                        {" · "}
                        {new Date(
                          resource.created_at,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {resource.status === "draft" && (
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      <Link
                        to="/upload/$draftId"
                        params={{
                          draftId: resource.id,
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit draft
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            id: resource.id,
                            title: resource.title,
                          })
                        }
                        disabled={
                          deletingDraftId ===
                          resource.id
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingDraftId ===
                        resource.id
                          ? "Deleting…"
                          : "Delete draft"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No uploads found"
            desc="There are no uploads matching the selected status."
          />
        )}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingDraftId) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete draft?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Delete{" "}
              <strong>
                {pendingDelete?.title}
              </strong>
              ? This will permanently remove the
              draft and its attached file. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingDraftId !== null}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteDraft();
              }}
              disabled={deletingDraftId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDraftId !== null && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}