import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
  History,
  ChevronDown,
  ChevronUp,
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

type AnnouncementProfile = {
  full_name: string | null;
  email: string | null;
};

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
  deletion_reason: string | null;
  creator?: AnnouncementProfile | null;
  updater?: AnnouncementProfile | null;
  deleter?: AnnouncementProfile | null;
};

type AnnouncementAudit = {
  id: string;
  announcement_id: string;
  performed_by: string;
  action: string;
  reason: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
  performer?: AnnouncementProfile | null;
};

type PendingToggle = {
  announcement: Announcement;
  nextIsActive: boolean;
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

  const [editSummary, setEditSummary] = useState("");
  const [pendingEditSave, setPendingEditSave] =
    useState<boolean>(false);

  const [pendingToggle, setPendingToggle] =
    useState<PendingToggle | null>(null);

  const [toggleReason, setToggleReason] = useState("");
  const toggleReasonRef =
    useRef<HTMLTextAreaElement | null>(null);

  const [pendingDelete, setPendingDelete] =
    useState<Announcement | null>(null);

  const [deleteReason, setDeleteReason] = useState("");

  const [expandedHistoryIds, setExpandedHistoryIds] =
    useState<Set<string>>(new Set());

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data: announcements, error } = await supabase
        .from("announcements")
        .select(
          "id, title, body, content, link, is_active, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at, deletion_reason",
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

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("private_profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map<
        string,
        AnnouncementProfile
      >(
        (profiles ?? [])
          .filter(
            (
              profile,
            ): profile is typeof profile & {
              id: string;
            } => profile.id !== null,
          )
          .map((profile) => [
            profile.id,
            {
              full_name: profile.full_name,
              email: profile.email,
            },
          ]),
      );

      return announcements.map(
        (announcement): Announcement => ({
          ...announcement,
          creator: announcement.created_by
            ? profileMap.get(
                announcement.created_by,
              ) ?? null
            : null,
          updater: announcement.updated_by
            ? profileMap.get(
                announcement.updated_by,
              ) ?? null
            : null,
          deleter: announcement.deleted_by
            ? profileMap.get(
                announcement.deleted_by,
              ) ?? null
            : null,
        }),
      );
    },
  });

  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
  } = useQuery({
    queryKey: ["admin-announcement-audits"],
    queryFn: async (): Promise<AnnouncementAudit[]> => {
      const { data: audits, error } = await supabase
        .from("announcement_audit_logs")
        .select(
          "id, announcement_id, performed_by, action, reason, old_data, new_data, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (!audits?.length) {
        return [];
      }

      const performerIds = [
        ...new Set(
          audits
            .map((audit) => audit.performed_by)
            .filter(
              (id): id is string => Boolean(id),
            ),
        ),
      ];

      if (!performerIds.length) {
        return audits;
      }

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("private_profiles")
        .select("id, full_name, email")
        .in("id", performerIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map<
        string,
        AnnouncementProfile
      >(
        (profiles ?? [])
          .filter(
            (
              profile,
            ): profile is typeof profile & {
              id: string;
            } => profile.id !== null,
          )
          .map((profile) => [
            profile.id,
            {
              full_name: profile.full_name,
              email: profile.email,
            },
          ]),
      );

      return audits.map(
        (audit): AnnouncementAudit => ({
          ...audit,
          performer:
            profileMap.get(audit.performed_by) ??
            null,
        }),
      );
    },
  });

  const getAnnouncementHistory = (
    announcementId: string,
  ) =>
    auditLogs.filter(
      (audit) =>
        audit.announcement_id === announcementId,
    );

  const getLatestAudit = (
    announcementId: string,
  ) => {
    const history = getAnnouncementHistory(
      announcementId,
    );

    return history[0] ?? null;
  };

  const toggleHistory = (announcementId: string) => {
    setExpandedHistoryIds((current) => {
      const next = new Set(current);

      if (next.has(announcementId)) {
        next.delete(announcementId);
      } else {
        next.add(announcementId);
      }

      return next;
    });
  };

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
        throw new Error(
          "Announcement title is required.",
        );
      }

      if (!trimmedBody) {
        throw new Error(
          "Announcement message is required.",
        );
      }

      if (!trimmedContent) {
        throw new Error(
          "Announcement content is required.",
        );
      }

      if (editingAnnouncement) {
        const { data, error } = await supabase.rpc(
          "admin_edit_announcement",
          {
            _announcement_id:
              editingAnnouncement.id,
            _title: trimmedTitle,
            _body: trimmedBody,
            _content: trimmedContent,
            _link: trimmedLink || undefined,
            _edit_summary:
              editSummary.trim() || undefined,
          },
        );

        if (error) {
          throw error;
        }

        const result = data as {
          id?: string;
          changed?: boolean;
        } | null;

        if (!result?.id) {
          throw new Error(
            "The announcement could not be updated.",
          );
        }

        return result.changed
          ? "updated"
          : "unchanged";
      }

      const { data, error } = await supabase.rpc(
        "admin_create_announcement",
        {
          _title: trimmedTitle,
          _body: trimmedBody,
          _content: trimmedContent,
          _link: trimmedLink || undefined,
        },
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "The announcement could not be published.",
        );
      }

      return "created";
    },

    onSuccess: (result) => {
      if (result === "unchanged") {
        toast.info("No changes were made.");
      } else {
        toast.success(
          result === "created"
            ? "Announcement published successfully."
            : "Announcement updated successfully.",
        );
      }

      setTitle("");
      setBody("");
      setContent("");
      setLink("");
      setEditSummary("");
      setEditingAnnouncement(null);
      setPendingEditSave(false);

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-announcement-audits"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleAnnouncement = useMutation({
    mutationFn: async ({
      announcement,
      reason,
    }: {
      announcement: Announcement;
      reason: string;
    }) => {
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

      const trimmedReason = reason.trim();

      if (!trimmedReason) {
        throw new Error(
          announcement.is_active
            ? "A deactivation reason is required."
            : "An activation reason is required.",
        );
      }

      const { data, error } = await supabase.rpc(
        "admin_toggle_announcement",
        {
          _announcement_id: announcement.id,
          _is_active: !announcement.is_active,
          _reason: trimmedReason,
        },
      );

      if (error) {
        throw error;
      }

      const result = data as {
        id?: string;
        changed?: boolean;
      } | null;

      if (!result?.id) {
        throw new Error(
          "The announcement status could not be updated.",
        );
      }

      return result.changed ?? false;
    },

    onSuccess: (changed, variables) => {
      toast.success(
        changed
          ? variables.announcement.is_active
            ? "Announcement deactivated successfully."
            : "Announcement activated successfully."
          : "No changes were made.",
      );

      setPendingToggle(null);
      setToggleReason("");

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-announcement-audits"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async ({
      announcement,
      reason,
    }: {
      announcement: Announcement;
      reason: string;
    }) => {
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

      const trimmedReason = reason.trim();

      if (!trimmedReason) {
        throw new Error(
          "A deletion reason is required.",
        );
      }

      const { data, error } = await supabase.rpc(
        "admin_delete_announcement",
        {
          _announcement_id: announcement.id,
          _deletion_reason: trimmedReason,
        },
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "The announcement could not be deleted.",
        );
      }
    },

    onSuccess: () => {
      toast.success("Announcement deleted.");

      setPendingDelete(null);
      setDeleteReason("");

      qc.invalidateQueries({
        queryKey: ["admin-announcements"],
      });

      qc.invalidateQueries({
        queryKey: ["active-announcement"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-announcement-audits"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const startEditing = (
    announcement: Announcement,
  ) => {
    if (announcement.deleted_at) {
      return;
    }

    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setBody(announcement.body);
    setContent(announcement.content ?? "");
    setLink(announcement.link ?? "");
    setEditSummary("");
    setPendingEditSave(false);
  };

  const cancelEditing = () => {
    if (saveAnnouncement.isPending) {
      return;
    }

    setEditingAnnouncement(null);
    setTitle("");
    setBody("");
    setContent("");
    setLink("");
    setEditSummary("");
    setPendingEditSave(false);
  };

  const hasActualChanges = () => {
    if (!editingAnnouncement) {
      return true;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedContent = content.trim();
    const trimmedLink = link.trim() || null;

    return (
      trimmedTitle !== editingAnnouncement.title ||
      trimmedBody !== editingAnnouncement.body ||
      trimmedContent !==
        (editingAnnouncement.content ?? "") ||
      trimmedLink !== editingAnnouncement.link
    );
  };

  const handleSave = () => {
    if (!editingAnnouncement) {
      saveAnnouncement.mutate();
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      toast.error("Announcement title is required.");
      return;
    }

    if (!trimmedBody) {
      toast.error(
        "Announcement message is required.",
      );
      return;
    }

    if (!trimmedContent) {
      toast.error(
        "Announcement content is required.",
      );
      return;
    }

    setPendingEditSave(true);
  };

  const closeEditConfirmation = () => {
    if (saveAnnouncement.isPending) {
      return;
    }

    setPendingEditSave(false);
  };

  const confirmEditSave = () => {
    if (!editingAnnouncement) {
      return;
    }

    if (!hasActualChanges()) {
      setPendingEditSave(false);
      toast.info("No changes were made.");
      return;
    }

    if (!editSummary.trim()) {
      toast.error("An edit summary is required.");
      return;
    }

    saveAnnouncement.mutate();
  };

  const openToggleDialog = (
    announcement: Announcement,
  ) => {
    if (announcement.deleted_at) {
      return;
    }

    setPendingToggle({
      announcement,
      nextIsActive: !announcement.is_active,
    });

    setToggleReason("");
  };

  const closeToggleDialog = () => {
    if (toggleAnnouncement.isPending) {
      return;
    }

    setPendingToggle(null);
    setToggleReason("");
  };

  const handleToggle = () => {
    if (!pendingToggle) {
      return;
    }

    const reason =
      toggleReasonRef.current?.value.trim() ??
      toggleReason.trim();

    if (!reason) {
      toast.error(
        pendingToggle.nextIsActive
          ? "Please provide an activation reason."
          : "Please provide a deactivation reason.",
      );
      return;
    }

    toggleAnnouncement.mutate({
      announcement: pendingToggle.announcement,
      reason,
    });
  };

  const openDeleteDialog = (
    announcement: Announcement,
  ) => {
    setPendingDelete(announcement);
    setDeleteReason("");
  };

  const closeDeleteDialog = () => {
    if (deleteAnnouncement.isPending) {
      return;
    }

    setPendingDelete(null);
    setDeleteReason("");
  };

  const handleDelete = () => {
    if (!pendingDelete) {
      return;
    }

    const trimmedReason = deleteReason.trim();

    if (!trimmedReason) {
      toast.error(
        "Please provide a reason for deleting this announcement.",
      );
      return;
    }

    deleteAnnouncement.mutate({
      announcement: pendingDelete,
      reason: trimmedReason,
    });
  };

  const getAuditActionLabel = (action: string) => {
    switch (action) {
      case "create":
        return "Created";
      case "edit":
        return "Edited";
      case "activate":
        return "Activated";
      case "deactivate":
        return "Deactivated";
      case "delete":
        return "Deleted";
      default:
        return action;
    }
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
        ) : announcements &&
          announcements.length > 0 ? (
          <ul className="divide-y divide-border">
            {announcements.map((announcement) => {
              const isToggling =
                toggleAnnouncement.isPending &&
                toggleAnnouncement.variables?.announcement
                  .id === announcement.id;

              const isDeleting =
                deleteAnnouncement.isPending &&
                deleteAnnouncement.variables?.announcement
                  .id === announcement.id;

              const isDeleted =
                announcement.deleted_at !== null;

              const history =
                getAnnouncementHistory(announcement.id);

              const latestAudit =
                getLatestAudit(announcement.id);

              const isHistoryExpanded =
                expandedHistoryIds.has(
                  announcement.id,
                );

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
                          {announcement.creator
                            ?.full_name ??
                            announcement.creator?.email ??
                            "Unknown user"}
                        </p>

                        {announcement.creator
                          ?.full_name &&
                          announcement.creator.email && (
                            <p>
                              <span className="font-medium text-foreground">
                                Email:
                              </span>{" "}
                              {
                                announcement.creator
                                  .email
                              }
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

                        {!isDeleted &&
                          latestAudit?.action ===
                            "activate" && (
                            <>
                              <p>
                                <span className="font-medium text-foreground">
                                  Activated by:
                                </span>{" "}
                                {latestAudit.performer
                                  ?.full_name ??
                                  latestAudit.performer
                                    ?.email ??
                                  "Unknown user"}
                              </p>

                              <p>
                                <span className="font-medium text-foreground">
                                  Activated:
                                </span>{" "}
                                {new Date(
                                  latestAudit.created_at,
                                ).toLocaleString()}
                              </p>
                            </>
                          )}

                        {!isDeleted &&
                          latestAudit?.action ===
                            "deactivate" && (
                            <>
                              <p>
                                <span className="font-medium text-foreground">
                                  Deactivated by:
                                </span>{" "}
                                {latestAudit.performer
                                  ?.full_name ??
                                  latestAudit.performer
                                    ?.email ??
                                  "Unknown user"}
                              </p>

                              <p>
                                <span className="font-medium text-foreground">
                                  Deactivated:
                                </span>{" "}
                                {new Date(
                                  latestAudit.created_at,
                                ).toLocaleString()}
                              </p>
                            </>
                          )}

                        {!isDeleted &&
                          latestAudit?.action ===
                            "edit" && (
                            <>
                              <p>
                                <span className="font-medium text-foreground">
                                  Updated by:
                                </span>{" "}
                                {announcement.updater
                                  ?.full_name ??
                                  announcement.updater
                                    ?.email ??
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
                            </>
                          )}

                        {isDeleted && (
                          <>
                            <p>
                              <span className="font-medium text-foreground">
                                Deleted by:
                              </span>{" "}
                              {announcement.deleter
                                ?.full_name ??
                                announcement.deleter
                                  ?.email ??
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

                            {announcement.deletion_reason && (
                              <p className="pt-1">
                                <span className="font-medium text-foreground">
                                  Deletion reason:
                                </span>{" "}
                                {
                                  announcement.deletion_reason
                                }
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {/* Audit history */}
                      {history.length > 0 && (
                        <div className="mt-4 border-t border-border pt-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleHistory(
                                announcement.id,
                              )
                            }
                            className="h-8 px-2 text-xs"
                          >
                            <History className="mr-1.5 h-3.5 w-3.5" />

                            {isHistoryExpanded
                              ? "Hide history"
                              : `History (${history.length})`}

                            {isHistoryExpanded ? (
                              <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                            )}
                          </Button>

                          {isHistoryExpanded && (
                            <div className="mt-3 space-y-3 border-l border-border pl-3">
                              {isAuditLoading ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Loading history…
                                </div>
                              ) : (
                                history.map((audit) => (
                                  <div
                                    key={audit.id}
                                    className="space-y-1 text-xs"
                                  >
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="font-semibold text-foreground">
                                        {getAuditActionLabel(
                                          audit.action,
                                        )}
                                      </span>

                                      <span className="text-muted-foreground">
                                        {new Date(
                                          audit.created_at,
                                        ).toLocaleString()}
                                      </span>
                                    </div>

                                    <p className="text-muted-foreground">
                                      <span className="font-medium text-foreground">
                                        By:
                                      </span>{" "}
                                      {audit.performer
                                        ?.full_name ??
                                        audit.performer
                                          ?.email ??
                                        "Unknown user"}
                                    </p>

                                    {audit.reason && (
                                      <p className="text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                          {audit.action ===
                                          "edit"
                                            ? "Summary:"
                                            : "Reason:"}
                                        </span>{" "}
                                        {audit.reason}
                                      </p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
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
                              toggleAnnouncement.isPending ||
                              deleteAnnouncement.isPending ||
                              saveAnnouncement.isPending
                            }
                            onClick={() =>
                              openToggleDialog(
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
                              deleteAnnouncement.isPending ||
                              saveAnnouncement.isPending
                            }
                            onClick={() =>
                              startEditing(
                                announcement,
                              )
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
                              deleteAnnouncement.isPending ||
                              saveAnnouncement.isPending
                            }
                            onClick={() =>
                              openDeleteDialog(
                                announcement,
                              )
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

      {/* Edit confirmation */}
      <AlertDialog
        open={pendingEditSave}
        onOpenChange={(open) => {
          if (!open && !saveAnnouncement.isPending) {
            closeEditConfirmation();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasActualChanges()
                ? "Save announcement changes?"
                : "No changes were made"}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {hasActualChanges()
                ? `You are about to update "${editingAnnouncement?.title}". Please provide a brief summary of what was changed.`
                : "The announcement is unchanged from its original values. No database update or audit entry will be created."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {hasActualChanges() && (
            <div className="space-y-2">
              <label
                htmlFor="announcement-edit-summary"
                className="text-sm font-medium"
              >
                Edit Summary
                <span className="ml-1 text-destructive">
                  *
                </span>
              </label>

              <textarea
                id="announcement-edit-summary"
                value={editSummary}
                onChange={(event) =>
                  setEditSummary(event.target.value)
                }
                placeholder="e.g. Updated the deadline and added the submission link..."
                rows={4}
                disabled={saveAnnouncement.isPending}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

              <p className="text-xs text-muted-foreground">
                This summary will be permanently retained
                in the announcement edit history.
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saveAnnouncement.isPending}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();

                if (!hasActualChanges()) {
                  setPendingEditSave(false);
                  return;
                }

                confirmEditSave();
              }}
              disabled={
                saveAnnouncement.isPending ||
                (hasActualChanges() &&
                  !editSummary.trim())
              }
            >
              {saveAnnouncement.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {hasActualChanges()
                ? "Save changes"
                : "Close"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activation / deactivation confirmation */}
      {pendingToggle && (
        <AlertDialog
          open={true}
          onOpenChange={(open) => {
            if (
              !open &&
              !toggleAnnouncement.isPending
            ) {
              closeToggleDialog();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingToggle.nextIsActive
                  ? "Activate announcement?"
                  : "Deactivate announcement?"}
              </AlertDialogTitle>

              <AlertDialogDescription>
                {pendingToggle.nextIsActive
                  ? `You are about to activate "${pendingToggle.announcement.title}". If another announcement is currently active, it will be automatically deactivated.`
                  : `You are about to deactivate "${pendingToggle.announcement.title}". This action will be recorded in the announcement audit history.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <label
                htmlFor="announcement-toggle-reason"
                className="text-sm font-medium"
              >
                {pendingToggle.nextIsActive
                  ? "Activation reason"
                  : "Deactivation reason"}
                <span className="ml-1 text-destructive">
                  *
                </span>
              </label>

              <textarea
                ref={toggleReasonRef}
                id="announcement-toggle-reason"
                value={toggleReason}
                onChange={(event) => {
                  setToggleReason(
                    event.target.value,
                  );
                }}
                placeholder={
                  pendingToggle.nextIsActive
                    ? "Enter the reason for activating this announcement..."
                    : "Enter the reason for deactivating this announcement..."
                }
                rows={4}
                disabled={toggleAnnouncement.isPending}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

              <p className="text-xs text-muted-foreground">
                This reason will be permanently retained
                in the announcement audit history.
              </p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={toggleAnnouncement.isPending}
              >
                Cancel
              </AlertDialogCancel>

              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  handleToggle();
                }}
                disabled={
                  toggleAnnouncement.isPending ||
                  !toggleReason.trim()
                }
              >
                {toggleAnnouncement.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}

                {pendingToggle.nextIsActive
                  ? "Confirm activation"
                  : "Confirm deactivation"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAnnouncement.isPending) {
            closeDeleteDialog();
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
              A deletion reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="announcement-delete-reason"
              className="text-sm font-medium"
            >
              Deletion reason
              <span className="ml-1 text-destructive">
                *
              </span>
            </label>

            <Input
              id="announcement-delete-reason"
              value={deleteReason}
              onChange={(event) =>
                setDeleteReason(event.target.value)
              }
              placeholder="Enter the reason for deleting this announcement..."
              disabled={deleteAnnouncement.isPending}
              required
            />

            <p className="text-xs text-muted-foreground">
              This reason will be permanently retained in the
              announcement history.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteAnnouncement.isPending}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={
                deleteAnnouncement.isPending ||
                !deleteReason.trim()
              }
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