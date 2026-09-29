import {
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  Eye,
  Filter,
  FileText,
  History,
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
import {
  colleges,
  levels,
  semesters,
  years,
  getDepartments,
} from "@/lib/academicData";
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
    name?: string | null;
    deleted_at?: string | null;
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

type ResourceEditAudit = {
  id: string;
  resource_id: string;
  edited_by: string;
  edit_summary: string;
  created_at: string;
  editor?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type EditResourceForm = {
  title: string;
  description: string;
  course_code: string;
  college: string;
  department: string;
  level: string;
  semester: string;
  year: string;
  author: string;
  category_id: string;
  tags: string;
  edit_summary: string;
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

const UNCATEGORIZED_FILTER = "__uncategorized__";

function createEmptyEditForm(): EditResourceForm {
  return {
    title: "",
    description: "",
    course_code: "",
    college: "",
    department: "",
    level: "",
    semester: "",
    year: "",
    author: "",
    category_id: "",
    tags: "",
    edit_summary: "",
  };
}

function normalizeTags(tags: string[]) {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function getNormalizedFormValues(
  form: EditResourceForm,
) {
  const yearText = form.year.trim();

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    course_code: form.course_code.trim(),
    college: form.college.trim(),
    department: form.department.trim(),
    level: form.level.trim(),
    semester: form.semester.trim(),
    year: yearText,
    author: form.author.trim(),
    category_id: form.category_id,
    tags: normalizeTags(
      form.tags.split(","),
    ),
  };
}

function getNormalizedResourceValues(
  resource: Resource,
) {
  return {
    title: resource.title.trim(),
    description:
      resource.description?.trim() ?? "",
    course_code:
      resource.course_code?.trim() ?? "",
    college:
      resource.college?.trim() ?? "",
    department:
      resource.department?.trim() ?? "",
    level:
      resource.level?.trim() ?? "",
    semester:
      resource.semester?.trim() ?? "",
    year:
      resource.year === null
        ? ""
        : String(resource.year),
    author:
      resource.author?.trim() ?? "",
    category_id:
      resource.category_id ?? "",
    tags: normalizeTags(
      resource.tags ?? [],
    ),
  };
}

function hasActualEditChanges(
  resource: Resource,
  form: EditResourceForm,
) {
  const original =
    getNormalizedResourceValues(
      resource,
    );

  const current =
    getNormalizedFormValues(form);

  return (
    original.title !== current.title ||
    original.description !==
      current.description ||
    original.course_code !==
      current.course_code ||
    original.college !==
      current.college ||
    original.department !==
      current.department ||
    original.level !== current.level ||
    original.semester !==
      current.semester ||
    original.year !== current.year ||
    original.author !== current.author ||
    original.category_id !==
      current.category_id ||
    JSON.stringify(original.tags) !==
      JSON.stringify(current.tags)
  );
}

function ResourcesPage() {
  const { user, roles } = useAuth();
  const { isAdmin } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const hasAdminAccess =
    roles?.includes("admin") ||
    roles?.includes("co-admin");

  useEffect(() => {
    if (!user) return;
    if (!roles) return;

    if (
      !roles.includes("admin") &&
      !roles.includes("co-admin")
    ) {
      void navigate({
        to: "/admin",
        replace: true,
      });
    }
  }, [user, roles, navigate]);

  const [search, setSearch] = useState("");
  const [status, setStatus] =
    useState<"all" | ResourceStatus>("all");
  const [category, setCategory] =
    useState("all");

  const [sortOrder, setSortOrder] =
    useState<"newest" | "oldest">(
      "newest",
    );

  const [previewResource, setPreviewResource] =
    useState<{
      id: string;
      title: string;
      file_path: string;
    } | null>(null);

  const [editingResource, setEditingResource] =
    useState<Resource | null>(null);

  const [editForm, setEditForm] =
    useState<EditResourceForm>(
      createEmptyEditForm(),
    );

  const [
    editConfirmation,
    setEditConfirmation,
  ] = useState<
    "changes" | "no_changes" | null
  >(null);

  const [
    expandedHistory,
    setExpandedHistory,
  ] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] =
    useState<Resource | null>(null);

  const [deletionReason, setDeletionReason] =
    useState("");

  const [
    downloadingResourceId,
    setDownloadingResourceId,
  ] = useState<string | null>(null);

  const {
    data: resources,
    isLoading,
  } = useQuery({
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
            category:categories(name, deleted_at)
          `,
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const primaryResources =
        (data ?? []) as unknown as Resource[];

      const profileIds = [
        ...new Set(
          [
            ...primaryResources.map(
              (resource) =>
                resource.uploader_id,
            ),
            ...primaryResources.map(
              (resource) =>
                resource.approved_by,
            ),
            ...primaryResources.map(
              (resource) =>
                resource.deleted_by,
            ),
            ...primaryResources.map(
              (resource) =>
                resource.rejected_by,
            ),
          ].filter(
            (id): id is string =>
              Boolean(id),
          ),
        ),
      ];

      if (profileIds.length === 0) {
        return primaryResources;
      }

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("private_profiles")
        .select(
          "id, full_name, email",
        )
        .in("id", profileIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map(
        (profiles ?? []).map(
          (profile) => [
            profile.id,
            {
              full_name:
                profile.full_name,
              email: profile.email,
            },
          ],
        ),
      );

      return primaryResources.map(
        (resource) => ({
          ...resource,
          uploader:
            profileMap.get(
              resource.uploader_id,
            ) ?? null,
          approver:
            resource.approved_by
              ? profileMap.get(
                  resource.approved_by,
                ) ?? null
              : null,
          deleter:
            resource.deleted_by
              ? profileMap.get(
                  resource.deleted_by,
                ) ?? null
              : null,
          rejecter:
            resource.rejected_by
              ? profileMap.get(
                  resource.rejected_by,
                ) ?? null
              : null,
        }),
      );
    },
  });

  const { data: categories } =
    useQuery({
      queryKey: [
        "admin-resource-categories",
      ],
      queryFn: async () => {
        const { data, error } =
          await supabase
            .from("categories")
            .select("id, name")
            .is("deleted_at", null)
            .order("name", {
              ascending: true,
            });

        if (error) {
          throw error;
        }

        return data ?? [];
      },
    });

  const resourceIds = useMemo(
    () =>
      (resources ?? []).map(
        (resource) => resource.id,
      ),
    [resources],
  );

  const { data: editAudits } =
    useQuery({
      queryKey: [
        "admin-resource-edit-audits",
        resourceIds,
      ],
      enabled: resourceIds.length > 0,
      queryFn: async () => {
        const {
          data: audits,
          error: auditsError,
        } = await supabase
          .from(
            "resource_edit_audit_logs",
          )
          .select(
            "id, resource_id, edited_by, edit_summary, created_at",
          )
          .in(
            "resource_id",
            resourceIds,
          )
          .order("created_at", {
            ascending: false,
          });

        if (auditsError) {
          throw auditsError;
        }

        const rows =
          (audits ??
            []) as ResourceEditAudit[];

        const editorIds = [
          ...new Set(
            rows
              .map(
                (audit) =>
                  audit.edited_by,
              )
              .filter(Boolean),
          ),
        ];

        if (
          editorIds.length === 0
        ) {
          return rows;
        }

        const {
          data: editors,
          error: editorsError,
        } = await supabase
          .from("private_profiles")
          .select(
            "id, full_name, email",
          )
          .in("id", editorIds);

        if (editorsError) {
          throw editorsError;
        }

        const editorMap = new Map(
          (editors ?? []).map(
            (editor) => [
              editor.id,
              {
                full_name:
                  editor.full_name,
                email: editor.email,
              },
            ],
          ),
        );

        return rows.map(
          (audit) => ({
            ...audit,
            editor:
              editorMap.get(
                audit.edited_by,
              ) ?? null,
          }),
        );
      },
    });

  const latestEditMap = useMemo(() => {
    const map = new Map<
      string,
      ResourceEditAudit
    >();

    for (const audit of editAudits ?? []) {
      if (
        !map.has(audit.resource_id)
      ) {
        map.set(
          audit.resource_id,
          audit,
        );
      }
    }

    return map;
  }, [editAudits]);

  const getResourceHistory = (
    resourceId: string,
  ) =>
    (editAudits ?? []).filter(
      (audit) =>
        audit.resource_id ===
        resourceId,
    );

  const editResource = useMutation({
    mutationFn: async ({
      resource,
      form,
    }: {
      resource: Resource;
      form: EditResourceForm;
    }) => {
      if (!user) {
        throw new Error(
          "You must be signed in to perform this action.",
        );
      }

      if (
        resource.status ===
          "deleted" ||
        resource.status ===
          "rejected"
      ) {
        throw new Error(
          "Rejected or deleted resources cannot be edited.",
        );
      }

      const title = form.title.trim();

      if (!title) {
        throw new Error(
          "Resource title is required.",
        );
      }

      const hasChanges =
        hasActualEditChanges(
          resource,
          form,
        );

      if (!hasChanges) {
        return {
          changed: false,
          id: resource.id,
        };
      }

      const editSummary =
        form.edit_summary.trim();

      if (!editSummary) {
        throw new Error(
          "An edit summary is required when changes are made.",
        );
      }

      const yearText =
        form.year.trim();

      let year: number | null =
        null;

      if (yearText) {
        const parsedYear =
          Number(yearText);

        if (
          !Number.isInteger(
            parsedYear,
          ) ||
          parsedYear < 1900 ||
          parsedYear > 2100
        ) {
          throw new Error(
            "Please enter a valid year.",
          );
        }

        year = parsedYear;
      }

      const tags =
        normalizeTags(
          form.tags.split(","),
        );

      const {
        data,
        error,
      } = await supabase.rpc(
        "admin_edit_resource",
        {
  _resource_id:
    resource.id,
  _title: title,
  _description:
    form.description.trim(),
  _course_code:
    form.course_code.trim(),
  _college:
    form.college.trim(),
  _department:
    form.department.trim(),
  _level:
    form.level.trim(),
  _semester:
    form.semester.trim(),
  _year: year as number,
  _author:
    form.author.trim(),
  _category_id:
    form.category_id,
  _tags: tags,
  _edit_summary:
    editSummary.trim(),
},
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Resource could not be updated.",
        );
      }

      return {
        changed: true,
        id: data,
      };
    },

    onSuccess: (result) => {
      setEditConfirmation(null);

      if (!result.changed) {
        toast.info(
          "No changes were made.",
        );
        return;
      }

      toast.success(
        "Resource updated and edit history recorded.",
      );

      qc.invalidateQueries({
        queryKey: ["admin-resources"],
      });

      qc.invalidateQueries({
        queryKey: ["admin-stats"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-resource-edit-audits",
        ],
      });

      closeEdit(true);
    },

    onError: (error: Error) => {
      toast.error(error.message);
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

      const normalizedReason =
        reason.trim();

      if (!normalizedReason) {
        throw new Error(
          "A deletion reason is required.",
        );
      }

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        "delete-resource",
        {
          body: {
            resourceId:
              resource.id,
            deletionReason:
              normalizedReason,
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

  const filteredResources =
    useMemo(() => {
      if (!resources) {
        return [];
      }

      const query =
        search.trim().toLowerCase();

      const filtered =
        resources.filter(
          (resource) => {
            const matchesStatus =
              status === "all" ||
              resource.status ===
                status;

            const categoryName =
              resource.category
                ?.deleted_at == null &&
              resource.category?.name
                ?.trim()
                ? resource.category.name.trim()
                : "Uncategorized";

            const categoryIsUncategorized =
              !resource.category_id ||
              resource.category?.deleted_at !=
                null ||
              !resource.category?.name?.trim();

            let matchesCategory =
              true;

            if (
              category !== "all"
            ) {
              if (
                category ===
                UNCATEGORIZED_FILTER
              ) {
                matchesCategory =
                  categoryIsUncategorized;
              } else {
                matchesCategory =
                  resource.category_id ===
                    category &&
                  !categoryIsUncategorized;
              }
            }

            if (
              !matchesStatus ||
              !matchesCategory
            ) {
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
              resource.college,
              resource.department,
              resource.level,
              resource.semester,
              resource.author,
              resource.year?.toString(),
              resource.tags?.join(
                " ",
              ),
              categoryName,
              resource.uploader
                ?.full_name,
              resource.uploader?.email,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return searchable.includes(
              query,
            );
          },
        );

      return [...filtered].sort(
        (a, b) => {
          const dateA =
            new Date(
              a.created_at,
            ).getTime();

          const dateB =
            new Date(
              b.created_at,
            ).getTime();

          return sortOrder ===
            "newest"
            ? dateB - dateA
            : dateA - dateB;
        },
      );
    }, [
      resources,
      search,
      status,
      category,
      sortOrder,
    ]);

  const openEdit = (
    resource: Resource,
  ) => {
    setEditingResource(resource);
    setEditConfirmation(null);

    setEditForm({
      title: resource.title,
      description:
        resource.description ??
        "",
      course_code:
        resource.course_code ??
        "",
      college:
        resource.college ?? "",
      department:
        resource.department ??
        "",
      level:
        resource.level ?? "",
      semester:
        resource.semester ?? "",
      year:
        resource.year !== null
          ? String(resource.year)
          : "",
      author:
        resource.author ?? "",
      category_id:
        resource.category_id ??
        "",
      tags:
        resource.tags?.join(
          ", ",
        ) ?? "",
      edit_summary: "",
    });
  };

  const closeEdit = (force = false) => {
  if (
    editResource.isPending &&
    !force
  ) {
    return;
  }

  setEditingResource(null);
  setEditForm(
    createEmptyEditForm(),
  );
};

  const requestEditSave = () => {
    if (!editingResource) {
      return;
    }

    if (!editForm.title.trim()) {
      toast.error(
        "Resource title is required.",
      );
      return;
    }

    const hasChanges =
      hasActualEditChanges(
        editingResource,
        editForm,
      );

    setEditConfirmation(
      hasChanges
        ? "changes"
        : "no_changes",
    );
  };

  const confirmEditSave = () => {
    if (!editingResource) {
      return;
    }

    if (
      !hasActualEditChanges(
        editingResource,
        editForm,
      )
    ) {
      setEditConfirmation(null);
      return;
    }

    if (!editForm.edit_summary.trim()) {
      toast.error(
        "An edit summary is required when changes are made.",
      );
      return;
    }

    editResource.mutate({
      resource: editingResource,
      form: editForm,
    });
  };

  const handleDelete = (
    resource: Resource,
  ) => {
    setPendingDelete(resource);
    setDeletionReason("");
  };

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }

    const reason =
      deletionReason.trim();

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

  const handleDownload = async (
    resource: Resource,
  ) => {
    if (
      resource.status !==
      "approved"
    ) {
      return;
    }

    if (downloadingResourceId) {
      return;
    }

    try {
      setDownloadingResourceId(
        resource.id,
      );

      await downloadResource(
        resource.id,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download the resource.",
      );
    } finally {
      setDownloadingResourceId(
        null,
      );
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
        ? `${fallbackId.slice(
            0,
            8,
          )}…`
        : "Unknown")
    );
  };

  const currentEditHasChanges =
    editingResource
      ? hasActualEditChanges(
          editingResource,
          editForm,
        )
      : false;

    const availableDepartments =
    editForm.college
      ? getDepartments(
          editForm.college,
        )
      : [];

  if (
    user &&
    roles &&
    !hasAdminAccess
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    );
  }

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
              onChange={(e) =>
                setSearch(
                  e.target.value,
                )
              }
              placeholder="Search resource title, file name, uploader…"
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
            {STATUS_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              ),
            )}
          </select>

          <select
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value,
              )
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Filter by category"
          >
            <option value="all">
              All categories
            </option>

            <option
              value={
                UNCATEGORIZED_FILTER
              }
            >
              Uncategorized
            </option>

            {(categories ?? []).map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ),
            )}
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
          sortOrder !==
            "newest") && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              {
                filteredResources.length
              }{" "}
              of{" "}
              {resources?.length ??
                0}{" "}
              resources
            </p>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setCategory("all");
                setSortOrder(
                  "newest",
                );
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
        ) : filteredResources.length >
          0 ? (
          <ul className="divide-y-0">
            {filteredResources.map(
              (resource) => {
                const isDeleting =
                  deleteResource.isPending &&
                  deleteResource.variables
                    ?.resource.id ===
                    resource.id;

                const isEditing =
                  editResource.isPending &&
                  editResource.variables
                    ?.resource.id ===
                    resource.id;

                const isDownloading =
                  downloadingResourceId ===
                  resource.id;

                const isDeleted =
                  resource.status ===
                  "deleted";

                const categoryName =
                  resource.category
                    ?.deleted_at ==
                    null &&
                  resource.category?.name
                    ?.trim()
                    ? resource.category.name.trim()
                    : "Uncategorized";

                const latestEdit =
                  latestEditMap.get(
                    resource.id,
                  );

                const history =
                  getResourceHistory(
                    resource.id,
                  );

                const isHistoryOpen =
                  expandedHistory ===
                  resource.id;

                const canPreview =
                  resource.file_size >
                    0 &&
                  (resource.status ===
                    "pending" ||
                    resource.status ===
                      "approved");

                const canDownload =
                  resource.status ===
                  "approved";

                const canEdit =
                  isAdmin &&
                  resource.status !==
                    "deleted" &&
                  resource.status !==
                    "rejected";

                const canDelete =
                  isAdmin &&
                  resource.status !==
                    "rejected" &&
                  resource.status !==
                    "deleted";

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
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill
                              status={
                                resource.status
                              }
                            />

                            <span className="max-w-[220px] truncate rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {
                                categoryName
                              }
                            </span>
                          </div>

                          <div className="mt-2 min-w-0">
                            <p
                              className={`break-words text-base font-semibold leading-6 sm:text-lg ${
                                isDeleted
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {
                                resource.title
                              }
                            </p>

                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {
                                resource.file_name
                              }
                            </p>

                            {resource.description && (
                              <p className="mt-3 max-w-4xl line-clamp-2 text-sm leading-6 text-muted-foreground">
                                {
                                  resource.description
                                }
                              </p>
                            )}
                          </div>

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
                              size="sm"
                              variant="outline"
                              disabled={
                                editResource.isPending ||
                                deleteResource.isPending ||
                                Boolean(
                                  downloadingResourceId,
                                )
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
                                editResource.isPending ||
                                deleteResource.isPending ||
                                Boolean(
                                  downloadingResourceId,
                                )
                              }
                              onClick={() =>
                                handleDownload(
                                  resource,
                                )
                              }
                            >
                              {isDownloading ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Download
                            </Button>
                          )}

                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                editResource.isPending ||
                                deleteResource.isPending ||
                                Boolean(
                                  downloadingResourceId,
                                )
                              }
                              onClick={() =>
                                openEdit(
                                  resource,
                                )
                              }
                            >
                              {isEditing ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Edit
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                editResource.isPending ||
                                deleteResource.isPending ||
                                Boolean(
                                  downloadingResourceId,
                                )
                              }
                              onClick={() =>
                                handleDelete(
                                  resource,
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
                          detail={formatDateTime(
                            resource.created_at,
                          )}
                        />

                        {resource.status ===
                        "rejected" ? (
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
                                  ? formatDateTime(
                                      resource.rejected_at,
                                    )
                                  : undefined
                              }
                            />

                            {resource.rejection_reason && (
                              <AuditItem
                                label="Rejection reason"
                                value={
                                  resource.rejection_reason
                                }
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
                                ? formatDateTime(
                                    resource.approved_at,
                                  )
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
                              ? formatDateTime(
                                  resource.deleted_at,
                                )
                              : undefined
                          }
                        />

                        {latestEdit && (
                          <>
                            <AuditItem
                              label="Last edited by"
                              value={getPersonName(
                                latestEdit.editor,
                                latestEdit.edited_by,
                              )}
                              detail={formatDateTime(
                                latestEdit.created_at,
                              )}
                            />

                            <AuditItem
                              label="Edit summary"
                              value={
                                latestEdit.edit_summary
                              }
                            />
                          </>
                        )}

                        {resource.status ===
                          "deleted" &&
                          resource.deletion_reason && (
                            <AuditItem
                              label="Deletion reason"
                              value={
                                resource.deletion_reason
                              }
                            />
                          )}
                      </div>

                      {/* Edit history */}
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedHistory(
                              isHistoryOpen
                                ? null
                                : resource.id,
                            )
                          }
                          className="h-7 px-2 text-xs text-muted-foreground"
                        >
                          <History className="mr-1.5 h-3.5 w-3.5" />

                          {isHistoryOpen
                            ? "Hide history"
                            : `History (${history.length})`}
                        </Button>

                        {isHistoryOpen && (
                          <div className="mt-2 border-l border-border pl-4">
                            {history.length >
                            0 ? (
                              <div className="space-y-3">
                                {history.map(
                                  (log) => (
                                    <div
                                      key={
                                        log.id
                                      }
                                      className="text-xs"
                                    >
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-medium uppercase">
                                          Edit
                                        </span>

                                        <span className="text-muted-foreground">
                                          {formatDateTime(
                                            log.created_at,
                                          )}
                                        </span>
                                      </div>

                                      <p className="mt-0.5 text-muted-foreground">
                                        By{" "}
                                        {getPersonName(
                                          log.editor,
                                          log.edited_by,
                                        )}
                                      </p>

                                      <p className="mt-1 text-muted-foreground">
                                        Summary:{" "}
                                        {
                                          log.edit_summary
                                        }
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="py-2 text-xs text-muted-foreground">
                                No edit history yet.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Responsive actions */}
                      <div className="flex flex-wrap items-center gap-2 lg:hidden">
                        {canPreview && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              editResource.isPending ||
                              deleteResource.isPending ||
                              Boolean(
                                downloadingResourceId,
                              )
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
                              editResource.isPending ||
                              deleteResource.isPending ||
                              Boolean(
                                downloadingResourceId,
                              )
                            }
                            onClick={() =>
                              handleDownload(
                                resource,
                              )
                            }
                          >
                            {isDownloading ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Download
                          </Button>
                        )}

                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              editResource.isPending ||
                              deleteResource.isPending ||
                              Boolean(
                                downloadingResourceId,
                              )
                            }
                            onClick={() =>
                              openEdit(
                                resource,
                              )
                            }
                          >
                            {isEditing ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Edit
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              editResource.isPending ||
                              deleteResource.isPending ||
                              Boolean(
                                downloadingResourceId,
                              )
                            }
                            onClick={() =>
                              handleDelete(
                                resource,
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
                        )}
                      </div>
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        ) : resources &&
          resources.length > 0 ? (
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

      {/* Edit resource dialog */}
      <AlertDialog
        open={
          editingResource !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !editConfirmation &&
            !editResource.isPending
          ) {
            closeEdit();
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Edit resource
            </AlertDialogTitle>

            <AlertDialogDescription>
              Update the resource metadata using
              the same academic details used during
              upload. The uploaded file itself will
              not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4">
            <FormField
              label="Resource title"
              required
            >
              <Input
                value={editForm.title}
                onChange={(event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      title:
                        event.target.value,
                    }),
                  )
                }
                placeholder="Resource title"
                disabled={
                  editResource.isPending
                }
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={
                  editForm.description
                }
                onChange={(event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }),
                  )
                }
                placeholder="Resource description"
                disabled={
                  editResource.isPending
                }
                rows={4}
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Category">
                <select
                  value={
                    editForm.category_id
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        category_id:
                          event.target.value,
                      }),
                    )
                  }
                  disabled={
                    editResource.isPending
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    Uncategorized
                  </option>

                  {(
                    categories ?? []
                  ).map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Course code">
                <Input
                  value={
                    editForm.course_code
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        course_code:
                          event.target.value,
                      }),
                    )
                  }
                  placeholder="e.g. CSC 499"
                  disabled={
                    editResource.isPending
                  }
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="College">
                <select
                  value={
                    editForm.college
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        college:
                          event.target.value,
                        department:
                          "",
                      }),
                    )
                  }
                  disabled={
                    editResource.isPending
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    Select college
                  </option>

                  {colleges.map((college) => (
                    <option
                      key={college.id}
                      value={college.id}
                    >
                      {college.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Department">
                <select
                  value={
                    editForm.department
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        department:
                          event.target.value,
                      }),
                    )
                  }
                  disabled={
                    editResource.isPending ||
                    !editForm.college
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {editForm.college
                      ? "Select department"
                      : "Select college first"}
                  </option>

                  {availableDepartments.map(
                    (department) => (
                      <option
                        key={department}
                        value={
                          department
                        }
                      >
                        {
                          department
                        }
                      </option>
                    ),
                  )}
                </select>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Level">
                <select
                  value={
                    editForm.level
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        level:
                          event.target.value,
                      }),
                    )
                  }
                  disabled={
                    editResource.isPending
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    Select level
                  </option>

                  {levels.map(
                    (level) => (
                      <option
                        key={level}
                        value={level}
                      >
                        {level}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField label="Semester">
                <select
                  value={
                    editForm.semester
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        semester:
                          event.target.value,
                      }),
                    )
                  }
                  disabled={
                    editResource.isPending
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    Select semester
                  </option>

                  {semesters.map(
                    (semester) => (
                      <option
                        key={semester}
                        value={semester}
                      >
                        {semester}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField label="Year">
                <select
                  value={
                    editForm.year
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        year:
                          event.target.value,
                      }),
                    )
                  }
                  disabled={
                    editResource.isPending
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    Select year
                  </option>

                  {years.map(
                    (year) => (
                      <option
                        key={String(year)}
                        value={String(
                          year,
                        )}
                      >
                        {year}
                      </option>
                    ),
                  )}
                </select>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Author">
                <Input
                  value={
                    editForm.author
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        author:
                          event.target.value,
                      }),
                    )
                  }
                  placeholder="Author"
                  disabled={
                    editResource.isPending
                  }
                />
              </FormField>

              <FormField label="Tags">
                <Input
                  value={editForm.tags}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        tags: event.target.value,
                      }),
                    )
                  }
                  placeholder="e.g. exam, lecture, revision"
                  disabled={
                    editResource.isPending
                  }
                />

                <p className="mt-1 text-xs text-muted-foreground">
                  Separate multiple tags with commas.
                </p>
              </FormField>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                editResource.isPending
              }
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                requestEditSave();
              }}
              disabled={
                editResource.isPending ||
                !editForm.title.trim()
              }
            >
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit save confirmation */}
      <AlertDialog
        open={
          editConfirmation !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !editResource.isPending
          ) {
            setEditConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editConfirmation ===
              "no_changes"
                ? "No changes detected"
                : "Save resource changes?"}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {editConfirmation ===
              "no_changes" ? (
                <>
                  No resource details have changed.
                  Saving now will not modify the
                  resource or create an edit-history
                  entry.
                </>
              ) : (
                <>
                  You are about to update the details
                  of{" "}
                  <strong>
                    {editingResource?.title}
                  </strong>
                  . This change will be recorded in
                  the resource edit history.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {editConfirmation ===
            "changes" && (
            <div className="space-y-2">
              <label
                htmlFor="resource-edit-summary"
                className="text-sm font-medium"
              >
                Edit summary
                <span className="ml-1 text-destructive">
                  *
                </span>
              </label>

              <textarea
                id="resource-edit-summary"
                value={
                  editForm.edit_summary
                }
                onChange={(event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      edit_summary:
                        event.target.value,
                    }),
                  )
                }
                placeholder="Briefly explain what was changed and why…"
                disabled={
                  editResource.isPending
                }
                rows={3}
                maxLength={500}
                autoFocus
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <p className="text-xs text-muted-foreground">
                This summary will be permanently
                retained in the resource edit history.
              </p>
            </div>
          )}

          <AlertDialogFooter>
            {editConfirmation ===
            "no_changes" ? (
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  setEditConfirmation(null);
                }}
              >
                Close
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel
                  disabled={
                    editResource.isPending
                  }
                >
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    confirmEditSave();
                  }}
                  disabled={
                    editResource.isPending ||
                    !editForm.edit_summary.trim()
                  }
                >
                  {editResource.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}

                  Save changes
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview */}
      {previewResource && (
        <PreviewModal
          resource={
            previewResource
          }
          onClose={() =>
            setPreviewResource(null)
          }
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={
          pendingDelete !== null
        }
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
                {
                  pendingDelete?.title
                }
              </strong>
              ? The physical file will be
              permanently removed from Storage,
              but the database record will be
              retained for audit/history.
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
              A reason is required and will be
              retained with the resource audit
              record.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                deleteResource.isPending
              }
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

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}

        {required && (
          <span className="ml-1 text-destructive">
            *
          </span>
        )}
      </label>

      {children}
    </div>
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

function formatDateTime(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleString();
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

  const index = Math.min(
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    ),
    units.length - 1,
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
  const scrollRootRef =
    useRef<HTMLDivElement>(
      null,
    );

  const {
    data: previewUrl,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "admin-resource-preview-url",
      resource.id,
    ],
    queryFn: async () => {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (
        !session?.access_token
      ) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      return {
        url:
          `${import.meta.env.VITE_SUPABASE_URL}` +
          `/functions/v1/preview-resource?resourceId=${encodeURIComponent(
            resource.id,
          )}`,
        accessToken:
          session.access_token,
      };
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
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
          {isLoading ? (
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Preparing preview…
            </div>
          ) : error ? (
            <div className="flex min-h-[60vh] items-center justify-center text-center text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Preview could not be prepared."}
            </div>
          ) : previewUrl ? (
            <DocumentPreview
              url={previewUrl.url}
              token={
                previewUrl.accessToken
              }
              filePath={
                resource.file_path
              }
              title={
                resource.title
              }
              scrollRoot={
                scrollRootRef.current
              }
            />
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Preview unavailable.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}