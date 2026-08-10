import type { Role } from "@victron-ems14a/domain";

export type Permission =
  | "grid:read"
  | "grid:write"
  | "comfort:write"
  | "status:read"
  | "audit:read"
  | "install:configure";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  enduser: ["grid:read", "comfort:write", "status:read"],
  installer: [
    "grid:read",
    "grid:write",
    "comfort:write",
    "status:read",
    "audit:read",
    "install:configure",
  ],
  system: ["grid:read", "grid:write", "status:read", "audit:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    const err = new Error(`Role '${role}' lacks permission '${permission}'`);
    err.name = "ForbiddenError";
    throw err;
  }
}
