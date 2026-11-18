import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { evaluatePolicy, type PolicyRuleLike } from "../src/modules/policies/policy.engine"
import {
  branchName,
  buildHeuristicPlan,
  canTransition,
  findDuplicates,
  isProtectedPath,
  triageIssue,
  validatePatch,
  validatePlanDraft,
  type IssueTaskInput,
} from "../src/modules/factory/factory.rules"

function rule(partial: Partial<PolicyRuleLike> & Pick<PolicyRuleLike, "id" | "key" | "effect" | "subject">): PolicyRuleLike {
  return {
    name: partial.key,
    priority: 100,
    scope: "ORGANIZATION",
    projectId: null,
    repositoryId: null,
    conditions: [],
    actions: {},
    ...partial,
  }
}

describe("policy engine", () => {
  it("first matching rule wins by priority", () => {
    const rules = [
      rule({ id: "allow", key: "allow", effect: "ALLOW", subject: "factory.merge", priority: 10 }),
      rule({ id: "deny", key: "deny", effect: "DENY", subject: "factory.merge", priority: 90 }),
    ]
    const decision = evaluatePolicy(rules, { subject: "factory.merge" })
    assert.equal(decision.allowed, false)
    assert.equal(decision.ruleKey, "deny")
  })

  it("prefers the most specific scope on a priority tie", () => {
    const rules = [
      rule({ id: "org", key: "org", effect: "ALLOW", subject: "agent.run", priority: 50 }),
      rule({ id: "repo", key: "repo", effect: "DENY", subject: "agent.run", priority: 50, repositoryId: "r1" }),
    ]
    const decision = evaluatePolicy(rules, { subject: "agent.run", repositoryId: "r1" })
    assert.equal(decision.allowed, false)
    assert.equal(decision.ruleKey, "repo")
    assert.equal(evaluatePolicy(rules, { subject: "agent.run", repositoryId: "r2" }).allowed, true)
  })

  it("evaluates nested conditions without regex injection", () => {
    const rules = [
      rule({
        id: "protected",
        key: "protected",
        effect: "REQUIRE_APPROVAL",
        subject: "factory.patch",
        conditions: [{ key: "patch.touchesProtectedPath", op: "eq", value: true }],
        actions: { approvalRole: "MANAGER" },
      }),
    ]
    const decision = evaluatePolicy(rules, { subject: "factory.patch", context: { patch: { touchesProtectedPath: true } } })
    assert.equal(decision.requiresApproval, true)
    assert.equal(decision.approvalRole, "MANAGER")
    assert.equal(evaluatePolicy(rules, { subject: "factory.patch", context: { patch: { touchesProtectedPath: false } } }).requiresApproval, false)
  })

  it("supports array overlap and glob conditions", () => {
    const rules = [
      rule({
        id: "overlap",
        key: "overlap",
        effect: "DENY",
        subject: "agent.run",
        conditions: [
          { key: "agent.tools", op: "overlaps", value: ["shell"] },
          { key: "file.path", op: "glob", value: "src/**/*.ts" },
        ],
      }),
    ]
    const decision = evaluatePolicy(rules, {
      subject: "agent.run",
      context: { agent: { tools: ["read", "shell"] }, file: { path: "src/modules/a.ts" } },
    })
    assert.equal(decision.allowed, false)
  })
})

describe("issue triage", () => {
  it("blocks autonomy when acceptance criteria are missing", () => {
    const task: IssueTaskInput = {
      id: "t1",
      title: "Improve authentication",
      description: "Make login better.",
      type: "TASK",
      priority: "MEDIUM",
      status: "TODO",
    }
    const profile = triageIssue({ task, existing: [], hasRepository: true })
    assert.equal(profile.missingAcceptanceCriteria, true)
    assert.equal(profile.autonomous, false)
    assert.ok(profile.labels.includes("needs-human"))
    assert.ok(profile.labels.includes("security-review"))
    assert.equal(profile.risk, "high")
  })

  it("marks a clear, low-risk issue as agent-ready", () => {
    const task: IssueTaskInput = {
      id: "t2",
      title: "Add CSV export to timesheet",
      description:
        "Add a CSV export button to the timesheet page.\nAcceptance criteria:\n- The button downloads a CSV with the visible week.\n- Empty weeks still produce a header row.",
      type: "STORY",
      priority: "MEDIUM",
      status: "TODO",
    }
    const profile = triageIssue({ task, existing: [], hasRepository: true })
    assert.equal(profile.missingAcceptanceCriteria, false)
    assert.equal(profile.autonomous, true)
    assert.ok(profile.labels.includes("agent-ready"))
    assert.equal(profile.risk, "low")
  })

  it("detects near-duplicate issues", () => {
    const existing: IssueTaskInput[] = [
      {
        id: "t9",
        title: "Add CSV export to timesheet page",
        description: "Download the visible week as CSV from the timesheet page.",
        type: "STORY",
        priority: "MEDIUM",
        status: "TODO",
      },
    ]
    const task: IssueTaskInput = {
      id: "t3",
      title: "Timesheet page CSV export",
      description: "Add download CSV for visible week on timesheet page.",
      type: "STORY",
      priority: "MEDIUM",
      status: "TODO",
    }
    const duplicates = findDuplicates(task, existing, 0.3)
    assert.equal(duplicates[0]?.id, "t9")
    const profile = triageIssue({ task, existing, hasRepository: true })
    assert.ok(profile.labels.includes("duplicate"))
  })
})

describe("patch safety", () => {
  it("rejects traversal, git metadata and oversized paths", () => {
    const validation = validatePatch([
      { path: "../etc/passwd", content: "x" },
      { path: ".git/config", content: "x" },
      { path: "/absolute.ts", content: "x" },
    ])
    assert.equal(validation.ok, false)
    assert.equal(validation.files.length, 0)
    assert.ok(validation.errors.length >= 3)
  })

  it("flags protected paths and accepts a normal file", () => {
    const validation = validatePatch([
      { path: "src/modules/api/auth/session.ts", content: "export const x = 1\n" },
      { path: "src/modules/tasks/tasks.service.ts", content: "export const y = 2\n" },
    ])
    assert.equal(validation.ok, true)
    assert.equal(validation.files.length, 2)
    assert.equal(validation.touchesProtectedPath, true)
    assert.ok(validation.protectedPaths.some((path) => path.includes("auth")))
    assert.equal(isProtectedPath("src/modules/tasks/tasks.service.ts"), false)
  })
})

describe("planning and state", () => {
  it("builds a plan with acceptance criteria and tests", () => {
    const plan = buildHeuristicPlan({
      task: {
        id: "t1",
        title: "Add CSV export",
        description: "Acceptance criteria:\n- Download works",
        type: "STORY",
        priority: "MEDIUM",
        status: "TODO",
      },
      project: { name: "Core", key: "CORE", description: null },
      profile: {
        classification: "FEATURE",
        labels: ["agent-ready"],
        complexity: 3,
        risk: "low",
        autonomous: true,
        confidence: 0.8,
        missingAcceptanceCriteria: false,
        duplicateOfIds: [],
        suggestedPriority: "MEDIUM",
        suggestedAgentRole: "BACKEND",
        rationale: [],
      },
      files: [],
      repository: { name: "core", defaultBranch: "main" },
    })
    assert.ok(plan.steps.length >= 4)
    assert.ok(plan.acceptanceCriteria.includes("Download works"))
    assert.equal(plan.approvalRequired, false)
  })

  it("rejects malformed AI plans", () => {
    assert.equal(validatePlanDraft({ summary: "x", steps: [] }), null)
    assert.ok(validatePlanDraft({ summary: "x", steps: [{ title: "Do it", detail: "..." }] }))
  })

  it("only allows declared transitions", () => {
    assert.equal(canTransition("EXECUTING", "QUALITY_CHECK"), true)
    assert.equal(canTransition("QUALITY_CHECK", "WAITING_REVIEW"), true)
    assert.equal(canTransition("MERGED", "READY_TO_MERGE"), false)
    assert.equal(canTransition("QUEUED", "MERGED"), false)
  })

  it("generates a safe unique branch name", () => {
    const name = branchName({ projectKey: "TV", taskId: "12345678-abcd", title: "Fix Login / Session!", existing: [] })
    assert.equal(name, "factory/TV-12345678-fix-login-session")
    const second = branchName({ projectKey: "TV", taskId: "12345678-abcd", title: "Fix Login", existing: [name] })
    assert.notEqual(second, name)
  })
})
