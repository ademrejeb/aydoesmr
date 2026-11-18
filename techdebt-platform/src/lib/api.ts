const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

export function wsOrigin(): string {
  try {
    return new URL(API_BASE).origin
  } catch {
    return "http://localhost:3001"
  }
}

export interface AuthUser {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  locale: string
  timezone: string
  status: string
  statusNote: string | null
  statusUntil: string | null
  lastSeenAt: string | null
  createdAt: string
}

export interface AuthResponse {
  user: AuthUser
  accessToken: string
  expiresIn: number
  /** Present on Basacore sign-in: the tenant organization selected server-side. */
  organizationId?: string | null
}

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  currency: string
  locale: string
  timezone: string
  role?: string
  billingEmail?: string | null
  country?: string | null
  workWeekStart?: number
  holidayCountry?: string | null
  holidayRegion?: string | null
}

export interface OrgMember {
  id: string
  role: string
  title: string | null
  user: AuthUser
}

export interface TeamMember {
  id: string
  role: string
  user: AuthUser
}

export interface Team {
  id: string
  name: string
  description: string | null
  color: string | null
  members: TeamMember[]
}

export interface Conversation {
  id: string
  type: "DIRECT" | "GROUP"
  name: string
  partnerId: string | null
  partner: AuthUser | null
  members: { userId: string; user: AuthUser; unreadCount: number; role?: string }[]
  unreadCount: number
  lastMessageAt: string | null
  lastReadAt: string | null
  updatedAt: string
  archived: boolean
  archivedAt?: string | null
}

export interface MessageAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  downloadPath: string
}

export interface MessageReaction {
  emoji: string
  userId: string
  user: AuthUser
}

export interface Message {
  id: string
  conversationId: string
  sender: AuthUser
  body: string
  kind: string
  mediaUrl?: string | null
  mediaWidth?: number | null
  mediaHeight?: number | null
  mimeType?: string | null
  attachment?: MessageAttachment | null
  replyTo?: { id: string; body: string; sender: AuthUser } | null
  deleted: boolean
  deletedAt?: string | null
  mentionIds: string[]
  reactions: MessageReaction[]
  createdAt: string
  editedAt: string | null
}

export interface Invite {
  id: string
  email: string
  role: string
  status: string
  expiresAt: string
  title: string | null
  createdAt: string
}

export interface OrganizationDetail extends Organization {
  members: { id: string; user: AuthUser; role: string; title: string | null }[]
  billing: { id: string; plan: string; status: string; seats: number; usageThisPeriod: number; usageLimit: number | null } | null
}

export interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  user: { id: string; email: string; fullName: string | null } | null
}

export interface AccessCapability {
  key: string
  description: string
}

export interface AccessRole {
  role: string
  rank: number
  summary: string
  capabilities: string[]
}

export interface AccessCatalog {
  capabilities: AccessCapability[]
  roles: AccessRole[]
}

export interface UpdateMemberRoleInput {
  role?: string
  title?: string
}

export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"

export interface TimesheetEntry {
  id: string
  organizationId: string
  userId: string
  workDate: string
  projectId: string | null
  taskId: string | null
  hours: number
  activity: string | null
  status: TimesheetStatus
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
  task?: { id: string; title: string } | null
}

export interface TimesheetImportResult {
  imported: number
  skipped: number
  errors: { row: number; message: string }[]
  totalRows: number
}

export interface AssistantQueryResult {
  answer: string
  mode: "ai" | "summary"
  provider: string | null
  model: string | null
  context: {
    org: string
    members: { total: number; owner: number; admin: number; manager: number; member: number; viewer: number }
    teams: number
    projects: number
    openTasks: number
    pendingLeaveRequests: number
    openIssues: Record<string, number>
    openIssuesTotal: number
    month: { entries: number; hours: number }
  }
}

export interface LeaveType {
  id: string
  organizationId: string
  name: string
  code: string
  color: string
  isPaid: boolean
  daysPerYear: number
  carryOverDays: number
  accrualPerMonth?: number
  requiresApproval: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type PayrollRunStatus = "PENDING" | "PAID"

export interface PayrollEntry {
  memberId: string
  memberName: string
  hours: number
  regularHours: number
  overtimeHours: number
  rate: number
  gross: number
  bonus: number
  net: number
  override?: boolean
}

export interface PayrollRun {
  id: string
  organizationId: string
  month: string
  currency: string
  status: PayrollRunStatus
  grossTotal: number
  netTotal: number
  entries: PayrollEntry[]
  createdById: string | null
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PayrollImportResult {
  runId: string
  applied: number
  skipped: number
  errors: { line: number; message: string }[]
  grossTotal: number
  netTotal: number
  importedBy: string
  run: PayrollRun
}

export interface PayrollOverridesResult {
  runId: string | null
  overrides: { memberId: string; memberName: string; rate: number; bonus: number; net: number }[]
}

export interface LeaveTypeRef {
  id: string
  name: string
  code: string
  color: string
  isPaid: boolean
}

export interface LeaveBalance {
  id: string
  organizationId: string
  userId: string
  typeId: string
  year: number
  granted: number
  used: number
  pending: number
  carriedOver: number
  adjusted: number
  /** granted + carriedOver + adjusted - used - pending (computed by the API) */
  remaining?: number
  updatedAt: string
  type: LeaveTypeRef
}

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

export interface LeaveRequestUser {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

export interface LeaveRequest {
  id: string
  organizationId: string
  userId: string
  typeId: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: LeaveRequestStatus
  reviewedById: string | null
  reviewedAt: string | null
  reviewNote?: string | null
  createdAt: string
  type: LeaveTypeRef
  /** Present on the approvals queue (scope=all / pending) responses. */
  user?: LeaveRequestUser
}

export interface Holiday {
  date: string
  name: string
  type: "public" | "bank"
  localName?: string
  source?: string
}

export interface HolidayRegion {
  code: string
  name: string
}

export interface HolidaySource {
  code: string
  name: string
  regions: HolidayRegion[]
}

/** A day the company actually closes, selected from the holiday feed. */
export interface CompanyOffDay {
  date: string
  name: string | null
}

export interface TimesheetPeriod {
  from: string
  to: string
}

export interface Project {
  id: string
  name: string
  key: string | null

  type: string
  color: string
  status: string
  dueDate: string | null
  visibility: string
  createdAt: string
  _count: { tasks: number; workflows: number; repositories: number; gitRepositories: number }
}

export interface WorkflowColumn {
  id: string
  name: string
  status: string
  color: string | null
  isBacklog: boolean
  wipLimit: number | null
  position: number
  tasks: AgileTask[]
}

export interface Workflow {
  id: string
  name: string
  method: string | null
  columns: WorkflowColumn[]
}

export interface AgileTask {
  id: string
  title: string
  type: string
  status: string
  priority: string
  order: number
  storyPoints: number | null
  estimateHours: number | null
  description: string | null
  columnId: string | null
  sprintId: string | null
  dueDate: string | null
  createdAt: string
  assignee: { id: string; fullName: string | null; avatarUrl: string | null } | null
  reporter: { id: string; fullName: string | null; avatarUrl: string | null } | null
  epic: { id: string; title: string; type: string } | null
  subtasks: { id: string; title: string; status: string }[]
  _count: { comments: number }
}

export interface Sprint {
  id: string
  name: string
  goal: string | null
  status: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  teamId: string | null
  team: { id: string; name: string } | null
  points: number
  tasks: AgileTask[]
}

export interface AgileEpic {
  id: string
  title: string
  storyPoints: number | null
}

export interface PlannedTicket {
  title: string
  description: string | null
  type: string
  priority: string
  storyPoints: number | null
  epic: string | null
}

export interface SprintPlan {
  id: string
  fileName: string
  mimeType: string
  charCount: number
  status: "GENERATED" | "APPLIED" | "FAILED" | string
  error: string | null
  tickets: PlannedTicket[] | null
  projectId: string | null
  teamId: string | null
  sprintName: string | null
  sprintId: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface AppliedSprintPlan {
  ok: boolean
  project: { id: string; name: string }
  sprint: { id: string; name: string }
  createdEpics: number
  createdTasks: number
}

export interface AgileTeam {
  id: string
  name: string
  members: { userId: string; role: string; user: AuthUser }[]
}

export interface AgileSnapshot {
  project: {
    id: string
    name: string
    key: string | null
    description: string | null
    color: string
    type: string
    status: string
    owner: AuthUser
  }
  workflow: Workflow
  sprints: Sprint[]
  backlog: AgileTask[]
  epics: AgileEpic[]
  teams: AgileTeam[]
}

export interface Task {
  id: string
  title: string
  status: string
  priority: string
  order: number
  dueDate: string | null
  estimateHours: number | null
  assignee: { id: string; fullName: string | null } | null
  reporter: { id: string; fullName: string | null } | null
  _count: { comments: number }
}

export interface FixInfo {
  kind: string
  description?: string
}

export interface DevIssue {
  id: string
  filePath: string
  lineNumber: number | null
  columnStart: number | null
  columnEnd: number | null
  codeSnippet: string | null
  fix?: FixInfo | null
  message: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  category: string | null
  ruleId: string | null
  suggestion: string | null
  isFixed: boolean
  createdAt: string
  scanId?: string | null
  tasks: { id: string; title: string; status: string }[]
}

export interface DevScan {
  id: string
  status: string
  filesScanned: number
  linesAnalyzed: number
  durationMs: number | null
  error: string | null
  metrics: { lines_of_code?: number; cyclomatic_complexity?: number; maintainability_index?: number; files_scanned?: number; analyzed_files?: number; debt_score?: number }
  issues: DevIssue[]
  project: { id: string; name: string } | null
  repository: { id: string; name: string; defaultBranch: string } | null
  createdAt: string
}

export interface RuleCatalogEntry {
  id: string
  name: string
  category: string
  severity: string
  languages: string[]
  metric?: string | null
  operator?: string | null
  threshold?: number | null
  suggestion?: string | null
  enabled: boolean
}

export interface AnalysisConfig {
  organizationId: string
  projectId: string | null
  config: {
    thresholds?: Record<string, number>
    ignore_rules?: string[]
    exclude_paths?: string[]
    include_paths?: string[]
    rules?: Record<string, { enabled?: boolean }>
  }
}

export interface DebtPoint {
  scanId: string
  date: string
  debtScore: number | null
  openIssues: number
}

export interface DevStats {
  total: number
  open: number
  fixed: number
  severity: Record<string, number>
  topRules: { ruleId: string; count: number }[]
  debtScore: number | null
  latestScanId: string | null
  latestScanAt: string | null
}

export interface IssueExplanation {
  issueId: string
  explanation: string
  mode: "ai" | "template"
  provider: string | null
  model: string | null
}

export interface GitCommit {
  sha: string
  author: string
  email: string
  date: string
  message: string
}

export interface GitTreeEntry {
  type: string
  path: string
}

export interface GitRepository {
  id: string
  organizationId: string
  projectId: string | null
  name: string
  description: string | null
  visibility: "private" | "public"
  defaultBranch: string
  sizeKb: number
  fileCount: number
  lastCommitSha: string | null
  lastPushAt: string | null
  createdAt: string
  updatedAt: string
  branches: string[]
  commits: GitCommit[]
  files: GitTreeEntry[]
  readme: { path: string; content: string } | null
  project: { id: string; name: string } | null
}

export interface GitBlob {
  path: string
  ref: string
  size: number
  binary: boolean
  truncated: boolean
  content: string | null
}

export interface GitCommitDetail extends GitCommit {
  parents: string[]
  entries: { path: string; status: string; additions: number; deletions: number }[]
  additions: number
  deletions: number
  patch: string
}

export interface GitToken {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type RunStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED"

export interface PipelineStep {
  id: string
  name: string
  command: string
}

export interface PipelineRun {
  id: string
  organizationId: string
  pipelineId: string
  status: RunStatus
  trigger: "manual" | "push"
  branch: string
  commitSha: string | null
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  steps: (PipelineStep & {
    status: RunStatus
    startedAt: string | null
    completedAt: string | null
    durationMs: number | null
    output: string | null
  })[]
  error: string | null
  createdById: string | null
  createdAt: string
  createdBy: { id: string; fullName: string | null; email: string } | null
  pipeline?: { id: string; name: string; repository: { id: string; name: string } | null } | null
}

export interface Pipeline {
  id: string
  organizationId: string
  repositoryId: string
  name: string
  description: string | null
  trigger: "manual" | "push"
  branch: string
  status: "active" | "disabled"
  steps: PipelineStep[]
  createdById: string | null
  createdAt: string
  updatedAt: string
  repository: { id: string; name: string; defaultBranch: string } | null
  lastRun: PipelineRun | null
}

export type AiProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "mistral"
  | "openrouter"
  | "azure"
  | "ollama"
  | "openai_compatible"

export interface AiProviderSpec {
  type: AiProviderType
  label: string
  needsBaseUrl: boolean
  hasDefaultBaseUrl: boolean
  defaultBaseUrl: string
  needsKey: boolean
  keyOptional: boolean
  baseUrlPlaceholder: string
  defaultModels: string[]
}

export interface AiProvider {
  id: string
  organizationId: string
  name: string
  type: AiProviderType
  baseUrl: string | null
  apiKeyHint: string | null
  models: string[]
  defaultModel: string | null
  status: "active" | "disabled"
  lastTestAt: string | null
  lastTestStatus: "ok" | "fail" | null
  lastTestError: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; fullName: string | null; email: string } | null
}

export interface AiChatMessageData {
  role: "user" | "assistant"
  content: string
}

export interface AiChatResult {
  reply: string
  model: string
  durationMs: number
  usage: { input: number | null; output: number | null; total: number | null }
  requestedAt: string
}

export interface AgentConnection {
  id: string
  organizationId: string
  name: string
  baseUrl: string
  agentId: string
  apiKeyHint: string | null
  status: "active" | "disabled"
  lastTestAt: string | null
  lastTestStatus: "ok" | "fail" | null
  lastTestError: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentRun {
  id: string
  organizationId: string
  connectionId: string
  status: "completed" | "failed"
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  durationMs: number | null
  providerRunId: string | null
  createdById: string | null
  createdAt: string
  connection?: { id: string; name: string } | null
}

export interface AgentConnectionTest {
  ok: boolean
  error?: string
  durationMs?: number
  agent?: {
    id: string
    name: string
    lifecycleStatus: string
    deployment: Record<string, unknown>
  }
}


// ------------------------- Software factory ------------------------- //

export type FactoryRunStatus =
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

export type FactoryGateStatus = "PENDING" | "PASSED" | "FAILED" | "BLOCKED"

export interface FactoryAgentProfile {
  id: string
  name: string
  slug: string
  role: string
  description: string | null
  instructions: string | null
  connectionId: string | null
  modelProviderId: string | null
  model: string | null
  capabilities: string[]
  allowedTools: string[]
  permissions: Record<string, unknown>
  budgetTokens: number
  timeoutSeconds: number
  maxRetries: number
  version: number
  status: "active" | "disabled" | string
  createdAt: string
  updatedAt: string
  connection?: { id: string; name: string; status: string } | null
  modelProvider?: { id: string; name: string; type: string; defaultModel: string | null } | null
}

export interface FactoryIssueProfile {
  id: string
  taskId: string
  classification: string
  labels: string[]
  complexity: number
  risk: "low" | "medium" | "high" | string
  autonomous: boolean
  confidence: number
  missingAcceptanceCriteria: boolean
  duplicateOfIds: string[]
  suggestedPriority: string | null
  suggestedAgentRole: string | null
  rationale: string[]
  analyzedBy: string
  model: string | null
  createdAt: string
  updatedAt: string
}

export interface FactoryCommandRun {
  id: string
  kind: string
  command: string
  runner: "docker" | "local" | "blocked" | string
  status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "BLOCKED" | "TIMEOUT" | "CANCELLED" | string
  exitCode: number | null
  output: string | null
  durationMs: number | null
  error: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface FactoryCostEvent {
  id: string
  kind: string
  provider: string | null
  model: string | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number | null
  durationMs: number | null
  createdAt: string
}

export interface FactoryProjectConfig {
  testCommand: string | null
  buildCommand: string | null
  lintCommand: string | null
  auditCommand: string | null
  image: string
  timeoutMs: number
}

export interface ProjectKnowledge {
  id: string
  projectId: string | null
  title: string
  category: string
  content: string
  source: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface FactoryImpact {
  project: { id: string; name: string }
  targetRepositories: { id: string; name: string }[]
  impacts: {
    repository: { id: string; name: string }
    project: { id: string; name: string } | null
    sharedDependencies: string[]
    risk: string
  }[]
}

export interface FactoryPlan {
  id: string
  runId: string
  version: number
  status: string
  summary: string
  steps: { title: string; detail: string }[]
  files: { path: string; reason: string }[]
  tests: string[]
  acceptanceCriteria: string[]
  risks: string[]
  outOfScope: string[]
  knowledgeRefs: { id: string; title: string; category: string }[]
  approvalRequired: boolean
  generatedBy: string
  model: string | null
  reasoning: string | null
  createdAt: string
}

export interface FactoryGate {
  id: string
  name: string
  status: FactoryGateStatus
  detail: string | null
  evidence: Record<string, unknown>
  scanId: string | null
  createdAt: string
  updatedAt: string
}

export interface FactoryApproval {
  id: string
  stage: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  requestedRole: string | null
  requestedById: string | null
  decidedById: string | null
  reason: string | null
  createdAt: string
  decidedAt: string | null
}

export interface FactoryEvent {
  id: string
  type: string
  actorId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export interface FactoryRunSummary {
  id: string
  status: FactoryRunStatus
  stage: string
  correlationId: string
  branch: string | null
  baseBranch: string | null
  commitSha: string | null
  planVersion: number | null
  error: string | null
  createdAt: string
  updatedAt: string
  task: { id: string; title: string; priority: string; status: string }
  project: { id: string; name: string; key: string | null }
  repository: { id: string; name: string; defaultBranch: string } | null
  agentProfile: { id: string; name: string; role: string } | null
  plans: { version: number; approvalRequired: boolean; generatedBy: string }[]
  gates: { name: string; status: FactoryGateStatus }[]
  approvals: { id: string; stage: string }[]
  pullRequest?: { number: number; status: string } | null
}

export interface FactoryPullRequest {
  id: string
  runId: string
  repositoryId: string
  number: number
  title: string
  body: string | null
  sourceBranch: string
  targetBranch: string
  status: "OPEN" | "MERGED" | "CLOSED" | string
  risk: string | null
  changedFiles: { path: string; status: string; additions: number; deletions: number }[]
  diffStats: { entries?: unknown[]; additions?: number; deletions?: number }
  commitShas: string[]
  findings: unknown[]
  securityFindings: unknown[]
  checks: { name: string; status: string; detail: string | null }[]
  createdAt: string
  updatedAt: string
  mergedAt: string | null
}

export interface FactoryPendingApproval {
  id: string
  stage: string
  status: string
  requestedRole: string | null
  requestedById: string | null
  reason: string | null
  createdAt: string
  run: {
    id: string
    status: FactoryRunStatus
    stage: string
    branch: string | null
    task: { id: string; title: string; priority: string }
    project: { id: string; name: string }
    agentProfile: { id: string; name: string; role: string } | null
    plans: { version: number; summary: string }[]
  }
}

export interface FactoryRun extends Omit<FactoryRunSummary, "plans" | "gates" | "approvals"> {
  projectId: string
  taskId: string
  repositoryId: string | null
  agentProfileId: string | null
  connectionId: string | null
  metadata: Record<string, unknown>
  startedAt: string | null
  completedAt: string | null
  plans: FactoryPlan[]
  gates: FactoryGate[]
  approvals: FactoryApproval[]
  events: FactoryEvent[]
  commandRuns: FactoryCommandRun[]
  costEvents: FactoryCostEvent[]
  issueProfile: FactoryIssueProfile | null
  pullRequest: FactoryPullRequest | null
}

export interface FactoryStats {
  runs: Record<string, number>
  gates: Record<string, number>
  activeProfiles: number
  pendingApprovals: number
  cost: { totalTokens: number; estimatedCostUsd: number | null }
}

export interface AutomationProposal {
  id: string
  fingerprint: string
  title: string
  description: string
  category: string
  frequency: number
  estimatedMinutesSaved: number
  complexity: string
  risk: string
  requiredPermissions: string[]
  proposedWorkflow: Record<string, unknown>
  evidence: Record<string, unknown>
  status: "PENDING" | "APPROVED" | "REJECTED" | string
  decisionReason: string | null
  createdAt: string
  decidedAt: string | null
}

export interface PolicyRule {
  id: string
  key: string
  name: string
  description: string | null
  category: string
  effect: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "WARN"
  priority: number
  enabled: boolean
  scope: string
  subject: string
  conditions: { key: string; op: string; value?: unknown }[]
  actions: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
}

export interface PolicyEvaluation {
  id: string
  subject: string
  action: string | null
  decision: string
  allowed: boolean
  reasons: string[]
  context: Record<string, unknown>
  ruleIds: string[]
  createdAt: string
}

export interface GatewayStatus {
  baseUrl: string
  healthy: boolean
  status?: string
  version?: string
}

export type ServerProtocol = "ssh" | "ftp" | "npm"

export interface ServerConnection {
  id: string
  organizationId: string
  label: string
  host: string
  port: number
  protocol: ServerProtocol
  username: string | null
  hasCredential: boolean
  lastProbeAt: string | null
  lastProbeOk: boolean | null
  lastProbeError: string | null
  createdAt: string
  updatedAt: string
  _count?: { apps: number }
}

export interface DeployedApp {
  id: string
  organizationId: string
  connectionId: string
  label: string
  url: string
  probePath: string | null
  probeMethod: string | null
  lastCheckAt: string | null
  lastStatus: "ok" | "fail" | null
  createdAt: string
  updatedAt: string
  connection?: { id: string; label: string; host: string }
}

export type AiActionKind = "optimize_dockerfile" | "optimize_pipeline" | "fix_scan_issues" | "explain_code"

export type AiActionMessageData = { role: "system" | "user" | "assistant"; content: string }

export interface AiActionPreset {
  kind: AiActionKind
  name: string
  model: string | null
  instructions: string
}

export interface AiActionDef {
  key: AiActionKind
  name: string
  description: string
  inputs: {
    preset: string | null
    model: string | null
    source: string | null
    repositoryId: string | null
    pipelineId: string | null
    projectId: string | null
    issues: { id: string; repositoryId: string; filePath: string; lineNumber: number | null; severity: string; message: string; category: string; ruleId: string }[] | null
  } | null
}

export interface AiActionRun {
  id: string
  organizationId: string
  providerId: string | null
  providerName: string | null
  model: string | null
  action: AiActionKind
  status: "completed" | "failed"
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  applied: boolean
  appliedAt: string | null
  error: string | null
  durationMs: number | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; fullName: string | null; email: string } | null
}

export interface DevRepository {
  id: string
  name: string
  url: string | null
  fullPath: string | null
  provider: "github" | "gitlab" | "bitbucket" | "azure" | "other"
  defaultBranch: string
  language: string | null
  sizeKb: number
  techDebtRatio: number | null
  scanOnPush: boolean
  lastSyncAt: string | null
  lastCommitSha: string | null
  webhookSecret: string | null
  createdAt: string
  branches?: string[]
  commits?: GitCommit[]
  project: { id: string; name: string } | null
  _count: { scans: number }
  scans?: { status: string; completedAt: string | null; error: string | null; metrics: DevScan["metrics"]; _count: { issues: number } }[]
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

export interface Comment {
  id: string
  taskId: string
  authorId: string
  body: string
  author: AuthUser
  createdAt: string
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  if (!query) return `${API_BASE}${path}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`
}

/**
 * Session token plumbing. The refresh token lives in an httpOnly cookie (set by
 * the API on login), so it never touches JS. When any request comes back 401 we
 * rotate the cookie once (single-flight so concurrent 401s cannot trip the
 * server-side reuse detection) and replay the original request with the new
 * access token. Listeners (auth-context) stay in sync via onSessionTokenChange.
 */
type SessionTokenListener = (token: string) => void

let sessionTokenListener: SessionTokenListener | null = null
let refreshInFlight: Promise<string | null> | null = null

export function onSessionTokenChange(listener: SessionTokenListener | null): void {
  sessionTokenListener = listener
}

function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    const p = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          credentials: "include",
        })
        if (!res.ok) return null
        const data = (await res.json()) as { accessToken?: string }
        if (!data.accessToken) return null
        sessionTokenListener?.(data.accessToken)
        return data.accessToken
      } catch {
        return null
      }
    })()
    refreshInFlight = p
    void p.then(
      () => {
        refreshInFlight = null
      },
      () => {
        refreshInFlight = null
      }
    )
  }
  return refreshInFlight
}

interface FetchSpec {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit
  token?: string
}

async function fetchWithAuth(
  path: string,
  spec: FetchSpec = {},
  query?: Record<string, string | number | undefined>
): Promise<Response> {
  const execute = (token?: string): Promise<Response> => {
    const headers = { ...spec.headers }
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(buildUrl(path, query), {
      method: spec.method ?? "GET",
      headers,
      body: spec.body,
      cache: "no-store",
      credentials: "include",
    })
  }

  const first = await execute(spec.token)
  if (first.status !== 401 || !spec.token) return first

  const fresh = await refreshSession()
  if (!fresh) return first
  return execute(fresh)
}

async function request<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string
    orgId?: string
    query?: Record<string, string | number | undefined>
  } = {}
): Promise<T> {
  const { method = "GET", body, token, orgId, query } = options
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (orgId) headers["X-Organization-Id"] = orgId

  const res = await fetchWithAuth(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), token }, query)

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (Array.isArray(data.message)) message = data.message.join(", ")
      else if (typeof data.message === "string") message = data.message
      else if (data.error) message = data.error
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message)
  }

  return (await res.json()) as T
}

async function requestText(
  path: string,
  options: {
    method?: string
    token?: string
    orgId?: string
  } = {}
): Promise<string> {
  const { method = "GET", token, orgId } = options
  const headers: Record<string, string> = {}
  if (orgId) headers["X-Organization-Id"] = orgId

  const res = await fetchWithAuth(path, { method, headers, token })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (Array.isArray(data.message)) message = data.message.join(", ")
      else if (typeof data.message === "string") message = data.message
      else if (data.error) message = data.error
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message)
  }

  return res.text()
}

async function requestRaw(
  path: string,
  options: {
    method?: string
    body?: string
    contentType?: string
    token?: string
    orgId?: string
  } = {}
): Promise<{ status: number; ok: boolean; text: string; message?: string }> {
  const { method = "GET", body, contentType, token, orgId } = options
  const headers: Record<string, string> = {}
  if (contentType) headers["Content-Type"] = contentType
  if (orgId) headers["X-Organization-Id"] = orgId

  const res = await fetchWithAuth(path, { method, headers, body, token })

  const text = await res.text()
  if (!res.ok) {
    let message = res.statusText
    try {
      const data = JSON.parse(text) as { message?: unknown; error?: unknown }
      if (Array.isArray(data.message)) message = data.message.join(", ")
      else if (typeof data.message === "string") message = data.message
      else if (data.error) message = String(data.error)
    } catch {
      /* keep statusText */
    }
    return { status: res.status, ok: false, text, message }
  }

  return { status: res.status, ok: true, text }
}

export async function requestMultipart<T>(
  path: string,
  options: {
    method?: string
    form: FormData
    token?: string
    orgId?: string
  }
): Promise<T> {
  const { method = "POST", form, token, orgId } = options
  const headers: Record<string, string> = {}
  if (orgId) headers["X-Organization-Id"] = orgId

  const res = await fetchWithAuth(path, { method, headers, body: form, token })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (Array.isArray(data.message)) message = data.message.join(", ")
      else if (typeof data.message === "string") message = data.message
      else if (data.error) message = data.error
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message)
  }

  return (await res.json()) as T
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// --------------------------- Service Desk (ITSM) --------------------------- //

export type ServicePriority = "P1" | "P2" | "P3" | "P4"

export type RequestStatus =
  | "SUBMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "FULFILLED"
  | "CANCELLED"
  | "CLOSED"

export type IncidentStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"

export type ServiceEntityType = "REQUEST" | "INCIDENT" | "ARTICLE"

export interface FormField {
  key: string
  label: string
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox"
  required?: boolean
  options?: string[]
}

export interface ServiceItem {
  id: string
  organizationId: string
  name: string
  description: string
  category: string
  icon: string | null
  active: boolean
  requiresApproval: boolean
  estimatedDays: number | null
  sortOrder: number
  formSchema: FormField[]
  createdAt: string
  updatedAt: string
}

export interface ServiceUserRef {
  id: string
  fullName: string | null
  email: string
}

export interface ServiceRequest {
  id: string
  organizationId: string
  number: string
  itemId: string | null
  title: string
  description: string
  status: RequestStatus
  priority: ServicePriority
  formData: Record<string, unknown>
  requesterId: string | null
  requesterEmail: string | null
  requesterName: string | null
  assigneeId: string | null
  approverId: string | null
  decisionNote: string | null
  rating: number | null
  approvedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  targetAt: string | null
  dueAt: string | null
  source: string
  createdAt: string
  updatedAt: string
  item?: { id: string; name: string; category: string; icon: string | null; estimatedDays: number | null } | null
  requester?: ServiceUserRef | null
  assignee?: ServiceUserRef | null
  approver?: ServiceUserRef | null
}

export interface ServiceRequestDetail extends ServiceRequest {
  incidents?: { id: string; number: string; title: string; status: IncidentStatus; priority: ServicePriority }[]
}

export interface Incident {
  id: string
  organizationId: string
  number: string
  title: string
  description: string
  status: IncidentStatus
  priority: ServicePriority
  category: string | null
  assigneeId: string | null
  requesterId: string | null
  requesterEmail: string | null
  requesterName: string | null
  linkedRequestId: string | null
  resolution: string | null
  rootCause: string | null
  firstRespondedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  responseDueAt: string | null
  resolveDueAt: string | null
  responseBreached: boolean
  resolveBreached: boolean
  reopenCount: number
  source: string
  createdAt: string
  updatedAt: string
  assignee?: ServiceUserRef | null
  requester?: ServiceUserRef | null
  linkedRequest?: { id: string; number: string; title: string; status: RequestStatus } | null
}

export interface ServiceComment {
  id: string
  organizationId: string
  entityType: ServiceEntityType
  entityId: string
  authorId: string | null
  authorName: string | null
  body: string
  internal: boolean
  createdAt: string
  author?: ServiceUserRef | null
}

export interface KnowledgeArticle {
  id: string
  organizationId: string
  title: string
  slug: string
  summary: string | null
  body: string
  category: string
  tags: string[]
  views: number
  helpful: number
  notHelpful: number
  published: boolean
  incidentId: string | null
  createdAt: string
  updatedAt: string
  author?: ServiceUserRef | null
}

export interface SlaPolicy {
  priority: ServicePriority
  name: string
  responseMinutes: number
  resolveMinutes: number
  businessHoursOnly: boolean
  active: boolean
  custom: boolean
}

export interface ServiceAgent {
  userId: string
  role: string
  user: ServiceUserRef
}

export interface ServiceQueue {
  requests: Record<string, number>
  incidents: Record<string, number>
}

export interface ServiceActivity {
  id: string
  entityType: ServiceEntityType
  entityId: string
  reference: string | null
  body: string
  author: string
  createdAt: string
}

export interface ServiceDeskOverview {
  requests: { total: number; open: number; pendingApprovals: number; byStatus: Record<string, number> }
  incidents: {
    total: number
    open: number
    breached: number
    unassigned: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
  }
  sla: { compliance: number | null; measurable: number; avgResolutionHours: number | null; avgFirstResponseMinutes: number | null }
  satisfaction: { average: number | null; responses: number }
  topItems: { id: string; name: string; category: string; icon: string | null; requests: number }[]
  workload: { assigneeId: string | null; name: string | null; open: number }[]
  recentActivity: ServiceActivity[]
  myQueue: ServiceQueue
}

export interface RequestFilters {
  status?: string
  priority?: string
  view?: "mine" | "unassigned" | "requested" | string
  search?: string
  itemId?: string
}

export interface IncidentFilters {
  status?: string
  priority?: string
  view?: "mine" | "unassigned" | "open" | string
  search?: string
  breached?: boolean
}

export interface PublicCatalogItem {
  id: string
  name: string
  description: string
  category: string
  icon: string | null
  estimatedDays: number | null
  formSchema: FormField[]
}

export interface PublicTrackedTicket {
  kind: "request" | "incident"
  id: string
  number: string
  title: string
  status: RequestStatus | IncidentStatus
  priority: ServicePriority
  createdAt: string
  updatedAt: string
  targetAt?: string | null
  dueAt?: string | null
  resolveDueAt?: string | null
  resolvedAt?: string | null
  item?: { name: string } | null
}

export const api = {
  baseUrl: API_BASE,

  register(dto: { email: string; password: string; fullName?: string; locale?: string; inviteToken?: string }) {
    return request<AuthResponse>("/auth/register", { method: "POST", body: dto })
  },

  login(dto: { email: string; password: string }) {
    return request<AuthResponse>("/auth/login", { method: "POST", body: dto })
  },

  basacoreExchange(dto: { code: string; codeVerifier: string; redirectUri: string; nonce?: string }) {
    return request<AuthResponse>("/auth/basacore/exchange", { method: "POST", body: dto })
  },

  /** Rotates the httpOnly refresh cookie; no body needed. */
  refresh() {
    return request<AuthResponse>("/auth/refresh", { method: "POST" })
  },

  /** Revokes the refresh cookie server-side and asks the browser to drop it. */
  logout() {
    return request<unknown>("/auth/logout", { method: "POST", body: {} })
  },

  me(token: string) {
    return request<AuthUser>("/auth/me", { token })
  },

  listOrganizations(token: string) {
    return request<Organization[]>("/organizations", { token })
  },

  createOrganization(dto: { name: string; slug?: string; currency?: string }, token: string) {
    return request<Organization>("/organizations", { method: "POST", body: dto, token })
  },

  listProjects(token: string, orgId: string) {
    return request<Project[]>(`/organizations/${orgId}/projects`, { token, orgId })
  },

  createProject(
    dto: { name: string; key?: string; type?: string; color?: string; description?: string },
    token: string,
    orgId: string
  ) {
    return request<Project>(`/organizations/${orgId}/projects`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listMembers(token: string, orgId: string) {
    return request<OrgMember[]>(`/organizations/${orgId}/members`, { token, orgId })
  },

  listTeams(token: string, orgId: string) {
    return request<Team[]>(`/organizations/${orgId}/teams`, { token, orgId })
  },

  createTeam(dto: { name: string; description?: string; color?: string }, token: string, orgId: string) {
    return request<Team>(`/organizations/${orgId}/teams`, { method: "POST", body: dto, token, orgId })
  },

  addTeamMember(teamId: string, dto: { userId: string; role?: string }, token: string, orgId: string) {
    return request<TeamMember>(`/organizations/${orgId}/teams/${teamId}/members`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  removeTeamMember(teamId: string, memberId: string, token: string, orgId: string) {
    return request(`/organizations/${orgId}/teams/${teamId}/members/${memberId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  listConversations(token: string, orgId: string) {
    return request<Conversation[]>(`/organizations/${orgId}/conversations`, { token, orgId })
  },

  getConversation(token: string, orgId: string, conversationId: string) {
    return request<Conversation>(`/organizations/${orgId}/conversations/${conversationId}`, { token, orgId })
  },

  openDirect(token: string, orgId: string, userId: string) {
    return request<Conversation>(`/organizations/${orgId}/conversations/direct`, {
      method: "POST",
      body: { userId },
      token,
      orgId,
    })
  },

  createGroup(dto: { name: string; memberIds?: string[] }, token: string, orgId: string) {
    return request<Conversation>(`/organizations/${orgId}/conversations/group`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listMessages(token: string, orgId: string, conversationId: string, cursor?: string, limit = 50) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : `?limit=${limit}`
    return request<Message[]>(`/organizations/${orgId}/conversations/${conversationId}/messages${q}`, {
      token,
      orgId,
    })
  },

  uploadFile(token: string, orgId: string, file: File) {
    const form = new FormData()
    form.append("file", file, file.name)
    return requestMultipart<MessageAttachment>(`/organizations/${orgId}/files`, { form, token, orgId })
  },

  updateStatus(
    token: string,
    orgId: string,
    dto: { status?: string; statusNote?: string | null; statusUntil?: string | null }
  ) {
    return request<{
      organizationId: string
      userId: string
      status: string
      statusNote: string | null
      statusUntil: string | null
      lastSeenAt: string | null
    }>(`/organizations/${orgId}/me/status`, { method: "PATCH", body: dto, token, orgId })
  },

  sendMessage(
    token: string,
    orgId: string,
    conversationId: string,
    body: string,
    opts?: {
      kind?: string
      mediaUrl?: string
      mediaWidth?: number
      mediaHeight?: number
      mimeType?: string
      attachmentId?: string
      mentions?: string[]
    }
  ) {
    return request<Message>(`/organizations/${orgId}/conversations/${conversationId}/messages`, {
      method: "POST",
      body: {
        body,
        ...(opts?.kind ? { kind: opts.kind } : {}),
        ...(opts?.mediaUrl ? { mediaUrl: opts.mediaUrl, mediaWidth: opts.mediaWidth, mediaHeight: opts.mediaHeight, mimeType: opts.mimeType } : {}),
        ...(opts?.attachmentId ? { attachmentId: opts.attachmentId } : {}),
        ...(opts?.mentions?.length ? { mentions: opts.mentions } : {}),
      },
      token,
      orgId,
    })
  },

  addReaction(token: string, orgId: string, conversationId: string, messageId: string, emoji: string) {
    return request<Message>(`/organizations/${orgId}/conversations/${conversationId}/messages/${messageId}/reactions`, {
      method: "PATCH",
      body: { emoji },
      token,
      orgId,
    })
  },

  removeReaction(token: string, orgId: string, conversationId: string, messageId: string) {
    return request<Message>(`/organizations/${orgId}/conversations/${conversationId}/messages/${messageId}/reactions`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  deleteMessage(token: string, orgId: string, conversationId: string, messageId: string) {
    return request<Message>(
      `/organizations/${orgId}/conversations/${conversationId}/messages/${messageId}`,
      { method: "DELETE", token, orgId }
    )
  },

  setConversationArchived(token: string, orgId: string, conversationId: string, archived: boolean) {
    return request<{ ok: boolean; archived: boolean }>(
      `/organizations/${orgId}/conversations/${conversationId}/archive`,
      { method: "PATCH", body: { archived }, token, orgId }
    )
  },

  markConversationRead(token: string, orgId: string, conversationId: string) {
    return request(`/organizations/${orgId}/conversations/${conversationId}/read`, {
      method: "POST",
      body: {},
      token,
      orgId,
    })
  },

  sendTyping(token: string, orgId: string, conversationId: string, typing: boolean) {
    return request(`/organizations/${orgId}/conversations/${conversationId}/typing`, {
      method: "POST",
      body: { typing },
      token,
      orgId,
    })
  },

  listInvites(token: string, orgId: string) {
    return request<Invite[]>(`/organizations/${orgId}/invites`, { token, orgId })
  },

  inviteMember(token: string, orgId: string, dto: { email: string; role?: string; title?: string }) {
    return request<{ invited: boolean }>(`/organizations/${orgId}/members/invite`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  revokeInvite(token: string, orgId: string, inviteId: string) {
    return request(`/organizations/${orgId}/invites/${inviteId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  getOrganization(token: string, orgId: string) {
    return request<OrganizationDetail>(`/organizations/${orgId}`, { token, orgId })
  },

  updateOrganization(
    token: string,
    orgId: string,
    dto: {
      name?: string
      billingEmail?: string
      currency?: string
      locale?: string
      timezone?: string
      country?: string
      holidayCountry?: string
      holidayRegion?: string
      workWeekStart?: number
    }
  ) {
    return request<OrganizationDetail>(`/organizations/${orgId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  updateMemberRole(token: string, orgId: string, memberId: string, dto: UpdateMemberRoleInput) {
    return request<OrgMember>(`/organizations/${orgId}/members/${memberId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  removeMember(token: string, orgId: string, memberId: string) {
    return request<{ removed: boolean }>(`/organizations/${orgId}/members/${memberId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  listAuditLogs(token: string, orgId: string, action?: string) {
    const q = action && action !== "ALL" ? `?action=${encodeURIComponent(action)}` : ""
    return request<AuditLog[]>(`/organizations/${orgId}/audit-logs${q}`, { token, orgId })
  },

  getAccessCatalog(token: string, orgId: string) {
    return request<AccessCatalog>(`/organizations/${orgId}/access`, { token, orgId })
  },

  getProject(token: string, orgId: string, projectId: string) {
    return request<AgileSnapshot>(`/organizations/${orgId}/projects/${projectId}`, {
      token,
      orgId,
    })
  },

  agileSnapshot(token: string, orgId: string, projectId: string) {
    return request<AgileSnapshot>(`/organizations/${orgId}/projects/${projectId}/agile`, {
      token,
      orgId,
    })
  },

  saveWorkflow(
    token: string,
    orgId: string,
    projectId: string,
    dto: { name?: string; method?: string; columns: { name: string; status?: string; color?: string | null; isBacklog?: boolean; wipLimit?: number | null }[] }
  ) {
    return request<Workflow>(`/organizations/${orgId}/projects/${projectId}/agile/workflow`, {
      method: "PUT",
      body: dto,
      token,
      orgId,
    })
  },

  createSprint(
    token: string,
    orgId: string,
    projectId: string,
    dto: { name: string; goal?: string; startDate?: string; endDate?: string; teamId?: string }
  ) {
    return request<Sprint>(`/organizations/${orgId}/projects/${projectId}/agile/sprints`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateSprint(
    token: string,
    orgId: string,
    projectId: string,
    sprintId: string,
    dto: { name?: string; goal?: string | null; startDate?: string | null; endDate?: string | null; teamId?: string | null }
  ) {
    return request<Sprint>(`/organizations/${orgId}/projects/${projectId}/agile/sprints/${sprintId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  setSprintStatus(token: string, orgId: string, projectId: string, sprintId: string, status: string) {
    return request<Sprint>(`/organizations/${orgId}/projects/${projectId}/agile/sprints/${sprintId}/status`, {
      method: "PATCH",
      body: { status },
      token,
      orgId,
    })
  },

  deleteSprint(token: string, orgId: string, projectId: string, sprintId: string) {
    return request(`/organizations/${orgId}/projects/${projectId}/agile/sprints/${sprintId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  moveTask(token: string, orgId: string, projectId: string, taskId: string, columnId: string, index = 0) {
    return request<AgileTask>(`/organizations/${orgId}/projects/${projectId}/agile/tasks/${taskId}/move`, {
      method: "PATCH",
      body: { columnId, index },
      token,
      orgId,
    })
  },

  createTask(
    dto: {
      title: string
      description?: string
      type?: string
      priority?: string
      assigneeId?: string
      dueDate?: string
      columnId?: string
      sprintId?: string
      epicId?: string
      storyPoints?: number
    },
    token: string,
    orgId: string,
    projectId: string
  ) {
    return request<AgileTask>(`/organizations/${orgId}/projects/${projectId}/tasks`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listTasks(token: string, orgId: string, projectId: string, teamId?: string) {
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
    return request<AgileTask[]>(`/organizations/${orgId}/projects/${projectId}/tasks${q}`, {
      token,
      orgId,
    })
  },

  devAnalyze(dto: { source: string; language?: string; projectId?: string }, token: string, orgId: string) {
    return request<DevScan>(`/organizations/${orgId}/dev/analyze`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listScans(token: string, orgId: string, projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    return request<DevScan[]>(`/organizations/${orgId}/dev/scans${q}`, { token, orgId })
  },

  listTimesheetEntries(token: string, orgId: string, params?: { from?: string; to?: string; projectId?: string }) {
    const q = new URLSearchParams()
    if (params?.from) q.set("from", params.from)
    if (params?.to) q.set("to", params.to)
    if (params?.projectId) q.set("projectId", params.projectId)
    const qs = q.toString() ? `?${q.toString()}` : ""
    return request<TimesheetEntry[]>(`/organizations/${orgId}/timesheets${qs}`, { token, orgId })
  },

  exportTimesheetsCsv(token: string, orgId: string, params?: { from?: string; to?: string; projectId?: string }): Promise<string> {
    const q = new URLSearchParams()
    if (params?.from) q.set("from", params.from)
    if (params?.to) q.set("to", params.to)
    if (params?.projectId) q.set("projectId", params.projectId)
    const qs = q.toString() ? `?${q.toString()}` : ""
    return requestText(`/organizations/${orgId}/timesheets/export${qs}`, { token, orgId })
  },

  importTimesheetsCsv(csv: string, token: string, orgId: string): Promise<TimesheetImportResult> {
    return requestRaw(`/organizations/${orgId}/timesheets/import`, {
      method: "POST",
      body: csv,
      contentType: "text/csv; charset=utf-8",
      token,
      orgId,
    }).then((res) => {
      if (!res.ok) throw new ApiError(res.status ?? 500, res.message ?? "Import failed")
      return JSON.parse(res.text) as TimesheetImportResult
    })
  },

  listAgentConnections(token: string, orgId: string) {
    return request<AgentConnection[]>(`/organizations/${orgId}/agent-factory/connections`, {
      token,
      orgId,
    })
  },

  createAgentConnection(
    dto: { name: string; baseUrl: string; agentId: string; apiKey?: string },
    token: string,
    orgId: string
  ) {
    return request<AgentConnection>(`/organizations/${orgId}/agent-factory/connections`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateAgentConnection(
    connectionId: string,
    dto: { name?: string; baseUrl?: string; agentId?: string; apiKey?: string; status?: string },
    token: string,
    orgId: string
  ) {
    return request<AgentConnection>(
      `/organizations/${orgId}/agent-factory/connections/${connectionId}`,
      { method: "PATCH", body: dto, token, orgId }
    )
  },

  deleteAgentConnection(connectionId: string, token: string, orgId: string) {
    return request<{ ok: boolean }>(
      `/organizations/${orgId}/agent-factory/connections/${connectionId}`,
      { method: "DELETE", token, orgId }
    )
  },

  testAgentConnection(connectionId: string, token: string, orgId: string) {
    return request<AgentConnectionTest>(
      `/organizations/${orgId}/agent-factory/connections/${connectionId}/test`,
      { method: "POST", body: {}, token, orgId }
    )
  },

  runAgent(
    connectionId: string,
    input: Record<string, unknown>,
    token: string,
    orgId: string
  ) {
    return request<AgentRun>(
      `/organizations/${orgId}/agent-factory/connections/${connectionId}/run`,
      { method: "POST", body: { input }, token, orgId }
    )
  },

  listAgentRuns(token: string, orgId: string, connectionId?: string) {
    const q = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""
    return request<AgentRun[]>(`/organizations/${orgId}/agent-factory/runs${q}`, { token, orgId })
  },

  assistantQuery(token: string, orgId: string, question: string): Promise<AssistantQueryResult> {
    return request<AssistantQueryResult>(`/organizations/${orgId}/ai/assistant/query`, {
      method: "POST",
      body: { question },
      token,
      orgId,
    })
  },

  upsertTimesheetEntry(
    dto: {
      organizationId: string
      userId: string
      workDate: string
      projectId?: string | null
      taskId?: string | null
      hours: number
      activity?: string | null
      status?: TimesheetStatus
    },
    token: string,
    orgId: string
  ) {
    return request<TimesheetEntry>(`/organizations/${orgId}/timesheets`, { method: "POST", body: dto, token, orgId })
  },

  listLeaveTypes(token: string, orgId: string) {
    return request<LeaveType[]>(`/organizations/${orgId}/timesheets/leave-types`, { token, orgId })
  },

  createLeaveType(
    token: string,
    orgId: string,
    dto: {
      name: string
      code: string
      color?: string
      isPaid?: boolean
      daysPerYear?: number
      carryOverDays?: number
      accrualPerMonth?: number
      requiresApproval?: boolean
      isActive?: boolean
    }
  ) {
    return request<LeaveType>(`/organizations/${orgId}/timesheets/leave-types`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateLeaveType(
    token: string,
    orgId: string,
    typeId: string,
    dto: {
      name?: string
      code?: string
      color?: string
      isPaid?: boolean
      daysPerYear?: number
      carryOverDays?: number
      accrualPerMonth?: number
      requiresApproval?: boolean
      isActive?: boolean
    }
  ) {
    return request<LeaveType>(`/organizations/${orgId}/timesheets/leave-types/${typeId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  listLeaveBalances(token: string, orgId: string, year?: number, userId?: string) {
    const q = new URLSearchParams()
    if (year) q.set("year", String(year))
    if (userId) q.set("userId", userId)
    const qs = q.toString() ? `?${q.toString()}` : ""
    return request<LeaveBalance[]>(`/organizations/${orgId}/timesheets/leave-balances${qs}`, { token, orgId })
  },

  updateLeaveBalance(
    token: string,
    orgId: string,
    balanceId: string,
    dto: { granted?: number; carriedOver?: number; adjusted?: number; pending?: number; used?: number }
  ) {
    return request<LeaveBalance>(`/organizations/${orgId}/timesheets/leave-balances/${balanceId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  listLeaveRequests(
    token: string,
    orgId: string,
    params?: { year?: number; status?: LeaveRequestStatus; scope?: "all" }
  ) {
    const q = new URLSearchParams()
    if (params?.year) q.set("year", String(params.year))
    if (params?.status) q.set("status", params.status)
    if (params?.scope) q.set("scope", params.scope)
    const qs = q.toString() ? `?${q.toString()}` : ""
    return request<LeaveRequest[]>(`/organizations/${orgId}/timesheets/leave-requests${qs}`, { token, orgId })
  },

  createLeaveRequest(dto: { typeId: string; startDate: string; endDate: string; days: number; reason?: string | null }, token: string, orgId: string) {
    return request<LeaveRequest>(`/organizations/${orgId}/timesheets/leave-requests`, { method: "POST", body: dto, token, orgId })
  },

  /** Pending queue for reviewers (MANAGER+); each item includes the requester. */
  listPendingLeaveRequests(token: string, orgId: string) {
    return request<LeaveRequest[]>(`/organizations/${orgId}/timesheets/leave-requests/pending`, { token, orgId })
  },

  approveLeaveRequest(token: string, orgId: string, requestId: string, reviewNote?: string | null) {
    return request<LeaveRequest>(`/organizations/${orgId}/timesheets/leave-requests/${requestId}/approve`, {
      method: "PATCH",
      body: { reviewNote },
      token,
      orgId,
    })
  },

  rejectLeaveRequest(token: string, orgId: string, requestId: string, reviewNote?: string | null) {
    return request<LeaveRequest>(`/organizations/${orgId}/timesheets/leave-requests/${requestId}/reject`, {
      method: "PATCH",
      body: { reviewNote },
      token,
      orgId,
    })
  },

  /** Cancels your own PENDING request and releases the held balance. */
  cancelLeaveRequest(token: string, orgId: string, requestId: string) {
    return request<LeaveRequest>(`/organizations/${orgId}/timesheets/leave-requests/${requestId}/cancel`, {
      method: "PATCH",
      token,
      orgId,
    })
  },

  getHolidays(token: string, orgId: string, year?: number, opts?: { country?: string; region?: string }) {
    const params = new URLSearchParams()
    if (year) params.set("year", String(year))
    if (opts?.country) params.set("country", opts.country)
    if (opts?.region) params.set("region", opts.region)
    const q = params.toString() ? `?${params.toString()}` : ""
    return request<Holiday[]>(`/organizations/${orgId}/timesheets/holidays${q}`, { token, orgId })
  },

  listHolidaySources(token: string, orgId: string, lang?: string) {
    const q = lang ? `?lang=${lang}` : ""
    return request<HolidaySource[]>(`/organizations/holiday-sources${q}`, { token, orgId })
  },

  listOffDays(token: string, orgId: string, year?: number) {
    const q = year ? `?year=${year}` : ""
    return request<CompanyOffDay[]>(`/organizations/${orgId}/timesheets/off-days${q}`, { token, orgId })
  },

  addOffDay(token: string, orgId: string, dto: { date: string; name?: string | null }) {
    return request<CompanyOffDay>(`/organizations/${orgId}/timesheets/off-days`, {
      method: "POST",
      body: { date: dto.date, name: dto.name ?? null },
      token,
      orgId,
    })
  },

  removeOffDay(token: string, orgId: string, date: string) {
    return request<{ removed: number }>(`/organizations/${orgId}/timesheets/off-days?date=${encodeURIComponent(date)}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  listPayrollRuns(token: string, orgId: string) {
    return request<PayrollRun[]>(`/organizations/${orgId}/payroll/runs`, { token, orgId })
  },

  getPayrollRun(token: string, orgId: string, runId: string) {
    return request<PayrollRun>(`/organizations/${orgId}/payroll/runs/${runId}`, { token, orgId })
  },

  createPayrollRun(dto: { month: string; currency?: string; notes?: string }, token: string, orgId: string) {
    return request<PayrollRun>(`/organizations/${orgId}/payroll/runs`, { method: "POST", body: dto, token, orgId })
  },

  generatePayrollRun(token: string, orgId: string, runId: string) {
    return request<PayrollRun & { generatedBy?: string }>(
      `/organizations/${orgId}/payroll/runs/${runId}/generate`,
      { method: "POST", body: {}, token, orgId }
    )
  },

  importPayrollOverrides(runId: string, csv: string, token: string, orgId: string) {
    return request<PayrollImportResult>(`/organizations/${orgId}/payroll/runs/${runId}/import`, {
      method: "POST",
      body: { csv },
      token,
      orgId,
    })
  },

  markPayrollRunPaid(token: string, orgId: string, runId: string) {
    return request<PayrollRun>(`/organizations/${orgId}/payroll/runs/${runId}/mark-paid`, {
      method: "PATCH",
      body: {},
      token,
      orgId,
    })
  },

  exportPayslipCsv(token: string, orgId: string, runId: string): Promise<string> {
    return requestText(`/organizations/${orgId}/payroll/runs/${runId}/payslips.csv`, { token, orgId })
  },

  listPayrollOverrides(token: string, orgId: string) {
    return request<PayrollOverridesResult>(`/organizations/${orgId}/payroll/overrides`, { token, orgId })
  },

  setPayrollOverride(
    memberId: string,
    dto: { rate?: number; bonus?: number; notes?: string },
    token: string,
    orgId: string
  ) {
    return request<PayrollRun>(`/organizations/${orgId}/payroll/overrides/${memberId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  listIssues(
    token: string,
    orgId: string,
    projectId?: string,
    limit = 500,
    filters?: { ruleId?: string; scanId?: string; isFixed?: string; severity?: string }
  ) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (projectId) params.set("projectId", projectId)
    if (filters?.ruleId) params.set("ruleId", filters.ruleId)
    if (filters?.scanId) params.set("scanId", filters.scanId)
    if (filters?.isFixed !== undefined) params.set("isFixed", filters.isFixed)
    if (filters?.severity) params.set("severity", filters.severity)
    return request<DevIssue[]>(`/organizations/${orgId}/dev/issues?${params.toString()}`, { token, orgId })
  },

  getDevStats(token: string, orgId: string, projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    return request<DevStats>(`/organizations/${orgId}/dev/stats${q}`, { token, orgId })
  },

  setIssueFixed(token: string, orgId: string, issueId: string, isFixed: boolean) {
    return request<DevIssue>(`/organizations/${orgId}/dev/issues/${issueId}`, {
      method: "PATCH",
      body: { isFixed },
      token,
      orgId,
    })
  },

  listRepositories(token: string, orgId: string, projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    return request<DevRepository[]>(`/organizations/${orgId}/dev/repositories${q}`, { token, orgId })
  },

  getRepository(token: string, orgId: string, repositoryId: string) {
    return request<DevRepository & { branches: string[]; commits: GitCommit[] }>(
      `/organizations/${orgId}/dev/repositories/${repositoryId}`,
      { token, orgId }
    )
  },

  createRepository(
    dto: { name?: string; url: string; defaultBranch?: string; token?: string; projectId?: string },
    token: string,
    orgId: string
  ) {
    return request<DevRepository>(`/organizations/${orgId}/dev/repositories`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateRepository(
    token: string,
    orgId: string,
    repositoryId: string,
    dto: { name?: string; defaultBranch?: string; scanOnPush?: boolean; token?: string }
  ) {
    return request<DevRepository>(`/organizations/${orgId}/dev/repositories/${repositoryId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  deleteRepository(token: string, orgId: string, repositoryId: string) {
    return request(`/organizations/${orgId}/dev/repositories/${repositoryId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  scanRepository(token: string, orgId: string, repositoryId: string, branch?: string) {
    return request<DevScan>(`/organizations/${orgId}/dev/repositories/${repositoryId}/scan`, {
      method: "POST",
      body: { ...(branch ? { branch } : {}) },
      token,
      orgId,
    })
  },

  triageIssue(
    token: string,
    orgId: string,
    issueId: string,
    dto: { projectId: string; title?: string }
  ) {
    return request<Task>(`/organizations/${orgId}/dev/issues/${issueId}/tasks`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  explainIssue(token: string, orgId: string, issueId: string) {
    return request<IssueExplanation>(`/organizations/${orgId}/dev/issues/${issueId}/explain`, {
      method: "POST",
      body: {},
      token,
      orgId,
    })
  },

  getRulesCatalog(token: string, orgId: string) {
    return request<{ source: string; rules: RuleCatalogEntry[] }>(`/organizations/${orgId}/dev/rules`, {
      token,
      orgId,
    })
  },

  getAnalysisConfig(token: string, orgId: string) {
    return request<AnalysisConfig>(`/organizations/${orgId}/dev/analysis-config`, { token, orgId })
  },

  setAnalysisConfig(token: string, orgId: string, config: AnalysisConfig["config"]) {
    return request<AnalysisConfig>(`/organizations/${orgId}/dev/analysis-config`, {
      method: "PUT",
      body: { config },
      token,
      orgId,
    })
  },

  getDebtTrend(token: string, orgId: string, projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    return request<DebtPoint[]>(`/organizations/${orgId}/dev/debt${q}`, { token, orgId })
  },

  gitListRepositories(token: string, orgId: string) {
    return request<GitRepository[]>(`/organizations/${orgId}/git/repositories`, { token, orgId })
  },

  gitCreateRepository(
    dto: { name: string; description?: string; visibility?: "private" | "public"; projectId?: string; initReadme?: boolean; defaultBranch?: string },
    token: string,
    orgId: string
  ) {
    return request<GitRepository>(`/organizations/${orgId}/git/repositories`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  gitGetRepository(token: string, orgId: string, repositoryId: string) {
    return request<GitRepository>(`/organizations/${orgId}/git/repositories/${repositoryId}`, {
      token,
      orgId,
    })
  },

  gitRepositoryTree(token: string, orgId: string, repositoryId: string, ref?: string) {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : ""
    return request<{ ref: string; entries: GitTreeEntry[] }>(
      `/organizations/${orgId}/git/repositories/${repositoryId}/tree${q}`,
      { token, orgId }
    )
  },

  gitRepositoryFile(token: string, orgId: string, repositoryId: string, path: string, ref?: string) {
    const q = new URLSearchParams({ path })
    if (ref) q.set("ref", ref)
    return request<GitBlob>(`/organizations/${orgId}/git/repositories/${repositoryId}/blob?${q.toString()}`, {
      token,
      orgId,
    })
  },

  gitRepositoryCommits(token: string, orgId: string, repositoryId: string, ref?: string, limit?: number) {
    const q = new URLSearchParams()
    if (ref) q.set("ref", ref)
    if (limit) q.set("limit", String(limit))
    const suffix = q.toString() ? `?${q.toString()}` : ""
    return request<{ ref: string; commits: GitCommit[] }>(
      `/organizations/${orgId}/git/repositories/${repositoryId}/commits${suffix}`,
      { token, orgId }
    )
  },

  gitRepositoryCommit(token: string, orgId: string, repositoryId: string, sha: string) {
    return request<GitCommitDetail>(
      `/organizations/${orgId}/git/repositories/${repositoryId}/commits/${encodeURIComponent(sha)}`,
      { token, orgId }
    )
  },

  gitDeleteRepository(token: string, orgId: string, repositoryId: string) {
    return request(`/organizations/${orgId}/git/repositories/${repositoryId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  gitCommitFile(
    token: string,
    orgId: string,
    repositoryId: string,
    dto: { path: string; content: string; message?: string }
  ) {
    return request<GitCommit>(`/organizations/${orgId}/git/repositories/${repositoryId}/files`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  gitScanRepository(token: string, orgId: string, repositoryId: string) {
    return request<DevScan>(`/organizations/${orgId}/git/repositories/${repositoryId}/scan`, {
      method: "POST",
      body: {},
      token,
      orgId,
    })
  },

  gitListTokens(token: string, orgId: string) {
    return request<GitToken[]>(`/organizations/${orgId}/git/tokens`, { token, orgId })
  },

  gitCreateToken(dto: { name?: string }, token: string, orgId: string) {
    return request<{ token: string; prefix: string; name: string }>(`/organizations/${orgId}/git/tokens`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  gitRevokeToken(token: string, orgId: string, tokenId: string) {
    return request(`/organizations/${orgId}/git/tokens/${tokenId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  listPipelines(token: string, orgId: string) {
    return request<Pipeline[]>(`/organizations/${orgId}/pipelines`, { token, orgId })
  },

  createPipeline(
    dto: { repositoryId: string; name: string; description?: string; trigger?: "manual" | "push"; branch?: string; steps: { name: string; command: string }[] },
    token: string,
    orgId: string
  ) {
    return request<Pipeline>(`/organizations/${orgId}/pipelines`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  getPipeline(token: string, orgId: string, pipelineId: string) {
    return request<Pipeline & { runs: PipelineRun[] }>(`/organizations/${orgId}/pipelines/${pipelineId}`, {
      token,
      orgId,
    })
  },

  updatePipeline(
    dto: { name?: string; description?: string; trigger?: "manual" | "push"; branch?: string; status?: "active" | "disabled"; steps?: { name: string; command: string }[] },
    token: string,
    orgId: string,
    pipelineId: string
  ) {
    return request<Pipeline>(`/organizations/${orgId}/pipelines/${pipelineId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  deletePipeline(token: string, orgId: string, pipelineId: string) {
    return request(`/organizations/${orgId}/pipelines/${pipelineId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  triggerPipelineRun(token: string, orgId: string, pipelineId: string, dto: { branch?: string } = {}) {
    return request<PipelineRun>(`/organizations/${orgId}/pipelines/${pipelineId}/run`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listPipelineRuns(token: string, orgId: string, pipelineId: string) {
    return request<PipelineRun[]>(`/organizations/${orgId}/pipelines/${pipelineId}/runs`, {
      token,
      orgId,
    })
  },

  getPipelineRun(token: string, orgId: string, runId: string) {
    return request<PipelineRun>(`/organizations/${orgId}/pipelines/runs/${runId}`, {
      token,
      orgId,
    })
  },

  cancelPipelineRun(token: string, orgId: string, runId: string) {
    return request<PipelineRun>(`/organizations/${orgId}/pipelines/runs/${runId}/cancel`, {
      method: "POST",
      body: {},
      token,
      orgId,
    })
  },

  listComments(token: string, orgId: string, projectId: string, taskId: string) {
    return request<Comment[]>(`/organizations/${orgId}/projects/${projectId}/tasks/${taskId}/comments`, {
      token,
      orgId,
    })
  },

  addComment(token: string, orgId: string, projectId: string, taskId: string, body: string) {
    return request<Comment>(`/organizations/${orgId}/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: { body },
      token,
      orgId,
    })
  },

  updateTask(
    token: string,
    orgId: string,
    projectId: string,
    taskId: string,
    dto: {
      status?: string
      priority?: string
      title?: string
      type?: string
      description?: string | null
      assigneeId?: string | null
      sprintId?: string | null
      epicId?: string | null
      columnId?: string | null
      storyPoints?: number | null
      dueDate?: string | null
      order?: number
    }
  ) {
    return request<AgileTask>(`/organizations/${orgId}/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  listNotifications(token: string, orgId: string) {
    return request<Notification[]>(`/notifications`, { token, orgId })
  },

  unreadCount(token: string, orgId: string) {
    return request<number>(`/notifications/unread-count`, { token, orgId })
  },

  markNotificationRead(id: string, token: string, orgId: string) {
    return request<Notification>(`/notifications/${id}/read`, { method: "POST", token, orgId })
  },

  markAllNotificationsRead(token: string, orgId: string) {
    return request<{ count: number }>(`/notifications/read-all`, { method: "POST", token, orgId })
  },

  listAiProviders(token: string, orgId: string) {
    return request<AiProvider[]>(`/organizations/${orgId}/ai/providers`, { token, orgId })
  },

  aiProviderSpecs(token: string, orgId: string) {
    return request<AiProviderSpec[]>(`/organizations/${orgId}/ai/providers/specs`, { token, orgId })
  },

  getAiProvider(token: string, orgId: string, providerId: string) {
    return request<AiProvider>(`/organizations/${orgId}/ai/providers/${providerId}`, { token, orgId })
  },

  createAiProvider(
    dto: { name: string; type: AiProviderType; baseUrl?: string; apiKey?: string; models?: string[]; defaultModel?: string },
    token: string,
    orgId: string
  ) {
    return request<AiProvider>(`/organizations/${orgId}/ai/providers`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateAiProvider(
    dto: { name?: string; baseUrl?: string; apiKey?: string; models?: string[]; defaultModel?: string; status?: "active" | "disabled" },
    token: string,
    orgId: string,
    providerId: string
  ) {
    return request<AiProvider>(`/organizations/${orgId}/ai/providers/${providerId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  deleteAiProvider(token: string, orgId: string, providerId: string) {
    return request<{ ok: boolean }>(`/organizations/${orgId}/ai/providers/${providerId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  testAiProvider(token: string, orgId: string, providerId: string) {
    return request<{ ok: boolean; provider: AiProvider; error: string | null }>(
      `/organizations/${orgId}/ai/providers/${providerId}/test`,
      { method: "POST", token, orgId }
    )
  },

  fetchAiModels(token: string, orgId: string, providerId: string) {
    return request<string[]>(`/organizations/${orgId}/ai/providers/${providerId}/models/fetch`, {
      method: "POST",
      token,
      orgId,
    })
  },

  chatAiProvider(
    providerId: string,
    dto: { model: string; messages: AiChatMessageData[]; maxTokens?: number },
    token: string,
    orgId: string
  ) {
    return request<AiChatResult>(`/organizations/${orgId}/ai/providers/${providerId}/chat`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listAiActionCatalog(token: string, orgId: string) {
    return request<AiActionDef[]>(`/organizations/${orgId}/ai-actions/catalog`, { token, orgId })
  },

  listAiActionRuns(token: string, orgId: string) {
    return request<AiActionRun[]>(`/organizations/${orgId}/ai-actions/runs`, { token, orgId })
  },

  runAiAction(dto: { action: AiActionKind; input: Record<string, unknown> }, token: string, orgId: string) {
    return request<AiActionRun>(`/organizations/${orgId}/ai-actions/runs`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  getAiActionRun(token: string, orgId: string, runId: string) {
    return request<AiActionRun>(`/organizations/${orgId}/ai-actions/runs/${runId}`, { token, orgId })
  },

  applyAiActionRun(token: string, orgId: string, runId: string) {
    return request<{ ok: boolean; applied: boolean; summary: Record<string, unknown> }>(
      `/organizations/${orgId}/ai-actions/runs/${runId}/apply`,
      { method: "POST", token, orgId }
    )
  },

  getGatewayStatus(token: string, orgId: string) {
    return request<GatewayStatus>(`/organizations/${orgId}/ai/gateway-status`, { token, orgId })
  },

  listServers(token: string, orgId: string) {
    return request<ServerConnection[]>(`/organizations/${orgId}/servers`, { token, orgId })
  },

  getServer(token: string, orgId: string, serverId: string) {
    return request<ServerConnection>(`/organizations/${orgId}/servers/${serverId}`, { token, orgId })
  },

  createServer(
    dto: { label: string; host: string; port?: number; protocol?: ServerProtocol; username?: string; credential?: string },
    token: string,
    orgId: string
  ) {
    return request<ServerConnection>(`/organizations/${orgId}/servers`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateServer(
    dto: { label?: string; host?: string; port?: number; protocol?: ServerProtocol; username?: string; credential?: string },
    token: string,
    orgId: string,
    serverId: string
  ) {
    return request<ServerConnection>(`/organizations/${orgId}/servers/${serverId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  deleteServer(token: string, orgId: string, serverId: string) {
    return request<{ ok: boolean }>(`/organizations/${orgId}/servers/${serverId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  testServer(token: string, orgId: string, serverId: string) {
    return request<{ server: ServerConnection; ok: boolean; error: string | null; latencyMs: number }>(
      `/organizations/${orgId}/servers/${serverId}/test`,
      { method: "POST", body: {}, token, orgId }
    )
  },

  listServerApps(token: string, orgId: string, serverId: string) {
    return request<DeployedApp[]>(`/organizations/${orgId}/servers/${serverId}/apps`, { token, orgId })
  },

  createServerApp(
    dto: { label: string; url: string; probePath?: string; probeMethod?: "GET" | "POST" },
    token: string,
    orgId: string,
    serverId: string
  ) {
    return request<DeployedApp>(`/organizations/${orgId}/servers/${serverId}/apps`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateServerApp(
    dto: { label?: string; url?: string; probePath?: string; probeMethod?: "GET" | "POST" },
    token: string,
    orgId: string,
    appId: string
  ) {
    return request<DeployedApp>(`/organizations/${orgId}/servers/apps/${appId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  deleteServerApp(token: string, orgId: string, appId: string) {
    return request<{ ok: boolean }>(`/organizations/${orgId}/servers/apps/${appId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  testServerApp(token: string, orgId: string, appId: string) {
    return request<{ app: DeployedApp; ok: boolean; status: number | null; error: string | null }>(
      `/organizations/${orgId}/servers/apps/${appId}/test`,
      { method: "POST", body: {}, token, orgId }
    )
  },

  // ------------------------------ Service Desk ----------------------------- //

  serviceOverview(token: string, orgId: string) {
    return request<ServiceDeskOverview>(`/organizations/${orgId}/service-desk/overview`, { token, orgId })
  },

  serviceQueue(token: string, orgId: string) {
    return request<ServiceQueue>(`/organizations/${orgId}/service-desk/queue`, { token, orgId })
  },

  serviceAgents(token: string, orgId: string) {
    return request<ServiceAgent[]>(`/organizations/${orgId}/service-desk/agents`, { token, orgId })
  },

  listCatalog(token: string, orgId: string, includeInactive = false) {
    return request<ServiceItem[]>(`/organizations/${orgId}/service-desk/catalog`, {
      token,
      orgId,
      query: includeInactive ? { includeInactive: "true" } : undefined,
    })
  },

  createCatalogItem(
    dto: {
      name: string
      description: string
      category: string
      icon?: string
      requiresApproval?: boolean
      estimatedDays?: number
      sortOrder?: number
      formSchema?: FormField[]
    },
    token: string,
    orgId: string
  ) {
    return request<ServiceItem>(`/organizations/${orgId}/service-desk/catalog`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateCatalogItem(
    dto: {
      name?: string
      description?: string
      category?: string
      icon?: string
      active?: boolean
      requiresApproval?: boolean
      estimatedDays?: number
      sortOrder?: number
      formSchema?: FormField[]
    },
    token: string,
    orgId: string,
    itemId: string
  ) {
    return request<ServiceItem>(`/organizations/${orgId}/service-desk/catalog/${itemId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  listServiceRequests(token: string, orgId: string, filters: RequestFilters = {}) {
    const query: Record<string, string> = {}
    if (filters.status) query.status = filters.status
    if (filters.priority) query.priority = filters.priority
    if (filters.view) query.view = filters.view
    if (filters.search) query.search = filters.search
    if (filters.itemId) query.itemId = filters.itemId
    return request<ServiceRequest[]>(`/organizations/${orgId}/service-desk/requests`, {
      token,
      orgId,
      query: Object.keys(query).length ? query : undefined,
    })
  },

  getServiceRequest(token: string, orgId: string, requestId: string) {
    return request<ServiceRequestDetail>(`/organizations/${orgId}/service-desk/requests/${requestId}`, {
      token,
      orgId,
    })
  },

  createServiceRequest(
    dto: {
      title: string
      description: string
      itemId?: string
      priority?: string
      formData?: Record<string, unknown>
      assigneeId?: string
    },
    token: string,
    orgId: string
  ) {
    return request<ServiceRequest>(`/organizations/${orgId}/service-desk/requests`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateServiceRequest(
    dto: { title?: string; description?: string; priority?: string; assigneeId?: string },
    token: string,
    orgId: string,
    requestId: string
  ) {
    return request<ServiceRequest>(`/organizations/${orgId}/service-desk/requests/${requestId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  decideServiceRequest(
    dto: { decision: "APPROVED" | "REJECTED"; note?: string },
    token: string,
    orgId: string,
    requestId: string
  ) {
    return request<ServiceRequest>(`/organizations/${orgId}/service-desk/requests/${requestId}/decision`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  transitionServiceRequest(
    dto: { status: RequestStatus; note?: string; rating?: number },
    token: string,
    orgId: string,
    requestId: string
  ) {
    return request<ServiceRequest>(`/organizations/${orgId}/service-desk/requests/${requestId}/status`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  rateServiceRequest(rating: number, token: string, orgId: string, requestId: string) {
    return request<ServiceRequest>(`/organizations/${orgId}/service-desk/requests/${requestId}/rate`, {
      method: "POST",
      body: { rating },
      token,
      orgId,
    })
  },

  listRequestComments(token: string, orgId: string, requestId: string) {
    return request<ServiceComment[]>(`/organizations/${orgId}/service-desk/requests/${requestId}/comments`, {
      token,
      orgId,
    })
  },

  addRequestComment(dto: { body: string; internal?: boolean }, token: string, orgId: string, requestId: string) {
    return request<ServiceComment>(`/organizations/${orgId}/service-desk/requests/${requestId}/comments`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listIncidents(token: string, orgId: string, filters: IncidentFilters = {}) {
    const query: Record<string, string> = {}
    if (filters.status) query.status = filters.status
    if (filters.priority) query.priority = filters.priority
    if (filters.view) query.view = filters.view
    if (filters.search) query.search = filters.search
    if (filters.breached) query.breached = "true"
    return request<Incident[]>(`/organizations/${orgId}/service-desk/incidents`, {
      token,
      orgId,
      query: Object.keys(query).length ? query : undefined,
    })
  },

  getIncident(token: string, orgId: string, incidentId: string) {
    return request<Incident>(`/organizations/${orgId}/service-desk/incidents/${incidentId}`, { token, orgId })
  },

  createIncident(
    dto: {
      title: string
      description: string
      priority?: string
      category?: string
      assigneeId?: string
      linkedRequestId?: string
    },
    token: string,
    orgId: string
  ) {
    return request<Incident>(`/organizations/${orgId}/service-desk/incidents`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateIncident(
    dto: { priority?: string; category?: string; assigneeId?: string; resolution?: string; rootCause?: string },
    token: string,
    orgId: string,
    incidentId: string
  ) {
    return request<Incident>(`/organizations/${orgId}/service-desk/incidents/${incidentId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  transitionIncident(
    dto: { status: IncidentStatus; resolution?: string; rootCause?: string },
    token: string,
    orgId: string,
    incidentId: string
  ) {
    return request<Incident>(`/organizations/${orgId}/service-desk/incidents/${incidentId}/status`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listIncidentComments(token: string, orgId: string, incidentId: string) {
    return request<ServiceComment[]>(`/organizations/${orgId}/service-desk/incidents/${incidentId}/comments`, {
      token,
      orgId,
    })
  },

  addIncidentComment(dto: { body: string; internal?: boolean }, token: string, orgId: string, incidentId: string) {
    return request<ServiceComment>(`/organizations/${orgId}/service-desk/incidents/${incidentId}/comments`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  listArticles(token: string, orgId: string, filters: { category?: string; search?: string; publishedOnly?: boolean } = {}) {
    const query: Record<string, string> = {}
    if (filters.category) query.category = filters.category
    if (filters.search) query.search = filters.search
    if (filters.publishedOnly === false) query.publishedOnly = "false"
    return request<KnowledgeArticle[]>(`/organizations/${orgId}/service-desk/knowledge`, {
      token,
      orgId,
      query: Object.keys(query).length ? query : undefined,
    })
  },

  getArticle(token: string, orgId: string, articleId: string) {
    return request<KnowledgeArticle>(`/organizations/${orgId}/service-desk/knowledge/${articleId}`, { token, orgId })
  },

  createArticle(
    dto: { title: string; body: string; summary?: string; category: string; tags?: string[]; published?: boolean },
    token: string,
    orgId: string
  ) {
    return request<KnowledgeArticle>(`/organizations/${orgId}/service-desk/knowledge`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateArticle(
    dto: { title?: string; body?: string; summary?: string; category?: string; tags?: string[]; published?: boolean },
    token: string,
    orgId: string,
    articleId: string
  ) {
    return request<KnowledgeArticle>(`/organizations/${orgId}/service-desk/knowledge/${articleId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  articleFeedback(token: string, orgId: string, articleId: string, helpful: boolean) {
    return request<{ id: string; views: number; helpful: number; notHelpful: number }>(
      `/organizations/${orgId}/service-desk/knowledge/${articleId}/feedback`,
      { method: "POST", body: { helpful }, token, orgId }
    )
  },

  listSlaPolicies(token: string, orgId: string) {
    return request<SlaPolicy[]>(`/organizations/${orgId}/service-desk/sla`, { token, orgId })
  },

  updateSlaPolicy(
    dto: {
      priority: string
      name: string
      responseMinutes: number
      resolveMinutes: number
      businessHoursOnly?: boolean
      active?: boolean
    },
    token: string,
    orgId: string
  ) {
    return request<SlaPolicy>(`/organizations/${orgId}/service-desk/sla`, {
      method: "PUT",
      body: dto,
      token,
      orgId,
    })
  },

  // ------------------------------ Public portal ----------------------------- //

  publicCatalog(orgSlug?: string) {
    return request<{ organization: { id: string; name: string; slug: string }; items: PublicCatalogItem[] }>(
      "/service-desk/public/catalog",
      { query: orgSlug ? { orgSlug } : undefined }
    )
  },

  publicTrack(number: string, email: string, orgSlug?: string) {
    const query: Record<string, string> = { number, email }
    if (orgSlug) query.orgSlug = orgSlug
    return request<{ organization: string; ticket: PublicTrackedTicket }>("/service-desk/public/track", { query })
  },

  submitPublicRequest(dto: {
    name: string
    email: string
    title: string
    description: string
    itemId?: string
    priority?: string
    formData?: Record<string, unknown>
    website?: string
  }) {
    return request<{ number: string; status: string; organization?: string; received: boolean }>(
      "/service-desk/public/requests",
      { method: "POST", body: dto }
    )
  },

  submitPublicIncident(dto: {
    name: string
    email: string
    title: string
    description: string
    priority?: string
    category?: string
    website?: string
  }) {
    return request<{ number: string; status: string; organization?: string; received: boolean }>(
      "/service-desk/public/incidents",
      { method: "POST", body: dto }
    )
  },


  // ------------------------------ Factory ------------------------------ //

  listFactoryRuns(token: string, orgId: string, status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : ""
    return request<FactoryRunSummary[]>(`/organizations/${orgId}/factory/runs${q}`, { token, orgId })
  },

  getFactoryRun(token: string, orgId: string, runId: string) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}`, { token, orgId })
  },

  createFactoryRun(
    dto: { taskId: string; repositoryId?: string; agentProfileId?: string; idempotencyKey?: string },
    token: string,
    orgId: string
  ) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  planFactoryRun(token: string, orgId: string, runId: string, useAi = false) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}/plan`, {
      method: "POST",
      body: { useAi },
      token,
      orgId,
    })
  },

  approveFactoryRun(token: string, orgId: string, runId: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}/approve`, {
      method: "POST",
      body: { decision, reason },
      token,
      orgId,
    })
  },

  executeFactoryRun(token: string, orgId: string, runId: string) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}/execute`, {
      method: "POST",
      body: {},
      token,
      orgId,
    })
  },

  reviewFactoryRun(
    token: string,
    orgId: string,
    runId: string,
    dto: { decision: "APPROVED" | "REJECTED"; findings?: string[]; reason?: string; reviewerAgentRunId?: string }
  ) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}/review`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  reviewFactoryRunWithAgent(token: string, orgId: string, runId: string, profileId?: string) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}/review/agent`, {
      method: "POST",
      body: { profileId },
      token,
      orgId,
    })
  },

  mergeFactoryRun(token: string, orgId: string, runId: string) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}/merge`, {
      method: "POST",
      body: {},
      token,
      orgId,
    })
  },

  cancelFactoryRun(token: string, orgId: string, runId: string) {
    return request<FactoryRun>(`/organizations/${orgId}/factory/runs/${runId}/cancel`, {
      method: "POST",
      body: {},
      token,
      orgId,
    })
  },

  factoryStats(token: string, orgId: string) {
    return request<FactoryStats>(`/organizations/${orgId}/factory/stats`, { token, orgId })
  },

  factoryProjectConfig(token: string, orgId: string, projectId: string) {
    return request<FactoryProjectConfig>(`/organizations/${orgId}/factory/projects/${projectId}/config`, { token, orgId })
  },

  setFactoryProjectConfig(
    token: string,
    orgId: string,
    projectId: string,
    dto: Partial<FactoryProjectConfig>
  ) {
    return request<FactoryProjectConfig>(`/organizations/${orgId}/factory/projects/${projectId}/config`, {
      method: "PUT",
      body: dto,
      token,
      orgId,
    })
  },

  factoryKnowledge(token: string, orgId: string, projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    return request<ProjectKnowledge[]>(`/organizations/${orgId}/factory/knowledge${q}`, { token, orgId })
  },

  createFactoryKnowledge(token: string, orgId: string, dto: { projectId?: string; title: string; category?: string; content: string; source?: string }) {
    return request<ProjectKnowledge>(`/organizations/${orgId}/factory/knowledge`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  deleteFactoryKnowledge(token: string, orgId: string, knowledgeId: string) {
    return request<{ ok: boolean }>(`/organizations/${orgId}/factory/knowledge/${knowledgeId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  factoryImpact(token: string, orgId: string, projectId: string) {
    return request<FactoryImpact>(`/organizations/${orgId}/factory/impact?projectId=${encodeURIComponent(projectId)}`, { token, orgId })
  },

  factoryPendingApprovals(token: string, orgId: string) {
    return request<FactoryPendingApproval[]>(`/organizations/${orgId}/factory/approvals`, { token, orgId })
  },

  factoryPullRequests(token: string, orgId: string, status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : ""
    return request<FactoryPullRequest[]>(`/organizations/${orgId}/factory/pull-requests${q}`, { token, orgId })
  },

  factoryPullRequest(token: string, orgId: string, runId: string) {
    return request<FactoryPullRequest>(`/organizations/${orgId}/factory/runs/${runId}/pull-request`, { token, orgId })
  },

  listFactoryAgents(token: string, orgId: string) {
    return request<FactoryAgentProfile[]>(`/organizations/${orgId}/factory/agents`, { token, orgId })
  },

  createFactoryAgent(
    dto: {
      name: string
      slug: string
      role: string
      description?: string
      instructions?: string
      connectionId?: string
      modelProviderId?: string
      model?: string
      allowedTools?: string[]
      budgetTokens?: number
      maxRetries?: number
    },
    token: string,
    orgId: string
  ) {
    return request<FactoryAgentProfile>(`/organizations/${orgId}/factory/agents`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },

  updateFactoryAgent(
    profileId: string,
    dto: Partial<{
      name: string
      role: string
      description: string | null
      instructions: string | null
      connectionId: string | null
      modelProviderId: string | null
      model: string | null
      allowedTools: string[]
      budgetTokens: number
      maxRetries: number
      status: string
    }>,
    token: string,
    orgId: string
  ) {
    return request<FactoryAgentProfile>(`/organizations/${orgId}/factory/agents/${profileId}`, {
      method: "PATCH",
      body: dto,
      token,
      orgId,
    })
  },

  deleteFactoryAgent(profileId: string, token: string, orgId: string) {
    return request<{ ok: boolean }>(`/organizations/${orgId}/factory/agents/${profileId}`, {
      method: "DELETE",
      token,
      orgId,
    })
  },

  getFactoryIssueProfile(token: string, orgId: string, taskId: string) {
    return request<FactoryIssueProfile>(`/organizations/${orgId}/factory/issues/${taskId}/profile`, { token, orgId })
  },

  classifyFactoryIssue(token: string, orgId: string, taskId: string, useAi = false) {
    return request<FactoryIssueProfile>(`/organizations/${orgId}/factory/issues/${taskId}/classify`, {
      method: "POST",
      body: { useAi },
      token,
      orgId,
    })
  },

  factoryAutomation(token: string, orgId: string) {
    return request<AutomationProposal[]>(`/organizations/${orgId}/factory/automation`, { token, orgId })
  },

  decideFactoryAutomation(
    token: string,
    orgId: string,
    proposalId: string,
    decision: "APPROVED" | "REJECTED",
    reason?: string
  ) {
    return request<AutomationProposal>(`/organizations/${orgId}/factory/automation/${proposalId}/decision`, {
      method: "POST",
      body: { decision, reason },
      token,
      orgId,
    })
  },

  listPolicies(token: string, orgId: string) {
    return request<PolicyRule[]>(`/organizations/${orgId}/policies`, { token, orgId })
  },

  listPolicyEvaluations(token: string, orgId: string) {
    return request<PolicyEvaluation[]>(`/organizations/${orgId}/policies/evaluations`, { token, orgId })
  },

  // --------------------------- Sprint planner --------------------------- //

  /** Uploads a cahier de charge and asks the AI (or built-in extraction) to draft the backlog. */
  planFromDocument(token: string, orgId: string, form: FormData) {
    return requestMultipart<SprintPlan>(`/organizations/${orgId}/planner/plan`, { form, token, orgId })
  },

  listSprintPlans(token: string, orgId: string) {
    return request<SprintPlan[]>(`/organizations/${orgId}/planner/plans`, { token, orgId })
  },

  getSprintPlan(token: string, orgId: string, planId: string) {
    return request<SprintPlan>(`/organizations/${orgId}/planner/plans/${planId}`, { token, orgId })
  },

  applySprintPlan(
    token: string,
    orgId: string,
    planId: string,
    dto: { projectId: string; teamId?: string; sprintName?: string }
  ) {
    return request<AppliedSprintPlan>(`/organizations/${orgId}/planner/plans/${planId}/apply`, {
      method: "POST",
      body: dto,
      token,
      orgId,
    })
  },
}