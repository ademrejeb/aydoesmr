import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { OrgRole } from "@prisma/client"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { AiActionsService } from "./ai-actions.service"
import { RunAiActionDto } from "./ai-actions.dto"

/** Predefined AI actions across the app — run against an active model provider, preview, then apply. */
@Controller("organizations/:id/ai-actions")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class AiActionsController {
  constructor(private readonly actions: AiActionsService) {}

  @Get("catalog")
  catalog() {
    return this.actions.catalog()
  }

  @Get("runs")
  list(@Param("id") orgId: string) {
    return this.actions.list(orgId)
  }

  @Post("runs")
  run(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: RunAiActionDto) {
    return this.actions.run(orgId, user.id, dto)
  }

  @Get("runs/:runId")
  get(@Param("id") orgId: string, @Param("runId") runId: string) {
    return this.actions.get(orgId, runId)
  }

  @Post("runs/:runId/apply")
  @MinRole(OrgRole.MANAGER)
  apply(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("runId") runId: string) {
    return this.actions.apply(orgId, user.id, runId)
  }
}