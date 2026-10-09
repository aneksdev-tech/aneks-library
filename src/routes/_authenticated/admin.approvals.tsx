import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { canManageApprovals } from "@/lib/permissions";
import {
  useAuth,
  type AppRole,
} from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./dashboard";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";
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
  "/_authenticated/admin/approvals",
)({
  beforeLoad: async ({ location }) => {
    const { data: auth } =
      await supabase.auth.getUser();

    if (!auth.user) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "login",
          next: location.pathname,
        },
      });
    }

    const {
      data: profile,
      error,
    } = await supabase
      .from("private_profiles")
      .select("primary_role, status")
      .eq("id", auth.user.id)
      .single();

    if (error || !profile) {
      throw redirect({
        to: "/dashboard",
        replace: true,
      });
    }

    if (profile.status !== "active") {
      throw redirect({
        to: "/dashboard",
        replace: true,
      });
    }

    const allowed =
      canManageApprovals([
        profile.primary_role as AppRole,
      ]);

    if (!allowed) {
      throw redirect({
        to: "/admin",
        replace: true,
      });
    }
  },

  head: () => ({
    meta: [
      {
        title: "Approvals | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),

  component: Approvals,
});

type ResourceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deleted"
  | "draft";

type ApprovalSection =
  | "users"
  | "resources";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  course_code: string | null;
  department: string | null;
  level: string | null;
  year: number | null;
  created_at: string;
  status: ResourceStatus;
  uploader_id: string;
  category?: {
    name?: string;
    deleted_at?: string | null;
  } | null;
  uploader?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type PendingDecision =
  | {
      type: "approve";
      id: string;
      file_path: string;
      title: string;
    }
  | {
      type: "reject";
      id: string;
      file_path: string;
      title: string;
    };

type PendingUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: AppRole;
  college: string | null;
  department: string | null;
  level: string | null;
  created_at: string;
  status: string;
};

type PendingUserDecision = {
  type: "approve" | "reject";
  id: string;
  name: string;
  email: string;
};

function Approvals() {
  const {
    user,
    roles,
    profile,
    loading,
  } = useAuth();

  const navigate = useNavigate();
  const qc = useQueryClient();

  const canApproveUsers =
    roles?.includes("admin") ||
    roles?.includes("co-admin");

  const [activeSection, setActiveSection] =
    useState<ApprovalSection>(
      canApproveUsers
        ? "users"
        : "resources",
    );

  useEffect(() => {
    setActiveSection(
      canApproveUsers
        ? "users"
        : "resources",
    );
  }, [canApproveUsers]);

  useEffect(() => {
    if (
      loading ||
      !profile ||
      !user
    ) {
      return;
    }

    const allowed =
      canManageApprovals(
        roles ?? [],
      );

    if (!allowed) {
      toast.error(
        "Your account no longer has permission to access Approvals.",
      );

      navigate({
        to: "/admin",
        replace: true,
      });
    }
  }, [
    loading,
    profile,
    user,
    roles,
    navigate,
  ]);

  const [previewResource, setPreviewResource] =
    useState<{
      id: string;
      title: string;
      file_path: string;
    } | null>(null);

  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);

  const [decisionReason, setDecisionReason] =
    useState("");

  const [pendingUserDecision, setPendingUserDecision] =
    useState<PendingUserDecision | null>(null);

  const [userDecisionReason, setUserDecisionReason] =
    useState("");

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ["pending-resources"],

    queryFn: async () => {
      const {
        data: resources,
        error,
      } = await supabase
        .from("resources")
        .select(
          `
            id,
            title,
            description,
            file_path,
            file_name,
            file_size,
            course_code,
            department,
            level,
            year,
            created_at,
            status,
            uploader_id,
            category:categories(name, deleted_at)
          `,
        )
        .eq(
          "status",
          "pending",
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        );

      if (error) {
        throw error;
      }

      const rows =
        (resources ?? []) as unknown as Resource[];

      const uploaderIds = [
        ...new Set(
          rows
            .map(
              (resource) =>
                resource.uploader_id,
            )
            .filter(Boolean),
        ),
      ];

      if (uploaderIds.length === 0) {
        return rows;
      }

      const {
        data: uploaderProfiles,
        error: uploaderError,
      } = await supabase
        .from("private_profiles")
        .select("id, full_name, email")
        .in("id", uploaderIds);

      if (uploaderError) {
        throw uploaderError;
      }

      const uploaderMap =
        new Map(
          (
            uploaderProfiles ?? []
          ).map((uploader) => [
            uploader.id,
            {
              full_name:
                uploader.full_name,
              email:
                uploader.email,
            },
          ]),
        );

      return rows.map(
        (resource) => ({
          ...resource,
          uploader:
            uploaderMap.get(
              resource.uploader_id,
            ) ?? null,
        }),
      );
    },
  });

  const {
    data: pendingUsers,
    isLoading: pendingUsersLoading,
  } = useQuery({
    queryKey: ["pending-users"],
    enabled: Boolean(canApproveUsers),

    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from("private_profiles")
        .select(
          `
            id,
            full_name,
            email,
            primary_role,
            college,
            department,
            level,
            created_at,
            status
          `,
        )
        .eq("status", "pending")
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return (data ?? []) as PendingUser[];
    },
  });

  const decide = useMutation({
    mutationFn: async (v: {
      id: string;
      file_path: string;
      title: string;
      approve: boolean;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      const normalizedReason =
        v.reason.trim();

      if (!normalizedReason) {
        throw new Error(
          v.approve
            ? "An approval reason is required."
            : "A rejection reason is required.",
        );
      }

      if (v.approve) {
        const {
          data,
          error,
        } = await supabase.rpc(
          "approve_resource",
          {
            _resource_id: v.id,
            _approval_reason: normalizedReason,
          },
        );

        if (error) {
          throw error;
        }

        if (data !== true) {
          throw new Error(
            "Resource approval was not completed.",
          );
        }

        return;
      }

      const {
        data: removedFiles,
        error: storageError,
      } = await supabase.storage
        .from("resources")
        .remove([v.file_path]);

      if (storageError) {
        throw new Error(
          `Could not remove the uploaded file: ${storageError.message}`,
        );
      }

      if (
        !removedFiles ||
        removedFiles.length === 0
      ) {
        throw new Error(
          "The uploaded file could not be removed from Storage.",
        );
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "reject_resource",
        {
          _resource_id: v.id,
          _rejection_reason:
            normalizedReason,
        },
      );

      if (error) {
        throw new Error(
          `The file was removed, but the resource record could not be updated: ${error.message}`,
        );
      }

      if (data !== true) {
        throw new Error(
          "Resource rejection was not completed.",
        );
      }
    },

    onSuccess: (_data, variables) => {
      toast.success(
        variables.approve
          ? "Resource approved successfully."
          : "Resource rejected. The file was removed and the record was retained.",
      );

      setPreviewResource(null);
      setPendingDecision(null);
      setDecisionReason("");

      qc.invalidateQueries({
        queryKey: ["pending-resources"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-resources"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-resource-moderation-audits",
        ],
      });

      qc.invalidateQueries({
        queryKey: ["admin-stats"],
      });

      qc.invalidateQueries({
        queryKey: ["my-uploads"],
      });

      qc.invalidateQueries({
        queryKey: ["notifications"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const decideUser = useMutation({
    mutationFn: async (v: {
      id: string;
      approve: boolean;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      const normalizedReason =
        v.reason.trim();

      if (!normalizedReason) {
        throw new Error(
          "A reason is required for this account status change.",
        );
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "admin_set_user_status",
        {
          _target_user_id: v.id,
          _new_status: v.approve
            ? "active"
            : "rejected",
          _reason: normalizedReason,
        },
      );

      if (error) {
        throw error;
      }

      if (data !== true) {
        throw new Error(
          "The account status change was not completed.",
        );
      }
    },

    onSuccess: (_data, variables) => {
      toast.success(
        variables.approve
          ? "User account approved successfully."
          : "User account rejected successfully.",
      );

      setPendingUserDecision(null);
      setUserDecisionReason("");

      qc.invalidateQueries({
        queryKey: ["pending-users"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-user-audits"],
      });

      qc.invalidateQueries({
        queryKey: ["notifications"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const requestApprove = (
    id: string,
    file_path: string,
    title: string,
  ) => {
    setDecisionReason("");

    setPendingDecision({
      type: "approve",
      id,
      file_path,
      title,
    });
  };

  const requestReject = (
    id: string,
    file_path: string,
    title: string,
  ) => {
    setDecisionReason("");

    setPendingDecision({
      type: "reject",
      id,
      file_path,
      title,
    });
  };

  const requestApproveUser = (
    id: string,
    name: string,
    email: string,
  ) => {
    setUserDecisionReason("");

    setPendingUserDecision({
      type: "approve",
      id,
      name,
      email,
    });
  };

  const requestRejectUser = (
    id: string,
    name: string,
    email: string,
  ) => {
    setUserDecisionReason("");

    setPendingUserDecision({
      type: "reject",
      id,
      name,
      email,
    });
  };

  const confirmDecision = () => {
    if (!pendingDecision) {
      return;
    }

    const reason =
      decisionReason.trim();

    if (!reason) {
      toast.error(
        pendingDecision.type ===
          "approve"
          ? "Please provide an approval reason before approving this resource."
          : "Please provide a rejection reason before rejecting this resource.",
      );
      return;
    }

    decide.mutate({
      id: pendingDecision.id,
      file_path:
        pendingDecision.file_path,
      title: pendingDecision.title,
      approve:
        pendingDecision.type ===
        "approve",
      reason,
    });
  };

  const confirmUserDecision = () => {
    if (!pendingUserDecision) {
      return;
    }

    const reason =
      userDecisionReason.trim();

    if (!reason) {
      toast.error(
        "Please provide a reason before continuing.",
      );
      return;
    }

    decideUser.mutate({
      id: pendingUserDecision.id,
      approve:
        pendingUserDecision.type ===
        "approve",
      reason,
    });
  };

  const decisionLoading =
    decide.isPending;

  const userDecisionLoading =
    decideUser.isPending;

  return (
    <>
      <section className="space-y-5 sm:space-y-6">
        {/* Approval section navigation */}
        <div className="border-b border-border">
          <div
            className="flex items-center gap-4 overflow-x-auto sm:gap-6"
            role="tablist"
            aria-label="Approval sections"
          >
            {canApproveUsers && (
              <button
                type="button"
                role="tab"
                aria-selected={
                  activeSection ===
                  "users"
                }
                onClick={() =>
                  setActiveSection(
                    "users",
                  )
                }
                className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2.5 text-xs font-semibold transition-colors sm:gap-2 sm:pb-3 sm:text-sm ${
                  activeSection ===
                  "users"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                User Accounts

                {pendingUsers &&
                  pendingUsers.length >
                    0 && (
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] leading-none font-semibold text-gold-foreground sm:h-5 sm:w-5 sm:text-[10px]">
                      {
                        pendingUsers.length
                      }
                    </span>
                  )}
              </button>
            )}

            <button
              type="button"
              role="tab"
              aria-selected={
                activeSection ===
                "resources"
              }
              onClick={() =>
                setActiveSection(
                  "resources",
                )
              }
              className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2.5 text-xs font-semibold transition-colors sm:gap-2 sm:pb-3 sm:text-sm ${
                activeSection ===
                "resources"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Resources

              {data &&
                data.length > 0 && (
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] leading-none font-semibold text-gold-foreground sm:h-5 sm:w-5 sm:text-[10px]">
                    {data.length}
                  </span>
                )}
            </button>
          </div>
        </div>

        {/* User Accounts */}
        {activeSection ===
          "users" &&
          canApproveUsers && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft sm:rounded-xl">

              {pendingUsersLoading ? (
                <div className="p-7 text-center text-xs text-muted-foreground sm:p-8 sm:text-sm">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                    Loading pending accounts…
                  </div>
                </div>
              ) : pendingUsers &&
                pendingUsers.length >
                  0 ? (
                <ul className="divide-y divide-border">
                  {pendingUsers.map(
                    (pendingUser) => {
                      const isProcessing =
                        userDecisionLoading &&
                        decideUser.variables
                          ?.id ===
                          pendingUser.id;

                      const displayName =
                        pendingUser.full_name?.trim() ||
                        "Unnamed user";

                      const email =
                        pendingUser.email?.trim() ||
                        "No email available";

                      const detailItems =
                        getPendingUserDetails(
                          pendingUser,
                        );

                      return (
                        <li
                          key={
                            pendingUser.id
                          }
                          className="border-b-2 border-border/70 p-3.5 transition-colors odd:bg-card even:bg-muted/40 hover:bg-muted/50 sm:p-5"
                        >
                          <div className="flex flex-col gap-3.5 sm:gap-4">
                            <div className="flex flex-col gap-3.5 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/20 bg-gold/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gold sm:px-2 sm:text-[10px]">
                                    <Clock3 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    Pending
                                  </span>

                                  <span className="max-w-[180px] truncate rounded-full border border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[220px] sm:px-2 sm:text-[10px]">
                                    {formatRoleLabel(
                                      pendingUser.primary_role,
                                    )}
                                  </span>
                                </div>

                                <div className="mt-1.5 sm:mt-2">
                                  <p className="break-words text-sm font-semibold leading-5 text-foreground sm:text-lg sm:leading-6">
                                    {displayName}
                                  </p>

                                  <p className="mt-0.5 break-all text-xs text-muted-foreground sm:mt-1 sm:text-sm">
                                    {email}
                                  </p>
                                </div>
                              </div>

                              <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex lg:justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    userDecisionLoading
                                  }
                                  onClick={() =>
                                    requestRejectUser(
                                      pendingUser.id,
                                      displayName,
                                      email,
                                    )
                                  }
                                  className="h-9 text-xs text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                                >
                                  {isProcessing &&
                                  pendingUserDecision?.type ===
                                    "reject" ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <X className="mr-1.5 h-3.5 w-3.5" />
                                  )}

                                  Reject
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    userDecisionLoading
                                  }
                                  onClick={() =>
                                    requestApproveUser(
                                      pendingUser.id,
                                      displayName,
                                      email,
                                    )
                                  }
                                  className="h-9 text-xs text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
                                >
                                  {isProcessing &&
                                  pendingUserDecision?.type ===
                                    "approve" ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                  )}

                                  Approve
                                </Button>
                              </div>
                            </div>

                            {detailItems.length >
                              0 && (
                              <div className="grid gap-3 text-[10px] sm:grid-cols-2 sm:gap-4 sm:text-xs xl:grid-cols-4">
                                {detailItems.map(
                                  (item) => (
                                    <AuditItem
                                      key={
                                        item.label
                                      }
                                      label={
                                        item.label
                                      }
                                      value={
                                        item.value
                                      }
                                    />
                                  ),
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:gap-2 sm:text-xs">
                              <AuditItem
                                label="Registered"
                                value="Pending approval"
                                detail={formatDateTime(
                                  pendingUser.created_at,
                                )}
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 lg:hidden sm:gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  userDecisionLoading
                                }
                                onClick={() =>
                                  requestRejectUser(
                                    pendingUser.id,
                                    displayName,
                                    email,
                                  )
                                }
                                className="h-8 px-2 text-[10px] text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-9 sm:px-3 sm:text-xs"
                              >
                                {isProcessing &&
                                pendingUserDecision?.type ===
                                  "reject" ? (
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                                ) : (
                                  <X className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                )}

                                Reject
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  userDecisionLoading
                                }
                                onClick={() =>
                                  requestApproveUser(
                                    pendingUser.id,
                                    displayName,
                                    email,
                                  )
                                }
                                className="h-8 px-2 text-[10px] text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:px-3 sm:text-xs"
                              >
                                {isProcessing &&
                                pendingUserDecision?.type ===
                                  "approve" ? (
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                                ) : (
                                  <Check className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                )}

                                Approve
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    },
                  )}
                </ul>
              ) : (
                <EmptyState
                  title="No pending accounts"
                  desc="All newly registered accounts have been reviewed."
                />
              )}
            </div>
          )}

        {/* Resources */}
        {activeSection ===
          "resources" && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft sm:rounded-xl">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                  Loading review queue…
                </div>
              </div>
            ) : data &&
              data.length >
                0 ? (
              <ul className="divide-y-0">
                {data.map(
                  (resource) => {
                    const isProcessing =
                      decisionLoading &&
                      decide.variables
                        ?.id ===
                        resource.id;

                    const canPreview =
                      resource.file_size >
                        0 &&
                      resource.status ===
                        "pending";

                    const categoryName =
                      resource.category
                        ?.deleted_at ==
                        null &&
                      resource.category?.name?.trim()
                        ? resource.category.name.trim()
                        : "Uncategorized";

                    return (
                      <li
                        key={
                          resource.id
                        }
                        className="group border-b-2 border-border/70 p-3.5 transition-colors sm:p-5 odd:bg-card even:bg-muted/40 hover:bg-muted/50"
                      >
                        <div className="flex flex-col gap-3.5 sm:gap-4">
                          <div className="flex flex-col gap-3.5 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <StatusPill
                                  status={
                                    resource.status
                                  }
                                />

                                <span className="max-w-[180px] truncate rounded-full border border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[220px] sm:px-2 sm:text-[10px]">
                                  {categoryName}
                                </span>
                              </div>

                              <div className="mt-1.5 min-w-0 sm:mt-2">
                                <p className="break-words text-sm font-semibold leading-5 text-foreground sm:text-lg sm:leading-6">
                                  {
                                    resource.title
                                  }
                                </p>

                                {resource.description && (
                                  <p className="mt-2 max-w-4xl line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
                                    {
                                      resource.description
                                    }
                                  </p>
                                )}
                              </div>

                              <div className="mt-1.5 flex flex-col gap-1 text-[10px] text-muted-foreground sm:mt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5 sm:text-xs">
                                <span>
                                  {formatFileSize(
                                    resource.file_size,
                                  )}
                                </span>

                                {resource.course_code && (
                                  <>
                                    <span className="hidden text-border sm:inline">
                                      •
                                    </span>
                                    <span>
                                      {
                                        resource.course_code
                                      }
                                    </span>
                                  </>
                                )}

                                {resource.department && (
                                  <>
                                    <span className="hidden text-border sm:inline">
                                      •
                                    </span>
                                    <span>
                                      {
                                        resource.department
                                      }
                                    </span>
                                  </>
                                )}

                                {resource.level && (
                                  <>
                                    <span className="hidden text-border sm:inline">
                                      •
                                    </span>
                                    <span>
                                      {
                                        resource.level
                                      }
                                    </span>
                                  </>
                                )}

                                {resource.year && (
                                  <>
                                    <span className="hidden text-border sm:inline">
                                      •
                                    </span>
                                    <span>
                                      {
                                        resource.year
                                      }
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex lg:justify-end">
                              {canPreview && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    decisionLoading
                                  }
                                  onClick={() =>
                                    setPreviewResource(
                                      {
                                        id: resource.id,
                                        title:
                                          resource.title,
                                        file_path:
                                          resource.file_path,
                                      },
                                    )
                                  }
                                  className="h-9 text-xs transition-colors"
                                >
                                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                                  Preview
                                </Button>
                              )}

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  decisionLoading
                                }
                                onClick={() =>
                                  requestReject(
                                    resource.id,
                                    resource.file_path,
                                    resource.title,
                                  )
                                }
                                className="h-9 text-xs text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                              >
                                {isProcessing &&
                                !decide
                                  .variables
                                  ?.approve ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="mr-1.5 h-3.5 w-3.5" />
                                )}

                                Reject
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  decisionLoading
                                }
                                onClick={() =>
                                  requestApprove(
                                    resource.id,
                                    resource.file_path,
                                    resource.title,
                                  )
                                }
                                className="h-9 text-xs text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
                              >
                                {isProcessing &&
                                decide
                                  .variables
                                  ?.approve ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="mr-1.5 h-3.5 w-3.5" />
                                )}

                                Approve
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 text-[10px] sm:grid-cols-2 sm:gap-4 sm:text-xs xl:grid-cols-3">
                            <AuditItem
                              label="Uploader"
                              value={
                                resource.uploader
                                  ?.full_name ||
                                resource.uploader
                                  ?.email ||
                                "Unknown"
                              }
                              detail={formatDateTime(
                                resource.created_at,
                              )}
                            />

                            <AuditItem
                              label="Submitted"
                              value="Pending review"
                              detail={formatDateTime(
                                resource.created_at,
                              )}
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 lg:hidden sm:gap-2">
                            {canPreview && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  decisionLoading
                                }
                                onClick={() =>
                                  setPreviewResource(
                                    {
                                      id: resource.id,
                                      title:
                                        resource.title,
                                      file_path:
                                        resource.file_path,
                                    },
                                  )
                                }
                                className="h-8 px-2 text-[10px] transition-colors sm:h-9 sm:px-3 sm:text-xs"
                              >
                                <Eye className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                Preview
                              </Button>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                decisionLoading
                              }
                              onClick={() =>
                                requestReject(
                                  resource.id,
                                  resource.file_path,
                                  resource.title,
                                )
                              }
                              className="h-8 px-2 text-[10px] text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-9 sm:px-3 sm:text-xs"
                            >
                              {isProcessing &&
                              !decide
                                .variables
                                ?.approve ? (
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                              ) : (
                                <X className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              )}

                              Reject
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                decisionLoading
                              }
                              onClick={() =>
                                requestApprove(
                                  resource.id,
                                  resource.file_path,
                                  resource.title,
                                )
                              }
                              className="h-8 px-2 text-[10px] text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:px-3 sm:text-xs"
                            >
                              {isProcessing &&
                              decide
                                .variables
                                ?.approve ? (
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                              ) : (
                                <Check className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              )}

                              Approve
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  },
                )}
              </ul>
            ) : (
              <EmptyState
                title="No pending resources"
                desc="No resources are waiting for review right now."
              />
            )}
          </div>
        )}
      </section>

      {/* Resource decision dialog */}
      <AlertDialog
        open={
          pendingDecision !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !decisionLoading
          ) {
            setPendingDecision(null);
            setDecisionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {pendingDecision?.type ===
              "approve"
                ? "Approve resource?"
                : "Reject resource?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {pendingDecision?.type ===
              "approve" ? (
                <>
                  Are you sure you want to
                  approve{" "}
                  <strong>
                    {
                      pendingDecision.title
                    }
                  </strong>
                  ? The resource will become
                  available in the Library and
                  the uploader will receive a
                  notification.
                </>
              ) : (
                <>
                  Are you sure you want to
                  reject{" "}
                  <strong>
                    {
                      pendingDecision?.title
                    }
                  </strong>
                  ? The uploaded file will be
                  permanently removed, while the
                  resource record will be retained
                  for history.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision && (
            <div className="space-y-2.5 sm:space-y-2">
              <label
                htmlFor="resource-decision-reason"
                className="text-xs font-medium sm:text-sm"
              >
                {pendingDecision.type ===
                "approve"
                  ? "Approval reason"
                  : "Rejection reason"}
              </label>

              <Input
                id="resource-decision-reason"
                value={decisionReason}
                onChange={(event) =>
                  setDecisionReason(
                    event.target.value,
                  )
                }
                placeholder={
                  pendingDecision.type ===
                  "approve"
                    ? "e.g. Content verified and meets Library submission requirements"
                    : "e.g. Incorrect course material or poor-quality scan"
                }
                disabled={
                  decisionLoading
                }
                required
                aria-required="true"
                className="h-9 text-xs sm:h-10 sm:text-sm"
              />

              <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                A{" "}
                {pendingDecision.type ===
                "approve"
                  ? "reason for approval"
                  : "reason for rejection"}{" "}
                is required before continuing.
              </p>
            </div>
          )}

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={decisionLoading}
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDecision();
              }}
              disabled={
                decisionLoading ||
                !decisionReason.trim()
              }
              className={`h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm ${
                pendingDecision?.type ===
                "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-gradient-emerald text-primary-foreground"
              }`}
            >
              {decisionLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              {decisionLoading
                ? pendingDecision?.type ===
                  "approve"
                  ? "Approving…"
                  : "Rejecting…"
                : pendingDecision?.type ===
                    "approve"
                  ? "Approve resource"
                  : "Reject resource"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User account decision dialog */}
      <AlertDialog
        open={
          pendingUserDecision !==
          null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !userDecisionLoading
          ) {
            setPendingUserDecision(null);
            setUserDecisionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {pendingUserDecision?.type ===
              "approve"
                ? "Approve user account?"
                : "Reject user account?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {pendingUserDecision?.type ===
              "approve" ? (
                <>
                  Are you sure you want to
                  approve{" "}
                  <strong>
                    {
                      pendingUserDecision.name
                    }
                  </strong>
                  ? This will activate the account
                  and allow the user to access
                  Aneks Library.
                </>
              ) : (
                <>
                  Are you sure you want to
                  reject{" "}
                  <strong>
                    {
                      pendingUserDecision?.name
                    }
                  </strong>
                  ? The account will remain
                  rejected and will not be granted
                  access.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2.5 sm:space-y-2">
            <label
              htmlFor="user-decision-reason"
              className="text-xs font-medium sm:text-sm"
            >
              {pendingUserDecision?.type ===
              "approve"
                ? "Approval reason"
                : "Rejection reason"}
            </label>

            <Input
              id="user-decision-reason"
              value={userDecisionReason}
              onChange={(event) =>
                setUserDecisionReason(
                  event.target.value,
                )
              }
              placeholder={
                pendingUserDecision?.type ===
                "approve"
                  ? "e.g. Registration details verified"
                  : "e.g. Registration details could not be verified"
              }
              disabled={
                userDecisionLoading
              }
              required
              aria-required="true"
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
              A reason is required and will be
              recorded in the account audit
              history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={
                userDecisionLoading
              }
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmUserDecision();
              }}
              disabled={
                userDecisionLoading ||
                !userDecisionReason.trim()
              }
              className={`h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm ${
                pendingUserDecision?.type ===
                "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-gradient-emerald text-primary-foreground"
              }`}
            >
              {userDecisionLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              {userDecisionLoading
                ? pendingUserDecision?.type ===
                  "approve"
                  ? "Approving…"
                  : "Rejecting…"
                : pendingUserDecision?.type ===
                    "approve"
                  ? "Approve account"
                  : "Reject account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewResource && (
        <PreviewModal
          resource={previewResource}
          onClose={() =>
            setPreviewResource(null)
          }
        />
      )}
    </>
  );
}

function getPendingUserDetails(
  user: PendingUser,
): {
  label: string;
  value: string;
}[] {
  const details: {
    label: string;
    value: string;
  }[] = [];

  const role = user.primary_role;

  const showAcademicDetails = [
    "student",
    "lecturer",
    "staff",
  ].includes(role);

  if (
    showAcademicDetails &&
    user.college?.trim()
  ) {
    details.push({
      label: "College",
      value: user.college.trim(),
    });
  }

  if (
    showAcademicDetails &&
    user.department?.trim()
  ) {
    details.push({
      label: "Department",
      value: user.department.trim(),
    });
  }

  if (
    role === "student" &&
    user.level?.trim()
  ) {
    details.push({
      label: "Level",
      value: user.level.trim(),
    });
  }

  return details;
}

function StatusPill({
  status,
}: {
  status: ResourceStatus;
}) {
  const config: Record<
    ResourceStatus,
    {
      label: string;
      className: string;
      icon: typeof CheckCircle2;
    }
  > = {
    approved: {
      label: "Approved",
      className:
        "border-primary/20 bg-primary/10 text-primary",
      icon: CheckCircle2,
    },
    pending: {
      label: "Pending",
      className:
        "border-gold/20 bg-gold/10 text-gold",
      icon: Clock3,
    },
    rejected: {
      label: "Rejected",
      className:
        "border-destructive/20 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    deleted: {
      label: "Deleted",
      className:
        "border-destructive/20 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    draft: {
      label: "Draft",
      className:
        "border-border bg-muted/30 text-muted-foreground",
      icon: FileText,
    },
  };

  const item = config[status];
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:gap-1 sm:px-2 sm:text-[10px] ${item.className}`}
    >
      <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      {item.label}
    </span>
  );
}

function AuditItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-l-2 border-border pl-2.5 sm:pl-3">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[10px]">
        {label}
      </p>

      <p className="mt-0.5 text-[10px] font-medium text-foreground sm:mt-1 sm:text-xs">
        {value}
      </p>

      {detail && (
        <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
          {detail}
        </p>
      )}
    </div>
  );
}

function formatRoleLabel(
  value: string,
) {
  return value
    .replace(/[-_]/g, " ")
    .toUpperCase();
}

function formatDateTime(
  value: string,
) {
  return new Date(value).toLocaleString();
}

function formatFileSize(
  bytes: number,
) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024),
  );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(
    index === 0 ? 0 : 1,
  )} ${units[index]}`;
}

function PreviewModal({
  resource,
  onClose,
}: {
  resource: {
    id: string;
    title: string;
    file_path: string;
  };
  onClose: () => void;
}) {
  const [scrollRoot, setScrollRoot] =
    useState<HTMLDivElement | null>(
      null,
    );

  const {
    data: previewUrl,
    isLoading,
  } = useQuery({
    queryKey: [
      "admin-preview-url",
      resource.id,
    ],

    queryFn: async () => {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      return {
        url:
          `${import.meta.env.VITE_SUPABASE_URL}` +
          `/functions/v1/preview-resource?resourceId=${resource.id}`,

        accessToken:
          session?.access_token ?? "",
      };
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[95vh] sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium sm:text-sm">
              {resource.title}
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
              Resource preview
            </p>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close preview"
            className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        <div
          ref={(node) =>
            setScrollRoot(node)
          }
          className="min-h-0 flex-1 overflow-auto p-2.5 sm:p-4"
        >
          {isLoading ||
          !previewUrl ? (
            <div className="flex min-h-[60vh] items-center justify-center text-xs text-muted-foreground sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                Preparing preview…
              </div>
            </div>
          ) : (
            <DocumentPreview
              url={previewUrl.url}
              token={
                previewUrl.accessToken
              }
              filePath={
                resource.file_path
              }
              title={resource.title}
              scrollRoot={scrollRoot}
            />
          )}
        </div>
      </div>
    </div>
  );
}
