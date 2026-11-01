import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common"
import { ProjectsService } from "./projects.service"
import { CreateProjectDto, UpdateProjectDto } from "./dto"
import { LinkTeamDto } from "../agile/dto"
import { OrgGuard } from "../../common/guards/org.guard"
import { CurrentOrg, CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgRole } from "@prisma/client"
import type { AuthUser, OrgContext } from "../../common/interfaces/authenticated-request.interface"

@Controller("organizations/:id/projects")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @MinRole(OrgRole.MANAGER)
  create(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto
  ) {
    return this.projects.create(orgId, user.id, dto)
  }

  @Get()
  list(@Param("id") orgId: string) {
    return this.projects.list(orgId)
  }

  @Get(":projectId")
  get(@Param("projectId") projectId: string, @CurrentOrg() org: OrgContext) {
    return this.projects.getById(org.organizationId, projectId)
  }

  @Patch(":projectId")
  @MinRole(OrgRole.MANAGER)
  update(@Param("projectId") projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(projectId, dto)
  }

  @Post(":projectId/teams")
  @MinRole(OrgRole.MANAGER)
  linkTeam(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Body() dto: LinkTeamDto
  ) {
    return this.projects.linkTeam(orgId, projectId, dto.teamId)
  }

  @Delete(":projectId/teams/:teamId")
  @MinRole(OrgRole.MANAGER)
  unlinkTeam(@Param("projectId") projectId: string, @Param("teamId") teamId: string) {
    return this.projects.unlinkTeam(projectId, teamId)
  }
}