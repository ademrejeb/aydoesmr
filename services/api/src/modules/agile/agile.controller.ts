import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common"
import { AgileService } from "./agile.service"
import { CreateSprintDto, SaveWorkflowDto, SprintStatusDto, UpdateSprintDto } from "./dto"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgRole } from "@prisma/client"

@Controller("organizations/:id/projects/:projectId/agile")
@UseGuards(OrgGuard)
export class AgileController {
  constructor(private readonly agile: AgileService) {}

  @Get()
  @MinRole(OrgRole.MEMBER)
  snapshot(@Param("id") orgId: string, @Param("projectId") projectId: string) {
    return this.agile.snapshot(orgId, projectId)
  }

  @Put("workflow")
  @MinRole(OrgRole.MANAGER)
  saveWorkflow(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Body() dto: SaveWorkflowDto
  ) {
    return this.agile.saveWorkflow(orgId, projectId, dto)
  }

  @Get("sprints")
  @MinRole(OrgRole.MEMBER)
  sprints(@Param("projectId") projectId: string) {
    return this.agile.listSprints(projectId)
  }

  @Post("sprints")
  @MinRole(OrgRole.MANAGER)
  createSprint(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Body() dto: CreateSprintDto
  ) {
    return this.agile.createSprint(orgId, projectId, dto)
  }

  @Patch("sprints/:sprintId")
  @MinRole(OrgRole.MANAGER)
  updateSprint(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Param("sprintId") sprintId: string,
    @Body() dto: UpdateSprintDto
  ) {
    return this.agile.updateSprint(orgId, projectId, sprintId, dto)
  }

  @Patch("sprints/:sprintId/status")
  @MinRole(OrgRole.MANAGER)
  sprintStatus(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Param("sprintId") sprintId: string,
    @Body() dto: SprintStatusDto
  ) {
    return this.agile.setSprintStatus(orgId, projectId, sprintId, dto)
  }

  @Delete("sprints/:sprintId")
  @MinRole(OrgRole.MANAGER)
  deleteSprint(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Param("sprintId") sprintId: string
  ) {
    return this.agile.deleteSprint(orgId, projectId, sprintId)
  }

  @Patch("tasks/:taskId/move")
  @MinRole(OrgRole.MEMBER)
  moveTask(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() dto: { columnId: string; index?: number }
  ) {
    return this.agile.moveTask(orgId, projectId, taskId, dto.columnId, dto.index ?? 0)
  }
}