import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { PrismaService } from "../../prisma/prisma.service"
import { CreateSprintDto, SaveWorkflowDto, SprintStatusDto, UpdateSprintDto } from "./dto"
import { SprintStatus } from "@prisma/client"

export const DEFAULT_WORKFLOW_COLUMNS = [
  { name: "Backlog", status: "BACKLOG", isBacklog: true, color: "#64748b", position: 0 },
  { name: "To Do", status: "TODO", color: "#2563eb", position: 1 },
  { name: "In Progress", status: "IN_PROGRESS", color: "#f59e0b", position: 2 },
  { name: "In Review", status: "IN_REVIEW", color: "#8b5cf6", position: 3 },
  { name: "Done", status: "DONE", color: "#22c55e", position: 4 },
]

const TASK_INCLUDE = {
  assignee: { select: { id: true, fullName: true, avatarUrl: true } },
  reporter: { select: { id: true, fullName: true, avatarUrl: true } },
  epic: { select: { id: true, title: true, type: true } },
  subtasks: { select: { id: true, title: true, status: true, type: true } },
  _count: { select: { comments: true } },
} as const

export interface AgileSnapshot {
  project: { id: string; name: string; key: string | null; color: string; type: string; status: string; dueDate: Date | null; description: string | null }
  workflow: {
    id: string
    name: string
    method: string
    columns: {
      id: string
      name: string
      status: string
      color: string | null
      wipLimit: number | null
      isBacklog: boolean
      position: number
      tasks: unknown[]
    }[]
  }
  sprints: {
    id: string
    name: string
    goal: string | null
    status: string
    startDate: Date | null
    endDate: Date | null
    completedAt: Date | null
    team: { id: string; name: string } | null
    points: number
    tasks: unknown[]
  }[]
  backlog: unknown[]
  epics: { id: string; title: string; storyPoints: number | null }[]
  teams: { id: string; name: string; members: { userId: string; role: string; user: { id: string; fullName: string | null; avatarUrl: string | null } }[] }[]
}

@Injectable()
export class AgileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2
  ) {}

  async ensureWorkflow(organizationId: string, projectId: string) {
    const existing = await this.prisma.workflow.findFirst({
      where: { projectId, isActive: true },
    })
    if (existing) return existing

    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException("Project not found")

    return this.prisma.workflow.create({
      data: {
        organizationId,
        projectId,
        name: "Board",
        method: project.type === "ENGINEERING" ? "scrum" : "kanban",
        columns: { create: DEFAULT_WORKFLOW_COLUMNS },
      },
    })
  }

  async snapshot(organizationId: string, projectId: string): Promise<AgileSnapshot> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: {
        id: true, name: true, key: true, color: true, type: true, status: true,
        dueDate: true, description: true,
      },
    })
    if (!project) throw new NotFoundException("Project not found")

    await this.ensureWorkflow(organizationId, projectId)

    const [workflow, sprints, backlogTasks, epics, teams] = await Promise.all([
      this.prisma.workflow.findFirst({
        where: { projectId, isActive: true },
        include: {
          columns: {
            orderBy: { position: "asc" },
            include: { tasks: { orderBy: { order: "asc" }, include: { ...TASK_INCLUDE } } },
          },
        },
      }),
      this.prisma.sprint.findMany({
        where: { projectId },
        orderBy: [
          { status: "asc" },
          { createdAt: "desc" },
        ],
        include: {
          team: { select: { id: true, name: true } },
          tasks: { orderBy: { order: "asc" }, include: { ...TASK_INCLUDE } },
        },
      }),
      this.prisma.task.findMany({
        where: {
          projectId,
          sprintId: null,
          OR: [{ columnId: null }, { column: { isBacklog: true } }],
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: { ...TASK_INCLUDE },
      }),
      this.prisma.task.findMany({
        where: { projectId, type: "EPIC" },
        select: { id: true, title: true, storyPoints: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.projectTeam.findMany({
        where: { projectId },
        include: {
          team: {
            include: {
              members: {
                include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
              },
            },
          },
        },
      }),
    ])

    return {
      project,
      workflow: workflow ?? {
        id: "",
        name: "Board",
        method: "kanban",
        columns: [],
      },
      sprints: sprints.map((s) => ({
        id: s.id,
        name: s.name,
        goal: s.goal,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        completedAt: s.completedAt,
        team: s.team,
        points: (s.tasks as { storyPoints: number | null }[]).reduce((acc, t) => acc + (t.storyPoints ?? 0), 0),
        tasks: s.tasks,
      })),
      backlog: backlogTasks,
      epics,
      teams: teams.map((pt) => ({
        id: pt.team.id,
        name: pt.team.name,
        members: pt.team.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          user: m.user,
        })),
      })),
    }
  }

  async saveWorkflow(organizationId: string, projectId: string, dto: SaveWorkflowDto) {
    await this.ensureWorkflow(organizationId, projectId)
    const workflow = await this.prisma.workflow.findFirst({ where: { projectId, isActive: true } })
    if (!workflow) throw new NotFoundException("Workflow not found")

    const existingColumns = await this.prisma.workflowColumn.findMany({ where: { workflowId: workflow.id } })
    const existingById = new Map(existingColumns.map((c) => [c.id, c]))

    const names = new Set<string>()
    for (const c of dto.columns) {
      const key = c.name.trim().toLowerCase()
      if (names.has(key)) throw new BadRequestException(`Duplicate column name: ${c.name}`)
      names.add(key)
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const newColumns: { id: string }[] = []
      const keepIds: string[] = []

      for (let i = 0; i < dto.columns.length; i++) {
        const input = dto.columns[i]
        const position = i
        if (input.id && existingById.has(input.id)) {
          keepIds.push(input.id)
          await tx.workflowColumn.update({
            where: { id: input.id },
            data: {
              name: input.name.trim(),
              status: input.status.trim(),
              color: input.color || null,
              wipLimit: input.wipLimit ?? null,
              isBacklog: input.isBacklog ?? false,
              position,
            },
          })
          newColumns.push({ id: input.id })
        } else {
          const created = await tx.workflowColumn.create({
            data: {
              workflowId: workflow.id,
              name: input.name.trim(),
              status: input.status.trim(),
              color: input.color || null,
              wipLimit: input.wipLimit ?? null,
              isBacklog: input.isBacklog ?? false,
              position,
            },
          })
          newColumns.push({ id: created.id })
        }
      }

      const keepSet = new Set(keepIds)
      const removed = existingColumns.filter((c) => !keepSet.has(c.id))
      for (const col of removed) {
        // Tasks in a removed column lose their column but keep their current status.
        await tx.task.updateMany({ where: { columnId: col.id }, data: { columnId: null } })
        await tx.workflowColumn.delete({ where: { id: col.id } })
      }

      await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          name: dto.name?.trim() || workflow.name,
          method: dto.method?.trim() || workflow.method,
        },
      })

      return tx.workflow.findUnique({
        where: { id: workflow.id },
        include: { columns: { orderBy: { position: "asc" } } },
      })
    })

    this.events.emit("workflow.updated", { projectId, organizationId })
    return result
  }

  async listSprints(projectId: string) {
    return this.prisma.sprint.findMany({
      where: { projectId },
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    })
  }

  async createSprint(organizationId: string, projectId: string, dto: CreateSprintDto) {
    const sprint = await this.prisma.sprint.create({
      data: {
        organizationId,
        projectId,
        name: dto.name.trim(),
        goal: dto.goal ?? null,
        teamId: dto.teamId ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: (dto.status as SprintStatus) ?? SprintStatus.PLANNING,
      },
      include: { team: { select: { id: true, name: true } } },
    })
    this.events.emit("sprint.updated", { projectId, organizationId })
    return sprint
  }

  async updateSprint(organizationId: string, projectId: string, sprintId: string, dto: UpdateSprintDto) {
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, projectId } })
    if (!sprint) throw new NotFoundException("Sprint not found")
    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        name: dto.name?.trim(),
        goal: dto.goal,
        teamId: dto.teamId === undefined ? undefined : dto.teamId,
        startDate: dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined,
      },
      include: { team: { select: { id: true, name: true } } },
    })
    this.events.emit("sprint.updated", { projectId, organizationId })
    return updated
  }

  async setSprintStatus(organizationId: string, projectId: string, sprintId: string, dto: SprintStatusDto) {
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, projectId } })
    if (!sprint) throw new NotFoundException("Sprint not found")

    if (dto.status === "ACTIVE") {
      const sameScope = await this.prisma.sprint.findFirst({
        where: { projectId, teamId: sprint.teamId, status: "ACTIVE", id: { not: sprintId } },
      })
      if (sameScope) {
        throw new BadRequestException("Another sprint is already active for this team/scope")
      }
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: dto.status as SprintStatus,
        completedAt: dto.status === "COMPLETED" ? new Date() : null,
        startDate: dto.status === "ACTIVE" ? (sprint.startDate ?? new Date()) : sprint.startDate,
      },
      include: { team: { select: { id: true, name: true } } },
    })
    this.events.emit("sprint.updated", { projectId, organizationId })
    return updated
  }

  async deleteSprint(organizationId: string, projectId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, projectId } })
    if (!sprint) throw new NotFoundException("Sprint not found")
    const deleted = await this.prisma.sprint.delete({ where: { id: sprintId } })
    this.events.emit("sprint.updated", { projectId, organizationId })
    return deleted
  }

  async moveTask(organizationId: string, projectId: string, taskId: string, columnId: string, index: number) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId } })
    if (!task) throw new NotFoundException("Task not found")

    const workflow = await this.ensureWorkflow(organizationId, projectId)
    const column = await this.prisma.workflowColumn.findFirst({
      where: { id: columnId, workflowId: workflow.id },
    })
    if (!column) throw new BadRequestException("Column does not belong to this project's workflow")
    if (column.wipLimit && column.status !== task.status) {
      const current = await this.prisma.task.count({ where: { columnId } })
      const movingOut = task.columnId === columnId ? 0 : 1
      if (current - movingOut + 1 > column.wipLimit) {
        throw new BadRequestException(`WIP limit of ${column.wipLimit} reached for "${column.name}"`)
      }
    }

    const peers = await this.prisma.task.findMany({
      where: { projectId, columnId, id: { not: taskId } },
      orderBy: { order: "asc" },
      select: { id: true },
    })

    const clamped = Math.max(0, Math.min(index, peers.length))
    const ordered = [...peers.slice(0, clamped), { id: taskId }, ...peers.slice(clamped)]

    await this.prisma.$transaction([
      ...ordered.map((t, i) =>
        this.prisma.task.update({
          where: { id: t.id },
          data: {
            order: i,
            ...(t.id === taskId ? { columnId, status: column.status } : {}),
          },
        })
      ),
    ])

    this.events.emit("task.updated", {
      id: taskId,
      projectId,
      organizationId,
      status: column.status,
      assigneeId: task.assigneeId,
    })

    return { ok: true, columnId, status: column.status, order: clamped }
  }
}