import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"
import { CreateTeamDto } from "./dto"

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        departmentId: dto.departmentId,
      },
    })
  }

  async list(organizationId: string) {
    return this.prisma.team.findMany({
      where: { organizationId },
      include: {
        _count: { select: { members: true } },
        members: {
          take: 10,
          select: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
            role: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  }

  async getById(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          select: {
            user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
            role: true,
          },
        },
        department: true,
      },
    })
    if (!team) throw new NotFoundException("Team not found")
    return team
  }

  async addMember(teamId: string, userId: string, role = "member") {
    return this.prisma.teamMember.create({
      data: { teamId, userId, role },
    })
  }

  async removeMember(teamId: string, userId: string) {
    return this.prisma.teamMember.deleteMany({
      where: { teamId, userId },
    })
  }
}