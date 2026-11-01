import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common"
import { TeamsService } from "./teams.service"
import { AddTeamMemberDto, CreateTeamDto } from "./dto"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgRole } from "@prisma/client"

@Controller("organizations/:id/teams")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  @MinRole(OrgRole.MANAGER)
  create(@Param("id") orgId: string, @Body() dto: CreateTeamDto) {
    return this.teams.create(orgId, dto)
  }

  @Get()
  list(@Param("id") orgId: string) {
    return this.teams.list(orgId)
  }

  @Get(":teamId")
  get(@Param("teamId") teamId: string) {
    return this.teams.getById(teamId)
  }

  @Post(":teamId/members")
  @MinRole(OrgRole.MANAGER)
  addMember(@Param("teamId") teamId: string, @Body() dto: AddTeamMemberDto) {
    return this.teams.addMember(teamId, dto.userId, dto.role)
  }

  @Delete(":teamId/members/:userId")
  @MinRole(OrgRole.MANAGER)
  removeMember(@Param("teamId") teamId: string, @Param("userId") userId: string) {
    return this.teams.removeMember(teamId, userId)
  }
}