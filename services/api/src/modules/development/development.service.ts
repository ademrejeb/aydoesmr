import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { createHash, randomBytes } from "crypto"
import { promises as fs } from "fs"
import { PrismaService } from "../../prisma/prisma.service"
import { AnalyzeCodeDto, CreateRepositoryDto, UpdateRepositoryDto } from "./dto"
import { NotificationType, Prisma, ScanStatus, Severity } from "@prisma/client"
import { NotificationsService } from "../notifications/notifications.service"
import { AiService } from "../ai/ai.service"
import {
  cacheDirFor,
  detectLanguageOfRepo,
  ensureClone,
  headSha,
  listCommits,
  listRemoteBranches,
  listSourceFiles,
  providerFromUrl,
  repoNameFromUrl,
} from "../../common/git"

interface GatewayRule {
  rule_id?: string
  rule_name?: string
  ruleId?: string
  ruleName?: string
  severity?: string
  category?: string
  message?: string
  suggestion?: string
  line_number?: number
  lineNumber?: number
  column?: number
  end_column?: number
  code_snippet?: string
  codeSnippet?: string
  fix?: {
    kind?: string
    description?: string
  } | null
}

interface GatewayResponse {
  metrics?: {
    lines_of_code?: number
    cyclomatic_complexity?: number
    maintainability_index?: number
  }
  rules?: GatewayRule[]
  issues?: GatewayRule[]
}

interface GatewayBatchResult {
  metrics?: {
    cyclomatic_complexity?: number
    maintainability_index?: number
  }
  rules?: GatewayRule[]
  issues?: GatewayRule[]
}

const SEVERITY_MAP: Record<string, Severity> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
}

/** Normalize a stored path-filter list (string[] or comma string) to string[]. */
function asPathFilters(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value.split(",").map((v) => v.trim()).filter(Boolean)
  }
  return []
}

/** Mirror the engine's path-matcher semantics: trailing `/` = contains, else suffix. */
function pathMatches(relPath: string, pattern: string): boolean {
  const normalized = relPath.replace(/\\/g, "/")
  if (pattern.endsWith("/") || pattern.endsWith("\\")) {
    return normalized.includes(pattern.replace(/[\\/]+$/, ""))
  }
  return normalized.endsWith(pattern)
}

/**
 * Development module: bridges the platform to the code-analysis engine
 * (Go gateway -> Rust tech-debt engine) and manages git-repository integration:
 * linking repos to projects, inspecting branches/commits, full-repo scans, and
 * push webhooks.
 */
@Injectable()
export class DevelopmentService {
  private readonly logger = new Logger(DevelopmentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
    private readonly ai: AiService
  ) {}

  private get gatewayUrl() {
    return this.config.get<string>("GATEWAY_URL", "http://localhost:8080")
  }

  /**
   * Resolve analysis options for an org (and optional project). The stored
   * config mirrors the engine's AnalyzeOptions payload: thresholds, ignore
   * rule ids, path filters, and a per-rule enable map. Disabled rules are
   * merged into `ignore_rules` before the options are handed to the engine.
   * Falls back to an empty object when unset.
   */
  private async buildAnalysisOptions(
    organizationId: string,
    projectId?: string | null
  ): Promise<Record<string, unknown>> {
    const orgConfig = await this.prisma.devAnalysisConfig.findFirst({
      where: { organizationId, projectId: null },
    })
    const projectConfig = projectId
      ? await this.prisma.devAnalysisConfig.findFirst({
          where: { organizationId, projectId },
        })
      : null
    const cfg = projectConfig?.config ?? orgConfig?.config
    if (!cfg || typeof cfg !== "object") return {}
    const base = { ...(cfg as Record<string, unknown>) }
    delete base.rules

    const leftover = base.ignore_rules
    const ignoreSeed: unknown[] = Array.isArray(leftover) ? leftover : []
    const rulesMap = (cfg as Record<string, unknown>).rules as
      | Record<string, { enabled?: boolean }>
      | undefined
    const disabled =
      rulesMap && typeof rulesMap === "object" && !Array.isArray(rulesMap)
        ? Object.entries(rulesMap)
            .filter(([, v]) => v && typeof v === "object" && v.enabled === false)
            .map(([id]) => id)
        : []

    base.ignore_rules = Array.from(new Set([...ignoreSeed.map(String), ...disabled]))
    return base
  }

  /**
   * Normalized 0-100 tech-debt score: weighted issue density, complexity and
   * maintainability components. Higher = more debt.
   */
  private computeDebtScore(input: {
    severityCounts: Record<string, number>
    lines: number
    complexity: number
    maintainability: number
  }): number {
    const { severityCounts, lines, complexity, maintainability } = input
    const weights: Record<string, number> = { CRITICAL: 5, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0.5 }
    let weighted = 0
    let total = 0
    for (const [sev, count] of Object.entries(severityCounts)) {
      weighted += (weights[sev] ?? 1) * count
      total += count
    }

    const severityComponent = total > 0 ? Math.min(weighted / total / 5, 1) * 40 : 0
    const densityComponent = lines > 0 ? Math.min(weighted / (lines / 1000), 1) * 20 : 0
    const ccComponent = complexity > 12 ? Math.min((complexity - 12) / 30, 1) * 20 : 0
    const miComponent = maintainability < 60 ? Math.min((60 - maintainability) / 60, 1) * 20 : 0
    return Math.min(Math.round((severityComponent + densityComponent + ccComponent + miComponent) * 100) / 100, 100)
  }

  private emitRepoEvent(organizationId: string, payload: { id: string; projectId: string | null }) {
    this.events.emit("repo.updated", { organizationId, id: payload.id, projectId: payload.projectId })
  }

  /**
   * Apply include/exclude path filters. The engine only ever sees a temp file,
   * so repository-relative filtering is enforced here before analysis.
   */
  private pathAllowed(relPath: string, excluded: string[], included: string[]): boolean {
    if (excluded.some((p) => pathMatches(relPath, p))) return false
    if (included.length > 0 && !included.some((p) => pathMatches(relPath, p))) return false
    return true
  }

  // ------------------------------------------------------------------ //
  //  Inline code analysis                                               //
  // ------------------------------------------------------------------ //

  async analyzeCode(organizationId: string, actorId: string, dto: AnalyzeCodeDto) {
    const scan = await this.prisma.devScan.create({
      data: {
        organizationId,
        projectId: dto.projectId,
        repositoryId: dto.repositoryId,
        status: ScanStatus.RUNNING,
        startedAt: new Date(),
      },
    })

    let response: GatewayResponse
    const options = await this.buildAnalysisOptions(organizationId, dto.projectId)
    try {
      const res = await fetch(`${this.gatewayUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: dto.source, language: dto.language ?? "rust", options }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`Gateway responded ${res.status}`)
      response = (await res.json()) as GatewayResponse
    } catch (e) {
      this.logger.error(`Analysis failed: ${(e as Error).message}`)
      await this.prisma.devScan.update({
        where: { id: scan.id },
        data: { status: ScanStatus.FAILED, completedAt: new Date(), error: `Analysis engine unreachable: ${(e as Error).message}` },
      })
      throw new ServiceUnavailableException("Code analysis engine unreachable. Is the Go gateway running?")
    }

    const metrics = response.metrics ?? {}
    const gatewayRules = (response.rules ?? response.issues ?? [])

    const completedAt = new Date()
    const severityCounts: Record<string, number> = {}
    for (const r of gatewayRules) {
      const sev = SEVERITY_MAP[String(r.severity ?? "medium").toLowerCase()] ?? Severity.MEDIUM
      severityCounts[sev] = (severityCounts[sev] ?? 0) + 1
    }
    const debtScore = this.computeDebtScore({
      severityCounts,
      lines: metrics.lines_of_code ?? 0,
      complexity: metrics.cyclomatic_complexity ?? 0,
      maintainability: metrics.maintainability_index ?? 100,
    })

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.devScan.update({
        where: { id: scan.id },
        data: {
          status: ScanStatus.SUCCESS,
          completedAt,
          durationMs: completedAt.getTime() - (scan.startedAt?.getTime() ?? completedAt.getTime()),
          filesScanned: 1,
          linesAnalyzed: metrics.lines_of_code ?? 0,
          metrics: {
            lines_of_code: metrics.lines_of_code ?? 0,
            cyclomatic_complexity: metrics.cyclomatic_complexity ?? 0,
            maintainability_index: metrics.maintainability_index ?? 100,
            debt_score: debtScore,
          },
        },
      })

      if (gatewayRules.length > 0) {
        await tx.devIssue.createMany({
          data: gatewayRules.map((r) => ({
            organizationId,
            scanId: scan.id,
            filePath: "(inline)",
            lineNumber: r.line_number ?? null,
            columnStart: r.column ?? null,
            columnEnd: r.end_column ?? null,
            codeSnippet: r.code_snippet ?? r.codeSnippet ?? null,
            fix: r.fix ?? undefined,
            message: r.message ?? r.rule_name ?? "Code issue",
            severity: SEVERITY_MAP[String(r.severity ?? "medium").toLowerCase()] ?? Severity.MEDIUM,
            category: r.category,
            ruleId: r.rule_id,
            suggestion: r.suggestion ?? null,
            fingerprint: r.rule_id ? `${r.rule_id}:${r.line_number ?? 0}` : null,
          })),
        })
      }

      const count = gatewayRules.length
      await this.notifications.create(
        organizationId,
        actorId,
        NotificationType.SCAN_COMPLETED,
        count > 0 ? `${count} code issue(s) found` : "Analysis complete — no issues",
        dto.source.length > 80 ? `${dto.source.slice(0, 80)}…` : dto.source,
        `/dev/scans/${scan.id}`
      )

      return updated
    })

    return this.getScan(scan.id)
  }

  async getScan(scanId: string) {
    const scan = await this.prisma.devScan.findUnique({
      where: { id: scanId },
      include: {
        issues: {
          orderBy: [{ severity: "desc" }, { lineNumber: "asc" }],
          take: 500,
        },
        project: { select: { id: true, name: true } },
        repository: { select: { id: true, name: true, defaultBranch: true } },
      },
    })
    if (!scan) throw new NotFoundException("Scan not found")
    return scan
  }

  async listScans(organizationId: string, projectId?: string, limit = 20) {
    return this.prisma.devScan.findMany({
      where: { organizationId, ...(projectId ? { projectId } : {}) },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { issues: true } },
        project: { select: { id: true, name: true } },
        repository: { select: { id: true, name: true, defaultBranch: true } },
      },
    })
  }

  async listIssues(
    organizationId: string,
    filters: {
      severity?: string
      category?: string
      isFixed?: string
      projectId?: string
      scanId?: string
      ruleId?: string
      ruleIds?: string[]
      limit?: number
    }
  ) {
    const limit = Math.min(filters.limit ?? 100, 500)
    const severity = filters.severity ? (filters.severity.toUpperCase() as Severity) : undefined
    const projectIds = filters.projectId ? [filters.projectId] : undefined
    return this.prisma.devIssue.findMany({
      where: {
        organizationId,
        ...(severity ? { severity } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.isFixed !== undefined ? { isFixed: filters.isFixed === "true" } : {}),
        ...(filters.ruleId ? { ruleId: filters.ruleId } : {}),
        ...(filters.ruleIds && filters.ruleIds.length > 0 ? { ruleId: { in: filters.ruleIds } } : {}),
        ...(filters.scanId ? { scanId: filters.scanId } : {}),
        ...(projectIds ? { scan: { projectId: { in: projectIds } } } : {}),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        scan: { select: { id: true, createdAt: true } },
        tasks: { select: { id: true, title: true, status: true } },
      },
    })
  }

  /** Toggle the fixed state of an issue. */
  async setIssueFixed(organizationId: string, issueId: string, isFixed: boolean) {
    const issue = await this.prisma.devIssue.findFirst({ where: { id: issueId, organizationId } })
    if (!issue) throw new NotFoundException("Issue not found")
    const updated = await this.prisma.devIssue.update({
      where: { id: issueId },
      data: { isFixed, fixedAt: isFixed ? new Date() : null },
    })
    // Keep the owning scan's open-issue count consistent for the debt trend.
    await this.refreshScanDebt(issue.scanId)
    return updated
  }

  /**
   * Recompute and persist a scan's debt score from its current issue set so the
   * trend reflects fixes applied after the scan finished.
   */
  private async refreshScanDebt(scanId: string | null) {
    if (!scanId) return
    const scan = await this.prisma.devScan.findUnique({
      where: { id: scanId },
      select: { metrics: true, linesAnalyzed: true },
    })
    if (!scan) return

    const grouped = await this.prisma.devIssue.groupBy({
      by: ["severity"],
      where: { scanId, isFixed: false },
      _count: { _all: true },
    })
    const severityCounts: Record<string, number> = {}
    for (const g of grouped) severityCounts[g.severity] = g._count._all

    const metrics = (scan.metrics ?? {}) as Record<string, unknown>
    const debtScore = this.computeDebtScore({
      severityCounts,
      lines: scan.linesAnalyzed ?? 0,
      complexity: typeof metrics.cyclomatic_complexity === "number" ? (metrics.cyclomatic_complexity as number) : 0,
      maintainability:
        typeof metrics.maintainability_index === "number" ? (metrics.maintainability_index as number) : 100,
    })
    await this.prisma.devScan.update({
      where: { id: scanId },
      data: { metrics: { ...metrics, debt_score: debtScore } as Prisma.InputJsonValue },
    })
  }

  /** Organization-level developer-tooling statistics for the dashboard. */
  async getStats(organizationId: string, projectId?: string) {
    const scope = projectId ? { scan: { projectId } } : {}
    const base = { organizationId, ...scope }

    const [total, open, fixed, bySeverity, byRule, latest] = await Promise.all([
      this.prisma.devIssue.count({ where: base }),
      this.prisma.devIssue.count({ where: { ...base, isFixed: false } }),
      this.prisma.devIssue.count({ where: { ...base, isFixed: true } }),
      this.prisma.devIssue.groupBy({ by: ["severity"], where: base, _count: { _all: true } }),
      this.prisma.devIssue.groupBy({ by: ["ruleId"], where: base, _count: { _all: true }, orderBy: { _count: { ruleId: "desc" } }, take: 8 }),
      this.prisma.devScan.findFirst({
        where: { organizationId, status: ScanStatus.SUCCESS, ...(projectId ? { projectId } : {}) },
        orderBy: { startedAt: "desc" },
        select: { id: true, metrics: true, startedAt: true },
      }),
    ])

    const severity: Record<string, number> = {}
    for (const s of bySeverity) severity[s.severity] = s._count._all
    const topRules = byRule.map((r) => ({ ruleId: r.ruleId, count: r._count._all }))
    const metrics = (latest?.metrics ?? {}) as Record<string, unknown>

    return {
      total,
      open,
      fixed,
      severity,
      topRules,
      debtScore: typeof metrics.debt_score === "number" ? (metrics.debt_score as number) : null,
      latestScanId: latest?.id ?? null,
      latestScanAt: latest?.startedAt?.toISOString() ?? null,
    }
  }

  // ------------------------------------------------------------------ //
  //  Analysis configuration, rules catalog, debt trend                  //
  // ------------------------------------------------------------------ //

  async getRulesCatalog(organizationId: string, projectId?: string | null) {
    let engineRules: Record<string, unknown>[] = []
    let source = "fallback"
    try {
      const res = await fetch(`${this.gatewayUrl}/rules`, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`Gateway responded ${res.status}`)
      const catalog = (await res.json()) as unknown
      if (Array.isArray(catalog)) {
        engineRules = catalog as Record<string, unknown>[]
        source = "engine"
      }
    } catch (e) {
      this.logger.warn(`Rule catalog unavailable: ${(e as Error).message}`)
    }

    const stored = await this.prisma.devAnalysisConfig.findFirst({
      where: { organizationId, ...(projectId ? { projectId } : { projectId: null }) },
    })
    const rulesMap = (stored?.config as Record<string, unknown> | undefined)?.rules as
      | Record<string, { enabled?: boolean }>
      | undefined

    const rules = engineRules.map((r) => {
      const id = String(r.id ?? "")
      const override = rulesMap && typeof rulesMap === "object" ? rulesMap[id] : undefined
      const effective = override && typeof override.enabled === "boolean"
        ? override.enabled
        : Boolean(r.enabled)
      return { ...r, enabled: effective }
    })
    return { source, rules }
  }

  async getAnalysisConfig(organizationId: string, projectId?: string | null) {
    const existing = await this.prisma.devAnalysisConfig.findFirst({
      where: { organizationId, ...(projectId ? { projectId } : { projectId: null }) },
    })
    return {
      organizationId,
      projectId: projectId ?? null,
      config: (existing?.config ?? {}) as Record<string, unknown>,
    }
  }

  async setAnalysisConfig(
    organizationId: string,
    projectId: string | null,
    config: Record<string, unknown>
  ) {
    const rules = config.rules
    if (rules !== undefined) {
      if (typeof rules !== "object" || rules === null || Array.isArray(rules)) {
        throw new BadRequestException("config.rules must be an object keyed by rule id")
      }
      for (const [id, v] of Object.entries(rules as Record<string, unknown>)) {
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
          throw new BadRequestException(`config.rules.${id} must be an object`)
        }
        const enabled = (v as { enabled?: unknown }).enabled
        if (enabled !== undefined && typeof enabled !== "boolean") {
          throw new BadRequestException(`config.rules.${id}.enabled must be a boolean`)
        }
      }
    }

    const existing = await this.prisma.devAnalysisConfig.findFirst({
      where: { organizationId, ...(projectId ? { projectId } : { projectId: null }) },
    })
    const data = { organizationId, projectId, config: config as Prisma.InputJsonValue }
    const saved = existing
      ? await this.prisma.devAnalysisConfig.update({ where: { id: existing.id }, data })
      : await this.prisma.devAnalysisConfig.create({ data })
    return saved
  }

  async getDebtTrend(organizationId: string, projectId?: string) {
    const scans = await this.prisma.devScan.findMany({
      where: { organizationId, status: ScanStatus.SUCCESS, ...(projectId ? { projectId } : {}) },
      orderBy: { startedAt: "asc" },
      take: 30,
      select: {
        id: true,
        startedAt: true,
        createdAt: true,
        metrics: true,
        _count: { select: { issues: { where: { isFixed: false } } } },
      },
    })
    return scans.map((s) => {
      const metrics = (s.metrics ?? {}) as Record<string, unknown>
      return {
        scanId: s.id,
        date: s.startedAt ? s.startedAt.toISOString() : s.createdAt?.toISOString(),
        debtScore: typeof metrics.debt_score === "number" ? (metrics.debt_score as number) : null,
        openIssues: s._count.issues,
      }
    })
  }

  async explainIssue(organizationId: string, userId: string, issueId: string) {
    return this.ai.explainIssue(organizationId, userId, issueId)
  }

  // ------------------------------------------------------------------ //
  //  Repository integration                                             //
  // ------------------------------------------------------------------ //

  async createRepository(organizationId: string, dto: CreateRepositoryDto) {
    const url = dto.url.trim()
    if (!/^(https?:\/\/|git@|ssh:\/\/)/i.test(url)) {
      throw new BadRequestException("Provide an HTTPS, SSH, or git+ssh clone URL")
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, organizationId } })
      if (!project) throw new BadRequestException("Project not found in this organization")
    }

    let branches: string[] = []
    try {
      branches = await listRemoteBranches(url, dto.token)
    } catch (e) {
      throw new BadRequestException(`Repository unreachable: ${(e as Error).message}`)
    }
    if (branches.length === 0) throw new BadRequestException("No branches found on the remote")

    const defaultBranch = dto.defaultBranch && branches.includes(dto.defaultBranch)
      ? dto.defaultBranch
      : branches.includes("main")
        ? "main"
        : branches.includes("master")
          ? "master"
          : branches[0]

    const repo = await this.prisma.devRepository.create({
      data: {
        organizationId,
        projectId: dto.projectId ?? null,
        name: dto.name?.trim() || repoNameFromUrl(url),
        url,
        provider: (dto.provider as string) || providerFromUrl(url),
        defaultBranch,
        language: dto.language,
        token: dto.token || null,
        webhookSecret: randomBytes(24).toString("hex"),
      },
    })

    this.emitRepoEvent(organizationId, { id: repo.id, projectId: repo.projectId })
    return this.getRepository(organizationId, repo.id)
  }

  async listRepositories(organizationId: string, projectId?: string) {
    const repos = await this.prisma.devRepository.findMany({
      where: { organizationId, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { scans: true } },
        project: { select: { id: true, name: true } },
        scans: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, completedAt: true, metrics: true, error: true, _count: { select: { issues: true } } },
        },
      },
    })
    return repos.map(({ token, ...rest }) => rest)
  }

  async getRepository(organizationId: string, repositoryId: string) {
    const repo = await this.prisma.devRepository.findFirst({
      where: { id: repositoryId, organizationId },
      include: {
        _count: { select: { scans: true } },
        project: { select: { id: true, name: true } },
        scans: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { _count: { select: { issues: true } } },
        },
      },
    })
    if (!repo) throw new NotFoundException("Repository not found")

    let branches: string[] = []
    let commits: { sha: string; author: string; email: string; date: string; message: string }[] = []
    try {
      branches = await listRemoteBranches(repo.url ?? repo.fullPath ?? "", repo.token)
      const dir = cacheDirFor(repo.id)
      await ensureClone(repo.url ?? "", dir, repo.defaultBranch, repo.token)
      commits = await listCommits(dir)
      const sha = await headSha(dir)
      await this.prisma.devRepository.update({
        where: { id: repo.id },
        data: { lastSyncAt: new Date(), ...(sha ? { lastCommitSha: sha } : {}) },
      })
    } catch (e) {
      this.logger.warn(`Git sync failed for ${repo.name}: ${(e as Error).message}`)
    }

    const { token: _token, ...safe } = repo
    return { ...safe, branches, commits }
  }

  async updateRepository(organizationId: string, repositoryId: string, dto: UpdateRepositoryDto) {
    const repo = await this.prisma.devRepository.findFirst({ where: { id: repositoryId, organizationId } })
    if (!repo) throw new NotFoundException("Repository not found")

    if (dto.projectId !== undefined && dto.projectId !== null) {
      const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, organizationId } })
      if (!project) throw new BadRequestException("Project not found in this organization")
    }

    const updated = await this.prisma.devRepository.update({
      where: { id: repositoryId },
      data: {
        name: dto.name?.trim(),
        provider: dto.provider,
        defaultBranch: dto.defaultBranch,
        scanOnPush: dto.scanOnPush ?? repo.scanOnPush,
        token: dto.token === undefined ? repo.token : dto.token || null,
        projectId:
          dto.projectId === undefined
            ? repo.projectId
            : dto.projectId === null
              ? null
              : dto.projectId,
      },
    })

    this.emitRepoEvent(organizationId, { id: updated.id, projectId: updated.projectId })
    const { token: _t, ...safe } = updated
    return safe
  }

  async deleteRepository(organizationId: string, repositoryId: string) {
    const repo = await this.prisma.devRepository.findFirst({ where: { id: repositoryId, organizationId } })
    if (!repo) throw new NotFoundException("Repository not found")
    await this.prisma.devRepository.delete({ where: { id: repositoryId } })
    const dir = cacheDirFor(repositoryId)
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
    return { ok: true }
  }

  // ------------------------------------------------------------------ //
  //  Full-repository scan                                               //
  // ------------------------------------------------------------------ //

  async scanRepository(
    organizationId: string,
    repositoryId: string,
    actorId: string,
    branch?: string
  ) {
    const repo = await this.prisma.devRepository.findFirst({ where: { id: repositoryId, organizationId } })
    if (!repo) throw new NotFoundException("Repository not found")
    if (!repo.url) throw new BadRequestException("Repository has no clone URL")

    const scan = await this.prisma.devScan.create({
      data: {
        organizationId,
        projectId: repo.projectId,
        repositoryId,
        status: ScanStatus.RUNNING,
        startedAt: new Date(),
      },
    })

    const scanBranch = branch && branch !== "#default" ? branch : repo.defaultBranch
    const startedAt = new Date()

    try {
      const dir = cacheDirFor(repo.id)
      await ensureClone(repo.url, dir, scanBranch, repo.token)

      const sha = await headSha(dir)
      const files = await listSourceFiles(dir, { maxFiles: 2000 })
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0)

      // Analyze a bounded sample of source files through the engine.
      const mayBeBinary = new Set([".py", ".rs", ".c", ".h", ".cpp", ".hpp", ".java", ".ts", ".js", ".go", ".rb"])
      const analyzable = files.filter((f) => mayBeBinary.has(f.ext) || !SKIP_ANALYSIS_EXT.has(f.ext))
      const sample = analyzable.slice(0, MAX_ANALYZED_FILES)

      const processed: { file: (typeof files)[number]; lines: number; complexity: number; maintainability: number; rules: GatewayRule[] }[] = []

      const options = await this.buildAnalysisOptions(organizationId, repo.projectId)
      const excluded = asPathFilters(options.exclude_paths)
      const included = asPathFilters(options.include_paths)

      // Read the sample, then analyze it in gateway batches (8 files/request)
      // instead of one HTTP round-trip per file.
      const BATCH_SIZE = 8
      const loaded: { file: (typeof files)[number]; source: string }[] = []
      for (const item of sample) {
        if (!this.pathAllowed(item.rel, excluded, included)) continue
        let source = ""
        try {
          source = await fs.readFile(item.path, "utf8")
        } catch {
          continue
        }
        loaded.push({ file: item, source: source.slice(0, 200_000) })
      }

      for (let start = 0; start < loaded.length; start += BATCH_SIZE) {
        const chunk = loaded.slice(start, start + BATCH_SIZE)
        let results: GatewayBatchResult[] | null = null
        try {
          const res = await fetch(`${this.gatewayUrl}/analyze-batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: chunk.map((c) => ({ source: c.source, language: c.file.ext.replace(".", "") || "rust", file: c.file.rel })),
              options,
            }),
            signal: AbortSignal.timeout(60_000),
          })
          if (res.ok) {
            const data = (await res.json()) as { results?: GatewayBatchResult[] }
            if (Array.isArray(data.results)) results = data.results
          }
        } catch {
          /* engine skip */
        }

        chunk.forEach((entry, idx) => {
          const one = results?.[idx]
          processed.push({
            file: entry.file,
            lines: entry.source.split("\n").length,
            complexity: one?.metrics?.cyclomatic_complexity ?? 0,
            maintainability: one?.metrics?.maintainability_index ?? 100,
            rules: one?.rules ?? one?.issues ?? [],
          })
        })
      }

      // Merge results; any non-analyzed file still counts toward LoC.
      const linesAnalyzed = processed.reduce((acc, p) => acc + p.lines, 0) +
        (files.length - processed.length > 0 ? files.length - processed.length : 0)
      const complexityAvg = processed.length > 0
        ? processed.reduce((acc, p) => acc + p.complexity, 0) / processed.length
        : 0
      const maintainabilityMin = processed.length > 0
        ? Math.min(...processed.map((p) => p.maintainability), 100)
        : 100

      const issues: { file: (typeof files)[number]; lines: number; complexity: number; maintainability: number; rules: GatewayRule[]; rule: GatewayRule }[] = []
      for (const p of processed) {
        for (const rule of p.rules) {
          issues.push({ ...p, rule })
        }
      }
      const issueCount = issues.length
      const severityCounts: Record<string, number> = {}
      for (const item of issues) {
        const sev = String((item.rule as GatewayRule).severity ?? "medium").toLowerCase()
        const mapped = SEVERITY_MAP[sev] ?? Severity.MEDIUM
        severityCounts[mapped] = (severityCounts[mapped] ?? 0) + 1
      }
      const debtScore = this.computeDebtScore({
        severityCounts,
        lines: linesAnalyzed,
        complexity: complexityAvg,
        maintainability: maintainabilityMin,
      })

      await this.prisma.$transaction(async (tx) => {
        const durationMs = Date.now() - startedAt.getTime()
        await tx.devScan.update({
          where: { id: scan.id },
          data: {
            status: ScanStatus.SUCCESS,
            completedAt: new Date(),
            durationMs,
            filesScanned: files.length,
            linesAnalyzed,
            metrics: {
              lines_of_code: linesAnalyzed,
              cyclomatic_complexity: Math.round(complexityAvg * 100) / 100,
              maintainability_index: Math.round(maintainabilityMin * 100) / 100,
              files_scanned: files.length,
              analyzed_files: processed.length,
              debt_score: debtScore,
            },
          },
        })

        if (issueCount > 0) {
          await tx.devIssue.createMany({
            data: issues.map((p) => ({
              organizationId,
              scanId: scan.id,
              filePath: p.file.rel,
              lineNumber: (p.rule as GatewayRule).line_number ?? p.rule.lineNumber ?? null,
              columnStart: (p.rule as GatewayRule).column ?? null,
              columnEnd: (p.rule as GatewayRule).end_column ?? null,
              codeSnippet: (p.rule as GatewayRule).code_snippet ?? p.rule.codeSnippet ?? null,
              fix: (p.rule as GatewayRule).fix ?? undefined,
              message: (p.rule as GatewayRule).message ?? (p.rule as GatewayRule).rule_name ?? "Code issue",
              severity: SEVERITY_MAP[String((p.rule as GatewayRule).severity ?? "medium").toLowerCase()] ?? Severity.MEDIUM,
              category: (p.rule as GatewayRule).category,
              ruleId: (p.rule as GatewayRule).rule_id ?? (p.rule as GatewayRule).ruleId,
              suggestion: (p.rule as GatewayRule).suggestion ?? null,
              fingerprint: `r:${repo.id}:${(p.rule as GatewayRule).rule_id}:${p.file.rel}:${(p.rule as GatewayRule).line_number ?? p.rule.lineNumber ?? 0}`,
            })),
          })
        }

        await tx.devRepository.update({
          where: { id: repo.id },
          data: {
            lastSyncAt: new Date(),
            lastCommitSha: sha || repo.lastCommitSha,
            sizeKb: Math.round(totalBytes / 1024),
            language: repo.language || (await detectLanguageOfRepo(dir)),
            techDebtRatio: fileCountSafe(issueCount, files.length),
          },
        })

        await this.notifications.create(
          organizationId,
          actorId,
          NotificationType.SCAN_COMPLETED,
          issueCount > 0 ? `${issueCount} issue(s) found in ${repo.name}` : `Clean scan of ${repo.name}`,
          `${scanBranch}@${(sha ?? "").slice(0, 8)} — ${files.length} files, ${linesAnalyzed} LoC, ${issueCount} findings`,
          `/repositories/${repo.id}/scans/${scan.id}`
        )
      })

      this.emitRepoEvent(organizationId, { id: repo.id, projectId: repo.projectId })
      return this.getScan(scan.id)
    } catch (e) {
      this.logger.error(`Repository scan failed: ${(e as Error).message}`)
      await this.prisma.devScan.update({
        where: { id: scan.id },
        data: { status: ScanStatus.FAILED, completedAt: new Date(), error: (e as Error).message },
      })
      this.emitRepoEvent(organizationId, { id: repo.id, projectId: repo.projectId })
      return this.getScan(scan.id)
    }
  }

  // ------------------------------------------------------------------ //
  //  Push webhook                                                       //
  // ------------------------------------------------------------------ //

  async handlePushWebhook(repositoryId: string, secret: string | undefined, payload: unknown) {
    const repo = await this.prisma.devRepository.findUnique({ where: { id: repositoryId } })
    if (!repo || !repo.webhookSecret) return { ok: false, reason: "unknown_repository" }
    if (!secret || !safeEqual(secret, repo.webhookSecret)) return { ok: false, reason: "invalid_secret" }

    const p = (payload ?? {}) as {
      ref?: string
      after?: string
      head_commit?: { message?: string } | null
      repository?: { clone_url?: string }
    }
    const incomingSha = p.after ?? null

    await this.prisma.devRepository.update({
      where: { id: repo.id },
      data: {
        lastSyncAt: new Date(),
        lastCommitSha: incomingSha || repo.lastCommitSha,
        url: p.repository?.clone_url || repo.url,
      },
    })

    if (repo.scanOnPush && repo.url) {
      const member = await this.prisma.organizationMember.findFirst({
        where: { organizationId: repo.organizationId },
        select: { userId: true },
      })
      await this.scanRepository(repo.organizationId, repo.id, member?.userId ?? repo.organizationId, "#default")
    }

    this.logger.log(`Webhook push received for ${repo.name} (${repo.organizationId})`)
    return { ok: true }
  }

  // ------------------------------------------------------------------ //
  //  Triage                                                             //
  // ------------------------------------------------------------------ //

  async triageIssueToTask(
    organizationId: string,
    issueId: string,
    actorId: string,
    projectId: string,
    assigneeId?: string,
    title?: string
  ) {
    const issue = await this.prisma.devIssue.findFirst({
      where: { id: issueId, organizationId },
      include: { scan: true },
    })
    if (!issue) throw new NotFoundException("Issue not found")

    const existing = await this.prisma.task.findFirst({ where: { devIssueId: issue.id } })
    if (existing) return existing

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId,
          projectId,
          reporterId: actorId,
          assigneeId,
          devIssueId: issue.id,
          title: title ?? `Fix: ${issue.message.slice(0, 80)}`,
          description: `${issue.filePath}${issue.lineNumber ? `:${issue.lineNumber}` : ""}\n\n${issue.message}`,
          priority: issue.severity === "CRITICAL" ? "URGENT" : issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
        },
      })

      await this.notifications.create(
        organizationId,
        assigneeId ?? actorId,
        NotificationType.TASK_ASSIGNED,
        "Code issue triaged to a task",
        `Task created from code analysis: ${task.title}`,
        `/projects/${projectId}/tasks/${task.id}`
      )

      return task
    })
  }

  }

const MAX_ANALYZED_FILES = 300
const SKIP_ANALYSIS_EXT = new Set([".md", ".json", ".yml", ".yaml", ".html", ".css", ".sql", ".sh", ".lock", ".txt"])

function fileCountSafe(issueCount: number, filesCount: number): number {
  if (filesCount === 0) return 0
  return Math.min(1, issueCount / Math.max(1, filesCount) / 10)
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return ha.equals(hb)
}