import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import {
  FolderTree,
  Plus,
  Trash2,
  Loader2,
  Tag,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin/categories")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();

    if (!u.user) {
      throw redirect({
        to: "/auth",
        search: { mode: "login" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_role")
      .eq("id", u.user.id)
      .single();

    if (
  !   profile ||
      !["admin", "co-admin"].includes(profile.primary_role)
    ) {
      throw redirect({
        to: "/admin",
      });
    }
  },

  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedSlug = slug.trim().toLowerCase();

      if (!trimmedName || !trimmedSlug) {
        throw new Error(
          "Category name and slug are required.",
        );
      }

      const { error } = await supabase
        .from("categories")
        .insert({
          name: trimmedName,
          slug: trimmedSlug,
        });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      setName("");
      setSlug("");

      qc.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      toast.success("Category created successfully.");
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      setPendingDelete(null);

      toast.success("Category deleted successfully.");
    },

    onError: (error: Error) => {
      setPendingDelete(null);
      toast.error(error.message);
    },
  });

  const handleDelete = (
    id: string,
    categoryName: string,
  ) => {
    setPendingDelete({
      id,
      name: categoryName,
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }

    del.mutate(pendingDelete.id);
  };

  const deleteLoading = del.isPending;

  return (
    <>
      <section className="space-y-6">
        {/* Create category */}
        <div className="border-b border-border pb-6">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />

            <div>
              <p className="text-sm font-semibold">
                Create category
              </p>

              <p className="text-xs text-muted-foreground">
                Add a new classification for library resources.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <div>
              <label
                htmlFor="category-name"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Category name
              </label>

              <Input
                id="category-name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="e.g. Journals"
                disabled={add.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="category-slug"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Slug
              </label>

              <Input
                id="category-slug"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value)
                }
                placeholder="e.g. journals"
                disabled={add.isPending}
              />
            </div>

            <Button
              type="submit"
              disabled={add.isPending}
              className="self-end bg-gradient-emerald text-primary-foreground"
            >
              {add.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}

              {add.isPending
                ? "Creating…"
                : "Create category"}
            </Button>
          </form>
        </div>

        {/* Category list */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />

              <p className="text-sm font-semibold">
                Existing categories
              </p>
            </div>

            {data && data.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {data.length} total
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="border-y border-border py-10 text-center text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading categories…
              </div>
            </div>
          ) : data && data.length > 0 ? (
            <div className="border-y border-border">
              <ul className="divide-y divide-border">
                {data.map((category, index) => {
                  const isDeleting =
                    del.isPending &&
                    del.variables === category.id;

                  return (
                    <li
                      key={category.id}
                      className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                          {String(index + 1).padStart(
                            2,
                            "0",
                          )}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {category.name}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Tag className="h-3 w-3" />

                            <span>
                              /{category.slug}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={del.isPending}
                        onClick={() =>
                          handleDelete(
                            category.id,
                            category.name,
                          )
                        }
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${category.name}`}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="border-y border-border py-12 text-center">
              <FolderTree className="mx-auto h-8 w-8 text-muted-foreground/50" />

              <p className="mt-3 text-sm font-medium">
                No categories yet
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Create your first category above to organize resources.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete category?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {pendingDelete?.name}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteLoading}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {deleteLoading
                ? "Deleting…"
                : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}