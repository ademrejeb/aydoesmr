import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"
import { CreateProjectDto, UpdateProjectDto } from "./dto"
import { AgileService, DEFAULT_WORKFLOW_COLUMNS } from "../agile/agile.service"

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agile: AgileService
  ) {}

  async create(organizationId: string, ownerId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId,
          ownerId,
          name: dto.name,
          description: dto.description,
          key: dto.key,
          type: dto.type,
          visibility: dto.visibility,
          color: dto.color,
          repoUrl: dto.repoUrl,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        },
      })

      await tx.workflow.create({
        data: {
          organizationId,
          projectId: project.id,
          name: "Board",
          method: dto.type === "ENGINEERING" ? "scrum" : "kanban",
          columns: { create: DEFAULT_WORKFLOW_COLUMNS },
        },
      })

      return project
    })
  }

  async list(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        key: true,
        type: true,
        color: true,
        status: true,
        dueDate: true,
        visibility: true,
        createdAt: true,
        _count: { select: { tasks: true, workflows: true, repositories: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async getById(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { owner: { select: { id: true, fullName: true, avatarUrl: true, email: true } } },
    })
    if (!project) throw new NotFoundException("Project not found")

    const snapshot = await this.agile.snapshot(organizationId, projectId)
    return {
      ...snapshot,
      project: { ...snapshot.project, owner: project.owner },
    }
  }

  async update(projectId: string, dto: UpdateProjectDto) {
    const data: Record<string, unknown> = { ...dto }
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate)
    return this.prisma.project.update({
      where: { id: projectId },
      data,
    })
  }

  async linkTeam(organizationId: string, projectId: string, teamId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId } })
    if (!project) throw new NotFoundException("Project not found")
    const team = await this.prisma.team.findFirst({ where: { id: teamId, organizationId } })
    if (!team) throw new BadRequestException("Team not found in this organization")
    return this.prisma.projectTeam.upsert({
      where: { projectId_teamId: { projectId, teamId } },
      create: { projectId, teamId },
      update: {},
    })
  }

  async unlinkTeam(projectId: string, teamId: string) {
    const link = await this.prisma.projectTeam.findUnique({
      where: { projectId_teamId: { projectId, teamId } },
    })
    if (!link) throw new NotFoundException("Team is not linked to this project")
    return this.prisma.projectTeam.delete({ where: { projectId_teamId: { projectId, teamId } } })
  }
}