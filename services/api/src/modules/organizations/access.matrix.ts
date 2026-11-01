import { OrgRole } from "@prisma/client"

export interface AccessCapability {
  key: string
  description: string
}

export interface AccessRole {
  role: OrgRole
  rank: number
  summary: string
  capabilities: string[]
}

export const ACCESS_CAPABILITIES: AccessCapability[] = [
  { key: "view", description: "Read organization data (projects, boards, members, messages)" },
  { key: "git_read", description: "Clone and read hosted repositories" },
  { key: "git_write", description: "Push commits and write to hosted repositories" },
  { key: "task_edit", description: "Create and edit tasks, add comments, move cards on the board" },
  { key: "project_create", description: "Create projects and repositories, run code scans" },
  { key: "pipeline_run", description: "Trigger pipeline runs and view run history" },
  { key: "pipeline_manage", description: "Create, edit, enable and delete CI/CD pipelines" },
  { key: "ai_use", description: "Use configured AI models in the playground" },
  { key: "ai_manage", description: "Connect and manage AI providers and API keys" },
  { key: "tokens", description: "Create and revoke personal access tokens" },
  { key: "service_read", description: "Browse the service catalog, submit tickets, follow and rate own tickets" },
  { key: "service_manage", description: "Manage service desk tickets, incidents, knowledge base and SLA policies" },
  { key: "team_manage", description: "Create and manage teams, sprints and workflows" },
  { key: "invites", description: "Send and revoke organization invitations" },
  { key: "member_manage", description: "Add, remove and change organization member roles" },
  { key: "org_settings", description: "Edit organization settings" },
  { key: "audit", description: "View the organization audit log" },
  { key: "owner", description: "Full ownership — billing, plan and final access decisions" },
]

export const ACCESS_MATRIX: Record<OrgRole, string[]> = {
  VIEWER: ["view", "git_read", "service_read"],
  MEMBER: ["view", "git_read", "git_write", "task_edit", "project_create", "pipeline_run", "ai_use", "tokens", "service_read"],
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

export const ACCESS_ROLES: AccessRole[] = [
  {
    role: OrgRole.VIEWER,
    rank: 0,
    summary: "Read-only access to projects, boards and repositories.",
    capabilities: ACCESS_MATRIX[OrgRole.VIEWER],
  },
  {
    role: OrgRole.MEMBER,
    rank: 1,
    summary: "Day-to-day contributor — can edit work, create projects and run scans.",
    capabilities: ACCESS_MATRIX[OrgRole.MEMBER],
  },
  {
    role: OrgRole.MANAGER,
    rank: 2,
    summary: "Leads teams, sprints, workflows and can send invitations.",
    capabilities: ACCESS_MATRIX[OrgRole.MANAGER],
  },
  {
    role: OrgRole.ADMIN,
    rank: 3,
    summary: "Manages members, roles, settings and the audit log.",
    capabilities: ACCESS_MATRIX[OrgRole.ADMIN],
  },
  {
    role: OrgRole.OWNER,
    rank: 4,
    summary: "Full control over the organization and billing.",
    capabilities: ACCESS_MATRIX[OrgRole.OWNER],
  },
]

export function accessCatalog() {
  return {
    capabilities: ACCESS_CAPABILITIES,
    roles: ACCESS_ROLES,
  }
}