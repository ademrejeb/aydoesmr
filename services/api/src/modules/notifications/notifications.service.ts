import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { PrismaService } from "../../prisma/prisma.service"
import { MailService } from "../../mail/mail.service"
import { NotificationType } from "@prisma/client"

/**
 * Persists app notifications and emits a realtime event so connected
 * websocket relays can push them to clients. Emission is fire-and-forget:
 * if no realtime relay is running, the notification is still stored.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly mail: MailService
  ) {}

  async create(
    organizationId: string,
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    link?: string
  ) {
    const notification = await this.prisma.notification.create({
      data: { organizationId, userId, type, title, body, link },
    })

    this.events.emit("notification.created", {
      ...notification,
      user: userId,
    })

    if (type === NotificationType.TASK_ASSIGNED || type === NotificationType.COMMENT) {
      void this.sendEmail(organizationId, userId, type, title, body, link)
    }

    return notification
  }

  private async sendEmail(
    organizationId: string,
    userId: string,
    type: NotificationType,
    title: string,
    body: string | undefined,
    link: string | undefined
  ) {
    if (!this.mail.isConfigured) return
    try {
      const [user, org] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.organization.findUnique({ where: { id: organizationId } }),
      ])
      if (!user) return
      await this.mail.send(
        type === NotificationType.TASK_ASSIGNED ? "task_assigned" : "task_comment",
        user.email,
        {
          organization: org?.name,
          name: user.fullName ?? user.email,
          details: body,
          preview: title,
          actionUrl: this.mail.link(link ?? "/dashboard"),
        },
        user.locale
      )
    } catch (err) {
      this.logger.warn(`Notification email failed: ${(err as Error).message}`)
    }
  }

  async listForUser(userId: string, organizationId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId, organizationId },
      take: limit,
      orderBy: { createdAt: "desc" },
    })
  }

  async markRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  }

  async unreadCount(userId: string, organizationId: string) {
    return this.prisma.notification.count({
      where: { userId, organizationId, readAt: null },
    })
  }
}