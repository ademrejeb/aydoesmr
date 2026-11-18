import type { PolicyCondition, PolicyEffect } from "./policy.engine"

export interface DefaultPolicy {
  key: string
  name: string
  description: string
  category: string
  subject: string
  effect: PolicyEffect
  priority: number
  conditions: PolicyCondition[]
  actions: Record<string, unknown>
}

/**
 * Baseline governance. These are conservative, deterministic rules created
 * lazily for an organization the first time policies are listed or evaluated.
 * They never grant authority: they only require a human or deny an action.
 */
export const DEFAULT_POLICIES: DefaultPolicy[] = [
  {
    key: "factory.merge-human-approval",
    name: "Human approval before merge",
    description: "Factory branches can only be merged after a human approval at the MERGE stage.",
    category: "git",
    subject: "factory.merge",
    effect: "REQUIRE_APPROVAL",
    priority: 900,
    conditions: [],
    actions: {
      approvalRole: "MANAGER",
      message: "Merging a factory branch requires a human MANAGER approval.",
    },
  },
  {
    key: "factory.patch-protected-paths",
    name: "Protected path patch approval",
    description: "Patches touching auth, secrets, billing or infrastructure need explicit approval.",
    category: "security",
    subject: "factory.patch",
    effect: "REQUIRE_APPROVAL",
    priority: 850,
    conditions: [{ key: "patch.touchesProtectedPath", op: "eq", value: true }],
    actions: {
      approvalRole: "MANAGER",
      message: "The patch touches a protected path and needs human approval before it is committed.",
    },
  },
  {
    key: "factory.review-same-agent-deny",
    name: "Independent review",
    description: "The agent that produced a change cannot approve its own work.",
    category: "agent",
    subject: "factory.review",
    effect: "DENY",
    priority: 950,
    conditions: [{ key: "review.sameAgent", op: "eq", value: true }],
    actions: {
      message: "A coding agent cannot approve its own changes. Use a human or a different agent profile.",
    },
  },
  {
    key: "deployment.production-approval",
    name: "Production deployment approval",
    description: "Production deployments require an explicit human approval.",
    category: "deployment",
    subject: "deployment.execute",
    effect: "REQUIRE_APPROVAL",
    priority: 900,
    conditions: [{ key: "deployment.environment", op: "eq", value: "production" }],
    actions: {
      approvalRole: "MANAGER",
      message: "Production deployment requires a human approval.",
    },
  },
]
