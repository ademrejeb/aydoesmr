import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { OrgRole } from "@prisma/client"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgGuard } from "../../common/guards/org.guard"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { CreatePolicyRuleDto, EvaluatePolicyDto, UpdatePolicyRuleDto } from "./dto"
import { PoliciesService } from "./policies.service"

@Controller("organizations/:id/policies")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  list(@Param("id") orgId: string) {
    return this.policies.list(orgId)
  }

  @Get("evaluations")
  history(@Param("id") orgId: string, @Query("limit") limit?: string) {
    return this.policies.history(orgId, limit ? parseInt(limit, 10) : 100)
  }

  @Post("evaluate")
  evaluate(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: EvaluatePolicyDto) {
    return this.policies.evaluate(orgId, user.id, dto)
  }

  @Post()
  @MinRole(OrgRole.MANAGER)
  create(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreatePolicyRuleDto) {
    return this.policies.create(orgId, user.id, dto)
  }

  @Patch(":ruleId")
  @MinRole(OrgRole.MANAGER)
  update(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdatePolicyRuleDto
  ) {
    return this.policies.update(orgId, user.id, ruleId, dto)
  }

  @Delete(":ruleId")
  @MinRole(OrgRole.ADMIN)
  remove(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("ruleId") ruleId: string) {
    return this.policies.remove(orgId, user.id, ruleId)
  }

  @Post("defaults")
  @MinRole(OrgRole.ADMIN)
  seedDefaults(@Param("id") orgId: string, @CurrentUser() user: AuthUser) {
    return this.policies.seedDefaults(orgId, user.id)
  }
}
