/**
 * Deterministic policy evaluator.
 *
 * Rules govern *actions* at execution boundaries, not source patterns: code
 * quality rules stay in the Rust engine (`crates/td-rules`). Evaluation is
 * pure and synchronous so the same input always yields the same decision;
 * persistence and audit happen in `PoliciesService`.
 *
 * Ordering: higher priority first, then the most specific scope
 * (repository > project > organization), then `key` for a stable tie-break.
 * The first matching rule wins. No match means allow — callers still enforce
 * their own hard requirements (tenant ownership, state transitions).
 */

export type PolicyEffect = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "WARN"

export type PolicyOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "exists"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "starts_with"
  | "contains"
  | "overlaps"
  | "glob"

export interface PolicyCondition {
  key: string
  op: PolicyOperator
  value?: unknown
}

export interface PolicyRuleLike {
  id: string
  key: string
  name: string
  effect: PolicyEffect | string
  priority: number
  scope: string
  subject: string
  projectId?: string | null
  repositoryId?: string | null
  conditions: unknown
  actions: unknown
  createdAt?: Date | string | null
}

export interface PolicyInput {
  subject: string
  action?: string
  projectId?: string | null
  repositoryId?: string | null
  context?: Record<string, unknown>
}

export interface PolicyDecision {
  allowed: boolean
  decision: PolicyEffect
  requiresApproval: boolean
  approvalRole: string | null
  ruleId: string | null
  ruleKey: string | null
  matchedRuleIds: string[]
  reasons: string[]
  warnings: string[]
}

const OPERATORS: ReadonlySet<PolicyOperator> = new Set([
  "eq",
  "neq",
  "in",
  "not_in",
  "exists",
  "gt",
  "gte",
  "lt",
  "lte",
  "starts_with",
  "contains",
  "overlaps",
  "glob",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Resolve `a.b.c` against nested records; arrays are returned as-is. */
function getValue(context: Record<string, unknown>, key: string): unknown {
  let current: unknown = context
  for (const part of key.split(".")) {
    if (!isRecord(current)) return undefined
    current = current[part]
  }
  return current
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === "number" || typeof b === "number") {
    const left = Number(a)
    const right = Number(b)
    return Number.isFinite(left) && Number.isFinite(right) && left === right
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => equal(entry, b[index]))
  }
  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return aKeys.length === bKeys.length && aKeys.every((key) => equal(a[key], b[key]))
  }
  return false
}

/** Escape a glob so only `*` and `?` are wildcards (no regex injection). */
function globMatch(value: string, pattern: string): boolean {
  let source = "^"
  for (const char of pattern) {
    if (char === "*") source += ".*"
    else if (char === "?") source += "."
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  source += "$"
  try {
    return new RegExp(source).test(value)
  } catch {
    return false
  }
}

export function conditionMatches(condition: PolicyCondition, context: Record<string, unknown>): boolean {
  if (!condition || typeof condition.key !== "string" || !OPERATORS.has(condition.op)) return false
  const actual = getValue(context, condition.key)
  const expected = condition.value

  switch (condition.op) {
    case "eq":
      return equal(actual, expected)
    case "neq":
      return !equal(actual, expected)
    case "exists":
      return expected === false ? actual === undefined || actual === null : actual !== undefined && actual !== null
    case "in":
      return Array.isArray(expected) && expected.some((entry) => equal(actual, entry))
    case "not_in":
      return Array.isArray(expected) && !expected.some((entry) => equal(actual, entry))
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const left = Number(actual)
      const right = Number(expected)
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false
      if (condition.op === "gt") return left > right
      if (condition.op === "gte") return left >= right
      if (condition.op === "lt") return left < right
      return left <= right
    }
    case "starts_with":
      return typeof actual === "string" && typeof expected === "string" && actual.startsWith(expected)
    case "contains":
      return typeof actual === "string" && typeof expected === "string" && actual.includes(expected)
    case "overlaps":
      return (
        Array.isArray(actual) &&
        Array.isArray(expected) &&
        actual.some((entry) => expected.some((candidate) => equal(entry, candidate)))
      )
    case "glob":
      return typeof actual === "string" && typeof expected === "string" && globMatch(actual, expected)
    default:
      return false
  }
}

function conditionsMatch(raw: unknown, context: Record<string, unknown>): boolean {
  if (!Array.isArray(raw)) return false
  return raw.every((entry) => isRecord(entry) && conditionMatches(entry as unknown as PolicyCondition, context))
}

function subjectMatches(ruleSubject: string, subject: string): boolean {
  if (ruleSubject === "*" || ruleSubject === subject) return true
  if (ruleSubject.endsWith(".*")) return subject.startsWith(ruleSubject.slice(0, -1))
  return false
}

function specificity(rule: PolicyRuleLike): number {
  if (rule.repositoryId) return 2
  if (rule.projectId) return 1
  return 0
}

function sortRules(rules: PolicyRuleLike[]): PolicyRuleLike[] {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    const scope = specificity(b) - specificity(a)
    if (scope !== 0) return scope
    return a.key.localeCompare(b.key)
  })
}

function actionApprovalRole(actions: unknown): string | null {
  if (!isRecord(actions)) return null
  const role = actions.approvalRole
  return typeof role === "string" && role.length > 0 ? role : null
}

function actionMessage(actions: unknown): string | null {
  if (!isRecord(actions)) return null
  const message = actions.message
  return typeof message === "string" && message.length > 0 ? message : null
}

export function evaluatePolicy(rules: PolicyRuleLike[], input: PolicyInput): PolicyDecision {
  const context = input.context ?? {}
  const sorted = sortRules(rules)
  const matchedRuleIds: string[] = []

  for (const rule of sorted) {
    if (!subjectMatches(rule.subject, input.subject)) continue
    if (rule.projectId && rule.projectId !== input.projectId) continue
    if (rule.repositoryId && rule.repositoryId !== input.repositoryId) continue
    if (!conditionsMatch(rule.conditions, context)) continue

    matchedRuleIds.push(rule.id)
    const effect = rule.effect as PolicyEffect
    const message = actionMessage(rule.actions)
    const baseReason = message ?? `Matched policy "${rule.name}" (${rule.key})`
    const approvalRole = actionApprovalRole(rule.actions)

    if (effect === "DENY") {
      return {
        allowed: false,
        decision: "DENY",
        requiresApproval: false,
        approvalRole,
        ruleId: rule.id,
        ruleKey: rule.key,
        matchedRuleIds,
        reasons: [baseReason],
        warnings: [],
      }
    }
    if (effect === "REQUIRE_APPROVAL") {
      return {
        allowed: true,
        decision: "REQUIRE_APPROVAL",
        requiresApproval: true,
        approvalRole,
        ruleId: rule.id,
        ruleKey: rule.key,
        matchedRuleIds,
        reasons: [baseReason],
        warnings: [],
      }
    }
    if (effect === "WARN") {
      return {
        allowed: true,
        decision: "WARN",
        requiresApproval: false,
        approvalRole,
        ruleId: rule.id,
        ruleKey: rule.key,
        matchedRuleIds,
        reasons: [baseReason],
        warnings: [baseReason],
      }
    }
    return {
      allowed: true,
      decision: "ALLOW",
      requiresApproval: false,
      approvalRole,
      ruleId: rule.id,
      ruleKey: rule.key,
      matchedRuleIds,
      reasons: [baseReason],
      warnings: [],
    }
  }

  return {
    allowed: true,
    decision: "ALLOW",
    requiresApproval: false,
    approvalRole: null,
    ruleId: null,
    ruleKey: null,
    matchedRuleIds,
    reasons: ["No policy matched; default allow"],
    warnings: [],
  }
}
