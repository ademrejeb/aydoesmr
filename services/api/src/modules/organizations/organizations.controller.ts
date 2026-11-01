import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { OrganizationsService } from "./organizations.service"
import { AddMemberDto, AcceptInviteDto, CreateOrganizationDto, UpdateMemberRoleDto, UpdateOrganizationDto, UpdateUserStatusDto } from "./dto"
import { CurrentOrg, CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgGuard } from "../../common/guards/org.guard"
import type { AuthUser, OrgContext } from "../../common/interfaces/authenticated-request.interface"
import { OrgRole } from "@prisma/client"
import { holidaySources } from "../../common/holiday-sources"

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get("holiday-sources")
  listHolidaySources(@Query("lang") lang?: string) {
    return holidaySources(lang && ["ar", "en", "fr"].includes(lang) ? lang : "en")
  }

  @Get()
  myOrganizations(@CurrentUser() user: AuthUser) {
    return this.organizations.listMyOrganizations(user.id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(user, dto)
  }

  @Get(":id")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.MEMBER)
  get(@Param("id") id: string) {
    return this.organizations.getById(id)
  }

  @Patch(":id")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.organizations.update(id, dto, user)
  }

  @Get(":id/access")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  accessCatalog() {
    return this.organizations.getAccessCatalog()
  }

  @Patch(":id/me/status")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.MEMBER)
  updateMyStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateUserStatusDto
  ) {
    return this.organizations.updateUserStatus(id, user.id, dto)
  }

  @Get(":id/audit-logs")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  auditLogs(@Param("id") id: string, @Query("action") action?: string) {
    return this.organizations.listAuditLogs(id, action)
  }

  @Post("invites/accept")
  acceptInvite(@Body() dto: AcceptInviteDto, @CurrentUser() user: AuthUser) {
    return this.organizations.acceptInviteOrThrow(dto.token, user.id)
  }

  @Post(":id/members")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  addMember(
    @Param("id") id: string,
    @Body() dto: AddMemberDto,
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser
  ) {
    return this.organizations.addMember(id, dto, org.role, user)
  }

  @Patch(":id/members/:memberId")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  updateMember(
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser
  ) {
    return this.organizations.updateMember(id, memberId, dto, org.role, user)
  }

  @Get(":id/members")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.MEMBER)
  listMembers(@Param("id") id: string) {
    return this.organizations.listMembers(id)
  }

  @Delete(":id/invites/:inviteId")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  revokeInvite(
    @Param("id") id: string,
    @Param("inviteId") inviteId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.organizations.revokeInvite(id, inviteId, user)
  }

  @Get(":id/invites")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.MANAGER)
  listInvites(@Param("id") id: string) {
    return this.organizations.listInvites(id)
  }

  @Post(":id/members/invite")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  invite(
    @Param("id") id: string,
    @Body() dto: AddMemberDto,
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser
  ) {
    return this.organizations.inviteMember(id, dto, org.role, user)
  }

  @Delete(":id/members/:memberId")
  @UseGuards(OrgGuard)
  @MinRole(OrgRole.ADMIN)
  removeMember(
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.organizations.removeMember(id, memberId, user)
  }
}