import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { PrismaService } from "../../prisma/prisma.service"
import { ConversationType, NotificationType } from "@prisma/client"
import type { CreateGroupDto, OpenDirectDto, SendMessageDto } from "./dto"

const PUBLIC_USER = { id: true, fullName: true, email: true, avatarUrl: true, status: true, statusNote: true, statusUntil: true, lastSeenAt: true } as const
const REACTION_SELECT = { emoji: true, userId: true, user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } } as const

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2
  ) {}

  async list(organizationId: string, userId: string) {
    const membership = await this.prisma.conversationMember.findMany({
      where: { userId, conversation: { organizationId } },
      orderBy: { conversation: { lastMessageAt: { sort: "desc", nulls: "last" } } },
      include: {
        conversation: {
          include: {
            members: {
              include: { user: { select: PUBLIC_USER } },
              orderBy: { joinedAt: "asc" },
            },
          },
        },
      },
    })

    return membership.map((m) => {
      const conv = m.conversation
      const base = { ...this.shape(m), archived: conv.archivedAt !== null, archivedAt: conv.archivedAt }
      if (conv.type === ConversationType.DIRECT) {
        const partner = conv.members.find((x) => x.userId !== userId)?.user ?? null
        return { id: conv.id, type: conv.type, name: partner?.fullName ?? partner?.email ?? "…", partnerId: partner?.id ?? null, partner, ...base }
      }
      return { id: conv.id, type: conv.type, name: conv.name ?? "Group", partner: null, partnerId: null, ...base }
    })
  }

  private shape(m: { conversation: any; unreadCount: number; lastReadAt: Date | null }) {
    return {
      unreadCount: m.unreadCount,
      lastReadAt: m.lastReadAt,
      lastMessageAt: m.conversation.lastMessageAt,
      updatedAt: m.conversation.updatedAt,
      members: m.conversation.members,
    }
  }

  private assertMembership(conv: { members: { userId: string }[] }, userId: string) {
    if (!conv.members.some((mm) => mm.userId === userId)) {
      throw new NotFoundException("Conversation not found")
    }
  }

  async openDirect(organizationId: string, userId: string, dto: OpenDirectDto) {
    const other = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: dto.userId } },
    })
    if (!other) throw new NotFoundException("User is not a member of this organization")

    const existing = await this.prisma.conversation.findFirst({
      where: {
        organizationId,
        type: ConversationType.DIRECT,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: dto.userId } } },
        ],
      },
      include: { members: true },
    })
    if (existing && existing.members.length === 2) {
      return this.getDetail(organizationId, existing.id, userId)
    }

    const conv = await this.prisma.conversation.create({
      data: {
        organizationId,
        type: ConversationType.DIRECT,
        createdBy: userId,
        lastMessageAt: new Date(),
        members: { create: [{ userId }, { userId: dto.userId }] },
      },
      include: { members: true },
    })

    const detail = await this.getDetail(organizationId, conv.id, userId)
    this.events.emit("conversation.new", {
      organizationId,
      conversationId: conv.id,
      memberIds: [userId, dto.userId],
    })
    return detail
  }

  async createGroup(organizationId: string, userId: string, dto: CreateGroupDto) {
    const memberIds = [userId, ...(dto.memberIds ?? []).filter((id) => id !== userId)]
    const valid = await this.prisma.organizationMember.findMany({
      where: { organizationId, userId: { in: memberIds } },
      select: { userId: true },
    })
    const finalIds = [userId, ...valid.map((v) => v.userId).filter((id) => id !== userId)]

    const conv = await this.prisma.conversation.create({
      data: {
        organizationId,
        type: ConversationType.GROUP,
        name: dto.name,
        createdBy: userId,
        lastMessageAt: new Date(),
        members: { create: finalIds.map((uid) => ({ userId: uid })) },
      },
      include: { members: true },
    })

    const detail = await this.getDetail(organizationId, conv.id, userId)
    this.events.emit("conversation.new", {
      organizationId,
      conversationId: conv.id,
      memberIds: finalIds,
    })
    return detail
  }

  async getDetail(organizationId: string, conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: { members: { include: { user: { select: PUBLIC_USER } }, orderBy: { joinedAt: "asc" } } },
    })
    if (!conv) throw new NotFoundException("Conversation not found")
    this.assertMembership(conv, userId)

    const me = conv.members.find((mm) => mm.userId === userId)
    const base = { members: conv.members, unreadCount: me?.unreadCount ?? 0, lastMessageAt: conv.lastMessageAt, archived: conv.archivedAt !== null, archivedAt: conv.archivedAt }
    if (conv.type === ConversationType.DIRECT) {
      const partner = conv.members.find((x) => x.userId !== userId)?.user ?? null
      return { id: conv.id, type: conv.type, name: partner?.fullName ?? partner?.email ?? "…", partner, ...base }
    }
    return { id: conv.id, type: conv.type, name: conv.name ?? "Group", partner: null, ...base }
  }

  async messages(organizationId: string, conversationId: string, userId: string, cursor?: string, limit = 50) {
    await this.getDetail(organizationId, conversationId, userId).catch(() => {
      throw new NotFoundException("Conversation not found")
    })

    const take = Math.min(Math.max(limit, 1), 100)
    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      take,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: PUBLIC_USER },
        replyTo: { select: { id: true, body: true, sender: { select: PUBLIC_USER } } },
        attachment: true,
        reactions: { select: REACTION_SELECT },
      },
    }).then((rows) => this.serializeMessages(organizationId, rows))
  }

  private serializeMessages(organizationId: string, rows: any[]) {
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      sender: r.sender,
      body: r.deletedAt ? "" : r.body,
      kind: r.kind,
      mediaUrl: r.mediaUrl,
      mediaWidth: r.mediaWidth,
      mediaHeight: r.mediaHeight,
      mimeType: r.mimeType,
      replyTo: r.replyTo,
      deleted: r.deletedAt !== null,
      deletedAt: r.deletedAt,
      mentionIds: r.mentionIds ?? [],
      reactions: r.reactions,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      attachment: r.attachment
        ? {
            id: r.attachment.id,
            name: r.attachment.name,
            mimeType: r.attachment.mimeType,
            size: r.attachment.size,
            downloadPath: `/api/organizations/${organizationId}/files/${encodeURIComponent(r.attachment.storageKey)}/download`,
          }
        : null,
    })).reverse()
  }

  private serializeNewMessage(organizationId: string, m: any) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      sender: m.sender,
      body: m.deletedAt ? "" : m.body,
      kind: m.kind,
      mediaUrl: m.mediaUrl,
      mediaWidth: m.mediaWidth,
      mediaHeight: m.mediaHeight,
      mimeType: m.mimeType,
      replyTo: m.replyTo,
      deleted: m.deletedAt !== null,
      deletedAt: m.deletedAt,
      mentionIds: m.mentionIds ?? [],
      reactions: m.reactions,
      attachment: m.attachment
        ? {
            id: m.attachment.id,
            name: m.attachment.name,
            mimeType: m.attachment.mimeType,
            size: m.attachment.size,
            downloadPath: `/api/organizations/${organizationId}/files/${encodeURIComponent(m.attachment.storageKey)}/download`,
          }
        : null,
      createdAt: m.createdAt,
    }
  }

  async sendMessage(organizationId: string, conversationId: string, senderId: string, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: { members: { select: { userId: true } } },
    })
    if (!conv) throw new NotFoundException("Conversation not found")
    this.assertMembership(conv, senderId)

    let kind = dto.kind ?? "TEXT"
    let body = dto.body
    const attachmentId = dto.attachmentId
    let attachmentRow: { mimeType: string } | null = null
    if (attachmentId) {
      kind = "ATTACHMENT"
      attachmentRow = await this.prisma.fileAttachment.findFirst({
        where: { id: attachmentId, organizationId },
        select: { mimeType: true },
      })
      if (!attachmentRow) throw new NotFoundException("Attachment not found")
      if (!body || body.trim() === "") body = "📎"
    }
    if (!body || body.trim() === "") throw new BadRequestException("body is required")

    const message = await this.prisma.message.create({
      data: {
        organizationId,
        conversationId,
        senderId,
        body,
        kind,
        mediaUrl: dto.mediaUrl ?? undefined,
        mediaWidth: dto.mediaWidth ?? undefined,
        mediaHeight: dto.mediaHeight ?? undefined,
        mimeType: dto.mimeType ?? undefined,
        replyToId: dto.replyToId ?? undefined,
        ...(attachmentId ? { attachment: { connect: { id: attachmentId } } } : {}),
      },
      include: {
        sender: { select: PUBLIC_USER },
        replyTo: { select: { id: true, body: true, sender: { select: { id: true, fullName: true } } } },
        attachment: true,
        reactions: { select: REACTION_SELECT },
      },
    })

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    })

    const recipients = conv.members.filter((m) => m.userId !== senderId)
    await this.prisma.conversationMember.updateMany({
      where: { conversationId, userId: { in: recipients.map((r) => r.userId) } },
      data: { unreadCount: { increment: 1 } },
    })

    if (dto.mentions && dto.mentions.length > 0) {
      const mentionIds = dto.mentions
      const mentionTargets = recipients.filter((r) => mentionIds.includes(r.userId))
      if (mentionTargets.length > 0) {
        const senderName = message.sender.fullName ?? message.sender.email
        await this.prisma.notification.createMany({
          data: mentionTargets.map((t) => ({
            organizationId,
            userId: t.userId,
            type: NotificationType.MENTION,
            title: `${senderName} mentioned you`,
            body: message.body.slice(0, 240),
            link: `/dashboard/messages?c=${conversationId}`,
          })),
        })
        this.events.emit("notification.created", {
          organizationId,
          kind: "MENTION",
          conversationId,
        })
      }
    }

    this.events.emit("message.sent", {
      organizationId,
      conversationId,
      message: this.serializeNewMessage(organizationId, message),
      senderId,
      recipientIds: recipients.map((r) => r.userId),
    })

    return message
  }

  async markRead(organizationId: string, conversationId: string, userId: string) {
    await this.getDetail(organizationId, conversationId, userId)
    const at = new Date()
    await this.prisma.conversationMember.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: at, unreadCount: 0 },
    })
    this.events.emit("conversation.read", { organizationId, conversationId, userId, at })
    return { conversationId, readAt: at }
  }

  async typing(organizationId: string, conversationId: string, userId: string, typing: boolean) {
    await this.getDetail(organizationId, conversationId, userId)
    this.events.emit("conversation.typing", {
      organizationId,
      conversationId,
      userId,
      typing: typing ?? true,
    })
    return { ok: true }
  }

  async addMember(organizationId: string, conversationId: string, actingUserId: string, otherUserId: string, requireManager = false) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: { members: true },
    })
    if (!conv) throw new NotFoundException("Conversation not found")
    this.assertMembership(conv, actingUserId)
    if (requireManager) {
      const me = conv.members.find((m) => m.userId === actingUserId)
      if (me?.role !== "OWNER") throw new Error("Only group owners can manage members")
    } else if (conv.type === ConversationType.DIRECT) {
      throw new Error("Direct conversations are private")
    }
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: otherUserId } },
    })
    if (!orgMember) throw new NotFoundException("User is not a member of this organization")

    await this.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId, userId: otherUserId } },
      create: { conversationId, userId: otherUserId },
      update: {},
    })

    const detail = await this.getDetail(organizationId, conversationId, actingUserId)
    this.events.emit("conversation.new", {
      organizationId,
      conversationId: conv.id,
      memberIds: [otherUserId],
    })
    return detail
  }

  async leave(organizationId: string, conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: { members: { select: { userId: true } } },
    })
    if (!conv) throw new NotFoundException("Conversation not found")
    this.assertMembership(conv, userId)

    await this.prisma.conversationMember.deleteMany({
      where: { conversationId, userId },
    })

    const remaining = await this.prisma.conversationMember.count({ where: { conversationId } })
    if (remaining === 0) {
      await this.prisma.conversation.delete({ where: { id: conversationId } })
    }
    return { ok: true }
  }

  private async loadMessageForUpdate(organizationId: string, conversationId: string, messageId: string) {
    const msg = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, organizationId },
      include: {
        sender: { select: PUBLIC_USER },
        replyTo: { select: { id: true, body: true, sender: { select: PUBLIC_USER } } },
        attachment: true,
        reactions: { select: REACTION_SELECT },
      },
    })
    if (!msg) throw new NotFoundException("Message not found")
    return msg
  }

  async setReaction(organizationId: string, conversationId: string, messageId: string, userId: string, emoji: string) {
    await this.getDetail(organizationId, conversationId, userId)
    await this.loadMessageForUpdate(organizationId, conversationId, messageId)
    await this.prisma.reaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, emoji },
      update: { emoji },
    })
    const msg = await this.loadMessageForUpdate(organizationId, conversationId, messageId)
    this.broadcastUpdate(organizationId, conversationId, msg)
    return this.serializeNewMessage(organizationId, msg)
  }

  async removeReaction(organizationId: string, conversationId: string, messageId: string, userId: string) {
    await this.getDetail(organizationId, conversationId, userId)
    await this.loadMessageForUpdate(organizationId, conversationId, messageId)
    await this.prisma.reaction.deleteMany({ where: { messageId, userId } })
    const msg = await this.loadMessageForUpdate(organizationId, conversationId, messageId)
    this.broadcastUpdate(organizationId, conversationId, msg)
    return this.serializeNewMessage(organizationId, msg)
  }

  async deleteMessage(organizationId: string, conversationId: string, messageId: string, userId: string) {
    await this.getDetail(organizationId, conversationId, userId)
    const msg = await this.loadMessageForUpdate(organizationId, conversationId, messageId)
    if (msg.senderId !== userId) throw new BadRequestException("Only the sender can delete a message")
    await this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } })
    const updated = await this.loadMessageForUpdate(organizationId, conversationId, messageId)
    this.broadcastUpdate(organizationId, conversationId, updated)
    return this.serializeNewMessage(organizationId, updated)
  }

  async setArchived(organizationId: string, conversationId: string, userId: string, archived: boolean) {
    await this.getDetail(organizationId, conversationId, userId)
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { archivedAt: archived ? new Date() : null },
    })
    this.events.emit("conversation.archived", { organizationId, conversationId, userId, archived })
    return { ok: true, archived }
  }

  private broadcastUpdate(organizationId: string, conversationId: string, message: any) {
    this.events.emit("message.updated", {
      organizationId,
      conversationId,
      message: this.serializeNewMessage(organizationId, message),
    })
  }
}