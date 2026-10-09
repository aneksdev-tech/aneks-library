import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  colleges,
  levels,
  semesters,
  getDepartments,
  ALL_OPTION,
} from "@/lib/academicData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute(
  "/_authenticated/academic/",
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

    if (profile.primary_role !== "lecturer") {
      throw redirect({
        to: "/dashboard",
        replace: true,
      });
    }
  },

  head: () => ({
    meta: [
      {
        title: "Resource Approvals | Academic | Aneks Library",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),

  component: AcademicApprovals,
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
  college: string | null;
  department: string | null;
  level: string | null;
  semester: string | null;
  year: number | null;
  created_at: string;
  status: ResourceStatus;
  uploader_id: string;
  category?: {
    id?: string | null;
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

function AcademicApprovals() {
  const {
    user,
    profile,
    roles,
    loading,
  } = useAuth();

  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const [searchQuery, setSearchQuery] =
    useState("");

  const [collegeFilter, setCollegeFilter] =
    useState(ALL_OPTION);

  const [departmentFilter, setDepartmentFilter] =
    useState(ALL_OPTION);

  const [levelFilter, setLevelFilter] =
    useState(ALL_OPTION);

  const [semesterFilter, setSemesterFilter] =
    useState(ALL_OPTION);

  const [categoryFilter, setCategoryFilter] =
    useState(ALL_OPTION);

  const departments =
    collegeFilter === ALL_OPTION
      ? []
      : getDepartments(collegeFilter);

  /*
   * Keep the page reactive if the lecturer's role
   * changes while this page is open.
   *
   * AuthProvider already receives the realtime
   * profile_access_changed event and updates roles.
   */
  useEffect(() => {
    if (
      loading ||
      !profile ||
      !user
    ) {
      return;
    }

    if (
      profile.status !== "active" ||
      !roles?.includes("lecturer")
    ) {
      toast.error(
        "Your account no longer has permission to access the Academic Workspace.",
      );

      navigate({
        to: "/dashboard",
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

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ["academic-pending-resources"],

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
            college,
            department,
            level,
            semester,
            year,
            created_at,
            status,
            uploader_id,
            category:categories(id, name, deleted_at)
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
    data: cats,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const {
        data: categories,
        error,
      } = await supabase
        .from("categories")
        .select("id, name, slug")
        .is("deleted_at", null)
        .order("sort_order");

      if (error) {
        throw error;
      }

      return categories ?? [];
    },
  });

  const filteredResources = useMemo(() => {
    const normalizedSearch =
      searchQuery.trim().toLowerCase();

    return (data ?? []).filter(
      (resource) => {
        const categoryId =
          resource.category?.id ??
          ALL_OPTION;

        const categoryName =
          resource.category
            ?.deleted_at == null
            ? resource.category?.name?.trim() ??
              ""
            : "";

        const matchesSearch =
          !normalizedSearch ||
          [
            resource.title,
            resource.file_name,
            resource.description,
            resource.course_code,
            resource.college,
            resource.department,
            resource.level,
            resource.semester,
            resource.year,
            categoryName,
            resource.uploader
              ?.full_name,
            resource.uploader
              ?.email,
          ]
            .filter(
              (value) =>
                value !== null &&
                value !== undefined &&
                value !== "",
            )
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(
                  normalizedSearch,
                ),
            );

        const matchesCollege =
          collegeFilter ===
            ALL_OPTION ||
          resource.college ===
            collegeFilter;

        const matchesDepartment =
          departmentFilter ===
            ALL_OPTION ||
          resource.department ===
            departmentFilter;

        const matchesLevel =
          levelFilter ===
            ALL_OPTION ||
          resource.level ===
            levelFilter;

        const matchesSemester =
          semesterFilter ===
            ALL_OPTION ||
          resource.semester ===
            semesterFilter;

        const matchesCategory =
          categoryFilter ===
            ALL_OPTION ||
          categoryId ===
            categoryFilter;

        return (
          matchesSearch &&
          matchesCollege &&
          matchesDepartment &&
          matchesLevel &&
          matchesSemester &&
          matchesCategory
        );
      },
    );
  }, [
    data,
    searchQuery,
    collegeFilter,
    departmentFilter,
    levelFilter,
    semesterFilter,
    categoryFilter,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    collegeFilter !== ALL_OPTION ||
    departmentFilter !== ALL_OPTION ||
    levelFilter !== ALL_OPTION ||
    semesterFilter !== ALL_OPTION ||
    categoryFilter !== ALL_OPTION;

  const clearFilters = () => {
    setSearchQuery("");
    setCollegeFilter(ALL_OPTION);
    setDepartmentFilter(ALL_OPTION);
    setLevelFilter(ALL_OPTION);
    setSemesterFilter(ALL_OPTION);
    setCategoryFilter(ALL_OPTION);
  };

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
            _approval_reason:
              normalizedReason,
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
        queryKey: [
          "academic-pending-resources",
        ],
      });

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

  const decisionLoading =
    decide.isPending;

  return (
    <>
      <section className="space-y-5 sm:space-y-6">
        {/* Header */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold sm:text-xs sm:tracking-[0.22em]">
            Academic
          </p>

          <h1 className="mt-1 font-display text-lg font-semibold tracking-tight sm:mt-2 sm:text-3xl">
            Resource Approvals
          </h1>

          <p className="mt-1.5 max-w-3xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-base sm:leading-normal">
            Review academic resources submitted to Aneks Library and
            approve or reject them based on their content and quality.
          </p>
        </section>

        {/* Pending resources */}
        <div className="flex items-center gap-2.5 border-b border-border pb-3 sm:gap-3 sm:pb-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted sm:h-9 sm:w-9">
            <Clock3 className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <p className="text-xs font-semibold sm:text-sm">
                Pending Resources
              </p>

                            <span
                 className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] leading-none font-semibold text-gold-foreground sm:h-5 sm:w-5 sm:text-[10px]"
                aria-label={`${data?.length ?? 0} pending resources`}
              >
                {(data?.length ?? 0) > 99
                  ? "99+"
                  : data?.length ?? 0}
              </span>
              </div>

            <p className="text-[10px] text-muted-foreground sm:text-xs">
              Resources awaiting academic review
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-4">
          <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
            {/* Search */}
            <div className="relative md:col-span-2 xl:col-span-3">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:h-4 sm:w-4" />

              <Input
                placeholder="Search title, course code, description…"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                aria-label="Search pending resources"
                className="h-9 pl-9 text-xs sm:h-10 sm:text-sm"
              />
            </div>

            {/* Category */}
            <Select
              value={categoryFilter}
              onValueChange={
                setCategoryFilter
              }
            >
              <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem
                  value={ALL_OPTION}
                >
                  All Categories
                </SelectItem>

                {cats?.map((category) => (
                  <SelectItem
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* College */}
            <Select
              value={collegeFilter}
              onValueChange={(value) => {
                setCollegeFilter(value);
                setDepartmentFilter(
                  ALL_OPTION,
                );
              }}
            >
              <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                <SelectValue placeholder="College" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem
                  value={ALL_OPTION}
                >
                  All Colleges
                </SelectItem>

                {colleges.map(
                  (college) => (
                    <SelectItem
                      key={college.id}
                      value={college.id}
                    >
                      <>
                        <span className="sm:hidden">
                          {college.id}
                        </span>

                        <span className="hidden sm:inline">
                          {college.name} (
                          {college.id})
                        </span>
                      </>
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            {/* Department */}
            <Select
              value={departmentFilter}
              onValueChange={
                setDepartmentFilter
              }
            >
              <SelectTrigger
                className={`h-9 text-xs sm:h-10 sm:text-sm ${
                  collegeFilter ===
                  ALL_OPTION
                    ? "opacity-60"
                    : ""
                }`}
              >
                <span>
                  {departmentFilter ===
                  ALL_OPTION
                    ? "All Departments"
                    : departmentFilter}
                </span>
              </SelectTrigger>

              <SelectContent>
                {collegeFilter ===
                ALL_OPTION ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Select College first
                  </div>
                ) : (
                  <>
                    <SelectItem
                      value={ALL_OPTION}
                    >
                      All Departments
                    </SelectItem>

                    {departments.map(
                      (department) => (
                        <SelectItem
                          key={department}
                          value={department}
                        >
                          {department}
                        </SelectItem>
                      ),
                    )}
                  </>
                )}
              </SelectContent>
            </Select>

            {/* Level */}
            <Select
              value={levelFilter}
              onValueChange={
                setLevelFilter
              }
            >
              <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                <SelectValue placeholder="Level" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem
                  value={ALL_OPTION}
                >
                  All Levels
                </SelectItem>

                {levels.map(
                  (item) => (
                    <SelectItem
                      key={item}
                      value={item}
                    >
                      {item}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            {/* Semester */}
            <Select
              value={semesterFilter}
              onValueChange={
                setSemesterFilter
              }
            >
              <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem
                  value={ALL_OPTION}
                >
                  All Semesters
                </SelectItem>

                {semesters.map(
                  (item) => (
                    <SelectItem
                      key={item}
                      value={item}
                    >
                      {item}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="mt-2.5 flex items-center justify-between gap-2 sm:mt-3">
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {
                    filteredResources.length
                  }
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {data?.length ?? 0}
                </span>{" "}
                pending{" "}
                {(data?.length ?? 0) ===
                1
                  ? "resource"
                  : "resources"}
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="shrink-0 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Resource queue */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft sm:rounded-xl">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                Loading review queue…
              </div>
            </div>
          ) : filteredResources.length >
            0 ? (
            <ul>
              {filteredResources.map(
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
                      className="group border-b-2 border-border/70 p-3.5 transition-colors odd:bg-card even:bg-muted/40 hover:bg-muted/50 sm:p-5"
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
                                {
                                  categoryName
                                }
                              </span>
                            </div>

                            <div className="mt-1.5 min-w-0 sm:mt-2">
                              <p className="break-words text-sm font-semibold leading-5 text-foreground sm:text-lg sm:leading-6">
                                {
                                  resource.title
                                }
                              </p>

                              <p className="mt-1 break-all text-[10px] text-muted-foreground sm:text-xs">
                                {resource.file_name || "Unnamed file"}
                              </p>

                              {resource.description && (
                                <p className="mt-2 max-w-4xl line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
                                  {
                                    resource.description
                                  }
                                </p>
                              )}
                            </div>
                            </div>
                        </div>

<div className="mt-3 grid gap-3 text-[10px] sm:grid-cols-2 sm:gap-4 sm:text-xs xl:grid-cols-3">
  <AuditItem
    label="File size"
    value={formatFileSize(resource.file_size)}
  />

  <AuditItem
    label="Course code"
    value={resource.course_code || "Not provided"}
  />

  <AuditItem
    label="College"
    value={resource.college || "Not provided"}
  />

  <AuditItem
    label="Department"
    value={resource.department || "Not provided"}
  />

  <AuditItem
    label="Level"
    value={resource.level || "Not provided"}
  />

  <AuditItem
    label="Semester"
    value={resource.semester || "Not provided"}
  />

  <AuditItem
    label="Year"
    value={resource.year?.toString() || "Not provided"}
  />
</div>

                        {/* Resource metadata */}
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


                        {/* Resource actions */}
                        <div className="grid w-full grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-3 sm:gap-3 sm:pt-4">
                          {canPreview && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={decisionLoading}
                              onClick={() =>
                                setPreviewResource({
                                  id: resource.id,
                                  title: resource.title,
                                  file_path: resource.file_path,
                                })
                              }
                              className="h-9 w-full min-w-0 text-xs sm:h-10 sm:text-sm"
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                              Preview
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            disabled={decisionLoading}
                            onClick={() =>
                              requestReject(
                                resource.id,
                                resource.file_path,
                                resource.title,
                              )
                            }
                            className="h-9 w-full min-w-0 text-xs text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive sm:h-10 sm:text-sm"
                          >
                            {isProcessing &&
                            !decide.variables?.approve ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <X className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                            )}
                            Reject
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            disabled={decisionLoading}
                            onClick={() =>
                              requestApprove(
                                resource.id,
                                resource.file_path,
                                resource.title,
                              )
                            }
                            className="h-9 w-full min-w-0 text-xs text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 sm:h-10 sm:text-sm"
                          >
                            {isProcessing &&
                            decide.variables?.approve ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
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
          ) : hasActiveFilters ? (
            <EmptyState
              title="No matching resources"
              desc="No pending resources match the selected filters."
            />
          ) : (
            <EmptyState
              title="No pending resources"
              desc="No resources are waiting for academic review right now."
            />
          )}
        </div>
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
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {pendingDecision?.type ===
              "approve"
                ? "Approve resource?"
                : "Reject resource?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {pendingDecision ? (
                pendingDecision.type === "approve" ? (
                  <>
                    Are you sure you want to
                    approve{" "}
                    <strong>
                      {pendingDecision.title}
                    </strong>
                    ? The resource will become
                    available in the Library and the
                    uploader will receive a notification.
                  </>
                ) : (
                  <>
                    Are you sure you want to
                    reject{" "}
                    <strong>
                      {pendingDecision.title}
                    </strong>
                    ? The uploaded file will be
                    permanently removed, while the
                    resource record will be retained
                    for history.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision && (
            <div className="space-y-1.5 sm:space-y-2">
              <label
                htmlFor="academic-resource-decision-reason"
                className="text-xs font-medium sm:text-sm"
              >
                {pendingDecision.type ===
                "approve"
                  ? "Approval reason"
                  : "Rejection reason"}
              </label>

              <Input
                id="academic-resource-decision-reason"
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

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={
                decisionLoading
              }
              className="h-9 text-xs sm:h-10 sm:text-sm"
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
              className={`h-9 text-xs sm:h-10 sm:text-sm ${
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
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:px-2 sm:text-[10px] ${item.className}`}
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
      "academic-preview-url",
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
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[95vh] sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-border px-3.5 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium sm:text-base">
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
