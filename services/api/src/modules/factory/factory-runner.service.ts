import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { FactoryCommandStatus, Prisma } from "@prisma/client"
import { promises as fs } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PrismaService } from "../../prisma/prisma.service"
import { runGitGet } from "../git/git-host"
import { dockerAvailable, runIsolatedCommand } from "./factory.runner"

export interface FactoryProjectConfig {
  testCommand: string | null
  buildCommand: string | null
  lintCommand: string | null
  auditCommand: string | null
  image: string
  timeoutMs: number
}

const DEFAULT_IMAGE = "node:22-alpine"
const DEFAULT_TIMEOUT = 300_000

@Injectable()
export class FactoryRunnerService {
  private readonly logger = new Logger(FactoryRunnerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private asConfig(settings: Prisma.JsonValue): FactoryProjectConfig {
    const root = settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {}
    const factory = root.factory && typeof root.factory === "object" && !Array.isArray(root.factory)
      ? (root.factory as Record<string, unknown>)
      : {}
    const stringOrNull = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)
    const timeout = Number(factory.timeoutMs)
    return {
      testCommand: stringOrNull(factory.testCommand),
      buildCommand: stringOrNull(factory.buildCommand),
      lintCommand: stringOrNull(factory.lintCommand),
      auditCommand: stringOrNull(factory.auditCommand),
      image: stringOrNull(factory.image) ?? this.config.get<string>("FACTORY_RUNNER_IMAGE", DEFAULT_IMAGE),
      timeoutMs: Number.isFinite(timeout) && timeout >= 10_000 && timeout <= 1_800_000
        ? timeout
        : Number(this.config.get<string>("FACTORY_RUNNER_TIMEOUT_MS", String(DEFAULT_TIMEOUT))) || DEFAULT_TIMEOUT,
    }
  }

  async getProjectConfig(organizationId: string, projectId: string): Promise<FactoryProjectConfig> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { settings: true },
    })
    if (!project) throw new NotFoundException("Project not found")
    return this.asConfig(project.settings)
  }

  async setProjectConfig(
    organizationId: string,
    projectId: string,
    patch: Partial<Pick<FactoryProjectConfig, "testCommand" | "buildCommand" | "lintCommand" | "auditCommand" | "image" | "timeoutMs">>
  ): Promise<FactoryProjectConfig> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, settings: true },
    })
    if (!project) throw new NotFoundException("Project not found")
    const current = project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, unknown>)
      : {}
    const currentFactory = current.factory && typeof current.factory === "object" && !Array.isArray(current.factory)
      ? (current.factory as Record<string, unknown>)
      : {}
    const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
    const nextFactory = { ...currentFactory, ...clean }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { settings: { ...current, factory: nextFactory } as Prisma.InputJsonValue },
    })
    return this.asConfig({ ...current, factory: nextFactory } as Prisma.JsonValue)
  }

  /** Cheap manifest detection. No repo command is executed here. */
  private async detectCommand(repoDir: string): Promise<string | null> {
    try {
      const pkgPath = join(repoDir, "package.json")
      const pkg = await fs.readFile(pkgPath, "utf8").catch(() => null)
      if (pkg) {
        const parsed = JSON.parse(pkg) as { scripts?: Record<string, unknown> }
        if (typeof parsed.scripts?.test === "string" && parsed.scripts.test.trim()) return "npm test"
      }
      if (await fs.stat(join(repoDir, "Cargo.toml")).then(() => true).catch(() => false)) return "cargo test"
      if (await fs.stat(join(repoDir, "go.mod")).then(() => true).catch(() => false)) return "go test ./..."
      if (await fs.stat(join(repoDir, "pytest.ini")).then(() => true).catch(() => false)) return "pytest -q"
      if (await fs.stat(join(repoDir, "pyproject.toml")).then(() => true).catch(() => false)) return "pytest -q"
    } catch {
      /* ignore malformed manifests */
    }
    return null
  }

  async runForRun(input: {
    organizationId: string
    runId: string
    repositoryId: string
    branch: string
    projectId: string
    actorId: string
  }): Promise<{ commands: Awaited<ReturnType<PrismaService["factoryCommandRun"]["findMany"]>>; testCommand: string | null; hasRunner: boolean }> {
    const [repo, config] = await Promise.all([
      this.prisma.gitRepository.findFirst({
        where: { id: input.repositoryId, organizationId: input.organizationId },
        select: { storagePath: true },
      }),
      this.getProjectConfig(input.organizationId, input.projectId),
    ])
    if (!repo) throw new NotFoundException("Repository not found")

    const tmp = await fs.mkdtemp(join(tmpdir(), "tv-runner-"))
    const work = join(tmp, "work")
    try {
      await runGitGet(["clone", "--depth", "1", "--branch", input.branch, repo.storagePath, work], 120_000)
      const testCommand = config.testCommand ?? (await this.detectCommand(work))
      const plans: { kind: string; command: string }[] = []
      if (testCommand) plans.push({ kind: "TEST", command: testCommand })
      if (config.buildCommand) plans.push({ kind: "BUILD", command: config.buildCommand })
      if (config.lintCommand) plans.push({ kind: "LINT", command: config.lintCommand })
      if (config.auditCommand) plans.push({ kind: "AUDIT", command: config.auditCommand })

      const hasRunner = (await dockerAvailable()) || this.allowLocal()
      if (plans.length === 0) return { commands: [], testCommand: null, hasRunner }

      const rows: Awaited<ReturnType<PrismaService["factoryCommandRun"]["findMany"]>> = []
      for (const plan of plans) {
        const row = await this.prisma.factoryCommandRun.create({
          data: {
            organizationId: input.organizationId,
            runId: input.runId,
            kind: plan.kind,
            command: plan.command,
            runner: "blocked",
            status: FactoryCommandStatus.QUEUED,
          },
        })
        await this.prisma.factoryCommandRun.update({
          where: { id: row.id },
          data: { status: FactoryCommandStatus.RUNNING, startedAt: new Date() },
        })
        const result = await runIsolatedCommand({
          command: plan.command,
          cwd: work,
          timeoutMs: config.timeoutMs,
          image: config.image,
          allowLocal: this.allowLocal(),
        })
        const finished = await this.prisma.factoryCommandRun.update({
          where: { id: row.id },
          data: {
            runner: result.runner,
            status: result.status as FactoryCommandStatus,
            exitCode: result.exitCode,
            output: result.output.slice(0, 120_000) || null,
            error: result.error,
            durationMs: result.durationMs,
            completedAt: new Date(),
          },
        })
        rows.push(finished)
      }
      return { commands: rows, testCommand: testCommand ?? null, hasRunner }
    } catch (error) {
      const row = await this.prisma.factoryCommandRun.create({
        data: {
          organizationId: input.organizationId,
          runId: input.runId,
          kind: "TEST",
          command: config.testCommand ?? "unknown",
          runner: "blocked",
          status: FactoryCommandStatus.BLOCKED,
          error: `Could not materialize the branch: ${(error as Error).message}`.slice(0, 1000),
          completedAt: new Date(),
        },
      })
      this.logger.warn(`Runner could not clone ${input.branch}: ${(error as Error).message}`)
      return { commands: [row], testCommand: config.testCommand, hasRunner: false }
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  private allowLocal(): boolean {
    return this.config.get<string>("FACTORY_ALLOW_LOCAL_EXEC") === "true"
  }
}
