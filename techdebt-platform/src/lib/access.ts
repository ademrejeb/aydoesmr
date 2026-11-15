/**
 * Client-side mirror of the API access matrix
 * (services/api/src/modules/organizations/access.matrix.ts).
 *
 * The sidebar and section visibility derive from this map so every role sees
 * exactly what the backend enforces. Keep the two files in sync — the admin
 * Roles tab renders the server catalog, this file drives navigation.
 */

export type OrgRoleName = "VIEWER" | "MEMBER" | "MANAGER" | "ADMIN" | "OWNER"

export const ROLE_RANK: Record<OrgRoleName, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
}

export const ACCESS_MATRIX: Record<OrgRoleName, string[]> = {
  VIEWER: ["view", "git_read", "service_read"],
  MEMBER: [
    "view",
    "git_read",
    "git_write",
    "task_edit",
    "project_create",
    "pipeline_run",
    "ai_use",
    "tokens",
    "service_read",
  ],
  MANAGER: [
    "view",
    "git_read",
    "git_write",
    "task_edit",
    "project_create",
    "pipeline_run",
    "pipeline_manage",
    "ai_use",
    "ai_manage",
    "tokens",
    "team_manage",
    "invites",
    "service_read",
    "service_manage",
  ],
  ADMIN: [
    "view",
    "git_read",
    "git_write",
    "task_edit",
    "project_create",
    "pipeline_run",
    "pipeline_manage",
    "ai_use",
    "ai_manage",
    "tokens",
    "team_manage",
    "invites",
    "service_read",
    "service_manage",
    "member_manage",
    "org_settings",
    "audit",
  ],
  OWNER: [
    "view",
    "git_read",
    "git_write",
    "task_edit",
    "project_create",
    "pipeline_run",
    "pipeline_manage",
    "ai_use",
    "ai_manage",
    "tokens",
    "team_manage",
    "invites",
    "service_read",
    "service_manage",
    "member_manage",
    "org_settings",
    "audit",
    "owner",
  ],
}

export function isOrgRole(role: string | null | undefined): role is OrgRoleName {
  return !!role && role in ROLE_RANK
}

/** Capabilities granted to a role. Unknown/absent roles get nothing. */
export function capabilitiesFor(role: string | null | undefined): Set<string> {
  if (!isOrgRole(role)) return new Set()
  return new Set(ACCESS_MATRIX[role])
}

export function can(role: string | null | undefined, capability: string): boolean {
  return capabilitiesFor(role).has(capability)
}

/** True when `role` is at least as high as `min`. Unknown roles rank below everything. */
export function atLeast(role: string | null | undefined, min: OrgRoleName): boolean {
  if (!isOrgRole(role)) return false
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

/**
 * Navigation gating — the single source of truth for which sidebar sections a
 * role can see. `cap` checks the capability matrix, `min` requires a minimum
 * role rank (used where the API gates by role rather than a named capability).
 * The sidebar filters with it and the admin Roles tab renders it, so the UI and
 * the API can never drift apart.
 */
export interface NavRequirement {
  key: string
  cap?: string
  min?: OrgRoleName
}

export interface NavSection {
  id: "workspace" | "engineering" | "service_desk" | "management" | "admin"
  items: NavRequirement[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    items: [
      { key: "overview", cap: "view" },
      { key: "projects", cap: "view" },
      { key: "repositories", cap: "git_read" },
      { key: "messages", cap: "view" },
      { key: "teams", cap: "view" },
    ],
  },
  {
    id: "engineering",
    items: [
      { key: "dev", cap: "git_read" },
      { key: "dev_rules", cap: "view" },
      { key: "issues", cap: "view" },
      { key: "pipelines", cap: "pipeline_run" },
      { key: "servers", cap: "view" },
      { key: "ai", cap: "ai_use" },
      { key: "agent_factory", cap: "ai_use" },
    ],
  },
  {
    id: "service_desk",
    items: [
      { key: "service_desk", cap: "service_read" },
      { key: "service_requests", cap: "service_read" },
      { key: "service_incidents", cap: "service_read" },
      { key: "service_knowledge", cap: "service_read" },
    ],
  },
  {
    id: "management",
    items: [
      { key: "timesheet", min: "MEMBER" },
      { key: "leave", min: "MEMBER" },
      { key: "leave_settings", min: "MANAGER" },
      { key: "holidays", cap: "view" },
      { key: "payroll", min: "MANAGER" },
    ],
  },
  {
    id: "admin",
    items: [{ key: "admin", cap: "org_settings" }],
  },
]

export function requirementSatisfied(role: string | null | undefined, req: NavRequirement): boolean {
  if (req.cap && !can(role, req.cap)) return false
  if (req.min && !atLeast(role, req.min)) return false
  return true
}
