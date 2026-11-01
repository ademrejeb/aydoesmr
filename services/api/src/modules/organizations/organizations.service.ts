import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { PrismaService } from "../../prisma/prisma.service"
import { AddMemberDto, CreateOrganizationDto, UpdateMemberRoleDto, UpdateOrganizationDto, UpdateUserStatusDto } from "./dto"
import { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { MailService } from "../../mail/mail.service"
import { AuditService } from "../audit/audit.service"
import { accessCatalog } from "./access.matrix"
import { NotificationType, OrgRole } from "@prisma/client"
import { randomBytes, createHash } from "crypto"

const ROLE_RANK: Record<OrgRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2
  ) {}

  async listMyOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: {
        role: true,
        organization: {
          select: { id: true, name: true, slug: true, plan: true, locale: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })
    return memberships.map((m) => ({ role: m.role, ...m.organization }))
  }

  async create(user: AuthUser, dto: CreateOrganizationDto) {
    const slug = dto.slug ?? dto.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const existing = await this.prisma.organization.findUnique({ where: { slug } })
    if (existing) throw new BadRequestException("Organization slug already taken")

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          country: dto.country,
          currency: dto.currency,
          locale: dto.locale,
          members: {
            create: { userId: user.id, role: OrgRole.OWNER },
          },
          billing: {
            create: { plan: "free", seats: 10, usageLimit: 1000 },
          },
        },
      })
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: "organization.created",
          entityType: "organization",
          entityId: org.id,
          metadata: { name: org.name, slug: org.slug },
        },
      })
      return org
    })
  }

  async getById(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          select: {
            id: true,
            role: true,
            title: true,
user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, statusNote: true, statusUntil: true, lastSeenAt: true } },
          },
        },
        billing: true,
      },
    })
    if (!org) throw new NotFoundException("Organization not found")
    return org
  }

  async update(organizationId: string, dto: UpdateOrganizationDto, actor: AuthUser) {
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
    })
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: "organization.updated",
      entityType: "organization",
      entityId: organizationId,
      metadata: { ...dto },
    })
    return updated
  }

  async addMember(organizationId: string, dto: AddMemberDto, actorRole: OrgRole, actor: AuthUser) {
    const role = dto.role ?? OrgRole.MEMBER
    if (ROLE_RANK[role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException("Cannot assign a role equal to or higher than your own")
    }

    const target = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!target) throw new NotFoundException("User not found — they must register first")

    const member = await this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId, userId: target.id },
      },
      create: {
        organizationId,
        userId: target.id,
        role,
        title: dto.title,
      },
      update: { role, title: dto.title },
    })

    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: "member.role_set",
      entityType: "member",
      entityId: member.id,
      metadata: { email: dto.email, role, title: dto.title ?? null },
    })
    return member
  }

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        title: true,
        createdAt: true,
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, statusNote: true, statusUntil: true, lastSeenAt: true } },
      },
      orderBy: { createdAt: "asc" },
    })
  }

  async removeMember(organizationId: string, memberId: string, actor: AuthUser) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { email: true, fullName: true } } },
    })
    if (!member) throw new NotFoundException("Member not found")
    if (member.organizationId !== organizationId) throw new NotFoundException("Member not found")
    if (member.role === OrgRole.OWNER) {
      throw new ForbiddenException("Cannot remove the organization owner")
    }
    await this.prisma.organizationMember.delete({ where: { id: memberId } })
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: "member.removed",
      entityType: "member",
      entityId: memberId,
      metadata: { email: member.user.email, role: member.role },
    })
    return { ok: true }
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    actorRole: OrgRole,
    actor: AuthUser
  ) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { email: true, fullName: true } } },
    })
    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException("Member not found")
    }
    if (member.role === OrgRole.OWNER) {
      throw new ForbiddenException("Cannot change the organization owner's role")
    }

    const role = dto.role ?? member.role
    if (role === OrgRole.OWNER) {
      throw new ForbiddenException("Cannot assign the OWNER role")
    }
    if (ROLE_RANK[role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException("Cannot assign a role equal to or higher than your own")
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role, title: dto.title !== undefined ? dto.title : member.title },
      include: { user: { select: { email: true, fullName: true } } },
    })

    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: "member.role_updated",
      entityType: "member",
      entityId: memberId,
      metadata: {
        email: member.user.email,
        from: member.role,
        to: role,
        title: updated.title ?? null,
      },
    })
    return updated
  }

  async inviteMember(organizationId: string, dto: AddMemberDto, actorRole: OrgRole, actor: AuthUser) {
    const role = dto.role ?? OrgRole.MEMBER
    if (ROLE_RANK[role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException("Cannot invite with a role equal to or higher than your own")
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      // Never change the role/title of an existing member — just notify them.
      await this.prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId, userId: existing.id } },
        create: { organizationId, userId: existing.id, role, title: dto.title },
        update: {},
      })
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
      await this.mail.send(
        "invite",
        dto.email,
        {
          organization: org?.name,
          name: existing.fullName ?? existing.email,
          actionUrl: this.mail.link("/dashboard"),
          actionLabel: "Open TechVerse",
          preview: `${org?.name} added you to their organization`,
        },
        org?.locale
      )
      await this.audit.log({
        organizationId,
        userId: actor.id,
        action: "member.added_existing",
        entityType: "member",
        metadata: { email: existing.email, role, title: dto.title ?? null },
      })
      return { membership: { email: existing.email, role, organizationId }, invited: false }
    }

    const token = createHash("sha256").update(`${randomBytes(24).toString("hex")}`).digest("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const invite = await this.prisma.invite.create({
      data: {
        organizationId,
        email: dto.email,
        role,
        title: dto.title,
        token,
        invitedById: actor.id,
        expiresAt,
      },
    })

    await this.prisma.notification.create({
      data: {
        organizationId,
        userId: actor.id,
        type: NotificationType.INVITE,
        title: "Invite sent",
        body: `You invited ${dto.email} to join`,
      },
    })

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    await this.mail.send(
      "invite",
      dto.email,
      {
        organization: org?.name,
        name: dto.email,
        actionUrl: this.mail.link(`/accept-invite?token=${token}`),
        actionLabel: "Accept Invite",
        preview: `You've been invited to join ${org?.name ?? "an organization"} on TechVerse`,
      },
      org?.locale
    )

    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: "invite.created",
      entityType: "invite",
      entityId: invite.id,
      metadata: { email: dto.email, role, tokenPrefix: token.slice(0, 10) },
    })

    return { invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, invited: true }
  }

  async listInvites(organizationId: string) {
    return this.prisma.invite.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true, title: true },
    })
  }

  async revokeInvite(organizationId: string, inviteId: string, actor: AuthUser) {
    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, organizationId, status: "PENDING" },
    })
    if (!invite) throw new NotFoundException("Invite not found")
    const revoked = await this.prisma.invite.update({
      where: { id: inviteId },
      data: { status: "REVOKED" },
    })
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: "invite.revoked",
      entityType: "invite",
      entityId: inviteId,
      metadata: { email: invite.email, role: invite.role },
    })
    return revoked
  }

  async acceptInvite(token: string, userId: string, alreadyMemberOk = false) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
    })
    if (!invite || invite.status !== "PENDING") {
      throw new NotFoundException("Invite not found or already used")
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException("Invite has expired")
    }

    if (alreadyMemberOk) {
      const existing = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
      })
      if (existing) {
        await this.prisma.invite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        })
        await this.audit.log({
          organizationId: invite.organizationId,
          userId,
          action: "invite.accepted",
          entityType: "invite",
          entityId: invite.id,
          metadata: { email: invite.email, role: invite.role, reused: true },
        })
        return { organizationId: invite.organizationId }
      }
    }

    await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
      create: { organizationId: invite.organizationId, userId, role: invite.role, title: invite.title },
      update: {},
    })

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    })

    await this.audit.log({
      organizationId: invite.organizationId,
      userId,
      action: "member.joined",
      entityType: "member",
      metadata: { email: invite.email, role: invite.role, via: "invite" },
    })

    return { organizationId: invite.organizationId }
  }

  async acceptInviteOrThrow(token: string, userId: string) {
    return this.acceptInvite(token, userId, true)
  }

  async listAuditLogs(organizationId: string, action?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(action && action !== "ALL" ? { action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    })
  }

  getAccessCatalog() {
    return accessCatalog()
  }

  async updateUserStatus(organizationId: string, userId: string, dto: UpdateUserStatusDto) {
    const data: { status?: string; statusNote?: string | null; statusUntil?: Date | null; lastSeenAt?: Date | null } = {}
    if (dto.status !== undefined) data.status = dto.status
    if (dto.statusNote !== undefined) data.statusNote = dto.statusNote ?? null
    if (dto.statusUntil !== undefined) data.statusUntil = dto.statusUntil ? new Date(dto.statusUntil) : null
    if (data.status === "OFFLINE" && data.statusUntil == null) data.lastSeenAt = new Date()

    const user = await this.prisma.user.update({ where: { id: userId }, data })
    const statusPayload = {
      organizationId,
      userId: user.id,
      status: user.status,
      statusNote: user.statusNote,
      statusUntil: user.statusUntil,
      lastSeenAt: user.lastSeenAt,
    } as const
    this.events.emit("user.status", statusPayload)
    return statusPayload
  }
}