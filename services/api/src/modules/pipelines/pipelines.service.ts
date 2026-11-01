import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { randomUUID } from "crypto"
import { PrismaService } from "../../prisma/prisma.service"
import { NotificationsService } from "../notifications/notifications.service"
import { NotificationType, RunStatus } from "@prisma/client"
import { CreatePipelineDto, TriggerRunDto, UpdatePipelineDto } from "./dto"

interface StepLog {
  id: string
  name: string
  command: string
  status: RunStatus
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  output: string | null
}

const STEP_DELAY_MS = 625
const STEP_OUTPUT_EXAMPLES = [
  "Resolved 214 packages in 2.4s\nChecked 187 files",
  "0 errors, 0 warnings — lint passed",
  "Build completed in 3.1s — dist ready",
]

/** CI/CD pipelines: definitions attached to hosted git repositories, with simulated runs. */
@Injectable()
export class PipelinesService {
  private readonly logger = new Logger(PipelinesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService
  ) {
    this.events.on("git.push", (payload: { organizationId: string; repositoryId: string }) => {
      void this.runPushTriggered(payload.organizationId, payload.repositoryId)
    })
  }

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

  private emit(organizationId: string, pipelineId: string, runId?: string) {
    this.events.emit("pipeline.updated", { organizationId, id: pipelineId, runId })
  }

  async list(organizationId: string) {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        repository: { select: { id: true, name: true, defaultBranch: true } },
        runs: { take: 1, orderBy: { createdAt: "desc" } },
      },
    })
    return pipelines.map(({ runs, ...p }) => ({
      ...p,
      lastRun: runs[0] ?? null,
    }))
  }

  async create(organizationId: string, userId: string, dto: CreatePipelineDto) {
    const repository = await this.prisma.gitRepository.findFirst({
      where: { id: dto.repositoryId, organizationId },
      select: { id: true },
    })
    if (!repository) throw new NotFoundException("Repository not found")

    const pipeline = await this.prisma.pipeline.create({
      data: {
        organizationId,
        repositoryId: dto.repositoryId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        trigger: dto.trigger ?? "manual",
        branch: dto.branch ?? "main",
        steps: dto.steps.map((s) => ({ id: randomUUID(), name: s.name.trim(), command: s.command.trim() })),
        createdById: userId,
      },
    })
    await this.audit(organizationId, userId, "pipeline.created", "pipeline", {
      name: pipeline.name,
      repositoryId: dto.repositoryId,
      trigger: pipeline.trigger as string,
    })
    this.emit(organizationId, pipeline.id)
    return pipeline
  }

  async get(organizationId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId },
      include: {
        repository: { select: { id: true, name: true, defaultBranch: true, projectId: true } },
        runs: { take: 20, orderBy: { createdAt: "desc" }, include: { createdBy: { select: { id: true, fullName: true, email: true } } } },
      },
    })
    if (!pipeline) throw new NotFoundException("Pipeline not found")
    return pipeline
  }

  async update(organizationId: string, userId: string, pipelineId: string, dto: UpdatePipelineDto) {
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } })
    if (!pipeline) throw new NotFoundException("Pipeline not found")

    const steps = dto.steps
      ? dto.steps.map((s) => ({ id: randomUUID(), name: s.name.trim(), command: s.command.trim() }))
      : undefined

    const updated = await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        name: dto.name?.trim(),
        description: dto.description !== undefined ? dto.description : undefined,
        trigger: dto.trigger,
        branch: dto.branch,
        status: dto.status,
        steps: steps as object | undefined,
      },
    })
    await this.audit(organizationId, userId, "pipeline.updated", "pipeline", {
      name: updated.name,
      fields: Object.keys(dto).join(","),
    })
    this.emit(organizationId, pipelineId)
    return updated
  }

  async remove(organizationId: string, userId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } })
    if (!pipeline) throw new NotFoundException("Pipeline not found")
    await this.prisma.pipeline.delete({ where: { id: pipelineId } })
    await this.audit(organizationId, userId, "pipeline.deleted", "pipeline", { name: pipeline.name })
    this.emit(organizationId, pipelineId)
    return { ok: true }
  }

  async trigger(organizationId: string, userId: string, pipelineId: string, dto: TriggerRunDto) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId, status: "active" },
      include: { repository: { select: { id: true, lastCommitSha: true } } },
    })
    if (!pipeline) throw new NotFoundException("Pipeline not found or disabled")

    const run = await this.prisma.pipelineRun.create({
      data: {
        organizationId,
        pipelineId,
        trigger: "manual",
        branch: dto.branch ?? pipeline.branch ?? "main",
        commitSha: pipeline.repository.lastCommitSha,
        steps: (pipeline.steps as { id: string; name: string; command: string }[]).map((s) => ({
          ...s,
          status: RunStatus.QUEUED,
          startedAt: null,
          completedAt: null,
          durationMs: null,
          output: null,
        })),
        createdById: userId,
      },
    })
    await this.audit(organizationId, userId, "pipeline.run_started", "pipeline", {
      name: pipeline.name,
      runId: run.id,
    })
    this.emit(organizationId, pipelineId, run.id)
    void this.execute(organizationId, pipelineId, run.id)
    return run
  }

  async runs(organizationId: string, pipelineId: string) {
    return this.prisma.pipelineRun.findMany({
      where: { organizationId, pipelineId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }

  async runDetail(organizationId: string, runId: string) {
    const run = await this.prisma.pipelineRun.findFirst({
      where: { id: runId, organizationId },
      include: {
        pipeline: { select: { id: true, name: true, repository: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    })
    if (!run) throw new NotFoundException("Run not found")
    return run
  }

  async cancel(organizationId: string, userId: string, runId: string) {
    const run = await this.prisma.pipelineRun.findFirst({
      where: { id: runId, organizationId, status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] } },
    })
    if (!run) throw new NotFoundException("Run not found or already finished")
    const cancelled = await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: RunStatus.CANCELLED, completedAt: new Date() },
    })
    await this.audit(organizationId, userId, "pipeline.run_cancelled", "pipeline", { runId })
    this.emit(organizationId, run.pipelineId, runId)
    return cancelled
  }

  // ------------------------------------------------------------------ //
  //  Execution (simulated in-process runner)                            //
  // ------------------------------------------------------------------ //

  private async runPushTriggered(organizationId: string, repositoryId: string) {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { organizationId, repositoryId, status: "active", trigger: "push" },
    })
    for (const pipeline of pipelines) {
      const run = await this.prisma.pipelineRun.create({
        data: {
          organizationId,
          pipelineId: pipeline.id,
          trigger: "push",
          branch: pipeline.branch ?? "main",
          steps: (pipeline.steps as { id: string; name: string; command: string }[]).map((s) => ({
            ...s,
            status: RunStatus.QUEUED,
            startedAt: null,
            completedAt: null,
            durationMs: null,
            output: null,
          })),
        },
      })
      this.emit(organizationId, pipeline.id, run.id)
      void this.execute(organizationId, pipeline.id, run.id)
    }
  }

  private async execute(organizationId: string, pipelineId: string, runId: string) {
    try {
      const run = await this.prisma.pipelineRun.update({
        where: { id: runId },
        data: { status: RunStatus.RUNNING, startedAt: new Date() },
      })
      this.emit(organizationId, pipelineId, runId)

      const startedAt = Date.now()
      let cancelled = false
      const steps = (run.steps as unknown as StepLog[]).map((s) => ({ ...s }))

      for (let i = 0; i < steps.length; i++) {
        const current = await this.prisma.pipelineRun.findUnique({ where: { id: runId }, select: { status: true } })
        if (current?.status !== RunStatus.RUNNING) {
          cancelled = true
          break
        }

        steps[i].status = RunStatus.RUNNING
        steps[i].startedAt = new Date().toISOString()
        await this.prisma.pipelineRun.update({ where: { id: runId }, data: { steps: steps as unknown as object } })
        this.emit(organizationId, pipelineId, runId)

        await this.sleep(STEP_DELAY_MS * (1 + (i % 3) * 0.4))

        if (i < steps.length - 1) {
          steps[i].status = RunStatus.SUCCESS
        } else {
          const finishedOk = Math.random() > 0.18
          if (finishedOk) steps[i].status = RunStatus.SUCCESS
          else steps[i].status = RunStatus.FAILED
        }
        steps[i].completedAt = new Date().toISOString()
        steps[i].durationMs = Math.round(Math.random() * 900) + 150
        steps[i].output =
          steps[i].status === RunStatus.SUCCESS
            ? STEP_OUTPUT_EXAMPLES[i % STEP_OUTPUT_EXAMPLES.length] + `\nexit code 0`
            : `npm ERR! command failed with exit code 1\ninput: ${steps[i].command}`
        await this.prisma.pipelineRun.update({ where: { id: runId }, data: { steps: steps as unknown as object } })
        this.emit(organizationId, pipelineId, runId)
      }

      if (cancelled) {
        await this.prisma.pipelineRun.update({
          where: { id: runId },
          data: { status: RunStatus.CANCELLED, completedAt: new Date() },
        })
        this.emit(organizationId, pipelineId, runId)
        return
      }

      const failed = steps.some((s) => s.status === RunStatus.FAILED)
      const final = await this.prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status: failed ? RunStatus.FAILED : RunStatus.SUCCESS,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
          error: failed ? `Pipeline failed at step "${steps.find((s) => s.status === RunStatus.FAILED)?.name}"` : null,
        },
      })
      this.emit(organizationId, pipelineId, runId)

      if (final.createdById) {
        await this.notifications.create(
          organizationId,
          final.createdById,
          failed ? NotificationType.PIPELINE_FAILED : NotificationType.PIPELINE_COMPLETED,
          `Pipeline ${failed ? "failed" : "completed"}: ${final.branch} branch`,
          final.error ?? `Finished in ${((final.durationMs ?? 0) / 1000).toFixed(1)}s`,
          `/dashboard/pipelines/${pipelineId}`
        )
      }
      await this.audit(organizationId, final.createdById, failed ? "pipeline.run_failed" : "pipeline.run_completed", "pipeline", {
        runId,
      })
    } catch (err) {
      this.logger.error(`Pipeline run ${runId} errored: ${(err as Error).message}`)
      await this.prisma.pipelineRun
        .update({
          where: { id: runId },
          data: { status: RunStatus.FAILED, completedAt: new Date(), error: (err as Error).message },
        })
        .catch(() => undefined)
      this.emit(organizationId, pipelineId, runId)
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}