import type { AppRole } from "./auth";

export function hasRole(
  roles: AppRole[],
  allowed: AppRole[],
) {
  return allowed.some((role) =>
    roles.includes(role),
  );
}

/* -------------------------------------------------------------------------- */
/* Role checks                                                                */
/* -------------------------------------------------------------------------- */

export function isAdmin(roles: AppRole[]) {
  return hasRole(roles, ["admin"]);
}

export function isCoAdmin(roles: AppRole[]) {
  return hasRole(roles, ["co-admin"]);
}

export function isLecturer(roles: AppRole[]) {
  return hasRole(roles, ["lecturer"]);
}

export function isStaff(roles: AppRole[]) {
  return hasRole(roles, ["staff"]);
}

export function isAdminOrCoAdmin(roles: AppRole[]) {
  return hasRole(roles, [
    "admin",
    "co-admin",
  ]);
}

/* -------------------------------------------------------------------------- */
/* Admin workspace                                                            */
/* -------------------------------------------------------------------------- */

export function canAccessAdmin(roles: AppRole[]) {
  return hasRole(roles, [
    "admin",
    "co-admin",
    "lecturer",
    "staff",
  ]);
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export function canViewAdminOverview(
  roles: AppRole[],
) {
  return canAccessAdmin(roles);
}

/* -------------------------------------------------------------------------- */
/* Approvals                                                                  */
/* -------------------------------------------------------------------------- */

export function canManageApprovals(
  roles: AppRole[],
) {
  return hasRole(roles, [
    "admin",
    "co-admin",
    "lecturer",
    "staff",
  ]);
}

/* -------------------------------------------------------------------------- */
/* Resources                                                                  */
/* -------------------------------------------------------------------------- */

export function canManageResources(
  roles: AppRole[],
) {
  return hasRole(roles, [
    "admin",
    "co-admin",
    "lecturer",
    "staff",
  ]);
}

/* -------------------------------------------------------------------------- */
/* Announcements                                                              */
/* -------------------------------------------------------------------------- */

export function canManageAnnouncements(
  roles: AppRole[],
) {
  return hasRole(roles, [
    "admin",
    "co-admin",
    "lecturer",
    "staff",
  ]);
}

/**
 * Whether the role can manage an announcement created by another user.
 *
 * Admin and co-admin have full announcement-management authority.
 * Lecturer and staff should normally manage their own announcements.
 */
export function canManageAllAnnouncements(
  roles: AppRole[],
) {
  return hasRole(roles, [
    "admin",
    "co-admin",
  ]);
}

/**
 * Whether a user can edit/delete a particular announcement.
 *
 * Admin/co-admin: any announcement.
 * Lecturer/staff: only their own.
 */
export function canManageAnnouncement(
  roles: AppRole[],
  announcementOwnerId: string | null | undefined,
  currentUserId: string | null | undefined,
) {
  if (!currentUserId) {
    return false;
  }

  if (canManageAllAnnouncements(roles)) {
    return true;
  }

  if (
    !hasRole(roles, [
      "lecturer",
      "staff",
    ])
  ) {
    return false;
  }

  return (
    Boolean(announcementOwnerId) &&
    announcementOwnerId === currentUserId
  );
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export function canManageCategories(
  roles: AppRole[],
) {
  return hasRole(roles, [
    "admin",
    "co-admin",
  ]);
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export function canManageUsers(
  roles: AppRole[],
) {
  return hasRole(roles, [
    "admin",
    "co-admin",
  ]);
}

export function canViewUserDetails(
  roles: AppRole[],
) {
  return canManageUsers(roles);
}

/* -------------------------------------------------------------------------- */
/* User role/status administration                                             */
/* -------------------------------------------------------------------------- */

export function canManageUserRoles(
  roles: AppRole[],
) {
  return canManageUsers(roles);
}

export function canManageUserStatuses(
  roles: AppRole[],
) {
  return canManageUsers(roles);
}

/**
 * Whether the current actor may modify a particular user's account.
 *
 * Admin:
 *   Can modify other users, including co-admins.
 *
 * Co-admin:
 *   Can modify other users except administrators.
 *
 * Nobody:
 *   Can modify their own account through administrative controls.
 */
export function canModifyUser(
  roles: AppRole[],
  currentUserId: string | null | undefined,
  targetUserId: string | null | undefined,
  targetRole: AppRole | null | undefined,
) {
  if (!currentUserId || !targetUserId) {
    return false;
  }

  if (currentUserId === targetUserId) {
    return false;
  }

  if (!canManageUsers(roles)) {
    return false;
  }

  if (
    isCoAdmin(roles) &&
    targetRole === "admin"
  ) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* System administration                                                       */
/* -------------------------------------------------------------------------- */

export function canManageSystem(
  roles: AppRole[],
) {
  return isAdmin(roles);
}

/* -------------------------------------------------------------------------- */
/* Legacy compatibility                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Kept for existing moderation code while the remaining admin routes
 * are migrated to explicit capability checks.
 *
 * This means "moderate" = approval/resource moderation,
 * not user or system administration.
 */
export function canModerate(
  roles: AppRole[],
) {
  return canManageApprovals(roles);
}

export function canModerateRole(
  role: AppRole | null | undefined,
) {
  if (!role) {
    return false;
  }

  return canModerate([role]);
}