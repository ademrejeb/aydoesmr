import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { PrismaService } from "../../prisma/prisma.service"
import { CreateCommentDto, CreateTaskDto, UpdateTaskDto } from "./dto"
import { NotificationType, TaskPriority, TaskType } from "@prisma/client"
import { NotificationsService } from "../notifications/notifications.service"
import { AgileService } from "../agile/agile.service"

export const TASK_INCLUDE = {
  assignee: { select: { id: true, fullName: true, avatarUrl: true } },
  reporter: { select: { id: true, fullName: true, avatarUrl: true } },
  epic: { select: { id: true, title: true, type: true } },
  subtasks: { select: { id: true, title: true, status: true, type: true } },
  _count: { select: { comments: true } },
} as const

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
    private readonly agile: AgileService
  ) {}

  private emitTaskEvent(task: { id: string; projectId: string; organizationId: string; status: string; assigneeId: string | null }) {
    this.events.emit("task.updated", {
      id: task.id,
      projectId: task.projectId,
      organizationId: task.organizationId,
      status: task.status,
      assigneeId: task.assigneeId,
    })
  }

  async createTask(
    organizationId: string,
    projectId: string,
    actorId: string,
    dto: CreateTaskDto
  ) {
    if (dto.parentId) {
      const parent = await this.prisma.task.findFirst({ where: { id: dto.parentId, projectId } })
      if (!parent) throw new BadRequestException("Parent task does not exist in this project")
    }
    if (dto.epicId) {
      const epic = await this.prisma.task.findFirst({
        where: { id: dto.epicId, projectId, type: "EPIC" },
      })
      if (!epic) throw new BadRequestException("Epic does not exist in this project")
    }
    if (dto.sprintId) {
      const sprint = await this.prisma.sprint.findFirst({ where: { id: dto.sprintId, projectId } })
      if (!sprint) throw new BadRequestException("Sprint does not belong to this project")
    }
    if (dto.assigneeId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: { organizationId, userId: dto.assigneeId },
      })
      if (!member) throw new BadRequestException("Assignee is not a member of this organization")
    }

    let columnId: string | null | undefined = dto.columnId
    let status = dto.status
    if (columnId) {
      const workflow = await this.agile.ensureWorkflow(organizationId, projectId)
      const column = await this.prisma.workflowColumn.findFirst({
        where: { id: columnId, workflowId: workflow.id },
      })
      if (!column) throw new BadRequestException("Column does not belong to this project")
      if (!status) status = column.status
    }
    if (!status) status = "TODO"
    if (!columnId) {
      const workflow = await this.agile.ensureWorkflow(organizationId, projectId)
      const fallback = await this.prisma.workflowColumn.findFirst({
        where: { workflowId: workflow.id, position: 0 },
      })
      if (fallback) {
        columnId = fallback.id
        if (!dto.status) status = fallback.status
      }
    }

    const order = await this.prisma.task.count({ where: { projectId, columnId } })

    const task = await this.prisma.task.create({
      data: {
        organizationId,
        projectId,
        reporterId: actorId,
        title: dto.title,
        description: dto.description ?? undefined,
        type: (dto.type ?? "TASK") as TaskType,
        status,
        priority: (dto.priority ?? "MEDIUM") as TaskPriority,
        assigneeId: dto.assigneeId,
        columnId,
        sprintId: dto.sprintId,
        epicId: dto.epicId,
        parentId: dto.parentId,
        storyPoints: dto.storyPoints,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        estimateHours: dto.estimateHours,
        order,
      },
      include: { ...TASK_INCLUDE },
    })

    if (task.assigneeId) {
      await this.notifications.create(
        organizationId,
        task.assigneeId,
        NotificationType.TASK_ASSIGNED,
        "New task assigned",
        `You were assigned: ${task.title}`,
        `/projects/${projectId}/tasks/${task.id}`
      )
    }

    this.events.emit("task.created", { id: task.id, organizationId, projectId })
    this.emitTaskEvent(task)
    return task
  }

  async listTasks(
    organizationId: string,
    projectId: string,
    filters: { status?: string; assigneeId?: string; sprintId?: string; type?: string; epicId?: string; teamId?: string }
  ) {
    const where: Record<string, unknown> = { organizationId, projectId }

    // Filter to org members of the team when teamId provided
    let memberIds: string[] | undefined
    if (filters.teamId) {
      const teamMemberRows = await this.prisma.teamMember.findMany({
        where: { teamId: filters.teamId },
        select: { userId: true },
      })
      memberIds = teamMemberRows.map((r) => r.userId)
      where.assigneeId = { in: memberIds }
    } else if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId
    }

    if (filters.status) where.status = filters.status
    if (filters.sprintId) where.sprintId = filters.sprintId
    if (filters.type) where.type = filters.type
    if (filters.epicId) where.epicId = filters.epicId

    return this.prisma.task.findMany({
      where,
      include: { ...TASK_INCLUDE },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    })
  }

  async updateTask(organizationId: string, projectId: string, taskId: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findFirst({ where: { id: taskId, projectId } })
    if (!existing) throw new NotFoundException("Task not found")

    const data: Record<string, unknown> = { ...dto }
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null
    if (dto.description !== undefined) data.description = dto.description
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId
    if (dto.sprintId !== undefined) data.sprintId = dto.sprintId
    if (dto.epicId !== undefined) data.epicId = dto.epicId

    if (dto.columnId !== undefined && dto.columnId) {
      const workflow = await this.agile.ensureWorkflow(organizationId, projectId)
      const column = await this.prisma.workflowColumn.findFirst({
        where: { id: dto.columnId, workflowId: workflow.id },
      })
      if (!column) throw new BadRequestException("Column does not belong to this project")
      data.columnId = column.id
      if (!dto.status) data.status = column.status
    } else if (dto.columnId === null) {
      data.columnId = null
    }

    if (dto.status !== undefined) {
      data.status = dto.status
      const doneCol = dto.status.toUpperCase() === "DONE"
      data.completedAt = doneCol ? (existing.completedAt ?? new Date()) : null
      data.startedAt = !doneCol && existing.completedAt ? null : existing.startedAt
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data,
      include: { ...TASK_INCLUDE },
    })

    this.events.emit("task.created", { id: task.id, organizationId, projectId })
    this.emitTaskEvent(task)
    return task
  }

  async addComment(
    organizationId: string,
    taskId: string,
    authorId: string,
    dto: CreateCommentDto
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: { select: { id: true } } },
    })
    if (!task) throw new NotFoundException("Task not found")

    const comment = await this.prisma.comment.create({
      data: { organizationId, taskId, authorId, body: dto.body },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    })

    if (task.assignee && task.assignee.id !== authorId) {
      await this.notifications.create(
        organizationId,
        task.assignee.id,
        NotificationType.COMMENT,
        "New comment on your task",
        dto.body.slice(0, 140),
        `/projects/${task.projectId}/tasks/${task.id}`
      )
    }

    return comment
  }

  async listComments(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    })
  }
}