import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  History,
  Loader2,
  Search,
  Shield,
  UserCog,
  UserRound,
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
import { Input } from "@/components/ui/input";
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
  "/_authenticated/admin/users/",
)({
  beforeLoad: async () => {
    const { data: u } =
      await supabase.auth.getUser();

    if (!u.user) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "login",
        },
      });
    }

    const { data: profile } =
      await supabase
        .from("private_profiles")
        .select("primary_role")
        .eq("id", u.user.id)
        .single();

    if (
      !profile ||
      !profile.primary_role ||
      !["admin", "co-admin"].includes(
        profile.primary_role,
      )
    ) {
      throw redirect({
        to: "/admin",
      });
    }
  },

  component: UsersPage,
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
};

type PendingAction =
  | {
      type: "status";
      user: UserProfile;
      value: AccountStatus;
    }
  | {
      type: "role";
      user: UserProfile;
      value: AppRole;
    }
  | null;

type UserAuditLog = {
  id: string;
  user_id: string;
  performed_by: string;
  action: string;
  reason: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  created_at: string;
};

type ActorProfile = {
  id: string;
  full_name: string | null;
};

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

    primary_role: row.primary_role as AppRole,
    status: row.status,
    reputation: row.reputation,

    created_at: row.created_at,
    updated_at: row.updated_at,

    subscription_plan: row.subscription_plan,
    subscription_status: row.subscription_status,
    subscription_started_at:
      row.subscription_started_at,
    subscription_expires_at:
      row.subscription_expires_at,
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

  return date.toLocaleString(
    undefined,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
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

function getActorLabel(
  performedBy: string | null | undefined,
  actorMap: Map<string, string>,
) {
  if (!performedBy) {
    return "System / SQL Editor";
  }

  return (
    actorMap.get(performedBy) ??
    "Unknown user"
  );
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
    return `${formatLabel(oldValue)} → ${formatLabel(
      newValue,
    )}`;
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

function UsersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const {
    user: currentUser,
    roles,
  } = useAuth();

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [roleFilter, setRoleFilter] =
    useState("all");

  const [
    pendingAction,
    setPendingAction,
  ] = useState<PendingAction>(null);

  const [actionReason, setActionReason] =
    useState("");

  const [
    expandedHistoryUserId,
    setExpandedHistoryUserId,
  ] = useState<string | null>(null);

  /*
   * Keep the currently open Users page
   * synchronized with the authenticated
   * user's permissions.
   *
   * The sidebar already reacts when the
   * authenticated user's role changes.
   * This guard makes the page itself react
   * as well instead of remaining accessible
   * simply because /admin/users was already
   * open in the browser.
   */
  useEffect(() => {
    const stillHasUserManagementAccess =
      roles?.includes("admin") ||
      roles?.includes("co-admin");

    if (
      currentUser &&
      roles &&
      !stillHasUserManagementAccess
    ) {
      toast.error(
        "Your account no longer has permission to access Users.",
      );

      navigate({
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
    data,
    isLoading,
    isError,
  } = useQuery<UserProfile[]>({
    queryKey: ["admin-users"],

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
      ].join(", "),
    )
    .neq("status", "pending")
    .order("created_at", {
      ascending: false,
    });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) =>
        mapUserProfile(
          row as unknown as ProfileQueryRow,
        ),
      );
    },
  });

  const {
    data: auditLogs,
    isLoading: auditLogsLoading,
  } = useQuery<UserAuditLog[]>({
    queryKey: [
      "admin-user-audits",
    ],

    queryFn: async () => {
      const { data, error } =
        await supabase
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
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as UserAuditLog[];
    },
  });

  const actorIds = useMemo(() => {
    return Array.from(
      new Set(
        (auditLogs ?? [])
          .map(
            (log) => log.performed_by,
          )
          .filter(Boolean),
      ),
    );
  }, [auditLogs]);

  const {
    data: actorProfiles,
  } = useQuery<ActorProfile[]>({
    queryKey: [
      "admin-user-audit-actors",
      actorIds,
    ],

    enabled: actorIds.length > 0,

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("private_profiles")
          .select("id, full_name")
          .in("id", actorIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as ActorProfile[];
    },
  });

  const actorMap = useMemo(() => {
    const map = new Map<
      string,
      string
    >();

    for (
      const actor of
        (actorProfiles ?? []).filter(
          (
            actor,
          ): actor is {
            id: string;
            full_name: string | null;
          } => Boolean(actor.id),
        )
    ) {
      if (actor.full_name?.trim()) {
        map.set(
          actor.id,
          actor.full_name.trim(),
        );
      }
    }

    return map;
  }, [actorProfiles]);

  const auditByUser = useMemo(() => {
    const map = new Map<
      string,
      UserAuditLog[]
    >();

    for (const log of auditLogs ?? []) {
      const existing =
        map.get(log.user_id) ?? [];

      existing.push(log);
      map.set(
        log.user_id,
        existing,
      );
    }

    return map;
  }, [auditLogs]);

  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: AccountStatus;
      reason: string;
    }) => {
      const trimmedReason =
        reason.trim();

      if (!trimmedReason) {
        throw new Error(
          "A reason is required.",
        );
      }

      const { data, error } =
        await supabase.rpc(
          "admin_set_user_status",
          {
            _target_user_id: id,
            _new_status: status,
            _reason: trimmedReason,
          },
        );

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: (
      changed,
      variables,
    ) => {
      if (!changed) {
        toast.success(
          "No changes were made.",
        );
      } else {
        toast.success(
          `Status changed to ${formatLabel(
            variables.status,
          )} and audit history recorded.`,
        );
      }

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-user-audits",
        ],
      });

      setPendingAction(null);
      setActionReason("");
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingAction(null);
      setActionReason("");
    },
  });

  const setRole = useMutation({
    mutationFn: async ({
      id,
      role,
      reason,
    }: {
      id: string;
      role: AppRole;
      reason: string;
    }) => {
      const trimmedReason =
        reason.trim();

      if (!trimmedReason) {
        throw new Error(
          "A reason is required.",
        );
      }

      const { data, error } =
        await supabase.rpc(
          "admin_set_user_role",
          {
            _target_user_id: id,
            _new_role: role,
            _reason: trimmedReason,
          },
        );

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: (
      changed,
      variables,
    ) => {
      if (!changed) {
        toast.success(
          "No changes were made.",
        );
      } else {
        toast.success(
          `Role changed to ${formatLabel(
            variables.role,
          )} and audit history recorded.`,
        );
      }

      qc.invalidateQueries({
        queryKey: ["admin-users"],
      });

      qc.invalidateQueries({
        queryKey: [
          "admin-user-audits",
        ],
      });

      setPendingAction(null);
      setActionReason("");
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingAction(null);
      setActionReason("");
    },
  });

  const filteredUsers = useMemo(() => {
    const users = data ?? [];

    const query = search
      .trim()
      .toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.full_name
          .toLowerCase()
          .includes(query) ||
        user.email
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        user.status === statusFilter;

      const matchesRole =
        roleFilter === "all" ||
        user.primary_role ===
          roleFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole
      );
    });
  }, [
    data,
    search,
    statusFilter,
    roleFilter,
  ]);

  const currentUserIsAdmin =
    roles?.includes("admin");

  const canModifyUser = (
    target: UserProfile,
  ) => {
    if (!currentUser) {
      return false;
    }

    if (
      currentUser.id === target.id
    ) {
      return false;
    }

    if (
      !currentUserIsAdmin &&
      target.primary_role === "admin"
    ) {
      return false;
    }

    return true;
  };

  const requestStatusChange = (
    target: UserProfile,
    status: AccountStatus,
  ) => {
    if (!canModifyUser(target)) {
      toast.error(
        "You do not have permission to modify this user.",
      );
      return;
    }

    if (status === target.status) {
      return;
    }

    setActionReason("");

    setPendingAction({
      type: "status",
      user: target,
      value: status,
    });
  };

  const requestRoleChange = (
    target: UserProfile,
    role: AppRole,
  ) => {
    if (!canModifyUser(target)) {
      toast.error(
        "You do not have permission to modify this user.",
      );
      return;
    }

    if (
      role === target.primary_role
    ) {
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
      user: target,
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
        "A reason is required before confirming this change.",
      );
      return;
    }

    if (
      pendingAction.type ===
      "status"
    ) {
      setStatus.mutate({
        id: pendingAction.user.id,
        status: pendingAction.value,
        reason: trimmedReason,
      });

      return;
    }

    setRole.mutate({
      id: pendingAction.user.id,
      role: pendingAction.value,
      reason: trimmedReason,
    });
  };

  const actionLoading =
    setStatus.isPending ||
    setRole.isPending;

  const toggleHistory = (
    userId: string,
  ) => {
    setExpandedHistoryUserId(
      (current) =>
        current === userId
          ? null
          : userId,
    );
  };

  return (
    <>
      <div className="w-full space-y-4">
        {/* Filters */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search by name or email..."
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={
                setStatusFilter
              }
            >
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All statuses
                </SelectItem>

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

            <Select
              value={roleFilter}
              onValueChange={
                setRoleFilter
              }
            >
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All roles
                </SelectItem>

                {ROLES.map((role) => (
                  <SelectItem
                    key={role}
                    value={role}
                  >
                    {formatLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isLoading
                ? "Loading users..."
                : `${filteredUsers.length} of ${
                    data?.length ?? 0
                  } users`}
            </span>

            {(search ||
              statusFilter !==
                "all" ||
              roleFilter !==
                "all") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setSearch("");
                  setStatusFilter(
                    "all",
                  );
                  setRoleFilter(
                    "all",
                  );
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* User table */}
        <div className="rounded-2xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4 font-medium">
                    User
                  </th>

                  <th className="p-4 font-medium">
                    Role
                  </th>

                  <th className="p-4 font-medium">
                    Status
                  </th>

                  <th className="p-4 font-medium">
                    Registered
                  </th>

                  <th className="p-4 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {isLoading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-10 text-center text-muted-foreground"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading users...
                      </div>
                    </td>
                  </tr>
                )}

                {isError &&
                  !isLoading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-10 text-center text-destructive"
                      >
                        Failed to load
                        users.
                      </td>
                    </tr>
                  )}

                {!isLoading &&
                  !isError &&
                  filteredUsers.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-10 text-center text-muted-foreground"
                      >
                        {data?.length
                          ? "No users match your search or filters."
                          : "No users found."}
                      </td>
                    </tr>
                  )}

                {!isLoading &&
                  !isError &&
                  filteredUsers.map(
                    (user) => {
                      const isSelf =
                        currentUser?.id ===
                        user.id;

                      const canModify =
                        canModifyUser(
                          user,
                        );

                      const RoleIcon =
                        getRoleIcon(
                          user.primary_role,
                        );

                      const userHistory =
                        auditByUser.get(
                          user.id,
                        ) ?? [];

                      const historyOpen =
                        expandedHistoryUserId ===
                        user.id;

                      return (
                        <Fragment
                          key={user.id}
                        >
                          <tr className="transition-colors hover:bg-muted/30">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {user.avatar_url ? (
                                  <img
                                    src={
                                      user.avatar_url
                                    }
                                    alt={
                                      user.full_name
                                    }
                                    className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                    {getInitials(
                                      user.full_name ||
                                        "User",
                                    )}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="font-medium">
                                    {user.full_name ||
                                      "Unnamed user"}

                                    {isSelf && (
                                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        (You)
                                      </span>
                                    )}
                                  </div>

                                  <div className="truncate text-xs text-muted-foreground">
                                    {user.email ||
                                      "—"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="p-4">
                              <Select
                                value={
                                  user.primary_role
                                }
                                onValueChange={(
                                  value,
                                ) =>
                                  requestRoleChange(
                                    user,
                                    value as AppRole,
                                  )
                                }
                                disabled={
                                  !canModify ||
                                  setRole.isPending
                                }
                              >
                                <SelectTrigger className="w-[160px]">
                                  <div className="flex items-center gap-2">
                                    <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue />
                                  </div>
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
                            </td>

                            <td className="p-4">
                              <Select
                                value={
                                  user.status
                                }
                                onValueChange={(
                                  value,
                                ) =>
                                  requestStatusChange(
                                    user,
                                    value as AccountStatus,
                                  )
                                }
                                disabled={
                                  !canModify ||
                                  setStatus.isPending
                                }
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                  {STATUSES.map(
                                    (
                                      status,
                                    ) => (
                                      <SelectItem
                                        key={
                                          status
                                        }
                                        value={
                                          status
                                        }
                                      >
                                        {formatLabel(
                                          status,
                                        )}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </td>

                            <td className="whitespace-nowrap p-4 text-muted-foreground">
                              {formatDate(
                                user.created_at,
                              )}
                            </td>

                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 px-2.5 text-muted-foreground"
                                  onClick={() =>
                                    toggleHistory(
                                      user.id,
                                    )
                                  }
                                >
                                  <History className="mr-1.5 h-3.5 w-3.5" />

                                  {historyOpen ? (
                                    <>
                                      Hide history
                                      <ChevronUp className="ml-1 h-3.5 w-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      History (
                                      {
                                        userHistory.length
                                      }
                                      )
                                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                    </>
                                  )}
                                </Button>

                                {isSelf ? (
                                  <span className="px-2 text-xs text-muted-foreground">
                                    Your account
                                  </span>
                                ) : (
                                  <Link
                                    to="/admin/users/$userId"
                                    params={{
                                      userId:
                                        user.id,
                                    }}
                                    className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <UserCog className="mr-1 h-3.5 w-3.5" />
                                    Details
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>

                          {historyOpen && (
                            <tr className="bg-muted/10">
                              <td
                                colSpan={5}
                                className="p-0"
                              >
                                <div className="border-t border-border px-4 py-4 sm:px-6">
                                  <div className="mb-3 flex items-center justify-between">
                                    <div>
                                      <h4 className="text-sm font-semibold">
                                        User history
                                      </h4>

                                      <p className="text-xs text-muted-foreground">
                                        Role and account-status changes recorded for this user.
                                      </p>
                                    </div>
                                  </div>

                                  {auditLogsLoading ? (
                                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Loading history...
                                    </div>
                                  ) : userHistory.length ===
                                    0 ? (
                                    <div className="py-6 text-sm text-muted-foreground">
                                      No account changes have been recorded for this user.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {userHistory.map(
                                        (log) => (
                                          <div
                                            key={
                                              log.id
                                            }
                                            className="border-l-2 border-border pl-4"
                                          >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                              <div>
                                                <div className="text-sm font-medium">
                                                  {getAuditActionLabel(
                                                    log.action,
                                                  )}
                                                </div>

                                                <div className="text-xs text-muted-foreground">
                                                  {getAuditChange(
                                                    log,
                                                  )}
                                                </div>
                                              </div>

                                              <div className="text-xs text-muted-foreground sm:text-right">
                                                {formatDateTime(
                                                  log.created_at,
                                                )}
                                              </div>
                                            </div>

                                            <div className="mt-2 text-xs text-muted-foreground">
                                              By{" "}
                                              <span className="font-medium text-foreground">
                                                {getActorLabel(
                                                  log.performed_by,
                                                  actorMap,
                                                )}
                                              </span>
                                            </div>

                                            <div className="mt-1 text-xs text-muted-foreground">
                                              Reason:{" "}
                                              <span className="text-foreground">
                                                {log.reason ||
                                                  "—"}
                                              </span>
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    },
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation dialog for table-level changes */}
      <AlertDialog
        open={pendingAction !== null}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm account change
            </AlertDialogTitle>

            <AlertDialogDescription>
              {pendingAction?.type ===
                "status" && (
                <>
                  Change{" "}
                  <strong>
                    {pendingAction.user.full_name}
                  </strong>{" "}
                  from{" "}
                  <strong>
                    {formatLabel(
                      pendingAction.user.status,
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
                    {pendingAction.user.full_name}
                  </strong>
                  's role from{" "}
                  <strong>
                    {formatLabel(
                      pendingAction.user.primary_role,
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

          <div className="space-y-2">
            <label
              htmlFor="user-change-reason"
              className="text-sm font-medium"
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
            />

            <p className="text-xs text-muted-foreground">
              This reason will be saved in
              the user audit history.
            </p>
          </div>

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
              disabled={
                actionLoading ||
                !actionReason.trim()
              }
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