import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute(
  "/_authenticated/admin/announcements",
)({
  head: () => ({
    meta: [
      { title: "Announcements | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnnouncementsPage,
});

type Announcement = {
  id: string;
  title: string;
  body: string;
  content: string | null;
  link: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  creator?: {
    full_name: string;
    email: string;
  } | null;
  updater?: {
    full_name: string;
    email: string;
  } | null;
  deleter?: {
    full_name: string;
    email: string;
  } | null;
};

function AnnouncementsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");

  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);

  const [pendingDelete, setPendingDelete] =
    useState<Announcement | null>(null);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data: announcements, error } = await supabase
        .from("announcements")
        .select(
        "id, title, body, content, link, is_active, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (!announcements?.length) {
        return [];
      }

      const profileIds = [
        ...new Set(
          announcements
            .flatMap((announcement) => [
              announcement.created_by,
              announcement.updated_by,
              announcement.deleted_by,
            ])
            .filter(
              (id): id is string => Boolean(id),
            ),
        ),
      ];

      if (!profileIds.length) {
        return announcements;
      }

      const { data: profiles, error: profilesError } =
        await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      return announcements.map((announcement) => ({
        ...announcement,
        creator: announcement.created_by
          ? profileMap.get(announcement.created_by) ?? null
          : null,
        updater: announcement.updated_by
          ? profileMap.get(announcement.updated_by) ?? null
          : null,
        deleter: announcement.deleted_by
          ? profileMap.get(announcement.deleted_by) ?? null
          : null,
      }));
    },
  });

  const saveAnnouncement = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error(
          "You must be signed in to manage announcements.",
        );
      }

      const trimmedTitle = title.trim();
      const trimmedBody = body.trim();
      const trimmedContent = content.trim();
      const trimmedLink = link.trim() || null;

      if (!trimmedTitle) {
        throw new Error("Announcement title is required.");
      }

      if (!trimmedBody) {
        throw new Error("Announcement message is required.");
      }
      if (!trimmedContent) {
        throw new Error("Announcement content is required.");
      }

      if (editingAnnouncement) {
        const { error } = await supabase
          .from("announcements")
          .update({
            title: trimmedTitle,
            body: trimmedBody,
            content: trimmedContent,
            link: trimmedLink,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("id", editingAnnouncement.id)
          .is("deleted_at", null);

        if (error) {
          throw error;
        }

        return "updated";
      }

      /*
       * Keep only one active Dashboard announcement.
       *
       * Existing announcements remain stored for history.
       */
      const { error: deactivateError } = await supabase
        .from("announcements")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("is_active", true)
        .is("deleted_at", null);

      if (deactivateError) {
        throw deactivateError;
      }

      const { error } = await supabase
        .from("announcements")
        .insert({
          title: trimmedTitle,
          body: trimmedBody,
          content: trimmedContent,
          link: trimmedLink,
          is_active: true,
          created_by: user.id,
          updated_by: user.id,
        });

      if (error) {
        throw error;
      }

      return "created";
    },

    onSuccess: (result) => {
      toast.success(
        result === "created"
          ? "Announcement published successfully."
          : "Announcement updated successfully.",
      );

      setTitle("");
      setBody("");
      setContent("");
      setLink("");
      setEditingAnnouncement(null);

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleAnnouncement = useMutation({
    mutationFn: async (announcement: Announcement) => {
      if (!user) {
        throw new Error(
          "You must be signed in to manage announcements.",
        );
      }

      if (announcement.deleted_at) {
        throw new Error(
          "Deleted announcements cannot be activated or deactivated.",
        );
      }

      if (!announcement.is_active) {
        const { error: deactivateError } = await supabase
          .from("announcements")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("is_active", true)
          .is("deleted_at", null);

        if (deactivateError) {
          throw deactivateError;
        }
      }

      const { error } = await supabase
        .from("announcements")
        .update({
          is_active: !announcement.is_active,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("id", announcement.id)
        .is("deleted_at", null);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      toast.success("Announcement status updated.");

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (announcement: Announcement) => {
      if (!user) {
        throw new Error(
          "You must be signed in to manage announcements.",
        );
      }

      if (announcement.deleted_at) {
        throw new Error(
          "This announcement has already been deleted.",
        );
      }

      const { error } = await supabase
        .from("announcements")
        .update({
          is_active: false,
          deleted_by: user.id,
          deleted_at: new Date().toISOString(),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", announcement.id)
        .is("deleted_at", null);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      toast.success("Announcement deleted.");

      setPendingDelete(null);

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingDelete(null);
    },
  });

  const startEditing = (announcement: Announcement) => {
    if (announcement.deleted_at) {
      return;
    }

    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setBody(announcement.body);
    setContent(announcement.content ?? announcement.body);
    setLink(announcement.link ?? "");
  };

  const cancelEditing = () => {
    setEditingAnnouncement(null);
    setTitle("");
    setBody("");
    setContent("");
    setLink("");
  };

  const handleSave = () => {
    saveAnnouncement.mutate();
  };

  return (
    <section className="space-y-5">
      {/* Announcement form */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft">
        <div className="mb-5 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />

          <div>
            <p className="text-sm font-semibold">
              {editingAnnouncement
                ? "Edit announcement"
                : "Create announcement"}
            </p>

            <p className="text-xs text-muted-foreground">
              Publish important information to the Dashboard announcement banner.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="announcement-title"
              className="text-sm font-medium"
            >
              Title
            </label>

            <Input
              id="announcement-title"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. New Upload Guidelines"
              disabled={saveAnnouncement.isPending}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="announcement-body"
              className="text-sm font-medium"
              >
              Message / Summary
              </label>

            <textarea
              id="announcement-body"
              value={body}
              onChange={(event) =>
                setBody(event.target.value)
              }
              placeholder="Enter a short summary for the Dashboard announcement banner..."
              rows={4}
              disabled={saveAnnouncement.isPending}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
  <label
    htmlFor="announcement-content"
    className="text-sm font-medium"
  >
    Full Content
  </label>

  <textarea
    id="announcement-content"
    value={content}
    onChange={(event) =>
      setContent(event.target.value)
    }
    placeholder="Enter the complete announcement details..."
    rows={10}
    disabled={saveAnnouncement.isPending}
    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
  />

  <p className="text-xs text-muted-foreground">
    This is the full content users will see when they open the announcement.
  </p>
</div>

          <div className="space-y-2">
            <label
              htmlFor="announcement-link"
              className="text-sm font-medium"
            >
              Link
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </label>

            <Input
              id="announcement-link"
              value={link}
              onChange={(event) =>
                setLink(event.target.value)
              }
              placeholder="e.g. /library"
              disabled={saveAnnouncement.isPending}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveAnnouncement.isPending}
              className="bg-gradient-emerald text-primary-foreground"
            >
              {saveAnnouncement.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}

              {saveAnnouncement.isPending
                ? editingAnnouncement
                  ? "Saving…"
                  : "Publishing…"
                : editingAnnouncement
                  ? "Save changes"
                  : "Publish announcement"}
            </Button>

            {editingAnnouncement && (
              <Button
                type="button"
                variant="outline"
                onClick={cancelEditing}
                disabled={saveAnnouncement.isPending}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Announcement history */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">
            Announcements
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage published and inactive announcements.
          </p>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading announcements…
            </div>
          </div>
        ) : announcements && announcements.length > 0 ? (
          <ul className="divide-y divide-border">
            {announcements.map((announcement) => {
              const isToggling =
                toggleAnnouncement.isPending &&
                toggleAnnouncement.variables?.id ===
                  announcement.id;

              const isDeleting =
                deleteAnnouncement.isPending &&
                deleteAnnouncement.variables?.id ===
                  announcement.id;

              const isDeleted =
                announcement.deleted_at !== null;

              return (
                <li
                  key={announcement.id}
                  className={`p-5 transition-colors ${
                    isDeleted
                      ? "bg-muted/40"
                      : announcement.is_active
                        ? "bg-primary/[0.03]"
                        : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            isDeleted
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : announcement.is_active
                                ? "border-primary/20 bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-muted-foreground"
                          }`}
                        >
                          {isDeleted
                            ? "Deleted"
                            : announcement.is_active
                              ? "Active"
                              : "Inactive"}
                        </span>
                      </div>

                      <h3 className="mt-2 font-medium">
                        {announcement.title}
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {announcement.body}
                      </p>

                      {announcement.link && (
                        <p className="mt-2 text-xs text-primary">
                          Link: {announcement.link}
                        </p>
                      )}

                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">
                            Created by:
                          </span>{" "}
                          {announcement.creator?.full_name ??
                            announcement.creator?.email ??
                            "Unknown user"}
                        </p>

                        {announcement.creator?.full_name &&
                          announcement.creator.email && (
                            <p>
                              <span className="font-medium text-foreground">
                                Email:
                              </span>{" "}
                              {announcement.creator.email}
                            </p>
                          )}

                        <p>
                          <span className="font-medium text-foreground">
                            Created:
                          </span>{" "}
                          {new Date(
                            announcement.created_at,
                          ).toLocaleString()}
                        </p>

                        <p>
                          <span className="font-medium text-foreground">
                            Updated by:
                          </span>{" "}
                          {announcement.updater?.full_name ??
                            announcement.updater?.email ??
                            "Unknown user"}
                        </p>

                        <p>
                          <span className="font-medium text-foreground">
                            Updated:
                          </span>{" "}
                          {new Date(
                            announcement.updated_at,
                          ).toLocaleString()}
                        </p>

                        {isDeleted && (
                          <>
                            <p>
                              <span className="font-medium text-foreground">
                                Deleted by:
                              </span>{" "}
                              {announcement.deleter?.full_name ??
                                announcement.deleter?.email ??
                                "Unknown user"}
                            </p>

                            <p>
                              <span className="font-medium text-foreground">
                                Deleted:
                              </span>{" "}
                              {announcement.deleted_at
                                ? new Date(
                                    announcement.deleted_at,
                                  ).toLocaleString()
                                : "Unknown"}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {!isDeleted && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              isToggling ||
                              deleteAnnouncement.isPending
                            }
                            onClick={() =>
                              toggleAnnouncement.mutate(
                                announcement,
                              )
                            }
                          >
                            {isToggling ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : announcement.is_active ? (
                              <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                            ) : (
                              <Power className="mr-1.5 h-3.5 w-3.5" />
                            )}

                            {announcement.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              toggleAnnouncement.isPending ||
                              deleteAnnouncement.isPending
                            }
                            onClick={() =>
                              startEditing(announcement)
                            }
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              toggleAnnouncement.isPending ||
                              deleteAnnouncement.isPending
                            }
                            onClick={() =>
                              setPendingDelete(announcement)
                            }
                            className="text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                          >
                            {isDeleting ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            )}

                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No announcements have been created yet.
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAnnouncement.isPending) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete announcement?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{pendingDelete?.title}</strong>? This
              announcement will be removed from active
              announcements but retained in the admin history.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteAnnouncement.isPending}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();

                if (pendingDelete) {
                  deleteAnnouncement.mutate(
                    pendingDelete,
                  );
                }
              }}
              disabled={deleteAnnouncement.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAnnouncement.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              Delete announcement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}