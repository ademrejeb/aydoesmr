import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common"
import { DevelopmentService } from "./development.service"
import { AnalyzeCodeDto, CreateRepositoryDto, QueryIssuesDto, ScanRepositoryDto, UpdateRepositoryDto } from "./dto"
import { OrgGuard } from "../../common/guards/org.guard"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole, Public } from "../../common/decorators/roles.decorator"
import { OrgRole } from "@prisma/client"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"

@Controller("organizations/:id/dev")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class DevelopmentController {
  constructor(private readonly development: DevelopmentService) {}

  @Post("analyze")
  analyze(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AnalyzeCodeDto
  ) {
    return this.development.analyzeCode(orgId, user.id, dto)
  }

  @Get("scans")
  scans(@Param("id") orgId: string, @Query("projectId") projectId?: string) {
    return this.development.listScans(orgId, projectId)
  }

  @Get("scans/:scanId")
  scan(@Param("scanId") scanId: string) {
    return this.development.getScan(scanId)
  }

  @Get("issues")
  issues(
    @Param("id") orgId: string,
    @Query() query: QueryIssuesDto
  ) {
    return this.development.listIssues(orgId, {
      severity: query.severity,
      category: query.category,
      isFixed: query.isFixed,
      projectId: query["projectId"],
      ruleId: query["ruleId"],
      ruleIds: query["ruleIds"],
      scanId: query["scanId"],
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    })
  }

  /** Dashboard aggregates: open/fixed totals, severity split, top rules. */
  @Get("stats")
  stats(@Param("id") orgId: string, @Query("projectId") projectId?: string) {
    return this.development.getStats(orgId, projectId)
  }

  /** Mark an issue as fixed / reopen it (recomputes the scan debt score). */
  @Patch("issues/:issueId")
  updateIssue(
    @Param("id") orgId: string,
    @Param("issueId") issueId: string,
    @Body() body: { isFixed?: boolean }
  ) {
    return this.development.setIssueFixed(orgId, issueId, body?.isFixed !== false)
  }

  // ------------------------------------------------ //
  //  Git repositories                                 //
  // ------------------------------------------------ //

  @Get("repositories")
  repositories(@Param("id") orgId: string, @Query("projectId") projectId?: string) {
    return this.development.listRepositories(orgId, projectId)
  }

  @Get("repositories/:repositoryId")
  repository(@Param("id") orgId: string, @Param("repositoryId") repositoryId: string) {
    return this.development.getRepository(orgId, repositoryId)
  }

  @Post("repositories")
  createRepository(
    @Param("id") orgId: string,
    @Body() dto: CreateRepositoryDto
  ) {
    return this.development.createRepository(orgId, dto)
  }

  @Patch("repositories/:repositoryId")
  @MinRole(OrgRole.MANAGER)
  updateRepository(
    @Param("id") orgId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() dto: UpdateRepositoryDto
  ) {
    return this.development.updateRepository(orgId, repositoryId, dto)
  }

  @Delete("repositories/:repositoryId")
  @MinRole(OrgRole.MANAGER)
  deleteRepository(@Param("id") orgId: string, @Param("repositoryId") repositoryId: string) {
    return this.development.deleteRepository(orgId, repositoryId)
  }

  @Post("repositories/:repositoryId/scan")
  scanRepository(
    @Param("id") orgId: string,
    @Param("repositoryId") repositoryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ScanRepositoryDto
  ) {
    return this.development.scanRepository(orgId, repositoryId, user.id, dto.branch)
  }

  @Get("rules")
  rules(@Param("id") orgId: string, @Query("projectId") projectId?: string) {
    return this.development.getRulesCatalog(orgId, projectId)
  }

  @Get("analysis-config")
  analysisConfig(
    @Param("id") orgId: string,
    @Query("projectId") projectId?: string
  ) {
    return this.development.getAnalysisConfig(orgId, projectId)
  }

  @Put("analysis-config")
  @MinRole(OrgRole.MANAGER)
  setAnalysisConfig(
    @Param("id") orgId: string,
    @Body() body: { projectId?: string | null; config: Record<string, unknown> }
  ) {
    return this.development.setAnalysisConfig(orgId, body.projectId ?? null, body.config)
  }

  @Get("debt")
  debt(@Param("id") orgId: string, @Query("projectId") projectId?: string) {
    return this.development.getDebtTrend(orgId, projectId)
  }

  @Post("issues/:issueId/explain")
  explain(
    @Param("id") orgId: string,
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.development.explainIssue(orgId, user.id, issueId)
  }

  @Post("issues/:issueId/tasks")
  triage(
    @Param("id") orgId: string,
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { projectId: string; assigneeId?: string; title?: string }
  ) {
    return this.development.triageIssueToTask(
      orgId,
      issueId,
      user.id,
      body.projectId,
      body.assigneeId,
      body.title
    )
  }
}

/** Public webhook receiver for Git providers (Github/GitLab/Bitbucket). */
@Controller("webhooks/git")
export class GitWebhookController {
  constructor(private readonly development: DevelopmentService) {}

  @Public()
  @Post(":repositoryId")
  push(
    @Param("repositoryId") repositoryId: string,
    @Headers("x-webhook-secret") headerSecret: string | undefined,
    @Query("secret") querySecret: string | undefined,
    @Body() payload: unknown
  ) {
    return this.development.handlePushWebhook(repositoryId, headerSecret || querySecret, payload)
  }
}