import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccess } from "@/hooks/useAccess";
import { downloadResource } from "@/lib/download";
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
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/admin/resources")({
  head: () => ({
    meta: [
      { title: "Resources | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResourcesPage,
});

type ResourceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deleted"
  | "draft";

type Resource = {
  id: string;
  uploader_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  course_code: string | null;
  department: string | null;
  level: string | null;
  author: string | null;
  year: number | null;
  tags: string[];
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  thumbnail_path: string | null;
  status: ResourceStatus;
  rejection_reason: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  download_count: number;
  bookmark_count: number;
  approved_by: string | null;
  approved_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
  college: string | null;
  semester: string | null;
  category?: {
    name?: string;
  } | null;
  uploader?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  approver?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  deleter?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  rejecter?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

const STATUS_OPTIONS: Array<{
  value: "all" | ResourceStatus;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "deleted", label: "Deleted" },
  { value: "draft", label: "Draft" },
];

function ResourcesPage() {
  const { user } = useAuth();
  const { isAdmin } = useAccess();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ResourceStatus>("all");
  const [category, setCategory] = useState("all");

  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">(
    "newest",
  );

  const [previewResource, setPreviewResource] = useState<{
    id: string;
    title: string;
    file_path: string;
  } | null>(null);

  const [pendingDelete, setPendingDelete] =
    useState<Resource | null>(null);

  const [deletionReason, setDeletionReason] = useState("");

  const [downloadingResourceId, setDownloadingResourceId] =
    useState<string | null>(null);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["admin-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(
          `
            id,
            uploader_id,
            category_id,
            title,
            description,
            course_code,
            department,
            level,
            author,
            year,
            tags,
            file_path,
            file_name,
            file_size,
            mime_type,
            thumbnail_path,
            status,
            rejection_reason,
            rejected_by,
            rejected_at,
            download_count,
            bookmark_count,
            approved_by,
            approved_at,
            deleted_by,
            deleted_at,
            deletion_reason,
            created_at,
            updated_at,
            college,
            semester,
            category:categories(name),
            uploader:profiles!resources_uploader_id_fkey(full_name,email),
            approver:profiles!resources_approved_by_fkey(full_name,email)
          `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        /*
         * The uploader relationship already exists in the verified schema.
         * approved_by/deleted_by relationship metadata can vary depending
         * on generated Supabase relationship metadata, so retry without
         * the embedded approver relationship when necessary.
         */
        const fallback = await supabase
          .from("resources")
          .select(
            `
              id,
              uploader_id,
              category_id,
              title,
              description,
              course_code,
              department,
              level,
              author,
              year,
              tags,
              file_path,
              file_name,
              file_size,
              mime_type,
              thumbnail_path,
              status,
              rejection_reason,
              rejected_by,
              rejected_at,
              download_count,
              bookmark_count,
              approved_by,
              approved_at,
              deleted_by,
              deleted_at,
              deletion_reason,
              created_at,
              updated_at,
              college,
              semester,
              category:categories(name),
              uploader:profiles!resources_uploader_id_fkey(full_name,email)
            `,
          )
          .order("created_at", { ascending: false });

        if (fallback.error) {
          throw fallback.error;
        }

const fallbackResources = (fallback.data ?? []) as unknown as Resource[];

const approvedByIds = fallbackResources
  .map((resource) => resource.approved_by)
  .filter((id): id is string => Boolean(id));

const deletedByIds = fallbackResources
  .map((resource) => resource.deleted_by)
  .filter((id): id is string => Boolean(id));

const rejectedByIds = fallbackResources
  .map((resource) => resource.rejected_by)
  .filter((id): id is string => Boolean(id));

const profileIds = [
  ...new Set([
    ...approvedByIds,
    ...deletedByIds,
    ...rejectedByIds,
  ]),
];

if (profileIds.length === 0) {
  return fallbackResources;
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
    {
      full_name: profile.full_name,
      email: profile.email,
    },
  ]),
);

return fallbackResources.map((resource) => ({
  ...resource,
  approver: resource.approved_by
    ? profileMap.get(resource.approved_by) ?? null
    : null,
  deleter: resource.deleted_by
    ? profileMap.get(resource.deleted_by) ?? null
    : null,
  rejecter: resource.rejected_by
    ? profileMap.get(resource.rejected_by) ?? null
    : null,
}));
      }

      const primaryResources = (data ?? []) as unknown as Resource[];

const approvedByIds = primaryResources
  .map((resource) => resource.approved_by)
  .filter((id): id is string => Boolean(id));

const deletedByIds = primaryResources
  .map((resource) => resource.deleted_by)
  .filter((id): id is string => Boolean(id));

const rejectedByIds = primaryResources
  .map((resource) => resource.rejected_by)
  .filter((id): id is string => Boolean(id));

      const profileIds = [
        ...new Set([
          ...approvedByIds,
          ...deletedByIds,
          ...rejectedByIds,
        ]),
      ];

      if (profileIds.length === 0) {
        return primaryResources;
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
          {
            full_name: profile.full_name,
            email: profile.email,
          },
        ]),
      );

      return primaryResources.map((resource) => ({
        ...resource,
        approver: resource.approved_by
          ? profileMap.get(resource.approved_by) ?? null
          : null,
        deleter: resource.deleted_by
          ? profileMap.get(resource.deleted_by) ?? null
          : null,
        rejecter: resource.rejected_by
          ? profileMap.get(resource.rejected_by) ?? null
          : null,
      }));
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-resource-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const deleteResource = useMutation({
    mutationFn: async ({
      resource,
      reason,
    }: {
      resource: Resource;
      reason: string;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      if (resource.status === "deleted") {
        throw new Error(
          "This resource is already deleted.",
        );
      }

      const normalizedReason = reason.trim();

      if (!normalizedReason) {
        throw new Error(
          "A deletion reason is required.",
        );
      }

      const { data, error } =
        await supabase.functions.invoke(
          "delete-resource",
          {
            body: {
              resourceId: resource.id,
              deletionReason: normalizedReason,
            },
          },
        );

      if (error) {
        throw new Error(
          error.message ||
            "Could not delete the resource.",
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Could not delete the resource.",
        );
      }

      return data;
    },

    onSuccess: (result) => {
      if (
        result.storageCleanup ===
        "partial_failure"
      ) {
        toast.warning(
          "Resource marked as deleted, but physical Storage cleanup was incomplete.",
        );
      } else {
        toast.success(
          "Resource deleted. The file was removed and the audit record was retained.",
        );
      }

      qc.invalidateQueries({
        queryKey: ["admin-resources"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-stats"],
      });

      setPreviewResource(null);
      setPendingDelete(null);
      setDeletionReason("");
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingDelete(null);
      setDeletionReason("");
    },
  });

  const filteredResources = useMemo(() => {
    if (!resources) {
      return [];
    }

    const query = search.trim().toLowerCase();

    const filtered = resources.filter((resource) => {
      const matchesStatus =
        status === "all" ||
        resource.status === status;

      const matchesCategory =
        category === "all" ||
        resource.category_id === category;

      if (!matchesStatus || !matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        resource.title,
        resource.file_name,
        resource.description,
        resource.course_code,
        resource.department,
        resource.author,
        resource.category?.name,
        resource.uploader?.full_name,
        resource.uploader?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      return sortOrder === "newest"
        ? dateB - dateA
        : dateA - dateB;
    });
  }, [
    resources,
    search,
    status,
    category,
    sortOrder,
  ]);

  const handleDelete = (resource: Resource) => {
    setPendingDelete(resource);
    setDeletionReason("");
  };

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }

    const reason = deletionReason.trim();

    if (!reason) {
      toast.error(
        "Please provide a deletion reason before deleting this resource.",
      );
      return;
    }

    deleteResource.mutate({
      resource: pendingDelete,
      reason,
    });
  };

  const handleDownload = async (resource: Resource) => {
    if (resource.status !== "approved") {
      return;
    }

    if (downloadingResourceId) {
      return;
    }

    try {
      setDownloadingResourceId(resource.id);

      await downloadResource(resource.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download the resource.",
      );
    } finally {
      setDownloadingResourceId(null);
    }
  };

  const getPersonName = (
    person:
      | {
          full_name?: string | null;
          email?: string | null;
        }
      | null
      | undefined,
    fallbackId?: string | null,
  ) => {
    return (
      person?.full_name ||
      person?.email ||
      (fallbackId
        ? `${fallbackId.slice(0, 8)}…`
        : "Unknown")
    );
  };

  return (
    <section className="space-y-5">
      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />

          <p className="text-sm font-semibold">
            Find resources
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_200px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, file name, uploader…"
              className="pl-9"
            />
          </div>

          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as
                  | "all"
                  | ResourceStatus,
              )
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value)
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Filter by category"
          >
            <option value="all">
              All categories
            </option>

            {(categories ?? []).map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) =>
              setSortOrder(
                e.target.value as
                  | "newest"
                  | "oldest",
              )
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Sort resources"
          >
            <option value="newest">
              Newest first
            </option>
            <option value="oldest">
              Oldest first
            </option>
          </select>
        </div>

        {(search ||
          status !== "all" ||
          category !== "all" ||
          sortOrder !== "newest") && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {filteredResources.length} of{" "}
              {resources?.length ?? 0} resources
            </p>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setCategory("all");
                setSortOrder("newest");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Resource list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Loading resources…
          </div>
        ) : filteredResources.length > 0 ? (
          <ul className="divide-y-0">
            {filteredResources.map((resource) => {
              const isDeleting =
                deleteResource.isPending &&
                deleteResource.variables?.resource.id ===
                  resource.id;

              const isDownloading =
                downloadingResourceId === resource.id;

              const isDeleted =
                resource.status === "deleted";

              const canPreview =
                resource.file_size > 0 &&
                (resource.status === "pending" ||
                  resource.status === "approved");

              const canDownload =
                resource.status === "approved";

              const canDelete =
                isAdmin &&
                resource.status !== "rejected" &&
                resource.status !== "deleted";

              return (
                <li
                  key={resource.id}
                  className={`group border-b-2 border-border/70 p-4 transition-colors sm:p-5 ${
                    isDeleted
                      ? "bg-muted/30"
                      : "odd:bg-card even:bg-muted/40 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    {/* Resource header */}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      {/* Resource information */}
                      <div className="min-w-0 flex-1">
                        {/* Status + Category */}
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill
                            status={resource.status}
                          />

                          {resource.category?.name && (
                            <span className="max-w-[220px] truncate rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {resource.category.name}
                            </span>
                          )}
                        </div>

                        {/* File / Metadata */}
                        <div className="mt-2 min-w-0">
                          <p
                            className={`break-words text-base font-semibold leading-6 sm:text-lg ${
                              isDeleted
                                ? "text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {resource.file_name}
                          </p>

                          {/* Description */}
                          {resource.description && (
                            <p className="mt-3 max-w-4xl line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {resource.description}
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
                                {resource.course_code}
                              </span>
                            </>
                          )}

                          {resource.department && (
                            <>
                              <span className="hidden text-border sm:inline">
                                •
                              </span>
                              <span>
                                {resource.department}
                              </span>
                            </>
                          )}

                          {resource.level && (
                            <>
                              <span className="hidden text-border sm:inline">
                                •
                              </span>
                              <span>
                                {resource.level}
                              </span>
                            </>
                          )}

                          {resource.year && (
                            <>
                              <span className="hidden text-border sm:inline">
                                •
                              </span>
                              <span>
                                {resource.year}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex lg:justify-end">
                        {canPreview && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              deleteResource.isPending ||
                              Boolean(
                                downloadingResourceId,
                              )
                            }
                            onClick={() =>
                              setPreviewResource({
                                id: resource.id,
                                title: resource.title,
                                file_path:
                                  resource.file_path,
                              })
                            }
                            className="transition-colors"
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Preview
                          </Button>
                        )}

                        {canDownload && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              deleteResource.isPending ||
                              Boolean(
                                downloadingResourceId,
                              )
                            }
                            onClick={() =>
                              handleDownload(resource)
                            }
                            className="transition-colors"
                          >
                            {isDownloading ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Download
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              deleteResource.isPending ||
                              Boolean(
                                downloadingResourceId,
                              )
                            }
                            onClick={() =>
                              handleDelete(resource)
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
                        )}
                      </div>
                    </div>

                    {/* Usage metrics */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 sm:block">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Downloads
                        </p>

                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {resource.download_count.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 sm:block">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Bookmarks
                        </p>

                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {resource.bookmark_count.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Audit information */}
<div className="grid gap-4 text-xs sm:grid-cols-2 xl:grid-cols-3">
  <AuditItem
    label="Uploader"
    value={getPersonName(
      resource.uploader,
      resource.uploader_id,
    )}
    detail={formatDateTime(resource.created_at)}
  />

  {resource.status === "rejected" ? (
    <>
      <AuditItem
        label="Rejected by"
        value={
          resource.rejected_by
            ? getPersonName(
                resource.rejecter,
                resource.rejected_by,
              )
            : "Unknown"
        }
        detail={
          resource.rejected_at
            ? formatDateTime(resource.rejected_at)
            : undefined
        }
      />

      {resource.rejection_reason && (
        <AuditItem
          label="Rejection reason"
          value={resource.rejection_reason}
        />
      )}
    </>
  ) : (
    <AuditItem
      label="Approved by"
      value={
        resource.approved_by
          ? getPersonName(
              resource.approver,
              resource.approved_by,
            )
          : "Not approved"
      }
      detail={
        resource.approved_at
          ? formatDateTime(resource.approved_at)
          : undefined
      }
    />
  )}

  <AuditItem
    label="Deleted by"
    value={
      resource.deleted_by
        ? getPersonName(
            resource.deleter,
            resource.deleted_by,
          )
        : "Not deleted"
    }
    detail={
      resource.deleted_at
        ? formatDateTime(resource.deleted_at)
        : undefined
    }
  />

  {resource.status === "deleted" &&
    resource.deletion_reason && (
      <AuditItem
        label="Deletion reason"
        value={resource.deletion_reason}
      />
    )}
</div>

                    {/* Responsive actions */}
                    <div className="flex flex-wrap items-center gap-2 lg:hidden">
                      {canPreview && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            deleteResource.isPending ||
                            Boolean(
                              downloadingResourceId,
                            )
                          }
                          onClick={() =>
                            setPreviewResource({
                              id: resource.id,
                              title: resource.title,
                              file_path:
                                resource.file_path,
                            })
                          }
                          className="transition-colors"
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Preview
                        </Button>
                      )}

                      {canDownload && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            deleteResource.isPending ||
                            Boolean(
                              downloadingResourceId,
                            )
                          }
                          onClick={() =>
                            handleDownload(resource)
                          }
                          className="transition-colors"
                        >
                          {isDownloading ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Download
                        </Button>
                      )}

                      {canDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            deleteResource.isPending ||
                            Boolean(
                              downloadingResourceId,
                            )
                          }
                          onClick={() =>
                            handleDelete(resource)
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
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : resources && resources.length > 0 ? (
          <div className="p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />

            <p className="mt-3 text-sm font-medium">
              No matching resources
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <EmptyState
            title="No resources yet"
            desc="Resources uploaded to the library will appear here."
          />
        )}
      </div>

      {/* Preview */}
      {previewResource && (
        <PreviewModal
          resource={previewResource}
          onClose={() =>
            setPreviewResource(null)
          }
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (
            !open &&
            !deleteResource.isPending
          ) {
            setPendingDelete(null);
            setDeletionReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm resource deletion
            </AlertDialogTitle>

            <AlertDialogDescription>
              Delete{" "}
              <strong>
                {pendingDelete?.title}
              </strong>
              ? The physical file will be permanently
              removed from Storage, but the database
              record will be retained for audit/history.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="deletion-reason"
              className="text-sm font-medium"
            >
              Deletion reason
            </label>

            <Input
              id="deletion-reason"
              value={deletionReason}
              onChange={(event) =>
                setDeletionReason(
                  event.target.value,
                )
              }
              placeholder="e.g. Duplicate resource or incorrect material"
              disabled={
                deleteResource.isPending
              }
              required
              aria-required="true"
            />

            <p className="text-xs text-muted-foreground">
              A reason is required and will be retained
              with the resource audit record.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteResource.isPending}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={
                deleteResource.isPending ||
                !deletionReason.trim()
              }
            >
              {deleteResource.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
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
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const { data: previewUrl, isLoading } =
    useQuery({
      queryKey: [
        "admin-resource-preview-url",
        resource.id,
      ],
      queryFn: async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

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
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
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
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close preview"
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        <div
            ref={scrollRootRef}
            className="min-h-0 flex-1 overflow-auto p-4"
          >
          {isLoading || !previewUrl ? (
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Preparing preview…
            </div>
          ) : (
            <DocumentPreview
              url={previewUrl.url}
              token={previewUrl.accessToken}
              filePath={resource.file_path}
              title={resource.title}
              scrollRoot={scrollRootRef.current}
            />
          )}
        </div>
      </div>
    </div>
  );
}