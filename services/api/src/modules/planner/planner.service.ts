import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { TaskPriority, TaskType } from "@prisma/client"
import { PrismaService } from "../../prisma/prisma.service"
import { EncryptionService } from "../ai/encryption.service"
import { providerChat, type AiChatMessage, type AiProviderType } from "../ai/providers"
import { parseAiOutput } from "../ai-actions/actions"
import { AgileService } from "../agile/agile.service"
import { ApplyPlanDto, PlanUploadDto } from "./planner.dto"

const MAX_DOC_BYTES = 20 * 1024 * 1024
const MAX_AI_CHARS = 60_000
const MAX_TICKETS = 80
const MAX_TOKEN_SPEND = 2600

const KEYLESS_TYPES = new Set<AiProviderType>(["ollama", "openai_compatible"])

const TASK_TYPES = new Set<TaskType>(["STORY", "TASK", "BUG", "EPIC", "SUBTASK"])
const PRIORITIES = new Set<TaskPriority>(["LOW", "MEDIUM", "HIGH", "URGENT"])
const POINTS = new Set([1, 2, 3, 5, 8, 13, 21])

export interface PlannedTicket {
  title: string
  description: string
  type: TaskType
  priority: TaskPriority
  storyPoints: number | null
  epic: string | null
}

const PLANNER_SYSTEM_PROMPT = `You are an experienced agile product owner. You will receive a "cahier de charge" (requirements / specification document) and must convert it into a clean, well-structured backlog of tickets for a development team.

RULES:
- Extract real functional and technical requirements only. Ignore boilerplate (cover pages, signatures, generic introductions, legal text).
- Each ticket must be a small, independently actionable unit of work.
- Group related tickets under a feature using the "epic" field (a short feature name, e.g. "Authentication" or "Reporting").
- "type" must be one of: STORY (a user-facing feature), TASK (technical or chore work), BUG (a defect or risk described in the spec).
- "priority" must be one of: LOW, MEDIUM, HIGH, URGENT. Reserve URGENT for blocking issues.
- "storyPoints" must be one of the Fibonacci values: 1, 2, 3, 5, 8, 13, 21.
- "description": concise plain text. When useful include functional requirements as bullets and acceptance criteria prefixed with "AC:".

OUTPUT FORMAT: reply with ONLY one valid JSON object, no markdown fences and no commentary:
{ "tickets": [ { "title": string, "description": string, "type": "STORY"|"TASK"|"BUG", "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT", "storyPoints": number, "epic": string|null } ] }`

export interface AppliedSummary {
  ok: boolean
  project: { id: string; name: string }
  sprint: { id: string; name: string }
  createdEpics: number
  createdTasks: number
}

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly encryption: EncryptionService,
    private readonly agile: AgileService
  ) {}

  async list(organizationId: string) {
    return this.prisma.sprintPlan.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { createdBy: { select: { id: true, fullName: true, avatarUrl: true } } },
    })
  }

  async get(organizationId: string, planId: string) {
    const plan = await this.prisma.sprintPlan.findFirst({
      where: { id: planId, organizationId },
      include: { createdBy: { select: { id: true, fullName: true, avatarUrl: true } } },
    })
    if (!plan) throw new NotFoundException("Plan not found")
    return plan
  }

  // ------------------------------------------------------------------ //
  //  Plan: upload a cahier de charge → extracted text → tickets        //
  // ------------------------------------------------------------------ //

  async create(
    organizationId: string,
    userId: string,
    file: Express.Multer.File | undefined,
    dto: PlanUploadDto
  ) {
    if (!file?.buffer || file.buffer.byteLength === 0) {
      throw new BadRequestException("file is required")
    }
    if (file.size > MAX_DOC_BYTES) {
      throw new BadRequestException("Document is too large (max 20 MB)")
    }

    let text = ""
    try {
      text = await this.extractText(file)
    } catch (err) {
      throw new BadRequestException(
        `Could not read this document type (${file.mimetype}): ${(err as Error).message}`
      )
    }
    text = text.replace(/\u0000/g, " ").trim()
    if (!text) {
      throw new BadRequestException("No readable text found in the document")
    }

    const capped = text.slice(0, MAX_AI_CHARS)
    let tickets: PlannedTicket[] | null = null
    let aiNote: string | null = null
    try {
      tickets = await this.generateWithAi(organizationId, file.originalname, capped)
    } catch (err) {
      aiNote = (err as Error).message.slice(0, 300)
      this.logger.warn(`Planner AI failed for "${file.originalname}" — using built-in extraction: ${aiNote}`)
    }
    if (!tickets || tickets.length === 0) {
      tickets = this.generateFromHeuristics(capped)
    }
    if (tickets.length === 0) {
      throw new BadRequestException("No tickets could be extracted from this document")
    }

    let plan: { id: string; fileName: string } | null = null
    try {
      plan = await this.prisma.sprintPlan.create({
        data: {
          organizationId,
          fileName: file.originalname.slice(0, 200),
          mimeType: file.mimetype || "application/octet-stream",
          charCount: text.length,
          status: "GENERATED",
          error: aiNote,
          tickets: tickets as unknown as object,
          sprintName: dto?.sprintName ? dto.sprintName.trim().slice(0, 120) || null : null,
          teamId: dto?.teamId ?? null,
          createdById: userId,
        },
      })
    } catch (err) {
      const message = (err as Error).message
      await this.prisma.sprintPlan.create({
        data: {
          organizationId,
          fileName: file.originalname.slice(0, 200),
          mimeType: file.mimetype || "application/octet-stream",
          charCount: text.length,
          status: "FAILED",
          error: `Failed to save plan: ${message.slice(0, 300)}`,
          createdById: userId,
        },
      })
      throw new BadRequestException(`Could not save the plan: ${message}`)
    }

    this.events.emit("planner.plan.updated", { organizationId, id: plan.id, tickets: tickets.length })
    this.logger.log(`Plan ${plan.id} generated ${tickets.length} tickets from "${plan.fileName}"`)
    return this.get(organizationId, plan.id)
  }

  // ------------------------------------------------------------------ //
  //  Apply: create sprint → epics → tasks                              //
  // ------------------------------------------------------------------ //

  async apply(organizationId: string, userId: string, planId: string, dto: ApplyPlanDto): Promise<AppliedSummary> {
    const plan = await this.prisma.sprintPlan.findFirst({ where: { id: planId, organizationId } })
    if (!plan) throw new NotFoundException("Plan not found")
    if (plan.status !== "GENERATED") {
      throw new BadRequestException("This plan is not ready to apply (it was already applied or failed)")
    }

    const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, organizationId } })
    if (!project) throw new NotFoundException("Project not found")

    const tickets = Array.isArray(plan.tickets)
      ? (plan.tickets as unknown as PlannedTicket[])
      : []
    if (tickets.length === 0) throw new BadRequestException("This plan has no tickets to create")

    let teamId: string | null = dto.teamId ?? plan.teamId ?? null
    if (teamId) {
      const team = await this.prisma.team.findFirst({ where: { id: teamId, organizationId } })
      if (!team) throw new NotFoundException("Team not found")
      await this.prisma.projectTeam.upsert({
        where: { projectId_teamId: { projectId: project.id, teamId } },
        create: { projectId: project.id, teamId },
        update: {},
      })
    }

    const workflow = await this.agile.ensureWorkflow(organizationId, project.id)
    const columns = await this.prisma.workflowColumn.findMany({
      where: { workflowId: workflow.id },
      orderBy: { position: "asc" },
    })
    const startColumn =
      columns.find((c) => c.status === "TODO") ?? columns.find((c) => !c.isBacklog) ?? columns[0] ?? null
    const columnId = startColumn?.id ?? null
    const status = startColumn?.status ?? "TODO"

    const sprintCount = await this.prisma.sprint.count({ where: { projectId: project.id } })
    const sprintName = dto.sprintName?.trim() || plan.sprintName?.trim() || `Sprint ${sprintCount + 1}`
    const sprint = await this.prisma.sprint.create({
      data: {
        organizationId,
        projectId: project.id,
        teamId,
        name: sprintName,
        status: "PLANNING",
      },
    })

    let order = await this.prisma.task.count({ where: { projectId: project.id, columnId } })

    const [created, epics] = await this.prisma.$transaction(async (tx) => {
      const epicIdByName = new Map<string, string>()
      for (const ticket of tickets) {
        if (ticket.epic && !epicIdByName.has(ticket.epic)) {
          const epic = await tx.task.create({
            data: {
              organizationId,
              projectId: project.id,
              reporterId: userId,
              title: ticket.epic,
              description: `Epic generated from "${plan.fileName}" by the sprint planner.`,
              type: "EPIC",
              status,
              columnId,
              sprintId: sprint.id,
              priority: "MEDIUM",
              order: 0,
            },
          })
          epicIdByName.set(ticket.epic, epic.id)
        }
      }

      const createdTaskIds: string[] = []
      for (const ticket of tickets) {
        order += 1
        const epicId = ticket.epic ? (epicIdByName.get(ticket.epic) ?? null) : null
        const task = await tx.task.create({
          data: {
            organizationId,
            projectId: project.id,
            reporterId: userId,
            title: ticket.title,
            description: ticket.description || undefined,
            type: TASK_TYPES.has(ticket.type) ? ticket.type : TaskType.STORY,
            status,
            columnId,
            sprintId: sprint.id,
            epicId,
            priority: PRIORITIES.has(ticket.priority) ? ticket.priority : TaskPriority.MEDIUM,
            storyPoints: ticket.storyPoints,
            order,
          },
        })
        createdTaskIds.push(task.id)
      }

      return [createdTaskIds, epicIdByName.size] as const
    })

    await this.prisma.sprintPlan.update({
      where: { id: plan.id },
      data: {
        status: "APPLIED",
        projectId: project.id,
        teamId,
        sprintName: sprint.name,
        sprintId: sprint.id,
      },
    })

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "planner.applied",
        entityType: "sprint_plan",
        entityId: plan.id,
        metadata: {
          projectId: project.id,
          sprintId: sprint.id,
          tasks: created.length,
          epics,
          fileName: plan.fileName,
        },
      },
    })

    this.events.emit("sprint.updated", { projectId: project.id, organizationId })
    this.logger.log(`Plan ${plan.id} applied → sprint ${sprint.id} (${created.length} tasks, ${epics} epics)`)

    return {
      ok: true,
      project: { id: project.id, name: project.name },
      sprint: { id: sprint.id, name: sprint.name },
      createdEpics: epics,
      createdTasks: created.length,
    }
  }

  // ------------------------------------------------------------------ //
  //  Text extraction                                                    //
  // ------------------------------------------------------------------ //

  private async extractText(file: Express.Multer.File): Promise<string> {
    const name = file.originalname.toLowerCase()
    const isPdf = file.mimetype === "application/pdf" || name.endsWith(".pdf")
    const isDocx =
      file.mimetype.includes("wordprocessingml") || name.endsWith(".docx")

    if (isPdf) {
      const pdfParse = (await import("pdf-parse")).default
      const data = await pdfParse(file.buffer, { max: 120 })
      return data.text ?? ""
    }
    if (isDocx) {
      const mammoth = await import("mammoth")
      const result = await mammoth.extractRawText({ buffer: file.buffer })
      return result.value ?? ""
    }
    // Plain text (txt, md, csv...) and any other textual format.
    return file.buffer.toString("utf8")
  }

  // ------------------------------------------------------------------ //
  //  Ticket generation                                                  //
  // ------------------------------------------------------------------ //

  private async generateWithAi(organizationId: string, fileName: string, text: string): Promise<PlannedTicket[] | null> {
    const providers = await this.prisma.aiProvider.findMany({
      where: { organizationId, status: "active" },
      orderBy: { updatedAt: "desc" },
    })
    const provider = providers.find(
      (p) => p.defaultModel && (p.apiKeyEncrypted || KEYLESS_TYPES.has(p.type as AiProviderType))
    )
    if (!provider) {
      this.logger.log("No active AI provider — using deterministic extraction")
      return null
    }

    const userPrompt =
      `Produce the backlog tickets for the document below.\n` +
      `Document name: ${fileName}\n\n` +
      `DOCUMENT CONTENT:\n${text}`

    const result = await providerChat(
      provider.type as AiProviderType,
      provider.baseUrl,
      provider.apiKeyEncrypted ? this.encryption.decrypt(provider.apiKeyEncrypted) : null,
      provider.defaultModel as string,
      [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ] as AiChatMessage[],
      MAX_TOKEN_SPEND
    )

    const parsed = parseAiOutput(result.reply)
    const rawTickets = Array.isArray(parsed.tickets) ? parsed.tickets : null
    if (!rawTickets) {
      throw new BadRequestException("The AI returned an unexpected shape — please rerun the planner")
    }
    const tickets = rawTickets
      .map((raw) => this.normalizeTicket(raw))
      .filter((t): t is PlannedTicket => t !== null)
    if (tickets.length === 0) {
      throw new BadRequestException("The AI did not return any usable tickets — please rerun the planner")
    }
    this.logger.log(`AI generated ${tickets.length} tickets via ${provider.name} (${provider.defaultModel})`)
    return tickets.slice(0, MAX_TICKETS)
  }

  private normalizeTicket(raw: unknown): PlannedTicket | null {
    if (typeof raw !== "object" || raw === null) return null
    const o = raw as Record<string, unknown>
    const title = String(o.title ?? "").trim().slice(0, 200)
    if (!title) return null

    const type = (String(o.type ?? "").toUpperCase() as TaskType)
    const priority = (String(o.priority ?? "").toUpperCase() as TaskPriority)
    const pts = Number(o.storyPoints)
    const storyPoints = Number.isFinite(pts) && POINTS.has(Math.round(pts)) ? Math.round(pts) : null
    const epic = typeof o.epic === "string" && o.epic.trim() ? o.epic.trim().slice(0, 80) : null
    const description = typeof o.description === "string" ? o.description.trim().slice(0, 4000) : ""

    return {
      title,
      description,
      type: TASK_TYPES.has(type) ? type : TaskType.STORY,
      priority: PRIORITIES.has(priority) ? priority : TaskPriority.MEDIUM,
      storyPoints,
      epic,
    }
  }

  private generateFromHeuristics(text: string): PlannedTicket[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const isHeading = (line: string) =>
      /^#{1,6}\s+/.test(line) ||
      /^\d{1,2}[.)]\s+\S/.test(line) ||
      /^[IVX]+[.)]\s+\S/.test(line) ||
      /^[A-Z\u0600-\u06FF][A-Z0-9\u0600-\u06FF \t'-]{4,}$/.test(line) && line.length <= 90

    const tickets: PlannedTicket[] = []
    let epic: string | null = null
    let current: PlannedTicket | null = null

    for (const line of lines) {
      if (isHeading(line)) {
        epic = line.replace(/^#{1,6}\s*/, "").replace(/^[\dIVX]+[.)]\s*/, "").slice(0, 80)
        current = null
        continue
      }
      const bullet = /^(?:[-*•▪o]|\d{1,3}[.)])\s+/.test(line)
      if (bullet && line.length >= 10) {
        if (current) current = null
        const title = line.replace(/^(?:[-*•▪o]|\d{1,3}[.)])\s+/, "").slice(0, 140)
        tickets.push({
          title,
          description: "",
          type: "STORY",
          priority: "MEDIUM",
          storyPoints: 3,
          epic,
        })
        continue
      }
      if (line.length < 12) continue
      if (current) {
        const clean = line.replace(/^[-*•▪o]\s*/, "")
        current.description = current.description
          ? `${current.description}\n• ${clean}`.slice(0, 1200)
          : clean.slice(0, 1200)
      } else {
        current = {
          title: line.slice(0, 140),
          description: "",
          type: "TASK",
          priority: "MEDIUM",
          storyPoints: 3,
          epic,
        }
        tickets.push(current)
      }
    }

    const dedup: PlannedTicket[] = []
    const seen = new Set<string>()
    for (const t of tickets) {
      const key = t.title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      dedup.push(t)
    }
    return dedup.slice(0, MAX_TICKETS)
  }
}