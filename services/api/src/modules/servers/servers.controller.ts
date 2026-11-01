import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common"
import { OrgRole } from "@prisma/client"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { ServersService } from "./servers.service"
import {
  CreateDeployedAppDto,
  CreateServerDto,
  ExecCommandDto,
  ExecHealthDto,
  ProvisionDto,
  UpdateDeployedAppDto,
  UpdateServerDto,
} from "./dto"

/**
 * Server/VPS connector. Reads are open to every member; every mutation
 * (create/update/delete and probes) is restricted to organization OWNERs.
 */
@Controller("organizations/:id/servers")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get()
  list(@Param("id") orgId: string) {
    return this.servers.list(orgId)
  }

  @Post()
  @MinRole(OrgRole.OWNER)
  create(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateServerDto) {
    return this.servers.create(orgId, user.id, dto)
  }

  @Get(":serverId")
  get(@Param("id") orgId: string, @Param("serverId") serverId: string) {
    return this.servers.get(orgId, serverId)
  }

  @Patch(":serverId")
  @MinRole(OrgRole.OWNER)
  update(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("serverId") serverId: string,
    @Body() dto: UpdateServerDto
  ) {
    return this.servers.update(orgId, user.id, serverId, dto)
  }

  @Delete(":serverId")
  @MinRole(OrgRole.OWNER)
  remove(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("serverId") serverId: string) {
    return this.servers.remove(orgId, user.id, serverId)
  }

  @Post(":serverId/test")
  @MinRole(OrgRole.OWNER)
  test(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("serverId") serverId: string) {
    return this.servers.test(orgId, user.id, serverId)
  }

  @Get(":serverId/apps")
  apps(@Param("id") orgId: string, @Param("serverId") serverId: string) {
    return this.servers.listApps(orgId, serverId)
  }

  @Post(":serverId/apps")
  @MinRole(OrgRole.OWNER)
  createApp(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("serverId") serverId: string,
    @Body() dto: CreateDeployedAppDto
  ) {
    return this.servers.createApp(orgId, user.id, serverId, dto)
  }

  @Patch("apps/:appId")
  @MinRole(OrgRole.OWNER)
  updateApp(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("appId") appId: string,
    @Body() dto: UpdateDeployedAppDto
  ) {
    return this.servers.updateApp(orgId, user.id, appId, dto)
  }

  @Delete("apps/:appId")
  @MinRole(OrgRole.OWNER)
  removeApp(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("appId") appId: string) {
    return this.servers.removeApp(orgId, user.id, appId)
  }

  @Post("apps/:appId/test")
  @MinRole(OrgRole.OWNER)
  testApp(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("appId") appId: string) {
    return this.servers.testApp(orgId, user.id, appId)
  }

  // ------------------------------------------------------------------ //
  //  Sandbox console (exec) + IaC provisioning                         //
  // ------------------------------------------------------------------ //

  @Post(":serverId/exec")
  @Post(":serverId/exec/command")
  @MinRole(OrgRole.OWNER)
  execCommand(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("serverId") serverId: string,
    @Body() dto: ExecCommandDto
  ) {
    return this.servers.exec(orgId, user.id, serverId, dto)
  }

  @Post(":serverId/exec/health")
  @MinRole(OrgRole.OWNER)
  execHealth(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("serverId") serverId: string,
    @Body() dto: ExecHealthDto
  ) {
    return this.servers.execHealth(orgId, user.id, serverId, dto)
  }

  @Post(":serverId/provision")
  @MinRole(OrgRole.OWNER)
  provision(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("serverId") serverId: string,
    @Body() dto: ProvisionDto
  ) {
    return this.servers.provision(orgId, user.id, serverId, dto)
  }
}