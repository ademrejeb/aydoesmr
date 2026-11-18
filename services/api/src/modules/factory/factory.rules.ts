/**
 * Pure factory logic: issue triage, plan validation, patch safety, state
 * transitions and branch naming. No Prisma, no network — unit-testable and
 * deterministic. The service layer supplies repository/task context.
 */

export type FactoryClassification =
  | "BUG"
  | "FEATURE"
  | "IMPROVEMENT"
  | "TECH_DEBT"
  | "SECURITY"
  | "INFRA"
  | "DOCS"
  | "RESEARCH"
  | "ARCHITECTURE"

export type Risk = "low" | "medium" | "high"

export interface IssueTaskInput {
  id: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
}

export interface IssueProfile {
  classification: FactoryClassification
  labels: string[]
  complexity: number
  risk: Risk
  autonomous: boolean
  confidence: number
  missingAcceptanceCriteria: boolean
  duplicateOfIds: string[]
  suggestedPriority: string
  suggestedAgentRole: string
  rationale: string[]
}

export interface FactoryPlanDraft {
  summary: string
  steps: { title: string; detail: string }[]
  files: { path: string; reason: string }[]
  tests: string[]
  acceptanceCriteria: string[]
  risks: string[]
  outOfScope: string[]
  approvalRequired: boolean
  reasoning: string
  generatedBy: string
  model: string | null
}

export interface PatchFile {
  path: string
  content: string
}

export interface PatchValidation {
  ok: boolean
  files: PatchFile[]
  touchesProtectedPath: boolean
  protectedPaths: string[]
  errors: string[]
}

export type FactoryStatus =
  | "QUEUED"
  | "TRIAGED"
  | "PLANNED"
  | "WAITING_APPROVAL"
  | "EXECUTING"
  | "QUALITY_CHECK"
  | "WAITING_REVIEW"
  | "READY_TO_MERGE"
  | "MERGED"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED"

export const FACTORY_TRANSITIONS: Record<FactoryStatus, FactoryStatus[]> = {
  QUEUED: ["TRIAGED", "FAILED", "CANCELLED"],
  TRIAGED: ["PLANNED", "WAITING_APPROVAL", "FAILED", "BLOCKED", "CANCELLED"],
  PLANNED: ["WAITING_APPROVAL", "EXECUTING", "FAILED", "BLOCKED", "CANCELLED"],
  WAITING_APPROVAL: ["PLANNED", "EXECUTING", "FAILED", "BLOCKED", "CANCELLED"],
  EXECUTING: ["QUALITY_CHECK", "FAILED", "BLOCKED", "CANCELLED"],
  QUALITY_CHECK: ["WAITING_REVIEW", "READY_TO_MERGE", "FAILED", "BLOCKED", "CANCELLED"],
  WAITING_REVIEW: ["READY_TO_MERGE", "FAILED", "BLOCKED", "CANCELLED"],
  READY_TO_MERGE: ["MERGED", "WAITING_APPROVAL", "FAILED", "BLOCKED", "CANCELLED"],
  MERGED: [],
  FAILED: ["QUEUED", "CANCELLED"],
  BLOCKED: ["QUEUED", "TRIAGED", "PLANNED", "CANCELLED"],
  CANCELLED: [],
}

export function canTransition(from: FactoryStatus, to: FactoryStatus): boolean {
  return (FACTORY_TRANSITIONS[from] ?? []).includes(to)
}

const SECURITY_TERMS = ["security", "vulnerab", "cve", "auth", "oauth", "token", "secret", "injection", "xss", "csrf", "permission", "rbac", "tenant"]
const INFRA_TERMS = ["docker", "deploy", "ci/cd", "pipeline", "kubernetes", "terraform", "server", "nginx", "database migration"]
const DOC_TERMS = ["documentation", "readme", "docs", "guide", "changelog"]
const RESEARCH_TERMS = ["investigate", "research", "spike", "evaluate", "explore", "proof of concept"]
const ARCHITECTURE_TERMS = ["architecture", "adr", "design", "refactor", "schema", "migration", "multi-tenant"]
const BUG_TERMS = ["bug", "crash", "error", "broken", "regression", "fails", "failure", "fix"]
const TECH_DEBT_TERMS = ["tech debt", "technical debt", "cleanup", "deprecated", "dead code", "coverage"]
const AMBIGUOUS_TERMS = ["improve", "better", "maybe", "somehow", "tbd", "asap", "etc."]
const BLOCKED_TERMS = ["blocked by", "depends on", "waiting for", "after #", "after tv-"]

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "when", "then", "should", "must",
  "have", "has", "are", "was", "were", "will", "would", "can", "could", "not", "but", "its", "all",
  "any", "our", "their", "your", "about", "need", "needs", "make", "makes", "use", "using", "add",
  "adds", "new", "issue", "task", "ticket", "please", "there", "where", "which", "what", "how",
])

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

function hasAny(text: string, terms: string[]): string[] {
  return terms.filter((term) => text.includes(term))
}

export function tokens(text: string): Set<string> {
  const words = normalize(text)
    .split(/[^a-z0-9_+#.-]+/)
    .map((word) => word.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  return new Set(words)
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

export function findDuplicates(task: IssueTaskInput, existing: IssueTaskInput[], threshold = 0.55): { id: string; score: number }[] {
  const base = tokens(`${task.title} ${task.title} ${task.description ?? ""}`)
  return existing
    .filter((candidate) => candidate.id !== task.id)
    .map((candidate) => ({
      id: candidate.id,
      score: jaccard(base, tokens(`${candidate.title} ${candidate.title} ${candidate.description ?? ""}`)),
    }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export function hasAcceptanceCriteria(description: string | null): boolean {
  if (!description) return false
  const text = normalize(description)
  if (/(^|\n)\s*(ac|acceptance criteria|acceptance)\s*:/i.test(description)) return true
  if (text.includes("acceptance criteria")) return true
  // Given/when/then or explicit expected behavior is enough evidence.
  if (/\bgiven\b[\s\S]{0,200}\bwhen\b[\s\S]{0,200}\bthen\b/.test(text)) return true
  return /\b(expected|should|must)\b/.test(text) && description.length >= 80
}

export function extractAcceptanceCriteria(description: string | null): string[] {
  if (!description) return []
  const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const collected: string[] = []
  let inSection = false
  for (const line of lines) {
    if (/^(ac|acceptance criteria|acceptance)\s*:/i.test(line)) {
      inSection = true
      const rest = line.replace(/^(ac|acceptance criteria|acceptance)\s*:/i, "").trim()
      if (rest) collected.push(rest)
      continue
    }
    if (inSection) {
      if (/^[A-Z][a-z ]{2,30}:$/.test(line) && !/^ac/i.test(line)) break
      collected.push(line.replace(/^[-*]\s*/, ""))
      if (collected.length >= 12) break
    }
  }
  if (collected.length > 0) return collected
  return lines
    .filter((line) => /\b(should|must|expected)\b/i.test(line))
    .slice(0, 8)
    .map((line) => line.replace(/^[-*]\s*/, ""))
}

function fibonacciComplexity(score: number): number {
  if (score <= 1) return 1
  if (score <= 2) return 2
  if (score <= 3) return 3
  if (score <= 5) return 5
  if (score <= 8) return 8
  return 13
}

function classifyText(text: string, type: string): { classification: FactoryClassification; evidence: string[] } {
  const security = hasAny(text, SECURITY_TERMS)
  if (security.length > 0) return { classification: "SECURITY", evidence: security }
  if (hasAny(text, ARCHITECTURE_TERMS).length > 0) {
    return { classification: "ARCHITECTURE", evidence: hasAny(text, ARCHITECTURE_TERMS) }
  }
  const infra = hasAny(text, INFRA_TERMS)
  if (infra.length > 0) return { classification: "INFRA", evidence: infra }
  const docs = hasAny(text, DOC_TERMS)
  if (docs.length > 0) return { classification: "DOCS", evidence: docs }
  const research = hasAny(text, RESEARCH_TERMS)
  if (research.length > 0) return { classification: "RESEARCH", evidence: research }
  const bug = hasAny(text, BUG_TERMS)
  if (bug.length > 0 || type === "BUG") return { classification: "BUG", evidence: bug }
  const debt = hasAny(text, TECH_DEBT_TERMS)
  if (debt.length > 0) return { classification: "TECH_DEBT", evidence: debt }
  return { classification: "FEATURE", evidence: [] }
}

export function triageIssue(input: {
  task: IssueTaskInput
  existing?: IssueTaskInput[]
  hasRepository: boolean
}): IssueProfile {
  const { task, existing = [], hasRepository } = input
  const text = normalize(`${task.title} ${task.description ?? ""}`)
  const { classification, evidence } = classifyText(text, task.type)
  const reasons: string[] = []
  if (evidence.length > 0) reasons.push(`Matched ${classification.toLowerCase()} terms: ${evidence.slice(0, 5).join(", ")}`)

  const missingAcceptanceCriteria = !hasAcceptanceCriteria(task.description)
  const security = classification === "SECURITY" || hasAny(text, ["auth", "secret", "token", "permission"]).length > 0
  const architecture = classification === "ARCHITECTURE"
  const ambiguous = hasAny(text, AMBIGUOUS_TERMS)
  const blocked = hasAny(text, BLOCKED_TERMS).length > 0

  let complexityScore = 1
  const length = (task.description ?? "").length
  if (length > 200) complexityScore += 1
  if (length > 700) complexityScore += 1
  if (task.title.split(/\s+/).length > 10) complexityScore += 1
  if (architecture) complexityScore += 2
  if (security) complexityScore += 1
  if (hasAny(text, ["across", "all modules", "every", "multi-tenant", "migration", "api"]).length > 0) complexityScore += 1
  if (blocked) complexityScore += 1
  const complexity = fibonacciComplexity(complexityScore)

  let risk: Risk = "low"
  if (security || /\b(payment|billing|production|credentials?|secret)\b/.test(text)) risk = "high"
  else if (architecture || classification === "INFRA" || classification === "TECH_DEBT" || complexity >= 8) risk = "medium"

  const duplicates = findDuplicates(task, existing)
  const labels = new Set<string>()
  if (security) labels.add("security-review")
  if (architecture) labels.add("architecture-review")
  if (duplicates.length > 0) labels.add("duplicate")
  if (blocked) {
    labels.add("blocked")
    labels.add("waiting-for-dependency")
  }
  if (missingAcceptanceCriteria || ambiguous.length > 0) {
    labels.add("needs-human")
    labels.add("unclear")
  }
  if (risk === "high") labels.add("needs-human")

  const autonomous =
    !missingAcceptanceCriteria &&
    risk !== "high" &&
    complexity <= 8 &&
    !blocked &&
    ambiguous.length === 0 &&
    hasRepository
  labels.add(autonomous ? "agent-ready" : "needs-human")

  if (missingAcceptanceCriteria) reasons.push("No explicit acceptance criteria found (add an 'Acceptance criteria:' section).")
  if (duplicates.length > 0) reasons.push(`Similar existing issues: ${duplicates.map((d) => d.id.slice(0, 8)).join(", ")}`)
  if (blocked) reasons.push("The description references a dependency or blocker.")
  if (ambiguous.length > 0) reasons.push(`Ambiguous wording: ${ambiguous.join(", ")}`)
  if (!hasRepository) reasons.push("No linked repository, so autonomous execution is disabled.")
  if (autonomous) reasons.push("Clear scope, low/medium risk and a linked repository: eligible for an autonomous run.")

  let suggestedPriority = task.priority || "MEDIUM"
  if (security || risk === "high") suggestedPriority = "HIGH"
  if (classification === "DOCS") suggestedPriority = "LOW"
  if (classification === "INFRA" && risk === "high") suggestedPriority = "URGENT"

  const roleByClass: Record<FactoryClassification, string> = {
    SECURITY: "SECURITY",
    ARCHITECTURE: "ARCHITECT",
    INFRA: "DEVOPS",
    DOCS: "DOCS",
    RESEARCH: "ARCHITECT",
    BUG: "BACKEND",
    TECH_DEBT: "BACKEND",
    IMPROVEMENT: "BACKEND",
    FEATURE: "BACKEND",
  }
  let suggestedAgentRole = roleByClass[classification]
  if (/\b(ui|frontend|react|next|css|component|page)\b/.test(text)) suggestedAgentRole = "FRONTEND"
  if (/\b(rust|crate|cargo|performance)\b/.test(text)) suggestedAgentRole = "RUST"

  const signals = [missingAcceptanceCriteria, duplicates.length > 0, security, architecture, hasRepository].filter(Boolean).length
  const confidence = Math.min(0.92, 0.55 + signals * 0.07 + (length > 120 ? 0.05 : 0))

  return {
    classification,
    labels: Array.from(labels).sort(),
    complexity,
    risk,
    autonomous,
    confidence: Math.round(confidence * 100) / 100,
    missingAcceptanceCriteria,
    duplicateOfIds: duplicates.map((d) => d.id),
    suggestedPriority,
    suggestedAgentRole,
    rationale: reasons,
  }
}

// ------------------------------------------------------------------ //
//  Plans                                                              //
// ------------------------------------------------------------------ //

export function buildHeuristicPlan(input: {
  task: IssueTaskInput
  project: { name: string; key: string | null; description: string | null }
  profile: IssueProfile
  files: { path: string; reason: string }[]
  repository: { name: string; defaultBranch: string } | null
}): FactoryPlanDraft {
  const { task, project, profile, files, repository } = input
  const acceptance = extractAcceptanceCriteria(task.description)
  const ac = acceptance.length > 0 ? acceptance : [
    `The behavior described in "${task.title}" is implemented.`,
    "Existing tests still pass and new behavior has coverage.",
    "No secrets, credentials or unrelated files are introduced.",
  ]
  const steps = [
    { title: "Read context", detail: `Inspect ${project.name}${repository ? ` and repository ${repository.name}` : ""} plus the files listed in this plan.` },
    { title: "Implement the change", detail: `Make the smallest change that satisfies: ${task.title}` },
    { title: "Add or update tests", detail: "Cover the acceptance criteria and the failure path introduced by the change." },
    { title: "Validate", detail: "Run the project's build, lint and test commands. Attach real command evidence." },
    { title: "Review", detail: "An independent reviewer must check the diff; the author cannot approve it." },
  ]
  const risks = profile.rationale.length > 0 ? [...profile.rationale] : []
  if (profile.risk !== "low") risks.push(`Risk level: ${profile.risk}.`)
  if (!repository) risks.push("No linked repository: code changes cannot be applied automatically.")

  return {
    summary: `Implement "${task.title}" in ${project.name}.`,
    steps,
    files,
    tests: [
      "Run the existing unit/integration suite for the touched module.",
      "Add a regression test for the acceptance criteria.",
      "Run lint and typecheck/build.",
    ],
    acceptanceCriteria: ac,
    risks: Array.from(new Set(risks)),
    outOfScope: [
      "Unrelated refactors or dependency upgrades.",
      "Changes to governance policies or CI secrets.",
      "Production deployment (handled by a separate approved workflow).",
    ],
    approvalRequired: !profile.autonomous || profile.risk === "high",
    reasoning: `Heuristic plan from ${profile.classification.toLowerCase()} classification, complexity ${profile.complexity}, risk ${profile.risk}.`,
    generatedBy: "heuristic",
    model: null,
  }
}

export function validatePlanDraft(raw: unknown): FactoryPlanDraft | null {
  if (!raw || typeof raw !== "object") return null
  const value = raw as Record<string, unknown>
  if (typeof value.summary !== "string" || !Array.isArray(value.steps)) return null
  const steps = value.steps
    .filter((step): step is Record<string, unknown> => !!step && typeof step === "object")
    .map((step) => ({
      title: typeof step.title === "string" ? step.title.slice(0, 200) : "",
      detail: typeof step.detail === "string" ? step.detail.slice(0, 2000) : "",
    }))
    .filter((step) => step.title.length > 0)
  if (steps.length === 0) return null
  const strings = (candidate: unknown, limit: number): string[] =>
    Array.isArray(candidate)
      ? candidate.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.slice(0, 2000)).slice(0, limit)
      : []
  const files = Array.isArray(value.files)
    ? value.files
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
        .map((entry) => ({
          path: typeof entry.path === "string" ? entry.path.slice(0, 500) : "",
          reason: typeof entry.reason === "string" ? entry.reason.slice(0, 1000) : "",
        }))
        .filter((entry) => entry.path.length > 0)
        .slice(0, 50)
    : []
  return {
    summary: value.summary.slice(0, 2000),
    steps,
    files,
    tests: strings(value.tests, 20),
    acceptanceCriteria: strings(value.acceptanceCriteria, 20),
    risks: strings(value.risks, 20),
    outOfScope: strings(value.outOfScope, 20),
    approvalRequired: value.approvalRequired !== false,
    reasoning: typeof value.reasoning === "string" ? value.reasoning.slice(0, 4000) : "AI-generated plan.",
    generatedBy: "ai",
    model: typeof value.model === "string" ? value.model : null,
  }
}

// ------------------------------------------------------------------ //
//  Patches                                                            //
// ------------------------------------------------------------------ //

export const PROTECTED_PATH_PATTERNS = [
  "**/auth/**",
  "**/security/**",
  "**/billing/**",
  "**/payments/**",
  "**/.github/workflows/**",
  "**/prisma/migrations/**",
  "**/infra/**",
  "**/terraform/**",
  "**/k8s/**",
  "**/kubernetes/**",
  "**/*.env*",
  "**/secrets/**",
  "**/helm/**",
  "**/migrations/**",
  "**/Dockerfile*",
  "**/docker-compose*",
  "**/*.pem",
  "**/*.key",
]

export function isProtectedPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/")
  return PROTECTED_PATH_PATTERNS.some((pattern) => {
    const regex = new RegExp(
      "^" +
        pattern
          .split("**")
          .map((part) =>
            part
              .replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*/g, "[^/]*")
              .replace(/\?/g, ".")
          )
          .join(".*") +
        "$"
    )
    return regex.test(normalized)
  })
}

const MAX_FILES = 100
const MAX_FILE_BYTES = 500 * 1024
const MAX_TOTAL_BYTES = 2 * 1024 * 1024

export function validatePatch(raw: unknown): PatchValidation {
  const errors: string[] = []
  const files: PatchFile[] = []
  const protectedPaths: string[] = []
  if (!Array.isArray(raw)) {
    return { ok: false, files, touchesProtectedPath: false, protectedPaths, errors: ["files must be an array"] }
  }
  if (raw.length > MAX_FILES) errors.push(`too many files (max ${MAX_FILES})`)
  const seen = new Set<string>()
  let total = 0

  for (const entry of raw.slice(0, MAX_FILES)) {
    if (!entry || typeof entry !== "object") {
      errors.push("each file must be an object")
      continue
    }
    const file = entry as Record<string, unknown>
    const path = typeof file.path === "string" ? file.path.replace(/\\/g, "/").trim() : ""
    const content = typeof file.content === "string" ? file.content : null
    if (!path) {
      errors.push("a file path is missing")
      continue
    }
    if (path.length > 400) {
      errors.push(`path too long: ${path.slice(0, 80)}...`)
      continue
    }
    if (path.startsWith("/") || /^[a-zA-Z]:/.test(path) || path.split("/").includes("..") || path.includes("\0")) {
      errors.push(`unsafe path: ${path}`)
      continue
    }
    if (path === ".git" || path.startsWith(".git/") || path.includes("/.git/")) {
      errors.push(`cannot write git metadata: ${path}`)
      continue
    }
    if (content === null) {
      errors.push(`full content is required for ${path} (diffs are not applied)`)
      continue
    }
    const bytes = Buffer.byteLength(content, "utf8")
    if (bytes > MAX_FILE_BYTES) {
      errors.push(`${path} exceeds ${MAX_FILE_BYTES} bytes`)
      continue
    }
    total += bytes
    if (total > MAX_TOTAL_BYTES) {
      errors.push("patch exceeds the total size limit")
      break
    }
    if (seen.has(path)) {
      errors.push(`duplicate path: ${path}`)
      continue
    }
    seen.add(path)
    files.push({ path, content })
    if (isProtectedPath(path)) protectedPaths.push(path)
  }

  return {
    ok: errors.length === 0 && files.length > 0,
    files,
    touchesProtectedPath: protectedPaths.length > 0,
    protectedPaths,
    errors,
  }
}

/** Extract the file list an agent returned, without trusting any other field. */
export function parseAgentPatch(output: unknown): PatchFile[] {
  if (!output || typeof output !== "object") return []
  const root = output as Record<string, unknown>
  const candidates = [root.files, root.changes, root.patch]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as PatchFile[]
    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>
      if (Array.isArray(nested.files)) return nested.files as PatchFile[]
    }
  }
  if (root.output && typeof root.output === "object") {
    const nested = parseAgentPatch(root.output)
    if (nested.length > 0) return nested
  }
  return []
}

export function branchName(input: {
  projectKey: string | null
  taskId: string
  title: string
  existing?: string[]
}): string {
  const key = (input.projectKey || "TV").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "TV"
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "")
  const base = `factory/${key}-${input.taskId.slice(0, 8)}${slug ? `-${slug}` : ""}`
  const existing = new Set(input.existing ?? [])
  if (!existing.has(base)) return base
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`
    if (!existing.has(candidate)) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}

// ------------------------------------------------------------------ //
//  Secret detection                                                   //
// ------------------------------------------------------------------ //

export interface SecretFinding {
  path: string
  line: number
  kind: string
}

const SECRET_PATTERNS: { kind: string; pattern: RegExp }[] = [
  { kind: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { kind: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { kind: "slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: "google_api_key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: "stripe_secret", pattern: /\bsk_live_[0-9A-Za-z]{20,}\b/ },
  { kind: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
]

/**
 * Scan only the patch content that is about to be committed. Findings never
 * include the secret itself — only path, line and kind — so the gate evidence
 * and trace cannot leak it.
 */
export function scanPatchForSecrets(files: { path: string; content: string }[]): SecretFinding[] {
  const findings: SecretFinding[] = []
  for (const file of files) {
    const lines = file.content.split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const rule of SECRET_PATTERNS) {
        if (rule.pattern.test(line)) {
          findings.push({ path: file.path, line: index + 1, kind: rule.kind })
        }
      }
    })
  }
  return findings
}
