import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common"
import { OrgRole, ServiceEntityType, ServicePriority } from "@prisma/client"
import { OrgGuard } from "../../common/guards/org.guard"
import { CurrentOrg, CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole } from "../../common/decorators/roles.decorator"
import type { AuthUser, OrgContext } from "../../common/interfaces/authenticated-request.interface"
import { ServiceDeskService } from "./service-desk.service"
import {
  AddCommentDto,
  ArticleFeedbackDto,
  CreateArticleDto,
  CreateIncidentDto,
  CreateServiceItemDto,
  CreateServiceRequestDto,
  DecideRequestDto,
  IncidentStatusDto,
  ListIncidentsQueryDto,
  ListRequestsQueryDto,
  RateRequestDto,
  RequestStatusDto,
  UpdateArticleDto,
  UpdateIncidentDto,
  UpdateServiceItemDto,
  UpdateServiceRequestDto,
  UpdateSlaPolicyDto,
} from "./dto"

const toInt = (value?: string) => (value === undefined ? undefined : Number.parseInt(value, 10))

@Controller("organizations/:id/service-desk")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class ServiceDeskController {
  constructor(private readonly serviceDesk: ServiceDeskService) {}

  // ---------------------------- dashboard ---------------------------- //

  @Get("overview")
  overview(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser) {
    return this.serviceDesk.getOverview(org.organizationId, user.id)
  }

  /** Members that can own tickets — powers the assignee pickers. */
  @Get("agents")
  agents(@CurrentOrg() org: OrgContext) {
    return this.serviceDesk.listAgents(org.organizationId)
  }

  /** Signed-in agent's own workload. */
  @Get("queue")
  queue(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser) {
    return this.serviceDesk.getQueue(org.organizationId, user.id)
  }

  // ----------------------------- catalog ----------------------------- //

  @Get("catalog")
  catalog(@CurrentOrg() org: OrgContext, @Query("includeInactive") includeInactive?: string) {
    return this.serviceDesk.listCatalog(org.organizationId, includeInactive === "true")
  }

  @Post("catalog")
  @MinRole(OrgRole.MANAGER)
  createCatalogItem(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser, @Body() dto: CreateServiceItemDto) {
    return this.serviceDesk.createCatalogItem(org.organizationId, user.id, dto)
  }

  @Patch("catalog/:itemId")
  @MinRole(OrgRole.MANAGER)
  updateCatalogItem(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateServiceItemDto
  ) {
    return this.serviceDesk.updateCatalogItem(org.organizationId, user.id, itemId, dto)
  }

  // ------------------------- service requests ------------------------ //

  @Get("requests")
  listRequests(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser, @Query() query: ListRequestsQueryDto) {
    return this.serviceDesk.listRequests(org.organizationId, user.id, {
      ...query,
      limit: toInt(query.limit),
    })
  }

  @Post("requests")
  createRequest(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser, @Body() dto: CreateServiceRequestDto) {
    return this.serviceDesk.createRequest(org.organizationId, user.id, dto)
  }

  @Get("requests/:requestId")
  getRequest(@CurrentOrg() org: OrgContext, @Param("requestId") requestId: string) {
    return this.serviceDesk.getRequest(org.organizationId, requestId)
  }

  @Patch("requests/:requestId")
  updateRequest(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("requestId") requestId: string,
    @Body() dto: UpdateServiceRequestDto
  ) {
    return this.serviceDesk.updateRequest(org.organizationId, user.id, requestId, dto)
  }

  /** Manager approval decision. */
  @Post("requests/:requestId/decision")
  @MinRole(OrgRole.MANAGER)
  async decideRequest(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("requestId") requestId: string,
    @Body() dto: DecideRequestDto
  ) {
    await this.serviceDesk.assertCanDecide(org.organizationId, user.id)
    return this.serviceDesk.decideRequest(org.organizationId, user.id, requestId, dto.decision, dto.note)
  }

  /** Lifecycle transition (start work, fulfil, close, cancel...). */
  @Post("requests/:requestId/status")
  transitionRequest(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("requestId") requestId: string,
    @Body() dto: RequestStatusDto
  ) {
    return this.serviceDesk.transitionRequest(org.organizationId, user.id, requestId, dto.status, {
      note: dto.note,
      rating: dto.rating,
    })
  }

  /** Requester satisfaction rating after fulfilment. */
  @Post("requests/:requestId/rate")
  @HttpCode(200)
  rateRequest(@CurrentOrg() org: OrgContext, @Param("requestId") requestId: string, @Body() dto: RateRequestDto) {
    return this.serviceDesk.rateRequest(org.organizationId, requestId, dto.rating)
  }

  @Get("requests/:requestId/comments")
  requestComments(@CurrentOrg() org: OrgContext, @Param("requestId") requestId: string) {
    return this.serviceDesk.listComments(org.organizationId, ServiceEntityType.REQUEST, requestId)
  }

  @Post("requests/:requestId/comments")
  addRequestComment(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("requestId") requestId: string,
    @Body() dto: AddCommentDto
  ) {
    return this.serviceDesk.addComment(org.organizationId, user.id, "REQUEST", requestId, dto.body, dto.internal ?? false)
  }

  // ---------------------------- incidents ---------------------------- //

  @Get("incidents")
  listIncidents(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser, @Query() query: ListIncidentsQueryDto) {
    return this.serviceDesk.listIncidents(org.organizationId, user.id, {
      ...query,
      limit: toInt(query.limit),
    })
  }

  @Post("incidents")
  createIncident(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser, @Body() dto: CreateIncidentDto) {
    return this.serviceDesk.createIncident(org.organizationId, user.id, dto)
  }

  @Get("incidents/:incidentId")
  getIncident(@CurrentOrg() org: OrgContext, @Param("incidentId") incidentId: string) {
    return this.serviceDesk.getIncident(org.organizationId, incidentId)
  }

  @Patch("incidents/:incidentId")
  updateIncident(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("incidentId") incidentId: string,
    @Body() dto: UpdateIncidentDto
  ) {
    return this.serviceDesk.updateIncident(org.organizationId, user.id, incidentId, dto)
  }

  @Post("incidents/:incidentId/status")
  transitionIncident(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("incidentId") incidentId: string,
    @Body() dto: IncidentStatusDto
  ) {
    return this.serviceDesk.transitionIncident(org.organizationId, user.id, incidentId, dto.status, {
      resolution: dto.resolution,
      rootCause: dto.rootCause,
    })
  }

  @Get("incidents/:incidentId/comments")
  incidentComments(@CurrentOrg() org: OrgContext, @Param("incidentId") incidentId: string) {
    return this.serviceDesk.listComments(org.organizationId, ServiceEntityType.INCIDENT, incidentId)
  }

  @Post("incidents/:incidentId/comments")
  addIncidentComment(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("incidentId") incidentId: string,
    @Body() dto: AddCommentDto
  ) {
    return this.serviceDesk.addComment(org.organizationId, user.id, "INCIDENT", incidentId, dto.body, dto.internal ?? false)
  }

  // --------------------------- knowledge base ------------------------- //

  @Get("knowledge")
  knowledge(
    @CurrentOrg() org: OrgContext,
    @Query("category") category?: string,
    @Query("search") search?: string,
    @Query("publishedOnly") publishedOnly?: string,
    @Query("limit") limit?: string
  ) {
    return this.serviceDesk.listArticles(org.organizationId, {
      category,
      search,
      publishedOnly: publishedOnly === "false" ? false : true,
      limit: toInt(limit),
    })
  }

  @Get("knowledge/:articleId")
  article(@CurrentOrg() org: OrgContext, @Param("articleId") articleId: string) {
    return this.serviceDesk.getArticle(org.organizationId, articleId, true)
  }

  @Post("knowledge")
  createArticle(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto) {
    return this.serviceDesk.createArticle(org.organizationId, user.id, dto)
  }

  @Patch("knowledge/:articleId")
  @MinRole(OrgRole.MANAGER)
  updateArticle(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param("articleId") articleId: string,
    @Body() dto: UpdateArticleDto
  ) {
    return this.serviceDesk.updateArticle(org.organizationId, user.id, articleId, dto)
  }

  @Post("knowledge/:articleId/feedback")
  @HttpCode(200)
  articleFeedback(@CurrentOrg() org: OrgContext, @Param("articleId") articleId: string, @Body() dto: ArticleFeedbackDto) {
    return this.serviceDesk.articleFeedback(org.organizationId, articleId, dto.helpful)
  }

  // ------------------------------- SLA ------------------------------- //

  @Get("sla")
  sla(@CurrentOrg() org: OrgContext) {
    return this.serviceDesk.listSlaPolicies(org.organizationId)
  }

  @Put("sla")
  @MinRole(OrgRole.MANAGER)
  async updateSla(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSlaPolicyDto
  ) {
    await this.serviceDesk.assertCanDecide(org.organizationId, user.id)
    return this.serviceDesk.updateSlaPolicy(org.organizationId, user.id, {
      ...dto,
      priority: dto.priority as ServicePriority,
    })
  }
}