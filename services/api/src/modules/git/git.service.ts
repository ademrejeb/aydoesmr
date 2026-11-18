import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { promises as fs } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { PrismaService } from "../../prisma/prisma.service"
import { NotificationsService } from "../notifications/notifications.service"
import {
  advertiseRefs,
  catBlob,
  catBlobSize,
  cleanRepoName,
  commitFileInBare,
  hashToken,
  headSha,
  initBareRepo,
  listBranches,
  listCommits,
  listTree,
  NAME_RE,
  randomToken,
  repoStoragePath,
  runGitGet,
  runGitPiped,
  calculateRepoBytes,
  findReadme,
} from "./git-host"
import { listSourceFiles } from "../../common/git"
import { NotificationType, ScanStatus, Severity } from "@prisma/client"
import { CreateGitRepositoryDto, CommitFileDto } from "./dto"

interface GatewayRule {
  rule_id?: string
  ruleId?: string
  message?: string
  line_number?: number
  lineNumber?: number
  column?: number
  end_column?: number
  code_snippet?: string
  codeSnippet?: string
  severity?: string
  category?: string
  suggestion?: string
}
interface GatewayResponse {
  metrics?: { lines_of_code?: number; cyclomatic_complexity?: number; maintainability_index?: number }
  rules?: GatewayRule[]
  issues?: GatewayRule[]
}

const SEVERITY_MAP: Record<string, Severity> = {
  critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW", info: "INFO",
}

/** Hosted Git: platform-managed bare repositories, cloneable/pushable over HTTP. */
@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2
  ) {}

  private audit(organizationId: string, userId: string, action: string, entityType: string, metadata?: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        entityType,
        metadata: (metadata ?? {}) as object,
      },
    })
  }

  private get gatewayUrl() {
    return this.config.get<string>("GATEWAY_URL", "http://localhost:8080")
  }

  private emitEvent(organizationId: string, payload: { id: string; projectId: string | null }) {
    this.events.emit("gitrepo.updated", { organizationId, id: payload.id, projectId: payload.projectId })
  }

  // ------------------------------------------------------------------ //
  //  Protocol support                                                   //
  // ------------------------------------------------------------------ //

  /** Look up a repo by URL segments `:owner/:repo`, owner = org slug or id. */
  async locateByOwner(owner: string, rawName: string) {
    const name = cleanRepoName(rawName)
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: owner }, { slug: owner }] },
      select: { id: true },
    })
    if (!org) return null
    return this.prisma.gitRepository.findUnique({
      where: { organizationId_name: { organizationId: org.id, name } },
    })
  }

  async serveInfoRefs(repoId: string, service: "git-upload-pack" | "git-receive-pack") {
    const repo = await this.prisma.gitRepository.findUnique({ where: { id: repoId } })
    if (!repo) throw new NotFoundException()
    return advertiseRefs(repo.storagePath, service)
  }

  async serveRpc(repoId: string, service: "git-upload-pack" | "git-receive-pack", input: Buffer) {
    const repo = await this.prisma.gitRepository.findUnique({ where: { id: repoId } })
    if (!repo) throw new NotFoundException()

    const cmd = service.replace(/^git-/, "")
    const out = await runGitPiped([cmd, "--stateless-rpc", repo.storagePath], input)

    if (service === "git-receive-pack") {
      // A push finished — sync stats + last push time and notify the UI.
      await this.refreshStats(repo.id)
      const updated = await this.prisma.gitRepository.update({
        where: { id: repo.id },
        data: { lastPushAt: new Date() },
      })
      this.emitEvent(repo.organizationId, { id: repo.id, projectId: updated.projectId })
      this.events.emit("git.push", { organizationId: repo.organizationId, repositoryId: repo.id })
      this.logger.log(`push received on ${repo.organizationId}/${repo.name}`)
    }
    return out
  }

  async refreshStats(repoId: string) {
    const repo = await this.prisma.gitRepository.findUnique({ where: { id: repoId } })
    if (!repo) return
    try {
      const tree = await listTree(repo.storagePath)
      const [bytes, sha] = await Promise.all([
        calculateRepoBytes(repo.storagePath),
        headSha(repo.storagePath),
      ])
      await this.prisma.gitRepository.update({
        where: { id: repo.id },
        data: {
          sizeKb: Math.round(bytes / 1024),
          fileCount: tree.length,
          lastCommitSha: sha ?? repo.lastCommitSha,
        },
      })
    } catch (e) {
      this.logger.warn(`Could not refresh stats for ${repo.name}: ${(e as Error).message}`)
    }
  }

  // ------------------------------------------------------------------ //
  //  Repository management                                              //
  // ------------------------------------------------------------------ //

  async createRepository(organizationId: string, dto: CreateGitRepositoryDto) {
    const raw = dto.name.trim()
    if (!NAME_RE.test(raw)) throw new BadRequestException("Name must be 1-100 chars of a-z, A-Z, 0-9, '_', '-', '.'")
    if (raw.toLowerCase() === "git" || raw.startsWith(".")) throw new BadRequestException("Invalid repository name")

    const existing = await this.prisma.gitRepository.findUnique({
      where: { organizationId_name: { organizationId, name: raw } },
    })
    if (existing) throw new BadRequestException("A repository with that name already exists")

    if (dto.projectId) {
      const p = await this.prisma.project.findFirst({ where: { id: dto.projectId, organizationId } })
      if (!p) throw new BadRequestException("Project not found")
    }

    const branch = dto.defaultBranch ?? "main"
    const storagePath = repoStoragePath(organizationId, raw)
    await initBareRepo(storagePath, branch)

    const repo = await this.prisma.gitRepository.create({
      data: {
        organizationId,
        projectId: dto.projectId ?? null,
        name: raw,
        description: dto.description?.trim() || null,
        visibility: dto.visibility ?? "private",
        storagePath,
        defaultBranch: branch,
      },
    })

    if (dto.initReadme) {
      try {
        await commitFileInBare({
          bareDir: storagePath,
          branch,
          path: "README.md",
          content: `# ${raw}\n\n${dto.description ? `${dto.description.trim()}\n\n` : ""}Started on TechVerse.`,
          message: "Initial commit",
          authorName: "TechVerse",
          authorEmail: "git@techverse.local",
        })
      } catch (e) {
        this.logger.warn(`Init README failed: ${(e as Error).message}`)
      }
    }

    await this.refreshStats(repo.id)
    this.emitEvent(organizationId, { id: repo.id, projectId: repo.projectId })
    return this.getDetail(organizationId, repo.id)
  }

  async listRepositories(organizationId: string) {
    const repos = await this.prisma.gitRepository.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
    })
    return repos
  }

  async getDetail(organizationId: string, repositoryId: string, includeContent = true) {
    const repo = await this.prisma.gitRepository.findFirst({
      where: { id: repositoryId, organizationId },
      include: { project: { select: { id: true, name: true } } },
    })
    if (!repo) throw new NotFoundException("Repository not found")

    let branches: string[] = []
    let commits: { sha: string; author: string; email: string; date: string; message: string }[] = []
    let files: { type: string; path: string }[] = []
    let readme: { path: string; content: string } | null = null
    try {
      ;[branches, commits, files] = await Promise.all([
        listBranches(repo.storagePath),
        listCommits(repo.storagePath, 40),
        listTree(repo.storagePath),
      ])
      if (includeContent) {
        const readmePath = await findReadme(repo.storagePath)
        if (readmePath) {
          const size = await catBlobSize(repo.storagePath, readmePath).catch(() => 0)
          if (size > 0 && size < 100_000) {
            const buf = await catBlob(repo.storagePath, readmePath).catch(() => Buffer.alloc(0))
            readme = { path: readmePath, content: buf.toString("utf8") }
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Detail failed for ${repo.name}: ${(e as Error).message}`)
    }

    return { ...repo, branches, commits, files, readme }
  }

  async deleteRepository(organizationId: string, repositoryId: string) {
    const repo = await this.prisma.gitRepository.findFirst({ where: { id: repositoryId, organizationId } })
    if (!repo) throw new NotFoundException("Repository not found")
    await this.prisma.gitRepository.delete({ where: { id: repositoryId } })
    await fs.rm(repo.storagePath, { recursive: true, force: true }).catch(() => undefined)
    this.emitEvent(organizationId, { id: repo.id, projectId: repo.projectId })
    return { ok: true }
  }

  /** Create a commit (new file) on the default branch straight from the UI. */
  async commitFile(organizationId: string, repositoryId: string, dto: CommitFileDto, actorId: string) {
    const repo = await this.prisma.gitRepository.findFirst({ where: { id: repositoryId, organizationId } })
    if (!repo) throw new NotFoundException("Repository not found")

    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, email: true } })
    const commit = await commitFileInBare({
      bareDir: repo.storagePath,
      branch: repo.defaultBranch,
      path: dto.path,
      content: dto.content,
      message: dto.message || `Add ${dto.path}`,
      authorName: actor?.fullName ?? actor?.email ?? "TechVerse",
      authorEmail: actor?.email ?? "git@techverse.local",
    })
    await this.refreshStats(repo.id)
    const updated = await this.prisma.gitRepository.update({
      where: { id: repo.id },
      data: { lastPushAt: new Date() },
    })
    this.emitEvent(organizationId, { id: repo.id, projectId: updated.projectId })
    return commit
  }

  // ------------------------------------------------------------------ //
  //  Scanning a hosted repository from disk                             //
  // ------------------------------------------------------------------ //

  async scanHosted(organizationId: string, repositoryId: string, actorId: string, branch?: string) {
    const repo = await this.prisma.gitRepository.findFirst({ where: { id: repositoryId, organizationId } })
    if (!repo) throw new NotFoundException("Repository not found")

    const tmp = await fs.mkdtemp(join(tmpdir(), "tv-scan-"))
    try {
      await fs.rm(join(tmp, ".git"), { recursive: true, force: true }).catch(() => undefined)
      await runGitGet(branch ? ["clone", "--branch", branch, repo.storagePath, tmp] : ["clone", repo.storagePath, tmp], 120_000)
    } catch (e) {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined)
      throw new ServiceUnavailableException(`Cannot materialize repository: ${(e as Error).message}`)
    }

    const scan = await this.prisma.devScan.create({
      data: {
        organizationId,
        projectId: repo.projectId,
        status: ScanStatus.RUNNING,
        startedAt: new Date(),
      },
    })
    const startedAt = new Date()

    try {
      const files = await listSourceFiles(tmp, { maxFiles: 2000 })
      const sample = files.filter((f) => !["md", "json", "yml", "yaml", "html", "css", "sql", "sh", "lock", "txt"].includes(f.ext.replace(".", ""))).slice(0, 300)
      let lines = 0
      let complexity = 0
      let maintainability = 100
      const issues: { filePath: string; line: number | null; columnStart: number | null; columnEnd: number | null; codeSnippet: string | null; message: string; severity: Severity; category: string | null; ruleId: string | null; suggestion: string | null; fingerprint: string }[] = []
      let analyzed = 0

      const concurrency = 8
      let cursor = 0
      const worker = async () => {
        while (cursor < sample.length) {
          const file = sample[cursor++]
          let source = ""
          try { source = await fs.readFile(file.path, "utf8") } catch { continue }
          const fileLines = source.split("\n").length
          lines += fileLines
          try {
            const res = await fetch(`${this.gatewayUrl}/analyze`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ source: source.slice(0, 200_000), language: file.ext.replace(".", "") || "rust" }),
              signal: AbortSignal.timeout(30_000),
            })
            if (res.ok) {
              const data = (await res.json()) as GatewayResponse
              complexity += data.metrics?.cyclomatic_complexity ?? 0
              maintainability = Math.min(maintainability, data.metrics?.maintainability_index ?? 100)
              analyzed += 1
              for (const rule of data.rules ?? data.issues ?? []) {
                const severity = SEVERITY_MAP[String(rule.severity ?? "medium").toLowerCase()] ?? Severity.MEDIUM
                issues.push({
                  filePath: file.rel,
                  line: rule.line_number ?? rule.lineNumber ?? null,
                  columnStart: rule.column ?? null,
                  columnEnd: rule.end_column ?? null,
                  codeSnippet: rule.code_snippet ?? rule.codeSnippet ?? null,
                  message: rule.message ?? "Code issue",
                  severity,
                  category: rule.category ?? null,
                  ruleId: rule.rule_id ?? rule.ruleId ?? null,
                  suggestion: rule.suggestion ?? null,
                  fingerprint: `h:${repo.id}:${rule.rule_id ?? rule.ruleId}:${file.rel}:${rule.line_number ?? rule.lineNumber ?? 0}`,
                })
              }
            }
          } catch { /* engine skip */ }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, sample.length || 1) }, () => worker()))

      await this.prisma.$transaction(async (tx) => {
        await tx.devScan.update({
          where: { id: scan.id },
          data: {
            status: ScanStatus.SUCCESS,
            completedAt: new Date(),
            durationMs: Date.now() - startedAt.getTime(),
            filesScanned: files.length,
            linesAnalyzed: lines,
            metrics: {
              lines_of_code: lines,
              cyclomatic_complexity: Math.round((complexity / Math.max(1, analyzed)) * 100) / 100,
              maintainability_index: Math.round(maintainability * 100) / 100,
              files_scanned: files.length,
              analyzed_files: analyzed,
            },
          },
        })
        if (issues.length > 0) {
          await tx.devIssue.createMany({
            data: issues.map((i) => ({
              organizationId,
              scanId: scan.id,
              filePath: i.filePath,
              lineNumber: i.line,
              columnStart: i.columnStart,
              columnEnd: i.columnEnd,
              codeSnippet: i.codeSnippet,
              message: i.message,
              severity: i.severity,
              category: i.category,
              ruleId: i.ruleId,
              suggestion: i.suggestion,
              fingerprint: i.fingerprint,
            })),
          })
        }
        await this.notifications.create(
          organizationId,
          actorId,
          NotificationType.SCAN_COMPLETED,
          issues.length > 0 ? `${issues.length} issue(s) found in ${repo.name}` : `Clean scan of ${repo.name}`,
          `${branch ?? repo.defaultBranch} — ${files.length} files, ${lines} LoC, ${issues.length} findings`,
          `/repositories/${repo.id}`
        )
      })

      this.emitEvent(organizationId, { id: repo.id, projectId: repo.projectId })
      return this.prisma.devScan.findUnique({
        where: { id: scan.id },
        include: { issues: { orderBy: [{ severity: "desc" }], take: 500 } },
      })
    } catch (e) {
      this.logger.error(`Hosted scan failed: ${(e as Error).message}`)
      await this.prisma.devScan.update({
        where: { id: scan.id },
        data: { status: ScanStatus.FAILED, completedAt: new Date(), error: (e as Error).message },
      })
      return this.prisma.devScan.findUnique({ where: { id: scan.id } })
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  // ------------------------------------------------------------------ //
  //  Git access tokens                                                  //
  // ------------------------------------------------------------------ //

  async createToken(organizationId: string, userId: string, name: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    })
    if (!member) throw new NotFoundException()
    const token = randomToken()
    const created = await this.prisma.gitToken.create({
      data: {
        organizationId,
        userId,
        name: name.trim() || "default",
        tokenHash: hashToken(token),
        prefix: token.slice(0, 8),
      },
    })
    await this.audit(organizationId, userId, "token.created", "token", { name: created.name, prefix: created.prefix })
    return { token, prefix: token.slice(0, 8), name: name.trim() || "default" }
  }

  async listTokens(organizationId: string, userId: string) {
    const tokens = await this.prisma.gitToken.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
    })
    return tokens.map(({ tokenHash, ...rest }) => rest)
  }

  async revokeToken(organizationId: string, userId: string, tokenId: string) {
    const token = await this.prisma.gitToken.findFirst({ where: { id: tokenId, organizationId, userId } })
    if (!token) throw new NotFoundException("Token not found")
    await this.prisma.gitToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } })
    await this.audit(organizationId, userId, "token.revoked", "token", { name: token.name, prefix: token.prefix })
    return { ok: true }
  }
}