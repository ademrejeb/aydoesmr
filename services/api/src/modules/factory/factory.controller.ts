import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { OrgRole } from "@prisma/client"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgGuard } from "../../common/guards/org.guard"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import {
  AutomationDecisionDto,
  ClassifyIssueDto,
  CreateAgentProfileDto,
  CreateFactoryRunDto,
  FactoryDecisionDto,
  FactoryReviewDto,
  GeneratePlanDto,
  UpdateAgentProfileDto,
} from "./dto"
import { FactoryService } from "./factory.service"

@Controller("organizations/:id/factory")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class FactoryController {
  constructor(private readonly factory: FactoryService) {}

  // ------------------------------ agents ------------------------------ //

  @Get("agents")
  listAgents(@Param("id") orgId: string) {
    return this.factory.listProfiles(orgId)
  }

  @Post("agents")
  @MinRole(OrgRole.MANAGER)
  createAgent(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateAgentProfileDto) {
    return this.factory.createProfile(orgId, user.id, dto)
  }

  @Patch("agents/:profileId")
  @MinRole(OrgRole.MANAGER)
  updateAgent(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("profileId") profileId: string,
    @Body() dto: UpdateAgentProfileDto
  ) {
    return this.factory.updateProfile(orgId, user.id, profileId, dto)
  }

  @Delete("agents/:profileId")
  @MinRole(OrgRole.MANAGER)
  removeAgent(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("profileId") profileId: string) {
    return this.factory.removeProfile(orgId, user.id, profileId)
  }

  // ------------------------------ runs -------------------------------- //

  @Get("runs")
  listRuns(
    @Param("id") orgId: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string
  ) {
    return this.factory.listRuns(orgId, status, limit ? parseInt(limit, 10) : 50)
  }

  @Post("runs")
  createRun(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateFactoryRunDto) {
    return this.factory.createRun(orgId, user.id, dto)
  }

  @Get("runs/:runId")
  getRun(@Param("id") orgId: string, @Param("runId") runId: string) {
    return this.factory.getRun(orgId, runId)
  }

  @Post("runs/:runId/plan")
  plan(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("runId") runId: string,
    @Body() dto: GeneratePlanDto
  ) {
    return this.factory.generatePlan(orgId, user.id, runId, dto)
  }

  @Post("runs/:runId/approve")
  @MinRole(OrgRole.MANAGER)
  approve(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("runId") runId: string,
    @Body() dto: FactoryDecisionDto
  ) {
    return this.factory.approve(orgId, user.id, runId, dto)
  }

  @Post("runs/:runId/execute")
  execute(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("runId") runId: string) {
    return this.factory.execute(orgId, user.id, runId)
  }

  @Post("runs/:runId/review")
  @MinRole(OrgRole.MANAGER)
  review(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("runId") runId: string,
    @Body() dto: FactoryReviewDto
  ) {
    return this.factory.review(orgId, user.id, runId, dto)
  }

  @Post("runs/:runId/merge")
  @MinRole(OrgRole.MANAGER)
  merge(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("runId") runId: string) {
    return this.factory.merge(orgId, user.id, runId)
  }

  @Post("runs/:runId/cancel")
  cancel(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("runId") runId: string) {
    return this.factory.cancel(orgId, user.id, runId)
  }

  @Get("stats")
  stats(@Param("id") orgId: string) {
    return this.factory.stats(orgId)
  }

  @Get("approvals")
  pendingApprovals(@Param("id") orgId: string) {
    return this.factory.pendingApprovals(orgId)
  }

  @Get("pull-requests")
  pullRequests(@Param("id") orgId: string, @Query("status") status?: string) {
    return this.factory.listPullRequests(orgId, status)
  }

  @Get("runs/:runId/pull-request")
  pullRequest(@Param("id") orgId: string, @Param("runId") runId: string) {
    return this.factory.getPullRequest(orgId, runId)
  }

  @Get("automation")
  automation(@Param("id") orgId: string, @CurrentUser() user: AuthUser) {
    return this.factory.automationOpportunities(orgId, user.id)
  }

  @Post("automation/:proposalId/decision")
  @MinRole(OrgRole.MANAGER)
  decideAutomation(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("proposalId") proposalId: string,
    @Body() dto: AutomationDecisionDto
  ) {
    return this.factory.decideAutomation(orgId, user.id, proposalId, dto)
  }

  // ----------------------------- issues ------------------------------- //

  @Get("issues/:taskId/profile")
  issueProfile(@Param("id") orgId: string, @Param("taskId") taskId: string) {
    return this.factory.getTaskProfile(orgId, taskId)
  }

  @Post("issues/:taskId/classify")
  classify(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("taskId") taskId: string,
    @Body() dto: ClassifyIssueDto
  ) {
    return this.factory.classifyTask(orgId, taskId, user.id, dto.useAi === true)
  }
}
