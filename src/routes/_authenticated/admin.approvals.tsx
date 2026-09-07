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
  Trash2,
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
      .from("profiles")
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
      { title: "Approvals | Aneks Library" },
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
  category?: {
    name?: string;
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

function Approvals() {
  const {
    user,
    roles,
    profile,
    loading,
  } = useAuth();

  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const [rejectionReason, setRejectionReason] =
    useState("");

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ["pending-resources"],

    queryFn: async () => {
      const { data, error } =
        await supabase
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
              category:categories(name),
              uploader:profiles!resources_uploader_id_fkey(full_name,email)
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

      return (data ?? []) as unknown as Resource[];
    },
  });

  const decide = useMutation({
    mutationFn: async (v: {
      id: string;
      file_path: string;
      title: string;
      approve: boolean;
      reason?: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      /*
       * APPROVE
       *
       * The secured database function:
       * - verifies the authenticated actor
       * - verifies the actor is active
       * - verifies the actor has an authorized role
       * - verifies the resource is pending
       * - approves the resource
       * - records the approving user
       * - awards +10 reputation to the uploader
       *
       * The approval and reputation update happen
       * inside the same database transaction.
       */
      if (v.approve) {
        const {
          data,
          error,
        } = await supabase.rpc(
          "approve_resource",
          {
            _resource_id: v.id,
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

      /*
       * REJECT
       *
       * Rejection reason is mandatory.
       * This is enforced here in addition to the
       * database function's own validation.
       */
      const normalizedReason =
        v.reason?.trim() ?? "";

      if (!normalizedReason) {
        throw new Error(
          "A rejection reason is required.",
        );
      }

      /*
       * The Storage file must be removed while the
       * resource is still pending because the B1
       * Lecturer/Staff Storage policy only permits
       * deletion of pending resource files.
       *
       * Admin and Co-admin are covered by the broader
       * administrator Storage policy.
       */
      const {
        error: storageError,
      } = await supabase.storage
        .from("resources")
        .remove([v.file_path]);

      if (storageError) {
        throw new Error(
          `Could not remove the uploaded file: ${storageError.message}`,
        );
      }

      /*
       * The secured database function:
       * - verifies the authenticated actor
       * - verifies the actor is active
       * - verifies the actor has an authorized role
       * - verifies the resource is still pending
       * - records the rejection
       * - stores the mandatory rejection reason
       * - clears approval metadata
       * - records rejected_by / rejected_at
       * - resets file_size to 0
       */
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
      setRejectionReason("");

      qc.invalidateQueries({
        queryKey: ["pending-resources"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-resources"],
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

  const requestApprove = (
    id: string,
    file_path: string,
    title: string,
  ) => {
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
    setRejectionReason("");

    setPendingDecision({
      type: "reject",
      id,
      file_path,
      title,
    });
  };

  const confirmDecision = () => {
    if (!pendingDecision) {
      return;
    }

    if (
      pendingDecision.type ===
      "approve"
    ) {
      decide.mutate({
        id: pendingDecision.id,
        file_path:
          pendingDecision.file_path,
        title: pendingDecision.title,
        approve: true,
      });

      return;
    }

    const reason =
      rejectionReason.trim();

    if (!reason) {
      toast.error(
        "Please provide a rejection reason before rejecting this resource.",
      );
      return;
    }

    decide.mutate({
      id: pendingDecision.id,
      file_path:
        pendingDecision.file_path,
      title: pendingDecision.title,
      approve: false,
      reason,
    });
  };

  const decisionLoading =
    decide.isPending;

  return (
    <>
      <section className="space-y-5">
        {/* Review queue */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading review queue…
              </div>
            </div>
          ) : data && data.length > 0 ? (
            <ul className="divide-y-0">
              {data.map((resource) => {
                const isProcessing =
                  decisionLoading &&
                  decide.variables?.id ===
                    resource.id;

                const canPreview =
                  resource.file_size > 0 &&
                  resource.status ===
                    "pending";

                return (
                  <li
                    key={resource.id}
                    className="group border-b-2 border-border/70 p-4 transition-colors sm:p-5 odd:bg-card even:bg-muted/40 hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Resource header */}
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        {/* Resource information */}
                        <div className="min-w-0 flex-1">
                          {/* Status + Category */}
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill
                              status={
                                resource.status
                              }
                            />

                            {resource.category
                              ?.name && (
                              <span className="max-w-[220px] truncate rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {
                                  resource
                                    .category
                                    .name
                                }
                              </span>
                            )}
                          </div>

                          {/* File / Metadata */}
                          <div className="mt-2 min-w-0">
                            <p className="break-words text-base font-semibold leading-6 text-foreground sm:text-lg">
                              {
                                resource.file_name
                              }
                            </p>

                            {/* Description */}
                            {resource.description && (
                              <p className="mt-3 max-w-4xl line-clamp-2 text-sm leading-6 text-muted-foreground">
                                {
                                  resource.description
                                }
                              </p>
                            )}
                          </div>

                          {/* File metadata */}
                          <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5">
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

                        {/* Actions */}
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
                              className="transition-colors"
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
                            className="text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
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
                            className="text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
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

                      {/* Audit information */}
                      <div className="grid gap-4 text-xs sm:grid-cols-2 xl:grid-cols-3">
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

                      {/* Responsive actions */}
                      <div className="flex flex-wrap items-center gap-2 lg:hidden">
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
                            className="transition-colors"
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
                          className="text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
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
                          className="text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
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
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Queue empty"
              desc="No resources are waiting for review right now."
            />
          )}
        </div>
      </section>

      {/* Approval / rejection confirmation */}
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
            setRejectionReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.type ===
              "approve"
                ? "Approve resource?"
                : "Reject resource?"}
            </AlertDialogTitle>

            <AlertDialogDescription>
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

          {pendingDecision?.type ===
            "reject" && (
            <div className="space-y-2">
              <label
                htmlFor="rejection-reason"
                className="text-sm font-medium"
              >
                Rejection reason
              </label>

              <Input
                id="rejection-reason"
                value={rejectionReason}
                onChange={(event) =>
                  setRejectionReason(
                    event.target.value,
                  )
                }
                placeholder="e.g. Poor quality scan or incorrect course material"
                disabled={
                  decisionLoading
                }
                required
                aria-required="true"
              />

              <p className="text-xs leading-5 text-muted-foreground">
                A rejection reason is required
                and will be included in the
                uploader's rejection notification.
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={decisionLoading}
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
                (pendingDecision?.type ===
                  "reject" &&
                  !rejectionReason.trim())
              }
              className={
                pendingDecision?.type ===
                "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-gradient-emerald text-primary-foreground"
              }
            >
              {decisionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

      {/* Preview overlay */}
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
      icon: Trash2,
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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.className}`}
    >
      <Icon className="h-3 w-3" />
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
    <div className="border-l-2 border-border pl-3">
      <p className="uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 font-medium text-foreground">
        {value}
      </p>

      {detail && (
        <p className="mt-0.5 text-muted-foreground">
          {detail}
        </p>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatFileSize(bytes: number) {
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
    Math.log(bytes) / Math.log(1024),
  );

  return `${(
    bytes / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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
    useState<HTMLDivElement | null>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Preview header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {resource.title}
            </p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Resource preview
            </p>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Preview content */}
        <div
          ref={(node) => setScrollRoot(node)}
          className="min-h-0 flex-1 overflow-auto p-4"
        >
          {isLoading ||
          !previewUrl ? (
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
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