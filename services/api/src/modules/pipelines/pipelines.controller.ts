import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { OrgRole } from "@prisma/client"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { PipelinesService } from "./pipelines.service"
import { CreatePipelineDto, TriggerRunDto, UpdatePipelineDto } from "./dto"

/** CI/CD pipeline management and run endpoints. */
@Controller("organizations/:id/pipelines")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get()
  list(@Param("id") orgId: string) {
    return this.pipelines.list(orgId)
  }

  @Post()
  @MinRole(OrgRole.MANAGER)
  create(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreatePipelineDto) {
    return this.pipelines.create(orgId, user.id, dto)
  }

  @Get("runs/:runId")
  runDetail(@Param("id") orgId: string, @Param("runId") runId: string) {
    return this.pipelines.runDetail(orgId, runId)
  }

  @Post("runs/:runId/cancel")
  cancel(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("runId") runId: string) {
    return this.pipelines.cancel(orgId, user.id, runId)
  }

  @Get(":pipelineId")
  get(@Param("id") orgId: string, @Param("pipelineId") pipelineId: string) {
    return this.pipelines.get(orgId, pipelineId)
  }

  @Get(":pipelineId/runs")
  runs(@Param("id") orgId: string, @Param("pipelineId") pipelineId: string) {
    return this.pipelines.runs(orgId, pipelineId)
  }

  @Patch(":pipelineId")
  @MinRole(OrgRole.MANAGER)
  update(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("pipelineId") pipelineId: string,
    @Body() dto: UpdatePipelineDto
  ) {
    return this.pipelines.update(orgId, user.id, pipelineId, dto)
  }

  @Delete(":pipelineId")
  @MinRole(OrgRole.MANAGER)
  remove(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("pipelineId") pipelineId: string) {
    return this.pipelines.remove(orgId, user.id, pipelineId)
  }

  @Post(":pipelineId/run")
  trigger(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("pipelineId") pipelineId: string,
    @Body() dto: TriggerRunDto
  ) {
    return this.pipelines.trigger(orgId, user.id, pipelineId, dto)
  }
}