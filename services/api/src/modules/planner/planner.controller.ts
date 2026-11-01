import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { OrgRole } from "@prisma/client"
import type { Express } from "express"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { PlannerService } from "./planner.service"
import { ApplyPlanDto, PlanUploadDto } from "./planner.dto"

const MAX_DOC_BYTES = 20 * 1024 * 1024

/** Sprint planner: upload a cahier de charge and turn it into a backlog of tickets. */
@Controller("organizations/:id/planner")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class PlannerController {
  constructor(private readonly planner: PlannerService) {}

  @Post("plan")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOC_BYTES } }))
  plan(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PlanUploadDto
  ) {
    return this.planner.create(orgId, user.id, file, dto)
  }

  @Get("plans")
  list(@Param("id") orgId: string) {
    return this.planner.list(orgId)
  }

  @Get("plans/:planId")
  get(@Param("id") orgId: string, @Param("planId") planId: string) {
    return this.planner.get(orgId, planId)
  }

  @Post("plans/:planId/apply")
  @MinRole(OrgRole.MANAGER)
  apply(
    @Param("id") orgId: string,
    @Param("planId") planId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApplyPlanDto
  ) {
    return this.planner.apply(orgId, user.id, planId, dto)
  }
}