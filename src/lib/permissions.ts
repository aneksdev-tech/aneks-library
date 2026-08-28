import { AppRole } from "./auth";

export function hasRole(
  roles: AppRole[],
  allowed: AppRole[],
) {
  return allowed.some((role) => roles.includes(role));
}

export function isAdmin(roles: AppRole[]) {
  return hasRole(roles, ["admin"]);
}

export function isCoAdmin(roles: AppRole[]) {
  return hasRole(roles, ["co-admin"]);
}

export function isStaff(roles: AppRole[]) {
  return hasRole(roles, [
    "staff",
    "lecturer",
    "co-admin",
    "admin",
  ]);
}

export function canModerate(roles: AppRole[]) {
  return hasRole(roles, [
    "staff",
    "lecturer",
    "co-admin",
    "admin",
  ]);
}

export function canManageUsers(roles: AppRole[]) {
  return hasRole(roles, [
    "co-admin",
    "admin",
  ]);
}

export function canManageSystem(roles: AppRole[]) {
  return hasRole(roles, [
    "admin",
  ]);
}

export function canModerateRole(role: AppRole | null | undefined) {
  if (!role) return false;

  return canModerate([role]);
}