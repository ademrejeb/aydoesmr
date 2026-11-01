import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common"
import { GitService } from "./git.service"
import { CreateGitRepositoryDto, CommitFileDto, CreateGitTokenDto } from "./dto"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { OrgRole } from "@prisma/client"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"

/** Hosted Git repository management endpoints. */
@Controller("organizations/:id/git")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class GitController {
  constructor(private readonly git: GitService) {}

  @Get("repositories")
  list(@Param("id") orgId: string) {
    return this.git.listRepositories(orgId)
  }

  @Post("repositories")
  create(@Param("id") orgId: string, @Body() dto: CreateGitRepositoryDto) {
    return this.git.createRepository(orgId, dto)
  }

  @Get("repositories/:repositoryId")
  detail(@Param("id") orgId: string, @Param("repositoryId") repositoryId: string) {
    return this.git.getDetail(orgId, repositoryId)
  }

  @Delete("repositories/:repositoryId")
  @MinRole(OrgRole.MANAGER)
  delete(@Param("id") orgId: string, @Param("repositoryId") repositoryId: string) {
    return this.git.deleteRepository(orgId, repositoryId)
  }

  @Post("repositories/:repositoryId/files")
  commitFile(
    @Param("id") orgId: string,
    @Param("repositoryId") repositoryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CommitFileDto
  ) {
    return this.git.commitFile(orgId, repositoryId, dto, user.id)
  }

  @Post("repositories/:repositoryId/scan")
  scan(
    @Param("id") orgId: string,
    @Param("repositoryId") repositoryId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.git.scanHosted(orgId, repositoryId, user.id)
  }

  @Get("tokens")
  listTokens(@Param("id") orgId: string, @CurrentUser() user: AuthUser) {
    return this.git.listTokens(orgId, user.id)
  }

  @Post("tokens")
  createToken(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGitTokenDto
  ) {
    return this.git.createToken(orgId, user.id, dto.name ?? "default")
  }

  @Delete("tokens/:tokenId")
  revokeToken(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("tokenId") tokenId: string
  ) {
    return this.git.revokeToken(orgId, user.id, tokenId)
  }
}