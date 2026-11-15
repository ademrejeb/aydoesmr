import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { OrgRole } from "@prisma/client"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgGuard } from "../../common/guards/org.guard"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { AgentFactoryService } from "./agent-factory.service"
import { CreateAgentConnectionDto, RunAgentDto, UpdateAgentConnectionDto } from "./dto"

@Controller("organizations/:id/agent-factory")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class AgentFactoryController {
  constructor(private readonly service: AgentFactoryService) {}

  @Get("connections")
  list(@Param("id") orgId: string) {
    return this.service.list(orgId)
  }

  @Post("connections")
  @MinRole(OrgRole.MANAGER)
  create(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateAgentConnectionDto) {
    return this.service.create(orgId, user.id, dto)
  }

  @Patch("connections/:connectionId")
  @MinRole(OrgRole.MANAGER)
  update(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("connectionId") connectionId: string,
    @Body() dto: UpdateAgentConnectionDto
  ) {
    return this.service.update(orgId, user.id, connectionId, dto)
  }

  @Delete("connections/:connectionId")
  @MinRole(OrgRole.MANAGER)
  remove(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("connectionId") connectionId: string) {
    return this.service.remove(orgId, user.id, connectionId)
  }

  @Post("connections/:connectionId/test")
  @MinRole(OrgRole.MANAGER)
  test(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("connectionId") connectionId: string) {
    return this.service.test(orgId, user.id, connectionId)
  }

  @Post("connections/:connectionId/run")
  run(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("connectionId") connectionId: string,
    @Body() dto: RunAgentDto
  ) {
    return this.service.run(orgId, user.id, connectionId, dto)
  }

  @Get("runs")
  runs(
    @Param("id") orgId: string,
    @Query("connectionId") connectionId?: string
  ) {
    return this.service.listRuns(orgId, connectionId)
  }
}
