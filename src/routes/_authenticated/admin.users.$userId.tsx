import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  GraduationCap,
  History,
  Loader2,
  Mail,
  Phone,
  Shield,
  UserCog,
  UserRound,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuth,
  type AccountStatus,
  type AppRole,
} from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";

export const Route = createFileRoute(
  "/_authenticated/admin/users/$userId",
)({
  beforeLoad: async () => {
    const { data: u, error: authError } =
      await supabase.auth.getUser();

    if (authError || !u.user) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "login",
        },
      });
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("private_profiles")
      .select("primary_role, status")
      .eq("id", u.user.id)
      .single();

    if (profileError || !profile) {
      throw redirect({
        to: "/admin",
        replace: true,
      });
    }

    if (
      !profile.primary_role ||
      !["admin", "co-admin"].includes(
        profile.primary_role,
      )
    ) {
      throw redirect({
        to: "/admin",
        replace: true,
      });
    }

    if (profile.status !== "active") {
      const targetPath =
        profile.status === "pending"
          ? "/pending"
          : profile.status === "suspended"
            ? "/suspended"
            : profile.status === "rejected"
              ? "/rejected"
              : profile.status === "inactive"
                ? "/inactive"
                : "/pending";

      throw redirect({
        to: targetPath,
        replace: true,
      });
    }
  },

  component: UserDetailsPage,
});

const STATUSES: AccountStatus[] = [
  "active",
  "rejected",
  "suspended",
  "inactive",
];

const ROLES: AppRole[] = [
  "admin",
  "co-admin",
  "staff",
  "lecturer",
  "researcher",
  "student",
  "guest",
];

type DatabaseAppRole =
  Database["public"]["Enums"]["app_role"];

type SubscriptionPlan =
  Database["public"]["Enums"]["subscription_plan"];

type ProfileQueryRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  college: string | null;
  department: string | null;
  level: string | null;
  primary_role: DatabaseAppRole;
  status: AccountStatus;
  reputation: number;
  created_at: string;
  updated_at: string;
  subscription_plan: SubscriptionPlan;
  subscription_status: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  last_activity: string | null;
};

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  college: string | null;
  department: string | null;
  level: string | null;
  primary_role: AppRole;
  status: AccountStatus;
  reputation: number;
  created_at: string;
  updated_at: string;
  subscription_plan: SubscriptionPlan;
  subscription_status: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  last_activity: string | null;
};

type ResourceRow = {
  id: string;
  title: string | null;
  description: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  status: string | null;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
};

type UserAuditLog = {
  id: string;
  user_id: string;
  performed_by: string;
  action: string;
  reason: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
};

type PendingAction =
  | {
      type: "status";
      value: AccountStatus;
    }
  | {
      type: "role";
      value: AppRole;
    }
  | null;

function mapUserProfile(
  row: ProfileQueryRow,
): UserProfile {
  return {
    id: row.id,
    full_name: row.full_name ?? "",
    email: row.email ?? "",
    avatar_url: row.avatar_url,
    bio: row.bio,
    phone_number: row.phone_number,
    college: row.college,
    department: row.department,
    level: row.level,
    primary_role:
      row.primary_role as AppRole,
    status: row.status,
    reputation: row.reputation,
    created_at: row.created_at,
    updated_at: row.updated_at,
    subscription_plan:
      row.subscription_plan,
    subscription_status:
      row.subscription_status,
    subscription_started_at:
      row.subscription_started_at,
    subscription_expires_at:
      row.subscription_expires_at,
    last_activity:
      row.last_activity,
  };
}

function formatLabel(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(
  value: number | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    value <= 0
  ) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(
      value /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    value /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}

function getInitials(
  fullName: string,
) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function getRoleIcon(
  role: AppRole,
) {
  if (
    role === "student" ||
    role === "lecturer" ||
    role === "researcher"
  ) {
    return GraduationCap;
  }

  if (
    role === "admin" ||
    role === "co-admin" ||
    role === "staff"
  ) {
    return Shield;
  }

  return UserRound;
}

function getAuditChange(
  log: UserAuditLog,
) {
  let oldValue: unknown;
  let newValue: unknown;

  if (log.action === "role_changed") {
    oldValue = log.old_data?.primary_role;
    newValue = log.new_data?.primary_role;
  } else if (
    log.action === "status_changed"
  ) {
    oldValue = log.old_data?.status;
    newValue = log.new_data?.status;
  }

  if (
    typeof oldValue === "string" &&
    typeof newValue === "string"
  ) {
    return `${formatLabel(
      oldValue,
    )} → ${formatLabel(newValue)}`;
  }

  return "Change recorded";
}

function getAuditActionLabel(
  action: string,
) {
  switch (action) {
    case "role_changed":
      return "Role changed";

    case "status_changed":
      return "Status changed";

    default:
      return formatLabel(action);
  }
}

function UserDetailsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    user: currentUser,
    roles,
  } = useAuth();

  const { userId } =
    Route.useParams();

  const [pendingAction, setPendingAction] =
    useState<PendingAction>(null);

  const [actionReason, setActionReason] =
    useState("");

  const [showHistory, setShowHistory] =
    useState(false);

  const currentUserIsAdmin =
    roles?.includes("admin");

  const hasAdminAccess =
    Boolean(
      roles?.includes("admin") ||
        roles?.includes("co-admin"),
    );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (!roles) {
      return;
    }

    if (
      !roles.includes("admin") &&
      !roles.includes("co-admin")
    ) {
      void navigate({
        to: "/admin",
        replace: true,
      });
    }
  }, [
    currentUser,
    roles,
    navigate,
  ]);

  const {
    data: user,
    isLoading: userLoading,
    isError: userError,
  } = useQuery<UserProfile | null>({
    queryKey: [
      "admin-user-details",
      userId,
    ],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("private_profiles")
          .select(
            [
              "id",
              "full_name",
              "email",
              "avatar_url",
              "bio",
              "phone_number",
              "college",
              "department",
              "level",
              "primary_role",
              "status",
              "reputation",
              "created_at",
              "updated_at",
              "subscription_plan",
              "subscription_status",
              "subscription_started_at",
              "subscription_expires_at",
              "last_activity",
            ].join(", "),
          )
          .eq("id", userId)
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return mapUserProfile(
        data as unknown as ProfileQueryRow,
      );
    },
  });

  const {
    data: resources,
    isLoading: resourcesLoading,
  } = useQuery<ResourceRow[]>({
    queryKey: [
      "admin-user-resources",
      userId,
    ],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("resources")
          .select(
            [
              "id",
              "title",
              "description",
              "file_name",
              "file_size",
              "created_at",
              "status",
            ].join(", "),
          )
          .eq("uploader_id", userId)
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return (data ??
        []) as unknown as ResourceRow[];
    },
  });

  const {
    data: auditHistory,
    isLoading: auditHistoryLoading,
  } = useQuery<UserAuditLog[]>({
    queryKey: [
      "admin-user-audits",
      userId,
    ],

    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase
        .from("user_audit_logs")
        .select(
          [
            "id",
            "user_id",
            "performed_by",
            "action",
            "reason",
            "old_data",
            "new_data",
            "created_at",
          ].join(", "),
        )
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const logs =
        (data ??
          []) as unknown as UserAuditLog[];

      if (logs.length === 0) {
        return [];
      }

      const actorIds = Array.from(
        new Set(
          logs.map(
            (log) => log.performed_by,
          ),
        ),
      );

      const {
        data: actors,
        error: actorsError,
      } = await supabase
        .from("private_profiles")
        .select("id, full_name")
        .in("id", actorIds);

      if (actorsError) {
        throw actorsError;
      }

      const actorMap = new Map<
        string,
        string
      >();

      for (
        const actor of
          (actors ?? []).filter(
            (
              actor,
            ): actor is {
              id: string;
              full_name: string | null;
            } => Boolean(actor.id),
          )
      ) {
        actorMap.set(
          actor.id,
          actor.full_name ??
            "Unknown user",
        );
      }

      return logs.map((log) => ({
        ...log,
        actor_name:
          actorMap.get(
            log.performed_by,
          ) ?? "Unknown user",
      }));
    },
  });

  const approvedResources = useMemo(
    () =>
      (resources ?? []).filter(
        (resource) =>
          resource.status ===
          "approved",
      ),
    [resources],
  );

  const recentActivity =
    useMemo<ActivityItem[]>(
      () => {
        const items: ActivityItem[] =
          [];

        if (user?.created_at) {
          items.push({
            id: "registration",
            type: "account",
            title: "Account registered",
            description:
              "User account was created.",
            created_at:
              user.created_at,
          });
        }

        if (
          user?.subscription_started_at
        ) {
          items.push({
            id: "subscription-start",
            type: "subscription",
            title:
              "Subscription started",
            description: `${formatLabel(
              user.subscription_plan,
            )} plan started.`,
            created_at:
              user.subscription_started_at,
          });
        }

        if (user?.last_activity) {
          items.push({
            id: "last-activity",
            type: "activity",
            title: "Last activity",
            description:
              "Most recent recorded account activity.",
            created_at:
              user.last_activity,
          });
        }

        for (
          const resource of
            resources ?? []
        ) {
          items.push({
            id: `resource-${resource.id}`,
            type: "upload",
            title:
              resource.title ??
              resource.file_name ??
              "Resource uploaded",
            description:
              resource.status ===
              "approved"
                ? "Resource approved."
                : "Resource submitted.",
            created_at:
              resource.created_at,
          });
        }

        return items
          .sort(
            (a, b) =>
              new Date(
                b.created_at,
              ).getTime() -
              new Date(
                a.created_at,
              ).getTime(),
          )
          .slice(0, 8);
      },
      [
        user,
        resources,
      ],
    );

  const setStatus = useMutation({
    mutationFn: async ({
      status,
      reason,
    }: {
      status: AccountStatus;
      reason: string;
    }) => {
      const { error } =
        await supabase.rpc(
          "admin_set_user_status",
          {
            _target_user_id: userId,
            _new_status: status,
            _reason: reason,
          },
        );

      if (error) {
        throw error;
      }
    },

    onSuccess: (_, variables) => {
      toast.success(
        `Status changed to ${formatLabel(
          variables.status,
        )}.`,
      );

      qc.invalidateQueries({
        queryKey: [
          "admin-user-details",
          userId,
        ],
      });

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-user-audits",
          userId,
        ],
      });

      setActionReason("");
      setPendingAction(null);
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingAction(null);
    },
  });

  const setRole = useMutation({
    mutationFn: async ({
      role,
      reason,
    }: {
      role: AppRole;
      reason: string;
    }) => {
      const { error } =
        await supabase.rpc(
          "admin_set_user_role",
          {
            _target_user_id: userId,
            _new_role: role,
            _reason: reason,
          },
        );

      if (error) {
        throw error;
      }
    },

    onSuccess: (_, variables) => {
      toast.success(
        `Role changed to ${formatLabel(
          variables.role,
        )}.`,
      );

      qc.invalidateQueries({
        queryKey: [
          "admin-user-details",
          userId,
        ],
      });

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-user-audits",
          userId,
        ],
      });

      setActionReason("");
      setPendingAction(null);
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingAction(null);
    },
  });

  const canModifyUser =
    Boolean(
      currentUser &&
        user &&
        currentUser.id !== user.id &&
        (currentUserIsAdmin ||
          user.primary_role !==
            "admin"),
    );

  const requestStatusChange = (
    status: AccountStatus,
  ) => {
    if (!user) {
      return;
    }

    if (!canModifyUser) {
      toast.error(
        "You do not have permission to modify this user.",
      );
      return;
    }

    if (status === user.status) {
      return;
    }

    setActionReason("");

    setPendingAction({
      type: "status",
      value: status,
    });
  };

  const requestRoleChange = (
    role: AppRole,
  ) => {
    if (!user) {
      return;
    }

    if (!canModifyUser) {
      toast.error(
        "You do not have permission to modify this user.",
      );
      return;
    }

    if (role === user.primary_role) {
      return;
    }

    if (
      !currentUserIsAdmin &&
      role === "admin"
    ) {
      toast.error(
        "Co-admins cannot promote users to administrator.",
      );
      return;
    }

    setActionReason("");

    setPendingAction({
      type: "role",
      value: role,
    });
  };

  const confirmAction = () => {
    if (!pendingAction) {
      return;
    }

    const trimmedReason =
      actionReason.trim();

    if (!trimmedReason) {
      toast.error(
        "A reason is required for this change.",
      );
      return;
    }

    if (
      pendingAction.type ===
      "status"
    ) {
      setStatus.mutate({
        status: pendingAction.value,
        reason: trimmedReason,
      });

      return;
    }

    setRole.mutate({
      role: pendingAction.value,
      reason: trimmedReason,
    });
  };

  const actionLoading =
    setStatus.isPending ||
    setRole.isPending;

  if (
    currentUser &&
    roles &&
    !hasAdminAccess
  ) {
    return (
      <div className="flex min-h-[320px] items-center justify-center sm:min-h-[400px]">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
          Redirecting...
        </div>
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center sm:min-h-[400px]">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
          Loading user details...
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          className="h-8 px-0 text-xs sm:h-9 sm:text-sm"
          onClick={() =>
            navigate({
              to: "/admin/users",
            })
          }
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
          Back to Users
        </Button>

        <div className="border border-border bg-card p-5 text-center text-xs text-destructive sm:p-8 sm:text-sm">
          Failed to load user
          details.
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          className="h-8 px-0 text-xs sm:h-9 sm:text-sm"
          onClick={() =>
            navigate({
              to: "/admin/users",
            })
          }
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
          Back to Users
        </Button>

        <div className="border border-border bg-card p-5 text-center text-xs text-muted-foreground sm:p-8 sm:text-sm">
          User not found.
        </div>
      </div>
    );
  }

  const RoleIcon = getRoleIcon(
    user.primary_role,
  );

  const subscriptionActive =
    user.subscription_status
      .toLowerCase() === "active";

  return (
    <>
      <div className="w-full space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-1.5 -ml-2 h-8 px-2 text-xs sm:mb-2 sm:-ml-3 sm:h-9 sm:px-3 sm:text-sm"
              onClick={() =>
                navigate({
                  to: "/admin/users",
                })
              }
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              Back to Users
            </Button>

            <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">
              User Details
            </h1>

            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-normal">
              Manage this account and
              review its activity.
            </p>
          </div>

          <Link
            to="/admin/users"
            className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted sm:w-auto sm:text-sm"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
            View Uploads
          </Link>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[2fr_1fr]">
          {/* Left column */}
          <div className="space-y-4 sm:space-y-5">
            {/* Profile */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="h-16 w-16 shrink-0 rounded-full border border-border object-cover sm:h-20 sm:w-20"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold sm:h-20 sm:w-20 sm:text-lg">
                    {getInitials(
                      user.full_name ||
                        "User",
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold sm:text-xl">
                        {user.full_name ||
                          "Unnamed user"}
                      </h2>

                      <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground sm:items-center sm:gap-2 sm:text-sm">
                        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0 sm:h-4 sm:w-4" />
                        <span className="break-all">
                          {user.email ||
                            "No email"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
                      <RoleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {formatLabel(
                        user.primary_role,
                      )}
                    </div>
                  </div>

                  {user.bio && (
                    <p className="mt-3 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-4 sm:text-sm sm:leading-6">
                      {user.bio}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
                <InfoItem
                  icon={Phone}
                  label="Phone"
                  value={
                    user.phone_number ||
                    "—"
                  }
                />

                <InfoItem
                  icon={GraduationCap}
                  label="College"
                  value={
                    user.college ||
                    "—"
                  }
                />

                <InfoItem
                  icon={GraduationCap}
                  label="Department"
                  value={
                    user.department ||
                    "—"
                  }
                />

                <InfoItem
                  icon={GraduationCap}
                  label="Level"
                  value={
                    user.level ||
                    "—"
                  }
                />
              </div>
            </section>

            {/* Account overview */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <SectionHeading>
                Account Overview
              </SectionHeading>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-0 sm:grid-cols-2 sm:gap-4">
                <InfoItem
                  icon={Shield}
                  label="Role"
                  value={formatLabel(
                    user.primary_role,
                  )}
                />

                <InfoItem
                  icon={UserRound}
                  label="Status"
                  value={formatLabel(
                    user.status,
                  )}
                />

                <InfoItem
                  icon={UserCog}
                  label="Reputation"
                  value={String(
                    user.reputation,
                  )}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="Registered"
                  value={formatDate(
                    user.created_at,
                  )}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="Last activity"
                  value={formatDateTime(
                    user.last_activity,
                  )}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="Profile updated"
                  value={formatDateTime(
                    user.updated_at,
                  )}
                />
              </div>
            </section>

            {/* Subscription */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <SectionHeading>
                Subscription
              </SectionHeading>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-0 sm:grid-cols-2 sm:gap-4">
                <InfoItem
                  label="Plan"
                  value={formatLabel(
                    user.subscription_plan,
                  )}
                />

                <InfoItem
                  label="Status"
                  value={formatLabel(
                    user.subscription_status,
                  )}
                />

                <InfoItem
                  label="Started"
                  value={formatDate(
                    user.subscription_started_at,
                  )}
                />

                <InfoItem
                  label="Expires"
                  value={formatDate(
                    user.subscription_expires_at,
                  )}
                />
              </div>

              <div className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground sm:mt-4 sm:pt-4 sm:text-sm sm:leading-normal">
                {subscriptionActive ? (
                  <>
                    This account currently has
                    an active{" "}
                    <span className="font-medium text-foreground">
                      {formatLabel(
                        user.subscription_plan,
                      )}
                    </span>{" "}
                    subscription.
                  </>
                ) : (
                  <>
                    This account does not
                    currently have an active
                    subscription.
                  </>
                )}
              </div>
            </section>

            {/* Resources */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <SectionHeading>
                  Resources
                </SectionHeading>

                <span className="text-[10px] text-muted-foreground sm:text-xs">
                  {resources?.length ?? 0}{" "}
                  total
                </span>
              </div>

              {resourcesLoading ? (
                <div className="flex items-center justify-center py-7 text-xs text-muted-foreground sm:py-8 sm:text-sm">
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                  Loading resources...
                </div>
              ) : resources &&
                resources.length > 0 ? (
                <div className="mt-3 divide-y divide-border sm:mt-4">
                  {resources
                    .slice(0, 8)
                    .map(
                      (resource) => (
                        <div
                          key={
                            resource.id
                          }
                          className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-4"
                        >
                          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted sm:h-9 sm:w-9">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium sm:text-sm">
                                {resource.title ||
                                  resource.file_name ||
                                  "Untitled resource"}
                              </p>

                              <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                                {resource.file_name ||
                                  "No file name"}
                                {" · "}
                                {formatFileSize(
                                  resource.file_size,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-10 text-[10px] text-muted-foreground sm:gap-3 sm:pl-0 sm:text-xs">
                            <span>
                              {formatLabel(
                                resource.status ||
                                  "unknown",
                              )}
                            </span>

                            <span>
                              {formatDate(
                                resource.created_at,
                              )}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                </div>
              ) : (
                <div className="mt-3 py-7 text-center text-xs text-muted-foreground sm:mt-4 sm:py-8 sm:text-sm">
                  This user has not
                  uploaded any resources.
                </div>
              )}

              {approvedResources.length >
                0 && (
                <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground sm:mt-4 sm:pt-4 sm:text-sm">
                  <span className="font-medium text-foreground">
                    {
                      approvedResources.length
                    }
                  </span>{" "}
                  approved{" "}
                  {approvedResources.length ===
                  1
                    ? "resource"
                    : "resources"}
                </div>
              )}
            </section>

            {/* User audit history */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                  <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />

                  <SectionHeading>
                    User Audit History
                  </SectionHeading>
                </div>

                {auditHistory &&
                  auditHistory.length >
                    0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-1.5 text-[10px] sm:px-2 sm:text-xs"
                      onClick={() =>
                        setShowHistory(
                          (value) =>
                            !value,
                        )
                      }
                    >
                      {showHistory
                        ? "Hide history"
                        : `History (${auditHistory.length})`}
                    </Button>
                  )}
              </div>

              {auditHistoryLoading ? (
                <div className="flex items-center justify-center py-7 text-xs text-muted-foreground sm:py-8 sm:text-sm">
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                  Loading audit history...
                </div>
              ) : auditHistory &&
                auditHistory.length >
                  0 ? (
                showHistory ? (
                  <div className="mt-3 divide-y divide-border sm:mt-4">
                    {auditHistory.map(
                      (log) => (
                        <div
                          key={log.id}
                          className="py-3 sm:py-4"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-medium sm:text-sm">
                                {getAuditActionLabel(
                                  log.action,
                                )}
                              </p>

                              <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                                {getAuditChange(
                                  log,
                                )}
                              </p>
                            </div>

                            <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                              {formatDateTime(
                                log.created_at,
                              )}
                            </span>
                          </div>

                          <p className="mt-1.5 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs">
                            By{" "}
                            <span className="font-medium text-foreground">
                              {log.actor_name ??
                                "Unknown user"}
                            </span>
                          </p>

                          <div className="mt-1.5 border-l-2 border-border pl-2.5 sm:mt-2 sm:pl-3">
                            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                              <span className="font-medium text-foreground">
                                Reason:
                              </span>{" "}
                              {log.reason ||
                                "No reason recorded."}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="mt-2.5 text-[10px] text-muted-foreground sm:mt-3 sm:text-xs">
                    {auditHistory.length}{" "}
                    recorded{" "}
                    {auditHistory.length ===
                    1
                      ? "change"
                      : "changes"}.
                  </p>
                )
              ) : (
                <p className="mt-3 text-xs text-muted-foreground sm:mt-4 sm:text-sm">
                  No account changes have
                  been recorded yet.
                </p>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-4 sm:space-y-5">
            {/* Role management */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <SectionHeading>
                Account Controls
              </SectionHeading>

              <div className="mt-4 space-y-3 sm:mt-0 sm:space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:mb-2 sm:text-xs">
                    Role
                  </label>

                  <Select
                    value={
                      user.primary_role
                    }
                    onValueChange={(
                      value,
                    ) =>
                      requestRoleChange(
                        value as AppRole,
                      )
                    }
                    disabled={
                      !canModifyUser ||
                      setRole.isPending
                    }
                  >
                    <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {ROLES.map(
                        (role) => {
                          const blockedForCoAdmin =
                            !currentUserIsAdmin &&
                            role ===
                              "admin";

                          return (
                            <SelectItem
                              key={role}
                              value={role}
                              disabled={
                                blockedForCoAdmin
                              }
                            >
                              {formatLabel(
                                role,
                              )}
                            </SelectItem>
                          );
                        },
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:mb-2 sm:text-xs">
                    Account status
                  </label>

                  <Select
                    value={user.status}
                    onValueChange={(
                      value,
                    ) =>
                      requestStatusChange(
                        value as AccountStatus,
                      )
                    }
                    disabled={
                      !canModifyUser ||
                      setStatus.isPending
                    }
                  >
                    <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {STATUSES.map(
                        (status) => (
                          <SelectItem
                            key={status}
                            value={status}
                          >
                            {formatLabel(
                              status,
                            )}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {!canModifyUser && (
                  <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                    {currentUser?.id ===
                    user.id
                      ? "You cannot modify your own account from this page."
                      : "This account is restricted by your current administrator permissions."}
                  </p>
                )}
              </div>
            </section>

            {/* Account dates */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <SectionHeading>
                Account Timeline
              </SectionHeading>

              <div className="mt-4 space-y-3 sm:mt-0 sm:space-y-4">
                <TimelineItem
                  label="Registered"
                  value={formatDateTime(
                    user.created_at,
                  )}
                />

                <TimelineItem
                  label="Last activity"
                  value={formatDateTime(
                    user.last_activity,
                  )}
                />

                <TimelineItem
                  label="Last profile update"
                  value={formatDateTime(
                    user.updated_at,
                  )}
                />

                {user.subscription_started_at && (
                  <TimelineItem
                    label="Subscription started"
                    value={formatDateTime(
                      user.subscription_started_at,
                    )}
                  />
                )}

                {user.subscription_expires_at && (
                  <TimelineItem
                    label="Subscription expires"
                    value={formatDateTime(
                      user.subscription_expires_at,
                    )}
                  />
                )}
              </div>
            </section>

            {/* Activity */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <SectionHeading>
                Recent Activity
              </SectionHeading>

              {recentActivity.length >
              0 ? (
                <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                  {recentActivity.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="relative pl-4 sm:pl-5"
                      >
                        <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground sm:h-2 sm:w-2" />

                        <div>
                          <p className="text-xs font-medium sm:text-sm">
                            {item.title}
                          </p>

                          <p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                            {
                              item.description
                            }
                          </p>

                          <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
                            {formatDateTime(
                              item.created_at,
                            )}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground sm:mt-4 sm:text-sm">
                  No recent activity
                  recorded.
                </p>
              )}
            </section>

            {/* Usage summary */}
            <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
              <SectionHeading>
                Usage Summary
              </SectionHeading>

              <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                <SummaryRow
                  icon={Upload}
                  label="Uploads"
                  value={String(
                    resources?.length ??
                      0,
                  )}
                />

                <SummaryRow
                  icon={FileText}
                  label="Approved resources"
                  value={String(
                    approvedResources.length,
                  )}
                />

                <SummaryRow
                  icon={Download}
                  label="Downloads"
                  value="—"
                />
              </div>
            </section>
          </div>
        </div>

        {/* Confirmed actions */}
        <section className="border border-border bg-card p-3.5 shadow-soft sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-xs font-semibold sm:text-sm">
                Confirmed Actions
              </h2>

              <p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
                Changes are applied through
                the protected admin RPCs
                and recorded in the audit
                history.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
                disabled={
                  !canModifyUser ||
                  user.status ===
                    "active" ||
                  actionLoading
                }
                onClick={() =>
                  requestStatusChange(
                    "active",
                  )
                }
              >
                Set Active
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
                disabled={
                  !canModifyUser ||
                  user.status ===
                    "suspended" ||
                  actionLoading
                }
                onClick={() =>
                  requestStatusChange(
                    "suspended",
                  )
                }
              >
                Suspend
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
                disabled={
                  !canModifyUser ||
                  user.status ===
                    "inactive" ||
                  actionLoading
                }
                onClick={() =>
                  requestStatusChange(
                    "inactive",
                  )
                }
              >
                Set Inactive
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog
        open={
          pendingAction !== null
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !actionLoading
          ) {
            setPendingAction(null);
            setActionReason("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Confirm account change
            </AlertDialogTitle>

            <AlertDialogDescription className="text-xs leading-5 sm:text-sm sm:leading-normal">
              {pendingAction?.type ===
                "status" && (
                <>
                  Change{" "}
                  <strong>
                    {user.full_name ||
                      "this user"}
                  </strong>{" "}
                  from{" "}
                  <strong>
                    {formatLabel(
                      user.status,
                    )}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {formatLabel(
                      pendingAction.value,
                    )}
                  </strong>
                  ?
                </>
              )}

              {pendingAction?.type ===
                "role" && (
                <>
                  Change{" "}
                  <strong>
                    {user.full_name ||
                      "this user"}
                  </strong>
                  's role from{" "}
                  <strong>
                    {formatLabel(
                      user.primary_role,
                    )}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {formatLabel(
                      pendingAction.value,
                    )}
                  </strong>
                  ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2.5 sm:space-y-2">
            <label
              htmlFor="user-change-reason"
              className="text-xs font-medium sm:text-sm"
            >
              Reason
            </label>

            <Input
              id="user-change-reason"
              value={actionReason}
              onChange={(event) =>
                setActionReason(
                  event.target.value,
                )
              }
              placeholder="Enter a reason for this change..."
              disabled={actionLoading}
              autoComplete="off"
              className="h-9 text-xs sm:h-10 sm:text-sm"
            />

            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-normal">
              This reason will be saved in
              the user audit history.
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={actionLoading}
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmAction();
              }}
              disabled={
                actionLoading ||
                !actionReason.trim()
              }
              className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
            >
              {actionLoading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}

              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SectionHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h2 className="text-xs font-semibold sm:text-sm">
      {children}
    </h2>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:gap-2 sm:text-xs">
        {Icon && (
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        )}
        <span>{label}</span>
      </div>

      <p className="mt-1 break-words text-xs font-medium sm:text-sm">
        {value}
      </p>
    </div>
  );
}

function TimelineItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 sm:gap-4">
      <span className="text-[10px] text-muted-foreground sm:text-xs">
        {label}
      </span>

      <span className="text-right text-[10px] font-medium sm:text-xs">
        {value}
      </span>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Upload;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span>{label}</span>
      </div>

      <span className="text-xs font-semibold sm:text-sm">
        {value}
      </span>
    </div>
  );
}