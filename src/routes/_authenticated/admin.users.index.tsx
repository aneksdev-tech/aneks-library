import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  GraduationCap,
  Loader2,
  Search,
  Shield,
  UserCog,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AccountStatus, type AppRole } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();

    if (!u.user) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "login",
        },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_role")
      .eq("id", u.user.id)
      .single();

    if (
      !profile ||
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
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function UsersPage() {
  const qc = useQueryClient();

  const {
    user: currentUser,
    roles,
  } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [roleFilter, setRoleFilter] =
    useState("all");

  const [
    pendingAction,
    setPendingAction,
  ] = useState<PendingAction>(null);

  const {
    data,
    isLoading,
    isError,
  } = useQuery<UserProfile[]>({
    queryKey: ["admin-users"],

    queryFn: async () => {
      const { data, error } = await supabase
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
          ].join(", "),
        )
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

  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AccountStatus;
    }) => {
      const { error } =
        await supabase.rpc(
          "admin_set_user_status",
          {
            _target_user_id: id,
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
      id,
      role,
    }: {
      id: string;
      role: AppRole;
    }) => {
      const { error } =
        await supabase.rpc(
          "admin_set_user_role",
          {
            _target_user_id: id,
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
        queryKey: ["admin-users"],
      });

      setPendingAction(null);
    },

    onError: (error: Error) => {
      toast.error(error.message);
      setPendingAction(null);
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

    if (currentUser.id === target.id) {
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

    if (role === target.primary_role) {
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
      user: target,
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
        id: pendingAction.user.id,
        status: pendingAction.value,
      });

      return;
    }

    setRole.mutate({
      id: pendingAction.user.id,
      role: pendingAction.value,
    });
  };

  const actionLoading =
    setStatus.isPending ||
    setRole.isPending;

  /*
   * Users list
   */
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

                      return (
                        <tr
                          key={user.id}
                          className="transition-colors hover:bg-muted/30"
                        >
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

                          <td className="p-4 text-right">
                            {isSelf ? (
                              <span className="text-xs text-muted-foreground">
                                Your account
                              </span>
                            ) : (
                              <Link
                                to="/admin/users/$userId"
                                params={{
                                  userId: user.id,
                                }}
                                className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <UserCog className="mr-1 h-3.5 w-3.5" />
                                Details
                              </Link>
                            )}
                          </td>
                        </tr>
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
                    {
                      pendingAction.user
                        .full_name
                    }
                  </strong>{" "}
                  from{" "}
                  <strong>
                    {formatLabel(
                      pendingAction.user
                        .status,
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
                    {
                      pendingAction.user
                        .full_name
                    }
                  </strong>
                  's role from{" "}
                  <strong>
                    {formatLabel(
                      pendingAction.user
                        .primary_role,
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