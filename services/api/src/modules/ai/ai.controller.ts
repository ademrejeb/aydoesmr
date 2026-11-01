import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { OrgRole } from "@prisma/client"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { AiService } from "./ai.service"
import { AiChatDto, AssistantQueryDto, CreateAiProviderDto, UpdateAiProviderDto } from "./dto"

/** AI provider management: cloud, hosted and local model endpoints + playground chat. */
@Controller("organizations/:id/ai")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("gateway-status")
  gatewayStatus() {
    return this.ai.gatewayStatus()
  }

  @Get("providers")
  list(@Param("id") orgId: string) {
    return this.ai.list(orgId)
  }

  @Get("providers/specs")
  specs() {
    return this.ai.specs()
  }

  @Post("providers")
  @MinRole(OrgRole.MANAGER)
  create(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateAiProviderDto) {
    return this.ai.create(orgId, user.id, dto)
  }

  @Get("providers/:providerId")
  get(@Param("id") orgId: string, @Param("providerId") providerId: string) {
    return this.ai.get(orgId, providerId)
  }

  @Patch("providers/:providerId")
  @MinRole(OrgRole.MANAGER)
  update(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("providerId") providerId: string,
    @Body() dto: UpdateAiProviderDto
  ) {
    return this.ai.update(orgId, user.id, providerId, dto)
  }

  @Delete("providers/:providerId")
  @MinRole(OrgRole.MANAGER)
  remove(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("providerId") providerId: string) {
    return this.ai.remove(orgId, user.id, providerId)
  }

  @Post("providers/:providerId/test")
  @MinRole(OrgRole.MANAGER)
  test(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("providerId") providerId: string) {
    return this.ai.test(orgId, user.id, providerId)
  }

  @Post("providers/:providerId/models/fetch")
  @MinRole(OrgRole.MANAGER)
  fetchModels(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("providerId") providerId: string) {
    return this.ai.fetchModels(orgId, user.id, providerId)
  }

  @Post("providers/:providerId/chat")
  chat(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("providerId") providerId: string,
    @Body() dto: AiChatDto
  ) {
    return this.ai.chat(orgId, user.id, providerId, dto)
  }

  @Post("assistant/query")
  @MinRole(OrgRole.MANAGER)
  assistantQuery(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: AssistantQueryDto) {
    return this.ai.assistantQuery(orgId, user.id, dto)
  }
}