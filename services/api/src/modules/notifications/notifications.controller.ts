import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common"
import { NotificationsService } from "./notifications.service"
import { OrgGuard } from "../../common/guards/org.guard"
import { CurrentOrg, CurrentUser } from "../../common/decorators/current-user.decorator"
import type { AuthUser, OrgContext } from "../../common/interfaces/authenticated-request.interface"

@Controller("notifications")
@UseGuards(OrgGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() org: OrgContext,
    @Query("limit") limit?: string
  ) {
    const n = limit ? Math.min(parseInt(limit, 10), 100) : 50
    return this.notifications.listForUser(user.id, org.organizationId, n)
  }

  @Get("unread-count")
  unread(@CurrentUser() user: AuthUser, @CurrentOrg() org: OrgContext) {
    return this.notifications.unreadCount(user.id, org.organizationId)
  }

  @Post(":id/read")
  markRead(@Param("id") id: string) {
    return this.notifications.markRead(id)
  }

  @Post("read-all")
  markAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id)
  }
}