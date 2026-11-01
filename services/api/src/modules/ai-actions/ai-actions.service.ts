import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { randomUUID } from "crypto"
import { PrismaService } from "../../prisma/prisma.service"
import { EncryptionService } from "../ai/encryption.service"
import { providerChat, type AiChatMessage, type AiProviderType } from "../ai/providers"
import { GitService } from "../git/git.service"
import { catBlob } from "../git/git-host"
import type { RunAiActionDto } from "./ai-actions.dto"
import {
  AI_ACTION_CATALOG,
  dockerfileSystemPrompt,
  dockerfileUserPrompt,
  explainSystemPrompt,
  explainUserPrompt,
  parseAiOutput,
  pipelineSystemPrompt,
  pipelineUserPrompt,
  scanSystemPrompt,
  scanUserPrompt,
  type AiActionKind,
  type AiActionMessage,
} from "./actions"

const MAX_TOKEN_SPEND = 1800
const MAX_DOCKERFILE_BYTES = 100_000

const KEYLESS_TYPES = new Set<AiProviderType>(["ollama", "openai_compatible"])

interface DockerfileTarget {
  path: string
  content: string
}

/** Predefined AI actions: run an action against an active model provider, preview, then apply. */
@Injectable()
export class AiActionsService {
  private readonly logger = new Logger(AiActionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly encryption: EncryptionService,
    private readonly git: GitService
  ) {}

  private audit(organizationId: string, userId: string | null, action: string, entityType: string, metadata?: Record<string, unknown>) {
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

  private emit(organizationId: string, runId: string) {
    this.events.emit("ai.actions.updated", { organizationId, runId })
  }

  catalog() {
    return AI_ACTION_CATALOG
  }

  async list(organizationId: string) {
    return this.prisma.aiActionRun.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { createdBy: { select: { id: true, fullName: true, email: true } } },
    })
  }

  async get(organizationId: string, runId: string) {
    const run = await this.prisma.aiActionRun.findFirst({
      where: { id: runId, organizationId },
      include: { createdBy: { select: { id: true, fullName: true, email: true } } },
    })
    if (!run) throw new NotFoundException("AI action run not found")
    return run
  }

  private async resolveProvider(organizationId: string) {
    const providers = await this.prisma.aiProvider.findMany({
      where: { organizationId, status: "active" },
      orderBy: { updatedAt: "desc" },
    })
    const provider = providers.find(
      (p) => p.defaultModel && (p.apiKeyEncrypted || KEYLESS_TYPES.has(p.type as AiProviderType))
    )
    if (!provider) {
      throw new BadRequestException(
        "No active AI provider with a default model — configure one in AI Models first."
      )
    }
    const apiKey = provider.apiKeyEncrypted ? this.encryption.decrypt(provider.apiKeyEncrypted) : null
    return { provider, apiKey }
  }

  async run(organizationId: string, userId: string, dto: RunAiActionDto) {
    const { provider, apiKey } = await this.resolveProvider(organizationId)
    const model = provider.defaultModel as string
    const startedAt = Date.now()

    const built = await this.buildContext(organizationId, dto)

    try {
      const result = await providerChat(
        provider.type as AiProviderType,
        provider.baseUrl,
        apiKey,
        model,
        built.messages as AiChatMessage[],
        MAX_TOKEN_SPEND
      )
      const output = parseAiOutput(result.reply)
      const run = await this.prisma.aiActionRun.create({
        data: {
          organizationId,
          providerId: provider.id,
          providerName: provider.name,
          model,
          action: dto.action,
          status: "completed",
          input: built.input as never,
          output: { ...output, ...built.extras } as never,
          durationMs: result.durationMs,
          createdById: userId,
        },
      })
      await this.audit(organizationId, userId, "ai.action.ran", "ai_action_run", {
        action: dto.action,
        provider: provider.name,
        model,
        durationMs: result.durationMs,
      })
      this.emit(organizationId, run.id)
      this.logger.log(
        `Action ${dto.action} ok via ${provider.name} (${model}) in ${result.durationMs}ms`
      )
      return run
    } catch (err) {
      const message = (err as Error).message
      const run = await this.prisma.aiActionRun.create({
        data: {
          organizationId,
          providerId: provider.id,
          providerName: provider.name,
          model,
          action: dto.action,
          status: "failed",
          input: built.input as never,
          error: message.slice(0, 1000),
          durationMs: Date.now() - startedAt,
          createdById: userId,
        },
      })
      await this.audit(organizationId, userId, "ai.action.ran", "ai_action_run", {
        action: dto.action,
        provider: provider.name,
        ok: false,
        error: message.slice(0, 200),
      })
      this.emit(organizationId, run.id)
      this.logger.warn(`Action ${dto.action} failed: ${message}`)
      throw new BadRequestException(message)
    }
  }

  private async buildContext(organizationId: string, dto: RunAiActionDto) {
    const input = dto.input ?? {}
    switch (dto.action) {
      case "optimize_dockerfile": {
        const doc = await this.resolveDockerfile(organizationId, input)
        const source = doc?.content ?? String(input.source ?? "")
        return {
          input: { repositoryId: input.repositoryId ?? null, path: doc?.path ?? null, source },
          messages: [
            { role: "system", content: dockerfileSystemPrompt() },
            { role: "user", content: dockerfileUserPrompt(source, doc?.path ?? "(pasted)") },
          ] as AiActionMessage[],
          extras: { path: doc?.path ?? null, before: source },
        }
      }
      case "optimize_pipeline": {
        const steps = await this.resolvePipelineSteps(organizationId, input)
        const name = typeof input.name === "string" ? input.name : "pipeline"
        return {
          input: { pipelineId: input.pipelineId ?? null, before: steps },
          messages: [
            { role: "system", content: pipelineSystemPrompt() },
            { role: "user", content: pipelineUserPrompt(name, steps) },
          ] as AiActionMessage[],
          extras: { before: steps },
        }
      }
      case "fix_scan_issues": {
        const issueIds = Array.isArray(input.issueIds) ? (input.issueIds.filter((x) => typeof x === "string") as string[]) : []
        if (issueIds.length === 0) throw new BadRequestException("No scan issues selected")
        const issues = await this.prisma.devIssue.findMany({
          where: { id: { in: issueIds }, organizationId },
          select: { id: true, filePath: true, lineNumber: true, severity: true, message: true, category: true, ruleId: true },
        })
        if (issues.length === 0) throw new BadRequestException("No matching scan issues")
        return {
          input: { issueIds, projectId: input.projectId ?? null },
          messages: [
            { role: "system", content: scanSystemPrompt() },
            { role: "user", content: scanUserPrompt(issues) },
          ] as AiActionMessage[],
          extras: { issues },
        }
      }
      case "explain_code": {
        const source = typeof input.source === "string" ? input.source : ""
        if (!source.trim()) throw new BadRequestException("No code provided")
        const language = typeof input.language === "string" ? input.language : null
        return {
          input: { source, language },
          messages: [
            { role: "system", content: explainSystemPrompt() },
            { role: "user", content: explainUserPrompt(source, language) },
          ] as AiActionMessage[],
          extras: { language },
        }
      }
      default:
        throw new BadRequestException("Unknown AI action")
    }
  }

  private async resolveDockerfile(organizationId: string, input: Record<string, unknown>): Promise<DockerfileTarget | null> {
    const source = typeof input.source === "string" ? input.source.trim() : ""
    if (source) return { path: "(pasted)", content: source }
    const repositoryId = typeof input.repositoryId === "string" ? input.repositoryId : null
    if (!repositoryId) throw new BadRequestException("Provide Dockerfile source or a repository")
    const detail = await this.git.getDetail(organizationId, repositoryId, true)
    const path = this.findDockerfilePath((detail.files ?? []) as { type: string; path: string }[])
    if (!path) throw new BadRequestException("No Dockerfile found in this repository")
    const buffer = await catBlob(detail.storagePath as string, path)
    if (buffer.length === 0) throw new BadRequestException("Dockerfile is empty")
    if (buffer.length > MAX_DOCKERFILE_BYTES) {
      throw new BadRequestException("Dockerfile is too large to optimize (over 100 KB)")
    }
    return { path, content: buffer.toString("utf8") }
  }

  private findDockerfilePath(files: { type: string; path: string }[]): string | null {
    const blobs = files.filter((f) => f.type === "blob")
    const exact = blobs.find((f) => f.path === "Dockerfile")
    if (exact) return exact.path
    const dockerDir = blobs.find((f) => /^docker[/\\]Dockerfile$/.test(f.path))
    if (dockerDir) return dockerDir.path
    const any = blobs.find((f) => /(^|\/)Dockerfile([^/]*)$/i.test(f.path))
    return any?.path ?? null
  }

  private async resolvePipelineSteps(organizationId: string, input: Record<string, unknown>) {
    const pipelineId = typeof input.pipelineId === "string" ? input.pipelineId : null
    if (pipelineId) {
      const pipeline = await this.prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } })
      if (!pipeline) throw new BadRequestException("Pipeline not found")
      return (pipeline.steps as { name: string; command: string }[]) ?? []
    }
    if (Array.isArray(input.steps) && input.steps.length > 0) {
      const steps = input.steps
        .filter((s) => typeof s === "object" && s !== null)
        .map((s) => s as { name?: unknown; command?: unknown })
        .map((s) => ({ name: String(s.name ?? "").trim(), command: String(s.command ?? "").trim() }))
        .filter((s) => s.name && s.command)
      if (steps.length === 0) throw new BadRequestException("No valid pipeline steps provided")
      return steps
    }
    throw new BadRequestException("Provide a pipeline or a step list")
  }

  // ------------------------------------------------------------------ //
  //  Apply                                                              //
  // ------------------------------------------------------------------ //

  async apply(organizationId: string, userId: string, runId: string) {
    const run = await this.prisma.aiActionRun.findFirst({ where: { id: runId, organizationId } })
    if (!run) throw new NotFoundException("AI action run not found")
    if (run.status !== "completed") throw new BadRequestException("Only completed runs can be applied")
    if (run.applied) throw new BadRequestException("This run was already applied")

    const output = (run.output ?? {}) as Record<string, unknown>
    const input = (run.input ?? {}) as Record<string, unknown>

    switch (run.action as AiActionKind) {
      case "optimize_dockerfile":
        return this.applyDockerfile(organizationId, userId, run.id, input, output)
      case "optimize_pipeline":
        return this.applyPipeline(organizationId, userId, run.id, input, output)
      case "fix_scan_issues":
        return this.applyScanFixes(organizationId, userId, run.id, input, output)
      case "explain_code":
        throw new BadRequestException("This action is advisory only — nothing to apply.")
      default:
        throw new BadRequestException("Unknown AI action")
    }
  }

  private async markApplied(organizationId: string, runId: string, summary: Record<string, unknown>) {
    const run = await this.prisma.aiActionRun.update({
      where: { id: runId },
      data: { applied: true, appliedAt: new Date() },
    })
    await this.audit(organizationId, run.createdById, "ai.action.applied", "ai_action_run", {
      runId,
      action: run.action,
      summary,
    })
    this.emit(organizationId, runId)
    return { ok: true, applied: true, summary }
  }

  private async applyDockerfile(
    organizationId: string,
    userId: string,
    runId: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>
  ) {
    const repositoryId = typeof input.repositoryId === "string" ? input.repositoryId : null
    const path = typeof output.path === "string" && output.path !== "(pasted)" ? output.path : null
    const dockerfile = typeof output.dockerfile === "string" ? output.dockerfile : null
    if (!repositoryId || !path || !dockerfile?.trim()) {
      throw new BadRequestException(
        "This run has no applyable Dockerfile result (paste a repository link or rerun the action)"
      )
    }
    const committed = await this.git.commitFile(organizationId, repositoryId, {
      path,
      content: dockerfile,
      message: `[AI] Optimize ${path}`,
    }, userId)
    return this.markApplied(organizationId, runId, { committed: committed.sha ?? committed, path })
  }

  private async applyPipeline(
    organizationId: string,
    _userId: string,
    runId: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>
  ) {
    const pipelineId = typeof input.pipelineId === "string" ? input.pipelineId : null
    const steps = Array.isArray(output.steps) ? (output.steps as { name?: unknown; command?: unknown }[]) : []
    const clean = steps
      .map((s) => ({ name: String(s.name ?? "").trim(), command: String(s.command ?? "").trim() }))
      .filter((s) => s.name && s.command)
    if (!pipelineId || clean.length === 0) {
      throw new BadRequestException("This run has no applyable pipeline result — provide a pipeline and rerun")
    }
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } })
    if (!pipeline) throw new BadRequestException("Pipeline not found")
    await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: { steps: clean.map((s) => ({ id: randomUUID(), ...s })) as unknown as object },
    })
    this.events.emit("pipeline.updated", { organizationId, id: pipelineId })
    return this.markApplied(organizationId, runId, { pipelineId, steps: clean.length })
  }

  private async applyScanFixes(
    organizationId: string,
    userId: string,
    runId: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>
  ) {
    const fixes = Array.isArray(output.fixes) ? (output.fixes as { issueId?: unknown; suggestion?: unknown }[]) : []
    if (fixes.length === 0) throw new BadRequestException("This run returned no fixes to apply")

    const projectId =
      (typeof input.projectId === "string" ? input.projectId : null) ??
      (await this.prisma.project.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" } }))?.id
    if (!projectId) throw new BadRequestException("No project available to create fix tasks in")

    const created: { issueId: string; taskId: string; title: string }[] = []
    for (const fix of fixes) {
      const issueId = String(fix.issueId ?? "")
      const suggestion = String(fix.suggestion ?? "").trim()
      if (!issueId || !suggestion) continue
      const issue = await this.prisma.devIssue.findFirst({ where: { id: issueId, organizationId }, select: { id: true, message: true, severity: true } })
      if (!issue || (await this.prisma.task.findFirst({ where: { devIssueId: issue.id } }))) continue
      const task = await this.prisma.task.create({
        data: {
          organizationId,
          projectId,
          reporterId: userId,
          devIssueId: issue.id,
          title: `Fix: ${suggestion.slice(0, 80)}`,
          description: `${issue.message}\n\nAI suggested: ${suggestion}`,
          priority: issue.severity === "CRITICAL" ? "URGENT" : issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
        },
      })
      created.push({ issueId, taskId: task.id, title: task.title })
    }
    if (created.length === 0) throw new BadRequestException("No fixes could be applied — issues already have tasks")
    return this.markApplied(organizationId, runId, { tasks: created.length })
  }
}