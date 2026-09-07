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
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  GraduationCap,
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

export const Route = createFileRoute(
  "/_authenticated/admin/users/$userId",
)({
  beforeLoad: async () => {
  console.log(
    "[Admin User Details] BEFORELOAD START",
  );

  const { data: u, error: authError } =
    await supabase.auth.getUser();

  console.log(
    "[Admin User Details] AUTH RESULT:",
    {
      userId: u.user?.id,
      authError,
    },
  );

  if (!u.user) {
    console.warn(
      "[Admin User Details] NO AUTH USER → /auth",
    );

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
    .from("profiles")
    .select("primary_role, status")
    .eq("id", u.user.id)
    .single();

  console.log(
    "[Admin User Details] PROFILE RESULT:",
    {
      profile,
      profileError,
    },
  );

  if (profileError || !profile) {
    console.error(
      "[Admin User Details] PROFILE QUERY FAILED → /admin",
      {
        profileError,
      },
    );

    throw redirect({
      to: "/admin",
      replace: true,
    });
  }

  console.log(
    "[Admin User Details] AUTHORIZATION:",
    {
      role: profile.primary_role,
      status: profile.status,
    },
  );

  if (
    !["admin", "co-admin"].includes(
      profile.primary_role,
    )
  ) {
    console.warn(
      "[Admin User Details] INVALID ROLE → /admin",
      {
        role: profile.primary_role,
      },
    );

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

    console.warn(
      "[Admin User Details] INACTIVE ACCOUNT → redirect",
      {
        status: profile.status,
        targetPath,
      },
    );

    throw redirect({
      to: targetPath,
      replace: true,
    });
  }

  console.log(
    "[Admin User Details] BEFORELOAD PASSED",
  );
},

  component: UserDetailsPage,
});

const STATUSES: AccountStatus[] = [
  "active",
  "pending",
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

  const currentUserIsAdmin =
    roles?.includes("admin");

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
          .from("profiles")
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
    }: {
      status: AccountStatus;
    }) => {
      const { error } =
        await supabase.rpc(
          "admin_set_user_status",
          {
            _target_user_id: userId,
            _new_status: status,
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
    }: {
      role: AppRole;
    }) => {
      const { error } =
        await supabase.rpc(
          "admin_set_user_role",
          {
            _target_user_id: userId,
            _new_role: role,
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

    setPendingAction({
      type: "role",
      value: role,
    });
  };

  const confirmAction = () => {
    if (!pendingAction) {
      return;
    }

    if (
      pendingAction.type ===
      "status"
    ) {
      setStatus.mutate({
        status: pendingAction.value,
      });

      return;
    }

    setRole.mutate({
      role: pendingAction.value,
    });
  };

  const actionLoading =
    setStatus.isPending ||
    setRole.isPending;

  if (userLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
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
          className="px-0"
          onClick={() =>
            navigate({
              to: "/admin/users",
            })
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>

        <div className="border border-border bg-card p-8 text-center text-sm text-destructive">
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
          className="px-0"
          onClick={() =>
            navigate({
              to: "/admin/users",
            })
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>

        <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
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
      <div className="w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-2 -ml-3 px-3"
              onClick={() =>
                navigate({
                  to: "/admin/users",
                })
              }
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Users
            </Button>

            <h1 className="text-2xl font-semibold tracking-tight">
              User Details
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage this account and
              review its activity.
            </p>
          </div>

          <Link
            to="/admin/users"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Upload className="mr-2 h-4 w-4" />
            View Uploads
          </Link>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          {/* Left column */}
          <div className="space-y-5">
            {/* Profile */}
            <section className="border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                    {getInitials(
                      user.full_name ||
                        "User",
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {user.full_name ||
                          "Unnamed user"}
                      </h2>

                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span className="break-all">
                          {user.email ||
                            "No email"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RoleIcon className="h-4 w-4" />
                      {formatLabel(
                        user.primary_role,
                      )}
                    </div>
                  </div>

                  {user.bio && (
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {user.bio}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <section className="border border-border bg-card p-5 shadow-soft">
              <SectionHeading>
                Account Overview
              </SectionHeading>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <section className="border border-border bg-card p-5 shadow-soft">
              <SectionHeading>
                Subscription
              </SectionHeading>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
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
            <section className="border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <SectionHeading>
                  Resources
                </SectionHeading>

                <span className="text-xs text-muted-foreground">
                  {resources?.length ?? 0}{" "}
                  total
                </span>
              </div>

              {resourcesLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading resources...
                </div>
              ) : resources &&
                resources.length > 0 ? (
                <div className="mt-4 divide-y divide-border">
                  {resources
                    .slice(0, 8)
                    .map(
                      (resource) => (
                        <div
                          key={
                            resource.id
                          }
                          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {resource.title ||
                                  resource.file_name ||
                                  "Untitled resource"}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {resource.file_name ||
                                  "No file name"}
                                {" · "}
                                {formatFileSize(
                                  resource.file_size,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                <div className="mt-4 py-8 text-center text-sm text-muted-foreground">
                  This user has not
                  uploaded any resources.
                </div>
              )}

              {approvedResources.length >
                0 && (
                <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
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
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Role management */}
            <section className="border border-border bg-card p-5 shadow-soft">
              <SectionHeading>
                Account Controls
              </SectionHeading>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                    <SelectTrigger>
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
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                    <SelectTrigger>
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
                  <p className="text-xs leading-5 text-muted-foreground">
                    {currentUser?.id ===
                    user.id
                      ? "You cannot modify your own account from this page."
                      : "This account is restricted by your current administrator permissions."}
                  </p>
                )}
              </div>
            </section>

            {/* Account dates */}
            <section className="border border-border bg-card p-5 shadow-soft">
              <SectionHeading>
                Account Timeline
              </SectionHeading>

              <div className="space-y-4">
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
            <section className="border border-border bg-card p-5 shadow-soft">
              <SectionHeading>
                Recent Activity
              </SectionHeading>

              {recentActivity.length >
              0 ? (
                <div className="mt-4 space-y-4">
                  {recentActivity.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="relative pl-5"
                      >
                        <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-muted-foreground" />

                        <div>
                          <p className="text-sm font-medium">
                            {item.title}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {
                              item.description
                            }
                          </p>

                          <p className="mt-1 text-[11px] text-muted-foreground">
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
                <p className="mt-4 text-sm text-muted-foreground">
                  No recent activity
                  recorded.
                </p>
              )}
            </section>

            {/* Usage summary */}
            <section className="border border-border bg-card p-5 shadow-soft">
              <SectionHeading>
                Usage Summary
              </SectionHeading>

              <div className="mt-4 space-y-4">
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
        <section className="border border-border bg-card p-5 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Confirmed Actions
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Changes are applied through
                the protected admin RPCs.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
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
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm account change
            </AlertDialogTitle>

            <AlertDialogDescription>
              {pendingAction?.type ===
              "status" ? (
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
              ) : pendingAction?.type ===
                "role" ? (
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
              ) : (
                "Are you sure you want to make this change?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={actionLoading}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmAction();
              }}
              disabled={actionLoading}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
    <h2 className="text-sm font-semibold">
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
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {Icon && (
          <Icon className="h-3.5 w-3.5" />
        )}
        <span>{label}</span>
      </div>

      <p className="mt-1 break-words text-sm font-medium">
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
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground">
        {label}
      </span>

      <span className="text-right text-xs font-medium">
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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}