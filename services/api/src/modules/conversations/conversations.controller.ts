import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { ConversationsService } from "./conversations.service"
import { AddConversationMemberDto, ArchiveConversationDto, CreateGroupDto, OpenDirectDto, SendMessageDto, SetReactionDto, TypingDto } from "./dto"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { OrgRole } from "@prisma/client"

@Controller("organizations/:id/conversations")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@Param("id") orgId: string, @CurrentUser() user: AuthUser) {
    return this.conversations.list(orgId, user.id)
  }

  @Get(":conversationId")
  get(@Param("id") orgId: string, @Param("conversationId") conversationId: string, @CurrentUser() user: AuthUser) {
    return this.conversations.getDetail(orgId, conversationId, user.id)
  }

  @Get(":conversationId/messages")
  messages(
    @Param("id") orgId: string,
    @Param("conversationId") conversationId: string,
    @CurrentUser() user: AuthUser,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    const l = limit ? parseInt(limit, 10) : 50
    return this.conversations.messages(orgId, conversationId, user.id, cursor, l)
  }

  @Post("direct")
  openDirect(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: OpenDirectDto) {
    return this.conversations.openDirect(orgId, user.id, dto)
  }

  @Post("group")
  createGroup(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.conversations.createGroup(orgId, user.id, dto)
  }

  @Post(":conversationId/messages")
  send(
    @Param("id") orgId: string,
    @Param("conversationId") conversationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto
  ) {
    return this.conversations.sendMessage(orgId, conversationId, user.id, dto)
  }

  @Post(":conversationId/read")
  markRead(@Param("id") orgId: string, @Param("conversationId") conversationId: string, @CurrentUser() user: AuthUser) {
    return this.conversations.markRead(orgId, conversationId, user.id)
  }

  @Post(":conversationId/typing")
  typing(@Param("id") orgId: string, @Param("conversationId") conversationId: string, @CurrentUser() user: AuthUser, @Body() dto: TypingDto) {
    return this.conversations.typing(orgId, conversationId, user.id, dto.typing ?? true)
  }

  @Post(":conversationId/members")
  addMember(@Param("id") orgId: string, @Param("conversationId") conversationId: string, @CurrentUser() user: AuthUser, @Body() dto: AddConversationMemberDto) {
    return this.conversations.addMember(orgId, conversationId, user.id, dto.userId)
  }

  @Delete(":conversationId/members/me")
  leave(@Param("id") orgId: string, @Param("conversationId") conversationId: string, @CurrentUser() user: AuthUser) {
    return this.conversations.leave(orgId, conversationId, user.id)
  }

  @Patch(":conversationId/archive")
  archive(
    @Param("id") orgId: string,
    @Param("conversationId") conversationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ArchiveConversationDto
  ) {
    return this.conversations.setArchived(orgId, conversationId, user.id, dto.archived)
  }

  @Patch(":conversationId/messages/:messageId/reactions")
  addReaction(
    @Param("id") orgId: string,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetReactionDto
  ) {
    return this.conversations.setReaction(orgId, conversationId, messageId, user.id, dto.emoji)
  }

  @Delete(":conversationId/messages/:messageId/reactions")
  removeReaction(
    @Param("id") orgId: string,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.conversations.removeReaction(orgId, conversationId, messageId, user.id)
  }

  @Delete(":conversationId/messages/:messageId")
  delete(
    @Param("id") orgId: string,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.conversations.deleteMessage(orgId, conversationId, messageId, user.id)
  }
}