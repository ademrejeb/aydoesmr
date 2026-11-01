import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { NotificationType, Prisma, ServiceEntityType, ServicePriority } from "@prisma/client"
import { PrismaService } from "../../prisma/prisma.service"
import { NotificationsService } from "../notifications/notifications.service"
import { AuditService } from "../audit/audit.service"
import type { FormField } from "./dto"

export const REQUEST_INCLUDE = {
  item: { select: { id: true, name: true, category: true, icon: true, estimatedDays: true } },
  requester: { select: { id: true, fullName: true, email: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  approver: { select: { id: true, fullName: true, email: true } },
} as const

export const INCIDENT_INCLUDE = {
  assignee: { select: { id: true, fullName: true, email: true } },
  requester: { select: { id: true, fullName: true, email: true } },
  linkedRequest: { select: { id: true, number: true, title: true, status: true } },
} as const

/** Allowed status transitions for service requests. */
const REQUEST_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "FULFILLED", "CANCELLED"],
  REJECTED: ["CLOSED"],
  IN_PROGRESS: ["FULFILLED", "CANCELLED"],
  FULFILLED: ["CLOSED"],
  CANCELLED: [],
  CLOSED: [],
}

/** Allowed status transitions for incidents (RESOLVED -> IN_PROGRESS is a reopen). */
const INCIDENT_TRANSITIONS: Record<string, string[]> = {
  NEW: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
}

/** Built-in SLA targets used until an organization overrides them. */
const DEFAULT_SLA: Record<ServicePriority, { name: string; responseMinutes: number; resolveMinutes: number; businessHoursOnly: boolean }> = {
  P1: { name: "Critical", responseMinutes: 15, resolveMinutes: 240, businessHoursOnly: false },
  P2: { name: "High", responseMinutes: 60, resolveMinutes: 480, businessHoursOnly: false },
  P3: { name: "Normal", responseMinutes: 240, resolveMinutes: 1440, businessHoursOnly: true },
  P4: { name: "Low", responseMinutes: 480, resolveMinutes: 2880, businessHoursOnly: true },
}

const BUSINESS_START_HOUR = 8
const BUSINESS_END_HOUR = 18

/**
 * Add `minutes` to `from`, optionally only counting business hours
 * (Mon–Fri 08:00–18:00 in the organization's local time).
 */
export function addSlaMinutes(from: Date, minutes: number, businessHoursOnly: boolean): Date {
  if (!businessHoursOnly || minutes <= 0) return new Date(from.getTime() + minutes * 60_000)
  const cursor = new Date(from.getTime())
  let remaining = minutes
  // Bounded walk: at most ~31 days of minutes for the largest policy.
  for (let guard = 0; guard < 60_000 && remaining > 0; guard++) {
    const day = cursor.getDay()
    const hour = cursor.getHours()
    if (day === 0 || day === 6 || hour < BUSINESS_START_HOUR || hour >= BUSINESS_END_HOUR) {
      cursor.setMinutes(cursor.getMinutes() + 30, 0, 0)
      continue
    }
    // Advance in 30-minute steps, clamped so we never cross 18:00.
    const minutesLeftToday = (BUSINESS_END_HOUR * 60) - (hour * 60 + cursor.getMinutes())
    const step = Math.min(30, remaining, minutesLeftToday)
    if (step <= 0) {
      cursor.setMinutes(cursor.getMinutes() + 30, 0, 0)
      continue
    }
    cursor.setMinutes(cursor.getMinutes() + step)
    remaining -= step
  }
  return cursor
}

function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(5, Math.max(1, Math.round(value)))
}

@Injectable()
export class ServiceDeskService {
  private readonly logger = new Logger(ServiceDeskService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService
  ) {}

  private get portalOrgSlug(): string {
    return this.config.get<string>("SERVICE_PORTAL_ORG_SLUG", "techverse-studio")
  }

  // ------------------------------------------------------------------ //
  //  SLA policies                                                        //
  // ------------------------------------------------------------------ //

  async listSlaPolicies(organizationId: string) {
    const rows = await this.prisma.serviceSlaPolicy.findMany({
      where: { organizationId },
      orderBy: { priority: "asc" },
    })
    const byPriority = new Map(rows.map((r) => [r.priority, r]))
    return (Object.keys(DEFAULT_SLA) as ServicePriority[]).map((priority) => {
      const row = byPriority.get(priority)
      const fallback = DEFAULT_SLA[priority]
      return {
        priority,
        name: row?.name ?? fallback.name,
        responseMinutes: row?.responseMinutes ?? fallback.responseMinutes,
        resolveMinutes: row?.resolveMinutes ?? fallback.resolveMinutes,
        businessHoursOnly: row?.businessHoursOnly ?? fallback.businessHoursOnly,
        active: row?.active ?? true,
        custom: Boolean(row),
      }
    })
  }

  async updateSlaPolicy(organizationId: string, actorId: string, dto: {
    priority: ServicePriority
    name: string
    responseMinutes: number
    resolveMinutes: number
    businessHoursOnly?: boolean
    active?: boolean
  }) {
    if (dto.responseMinutes < 1 || dto.resolveMinutes < 1) {
      throw new BadRequestException("SLA minutes must be positive")
    }
    if (dto.resolveMinutes < dto.responseMinutes) {
      throw new BadRequestException("Resolve target must be greater than or equal to the response target")
    }
    const data = {
      name: dto.name,
      responseMinutes: dto.responseMinutes,
      resolveMinutes: dto.resolveMinutes,
      businessHoursOnly: dto.businessHoursOnly ?? false,
      active: dto.active ?? true,
    }
    const saved = await this.prisma.serviceSlaPolicy.upsert({
      where: { organizationId_priority: { organizationId, priority: dto.priority } },
      create: { organizationId, priority: dto.priority, ...data },
      update: data,
    })
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.sla_updated",
      entityType: "service_sla_policy",
      entityId: saved.id,
      metadata: { priority: dto.priority, ...data },
    })
    return saved
  }

  /** Effective SLA targets for an organization, defaults merged with overrides. */
  private async slaTargets(organizationId: string) {
    const policies = await this.listSlaPolicies(organizationId)
    return new Map(policies.map((p) => [p.priority, p]))
  }

  // ------------------------------------------------------------------ //
  //  Catalog                                                             //
  // ------------------------------------------------------------------ //

  async listCatalog(organizationId: string, includeInactive = false) {
    return this.prisma.serviceItem.findMany({
      where: { organizationId, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
  }

  async getCatalogItem(organizationId: string, itemId: string) {
    const item = await this.prisma.serviceItem.findFirst({ where: { id: itemId, organizationId } })
    if (!item) throw new NotFoundException("Service item not found")
    return item
  }

  async createCatalogItem(organizationId: string, actorId: string, dto: {
    name: string
    description: string
    category: string
    icon?: string
    requiresApproval?: boolean
    estimatedDays?: number
    sortOrder?: number
    formSchema?: FormField[]
  }) {
    const item = await this.prisma.serviceItem.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        category: dto.category.toUpperCase(),
        icon: dto.icon ?? null,
        requiresApproval: dto.requiresApproval ?? true,
        estimatedDays: dto.estimatedDays ?? null,
        sortOrder: dto.sortOrder ?? 0,
        formSchema: (dto.formSchema ?? []) as unknown as Prisma.InputJsonValue,
        createdById: actorId,
      },
    })
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.catalog_item_created",
      entityType: "service_item",
      entityId: item.id,
      metadata: { name: item.name },
    })
    this.emit(organizationId, { kind: "catalog", id: item.id })
    return item
  }

  async updateCatalogItem(organizationId: string, actorId: string, itemId: string, dto: {
    name?: string
    description?: string
    category?: string
    icon?: string
    active?: boolean
    requiresApproval?: boolean
    estimatedDays?: number
    sortOrder?: number
    formSchema?: FormField[]
  }) {
    await this.getCatalogItem(organizationId, itemId)
    const item = await this.prisma.serviceItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category.toUpperCase() } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.requiresApproval !== undefined ? { requiresApproval: dto.requiresApproval } : {}),
        ...(dto.estimatedDays !== undefined ? { estimatedDays: dto.estimatedDays } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.formSchema !== undefined ? { formSchema: dto.formSchema as unknown as Prisma.InputJsonValue } : {}),
      },
    })
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.catalog_item_updated",
      entityType: "service_item",
      entityId: item.id,
      metadata: dto as Record<string, unknown>,
    })
    this.emit(organizationId, { kind: "catalog", id: item.id })
    return item
  }

  // ------------------------------------------------------------------ //
  //  Service requests                                                    //
  // ------------------------------------------------------------------ //

  /** Sequential per-organization ticket number (REQ-000001). */
  private async nextNumber(organizationId: string, kind: "REQ" | "INC"): Promise<string> {
    const last = kind === "REQ"
      ? await this.prisma.serviceRequest.findFirst({
          where: { organizationId },
          orderBy: { number: "desc" },
          select: { number: true },
        })
      : await this.prisma.incident.findFirst({
          where: { organizationId },
          orderBy: { number: "desc" },
          select: { number: true },
        })
    let next = last ? (parseInt(last.number.split("-")[1] ?? "0", 10) || 0) + 1 : 1
    for (let attempt = 0; attempt < 5; attempt++) {
      const number = `${kind}-${String(next).padStart(6, "0")}`
      const exists = kind === "REQ"
        ? await this.prisma.serviceRequest.findFirst({ where: { organizationId, number }, select: { id: true } })
        : await this.prisma.incident.findFirst({ where: { organizationId, number }, select: { id: true } })
      if (!exists) return number
      next += 1
    }
    throw new BadRequestException("Could not allocate a ticket number, please retry")
  }

  async listRequests(
    organizationId: string,
    userId: string,
    filters: {
      status?: string
      priority?: string
      itemId?: string
      assigneeId?: string
      view?: string
      search?: string
      limit?: number
    }
  ) {
    const where: Prisma.ServiceRequestWhereInput = { organizationId }
    if (filters.status) where.status = filters.status as Prisma.EnumServiceRequestStatusFilter["equals"]
    if (filters.priority) where.priority = filters.priority as ServicePriority
    if (filters.itemId) where.itemId = filters.itemId
    if (filters.assigneeId) where.assigneeId = filters.assigneeId
    if (filters.view === "mine") where.assigneeId = userId
    if (filters.view === "unassigned") where.assigneeId = null
    if (filters.view === "requested") where.requesterId = userId
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { number: { contains: filters.search, mode: "insensitive" } },
      ]
    }
    const limit = Math.min(filters.limit ?? 100, 500)
    return this.prisma.serviceRequest.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: REQUEST_INCLUDE,
    })
  }

  async getRequest(organizationId: string, requestId: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id: requestId, organizationId },
      include: {
        ...REQUEST_INCLUDE,
        incidents: { select: { id: true, number: true, title: true, status: true, priority: true } },
      },
    })
    if (!request) throw new NotFoundException("Service request not found")
    return request
  }

  async createRequest(
    organizationId: string,
    actorId: string,
    dto: {
      title: string
      description: string
      itemId?: string
      priority?: string
      formData?: Record<string, unknown>
      assigneeId?: string
    }
  ) {
    const item = dto.itemId ? await this.getCatalogItem(organizationId, dto.itemId) : null
    const priority = (dto.priority as ServicePriority) ?? "P3"
    const sla = (await this.slaTargets(organizationId)).get(priority)
    const now = new Date()
    const request = await this.prisma.serviceRequest.create({
      data: {
        organizationId,
        number: await this.nextNumber(organizationId, "REQ"),
        itemId: item?.id ?? null,
        title: dto.title,
        description: dto.description,
        priority,
        status: item?.requiresApproval ? "PENDING_APPROVAL" : "APPROVED",
        formData: (dto.formData ?? {}) as Prisma.InputJsonValue,
        requesterId: actorId,
        assigneeId: dto.assigneeId ?? null,
        approverId: null,
        approvedAt: item?.requiresApproval ? null : now,
        targetAt: item?.estimatedDays ? addSlaMinutes(now, item.estimatedDays * 24 * 60, false) : null,
        dueAt: sla ? addSlaMinutes(now, sla.resolveMinutes, sla.businessHoursOnly) : null,
        source: "app",
      },
      include: REQUEST_INCLUDE,
    })
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.request_created",
      entityType: "service_request",
      entityId: request.id,
      metadata: { number: request.number, title: request.title, priority },
    })
    this.emit(organizationId, { kind: "request", id: request.id, number: request.number })
    return request
  }

  async updateRequest(organizationId: string, actorId: string, requestId: string, dto: {
    title?: string
    description?: string
    priority?: string
    assigneeId?: string
  }) {
    const existing = await this.getRequest(organizationId, requestId)
    if (["FULFILLED", "CLOSED", "CANCELLED"].includes(existing.status)) {
      throw new BadRequestException(`A ${existing.status.toLowerCase()} request can no longer be edited`)
    }
    const previousAssignee = existing.assigneeId
    const data: Prisma.ServiceRequestUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority as ServicePriority } : {}),
    }
    if (dto.assigneeId !== undefined) {
      data.assignee = dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : { disconnect: true }
    }
    const request = await this.prisma.serviceRequest.update({ where: { id: requestId }, data, include: REQUEST_INCLUDE })

    if (dto.priority && dto.priority !== existing.priority) {
      const sla = (await this.slaTargets(organizationId)).get(dto.priority as ServicePriority)
      if (sla) {
        await this.prisma.serviceRequest.update({
          where: { id: requestId },
          data: { dueAt: addSlaMinutes(new Date(), sla.resolveMinutes, sla.businessHoursOnly) },
        })
      }
    }
    if (dto.assigneeId && dto.assigneeId !== previousAssignee) {
      await this.notify(
        organizationId,
        dto.assigneeId,
        NotificationType.TASK_ASSIGNED,
        `Service request ${request.number} assigned to you`,
        request.title.slice(0, 80),
        `/dashboard/service-desk/requests?id=${request.id}`
      )
    }
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.request_updated",
      entityType: "service_request",
      entityId: requestId,
      metadata: dto as Record<string, unknown>,
    })
    this.emit(organizationId, { kind: "request", id: requestId })
    return request
  }

  /** Approve or reject a request that is waiting for approval. */
  async decideRequest(organizationId: string, actorId: string, requestId: string, decision: "APPROVED" | "REJECTED", note?: string) {
    const request = await this.getRequest(organizationId, requestId)
    if (request.status !== "PENDING_APPROVAL" && request.status !== "SUBMITTED") {
      throw new BadRequestException(`Request is ${request.status.toLowerCase()} and cannot be ${decision.toLowerCase()}`)
    }
    const now = new Date()
    const sla = (await this.slaTargets(organizationId)).get(request.priority)
    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        approverId: actorId,
        decisionNote: note ?? null,
        approvedAt: decision === "APPROVED" ? now : null,
        dueAt: decision === "APPROVED" && sla
          ? addSlaMinutes(now, sla.resolveMinutes, sla.businessHoursOnly)
          : request.dueAt,
      },
      include: REQUEST_INCLUDE,
    })
    if (request.requesterId && request.requesterId !== actorId) {
      await this.notify(
        organizationId,
        request.requesterId,
        NotificationType.PROJECT_UPDATE,
        `Request ${request.number} ${decision === "APPROVED" ? "approved" : "rejected"}`,
        note ?? request.title.slice(0, 80),
        `/dashboard/service-desk/requests?id=${request.id}`
      )
    }
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: `service.request_${decision === "APPROVED" ? "approved" : "rejected"}`,
      entityType: "service_request",
      entityId: requestId,
      metadata: { number: request.number, note: note ?? null },
    })
    this.emit(organizationId, { kind: "request", id: requestId, number: request.number })
    return updated
  }

  /** Move a request to another status, validating the transition. */
  async transitionRequest(organizationId: string, actorId: string, requestId: string, status: string, options: { note?: string; rating?: number }) {
    const request = await this.getRequest(organizationId, requestId)
    const allowed = REQUEST_TRANSITIONS[request.status] ?? []
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot move a ${request.status.toLowerCase()} request to ${status.toLowerCase()}`)
    }
    const now = new Date()
    const data: Prisma.ServiceRequestUpdateInput = { status: status as Prisma.EnumServiceRequestStatusFieldUpdateOperationsInput["set"] }
    if (status === "IN_PROGRESS") data.targetAt = request.targetAt ?? null
    if (status === "FULFILLED") data.resolvedAt = now
    if (status === "CLOSED") {
      data.closedAt = now
      if (!request.resolvedAt) data.resolvedAt = now
    }
    if (options.rating !== undefined) data.rating = clampRating(options.rating)

    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data,
      include: REQUEST_INCLUDE,
    })

    if (status === "FULFILLED" && request.requesterId && request.requesterId !== actorId) {
      await this.notify(
        organizationId,
        request.requesterId,
        NotificationType.PROJECT_UPDATE,
        `Request ${request.number} is fulfilled`,
        request.title.slice(0, 80),
        `/dashboard/service-desk/requests?id=${request.id}`
      )
    }
    if (options.note) {
      await this.addComment(organizationId, actorId, "REQUEST", requestId, options.note, false)
    }
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.request_status_changed",
      entityType: "service_request",
      entityId: requestId,
      metadata: { from: request.status, to: status },
    })
    this.emit(organizationId, { kind: "request", id: requestId, number: request.number })
    return updated
  }

  async rateRequest(organizationId: string, requestId: string, rating: number) {
    const request = await this.getRequest(organizationId, requestId)
    if (!["FULFILLED", "CLOSED"].includes(request.status)) {
      throw new BadRequestException("Only fulfilled requests can be rated")
    }
    return this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { rating: clampRating(rating) },
    })
  }

  // ------------------------------------------------------------------ //
  //  Incidents                                                           //
  // ------------------------------------------------------------------ //

  async listIncidents(
    organizationId: string,
    userId: string,
    filters: {
      status?: string
      priority?: string
      assigneeId?: string
      breached?: string
      view?: string
      search?: string
      limit?: number
    }
  ) {
    const where: Prisma.IncidentWhereInput = { organizationId }
    if (filters.status) where.status = filters.status as Prisma.EnumIncidentStatusFilter["equals"]
    if (filters.priority) where.priority = filters.priority as ServicePriority
    if (filters.assigneeId) where.assigneeId = filters.assigneeId
    if (filters.breached === "true") where.OR = [{ resolveBreached: true }, { responseBreached: true }]
    if (filters.view === "mine") where.assigneeId = userId
    if (filters.view === "unassigned") where.assigneeId = null
    if (filters.view === "open") where.status = { in: ["NEW", "IN_PROGRESS"] }
    if (filters.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
            { number: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      ]
    }
    const limit = Math.min(filters.limit ?? 100, 500)
    return this.prisma.incident.findMany({
      where,
      take: limit,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: INCIDENT_INCLUDE,
    })
  }

  async getIncident(organizationId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organizationId },
      include: INCIDENT_INCLUDE,
    })
    if (!incident) throw new NotFoundException("Incident not found")
    return incident
  }

  async createIncident(
    organizationId: string,
    actorId: string | null,
    dto: {
      title: string
      description: string
      priority?: string
      category?: string
      assigneeId?: string
      linkedRequestId?: string
    },
    source: "portal" | "app" = "app"
  ) {
    const priority = (dto.priority as ServicePriority) ?? "P3"
    const sla = (await this.slaTargets(organizationId)).get(priority)
    const now = new Date()
    const incident = await this.prisma.incident.create({
      data: {
        organizationId,
        number: await this.nextNumber(organizationId, "INC"),
        title: dto.title,
        description: dto.description,
        priority,
        category: dto.category ?? null,
        assigneeId: dto.assigneeId ?? null,
        requesterId: actorId,
        linkedRequestId: dto.linkedRequestId ?? null,
        responseDueAt: sla ? addSlaMinutes(now, sla.responseMinutes, sla.businessHoursOnly) : null,
        resolveDueAt: sla ? addSlaMinutes(now, sla.resolveMinutes, sla.businessHoursOnly) : null,
        source,
      },
      include: INCIDENT_INCLUDE,
    })
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.incident_created",
      entityType: "incident",
      entityId: incident.id,
      metadata: { number: incident.number, priority, source },
    })
    this.emit(organizationId, { kind: "incident", id: incident.id, number: incident.number })
    return incident
  }

  async updateIncident(organizationId: string, actorId: string, incidentId: string, dto: {
    priority?: string
    category?: string
    assigneeId?: string
    resolution?: string
    rootCause?: string
  }) {
    const existing = await this.getIncident(organizationId, incidentId)
    if (existing.status === "CLOSED") {
      throw new BadRequestException("A closed incident can no longer be edited")
    }
    const data: Prisma.IncidentUpdateInput = {
      ...(dto.priority !== undefined ? { priority: dto.priority as ServicePriority } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
      ...(dto.rootCause !== undefined ? { rootCause: dto.rootCause } : {}),
    }
    if (dto.assigneeId !== undefined) {
      data.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true }
    }
    if (dto.priority && dto.priority !== existing.priority) {
      const sla = (await this.slaTargets(organizationId)).get(dto.priority as ServicePriority)
      if (sla && !existing.firstRespondedAt) {
        data.responseDueAt = addSlaMinutes(new Date(), sla.responseMinutes, sla.businessHoursOnly)
      }
      if (sla && !existing.resolvedAt) {
        data.resolveDueAt = addSlaMinutes(new Date(), sla.resolveMinutes, sla.businessHoursOnly)
      }
    }
    const incident = await this.prisma.incident.update({ where: { id: incidentId }, data, include: INCIDENT_INCLUDE })
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      await this.notify(
        organizationId,
        dto.assigneeId,
        NotificationType.TASK_ASSIGNED,
        `Incident ${incident.number} assigned to you`,
        incident.title.slice(0, 80),
        `/dashboard/service-desk/incidents?id=${incident.id}`
      )
    }
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.incident_updated",
      entityType: "incident",
      entityId: incidentId,
      metadata: dto as Record<string, unknown>,
    })
    this.emit(organizationId, { kind: "incident", id: incidentId })
    return incident
  }

  async transitionIncident(organizationId: string, actorId: string, incidentId: string, status: string, details: { resolution?: string; rootCause?: string }) {
    const incident = await this.getIncident(organizationId, incidentId)
    const allowed = INCIDENT_TRANSITIONS[incident.status] ?? []
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot move a ${incident.status.toLowerCase()} incident to ${status.toLowerCase()}`)
    }
    const now = new Date()
    const data: Prisma.IncidentUpdateInput = { status: status as Prisma.EnumIncidentStatusFieldUpdateOperationsInput["set"] }
    const sla = (await this.slaTargets(organizationId)).get(incident.priority)

    if (status === "IN_PROGRESS" && !incident.firstRespondedAt) {
      data.firstRespondedAt = now
      if (incident.responseDueAt && now > incident.responseDueAt) data.responseBreached = true
    }
    if (status === "RESOLVED") {
      data.resolvedAt = now
      if (!incident.firstRespondedAt) data.firstRespondedAt = now
      if (incident.resolveDueAt) {
        data.resolveBreached = now > incident.resolveDueAt
        if (sla) data.resolveDueAt = addSlaMinutes(now, sla.resolveMinutes, sla.businessHoursOnly)
      }
      if (details.resolution) data.resolution = details.resolution
      if (details.rootCause) data.rootCause = details.rootCause
    }
    if (status === "IN_PROGRESS" && incident.status === "RESOLVED") {
      data.resolvedAt = null
      data.resolveBreached = false
      data.reopenCount = { increment: 1 }
      if (sla) data.resolveDueAt = addSlaMinutes(now, sla.resolveMinutes, sla.businessHoursOnly)
    }
    if (status === "CLOSED") {
      data.closedAt = now
      if (!incident.resolvedAt) data.resolvedAt = now
    }

    const updated = await this.prisma.incident.update({ where: { id: incidentId }, data, include: INCIDENT_INCLUDE })

    if (incident.requesterId && incident.requesterId !== actorId && ["RESOLVED", "CLOSED"].includes(status)) {
      await this.notify(
        organizationId,
        incident.requesterId,
        NotificationType.PROJECT_UPDATE,
        `Incident ${incident.number} was ${status.toLowerCase()}`,
        updated.resolution ?? updated.title.slice(0, 80),
        `/dashboard/service-desk/incidents?id=${updated.id}`
      )
    }
    if (status === "RESOLVED" && details.rootCause) {
      this.logger.log(`Incident ${incident.number} resolved; suggest a KB article for the root cause`)
    }
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.incident_status_changed",
      entityType: "incident",
      entityId: incidentId,
      metadata: { from: incident.status, to: status },
    })
    this.emit(organizationId, { kind: "incident", id: incidentId, number: incident.number })
    return updated
  }

  // ------------------------------------------------------------------ //
  //  Comments                                                            //
  // ------------------------------------------------------------------ //

  async listComments(organizationId: string, entityType: ServiceEntityType, entityId: string) {
    return this.prisma.serviceComment.findMany({
      where: { organizationId, entityType, entityId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    })
  }

  async addComment(
    organizationId: string,
    actorId: string | null,
    entityType: "REQUEST" | "INCIDENT" | "ARTICLE",
    entityId: string,
    body: string,
    internal: boolean
  ) {
    const comment = await this.prisma.serviceComment.create({
      data: {
        organizationId,
        entityType: entityType as ServiceEntityType,
        entityId,
        authorId: actorId,
        authorName: actorId ? null : "Portal",
        body,
        internal,
      },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    })
    await this.notifyWatchers(organizationId, actorId, entityType, entityId, comment.id)
    this.emit(organizationId, { kind: entityType.toLowerCase(), id: entityId })
    return comment
  }

  /** Notify the other party of a ticket when a comment is added. */
  private async notifyWatchers(
    organizationId: string,
    actorId: string | null,
    entityType: "REQUEST" | "INCIDENT" | "ARTICLE",
    entityId: string,
    commentId: string
  ) {
    try {
      if (entityType === "REQUEST") {
        const request = await this.prisma.serviceRequest.findFirst({
          where: { id: entityId, organizationId },
          select: { number: true, title: true, requesterId: true, assigneeId: true },
        })
        if (!request) return
        const recipients = new Set([request.requesterId, request.assigneeId].filter(Boolean) as string[])
        recipients.delete(actorId ?? "")
        for (const userId of recipients) {
          await this.notify(organizationId, userId, NotificationType.COMMENT, `New comment on ${request.number}`, request.title.slice(0, 80), `/dashboard/service-desk/requests?id=${entityId}&comment=${commentId}`)
        }
      } else if (entityType === "INCIDENT") {
        const incident = await this.prisma.incident.findFirst({
          where: { id: entityId, organizationId },
          select: { number: true, title: true, requesterId: true, assigneeId: true },
        })
        if (!incident) return
        const recipients = new Set([incident.requesterId, incident.assigneeId].filter(Boolean) as string[])
        recipients.delete(actorId ?? "")
        for (const userId of recipients) {
          await this.notify(organizationId, userId, NotificationType.COMMENT, `New comment on ${incident.number}`, incident.title.slice(0, 80), `/dashboard/service-desk/incidents?id=${entityId}&comment=${commentId}`)
        }
      }
    } catch (e) {
      this.logger.warn(`Could not notify watchers: ${(e as Error).message}`)
    }
  }

  // ------------------------------------------------------------------ //
  //  Knowledge base                                                     //
  // ------------------------------------------------------------------ //

  async listArticles(organizationId: string, filters: { category?: string; search?: string; publishedOnly?: boolean; limit?: number } = {}) {
    return this.prisma.knowledgeArticle.findMany({
      where: {
        organizationId,
        ...(filters.category ? { category: filters.category.toUpperCase() } : {}),
        ...(filters.publishedOnly === false ? {} : { published: true }),
        ...(filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: "insensitive" as const } },
                { summary: { contains: filters.search, mode: "insensitive" as const } },
                { body: { contains: filters.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(filters.limit ?? 100, 200),
      include: { author: { select: { id: true, fullName: true, email: true } } },
    })
  }

  async getArticle(organizationId: string, articleId: string, countView = false) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    })
    if (!article) throw new NotFoundException("Article not found")
    if (countView) {
      const updated = await this.prisma.knowledgeArticle.update({
        where: { id: articleId },
        data: { views: { increment: 1 } },
        select: { views: true },
      })
      return { ...article, views: updated.views }
    }
    return article
  }

  async createArticle(organizationId: string, actorId: string, dto: {
    title: string
    body: string
    summary?: string
    category: string
    tags?: string[]
    published?: boolean
  }) {
    const slug = await this.uniqueSlug(organizationId, dto.title)
    const article = await this.prisma.knowledgeArticle.create({
      data: {
        organizationId,
        title: dto.title,
        slug,
        body: dto.body,
        summary: dto.summary ?? dto.body.slice(0, 160),
        category: dto.category.toUpperCase(),
        tags: (dto.tags ?? []) as unknown as Prisma.InputJsonValue,
        published: dto.published ?? true,
        authorId: actorId,
      },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    })
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.article_created",
      entityType: "knowledge_article",
      entityId: article.id,
      metadata: { title: article.title },
    })
    this.emit(organizationId, { kind: "article", id: article.id })
    return article
  }

  async updateArticle(organizationId: string, actorId: string, articleId: string, dto: {
    title?: string
    body?: string
    summary?: string
    category?: string
    tags?: string[]
    published?: boolean
  }) {
    await this.getArticle(organizationId, articleId)
    const article = await this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title, slug: await this.uniqueSlug(organizationId, dto.title, articleId) } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.category !== undefined ? { category: dto.category.toUpperCase() } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
      },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    })
    await this.audit.log({
      organizationId,
      userId: actorId,
      action: "service.article_updated",
      entityType: "knowledge_article",
      entityId: articleId,
      metadata: dto as Record<string, unknown>,
    })
    this.emit(organizationId, { kind: "article", id: articleId })
    return article
  }

  async articleFeedback(organizationId: string, articleId: string, helpful: boolean) {
    await this.getArticle(organizationId, articleId)
    return this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: helpful ? { helpful: { increment: 1 } } : { notHelpful: { increment: 1 } },
      select: { id: true, helpful: true, notHelpful: true, views: true },
    })
  }

  private async uniqueSlug(organizationId: string, title: string, excludeId?: string): Promise<string> {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9\u0621-\u064A\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "article"
    let slug = base
    for (let i = 2; i < 50; i++) {
      const existing = await this.prisma.knowledgeArticle.findFirst({
        where: { organizationId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      })
      if (!existing) return slug
      slug = `${base}-${i}`
    }
    return `${base}-${Date.now()}`
  }

  // ------------------------------------------------------------------ //
  //  Queue + overview                                                    //
  // ------------------------------------------------------------------ //

  /** The signed-in agent's workload across requests and incidents. */
  async getQueue(organizationId: string, userId: string) {
    const [requests, incidents] = await Promise.all([
      this.prisma.serviceRequest.groupBy({
        by: ["status"],
        where: { organizationId, assigneeId: userId },
        _count: { _all: true },
      }),
      this.prisma.incident.groupBy({
        by: ["status"],
        where: { organizationId, assigneeId: userId },
        _count: { _all: true },
      }),
    ])
    const toMap = (rows: { status: string; _count: { _all: number } }[]) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = r._count._all
        return acc
      }, {})
    return { requests: toMap(requests), incidents: toMap(incidents) }
  }

  /** Dashboard aggregates: volumes, SLA compliance, MTTR, workload, activity. */
  async getOverview(organizationId: string, userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const openRequestStatuses = ["SUBMITTED", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS"] as const

    const [
      totalRequests,
      openRequests,
      pendingApprovals,
      totalIncidents,
      openIncidents,
      breachedIncidents,
      unassignedIncidents,
      requestsByStatus,
      incidentsByStatus,
      incidentsByPriority,
      resolvedIncidents,
      ratedRequests,
      topItems,
      workload,
      recentComments,
    ] = await Promise.all([
      this.prisma.serviceRequest.count({ where: { organizationId } }),
      this.prisma.serviceRequest.count({ where: { organizationId, status: { in: [...openRequestStatuses] } } }),
      this.prisma.serviceRequest.count({ where: { organizationId, status: "PENDING_APPROVAL" } }),
      this.prisma.incident.count({ where: { organizationId } }),
      this.prisma.incident.count({ where: { organizationId, status: { in: ["NEW", "IN_PROGRESS"] } } }),
      this.prisma.incident.count({ where: { organizationId, OR: [{ resolveBreached: true }, { responseBreached: true }], status: { in: ["NEW", "IN_PROGRESS"] } } }),
      this.prisma.incident.count({ where: { organizationId, assigneeId: null, status: { in: ["NEW", "IN_PROGRESS"] } } }),
      this.prisma.serviceRequest.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
      this.prisma.incident.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
      this.prisma.incident.groupBy({ by: ["priority"], where: { organizationId, status: { in: ["NEW", "IN_PROGRESS"] } }, _count: { _all: true } }),
      this.prisma.incident.findMany({
        where: { organizationId, resolvedAt: { not: null }, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, resolvedAt: true, firstRespondedAt: true, resolveDueAt: true },
      }),
      this.prisma.serviceRequest.aggregate({
        where: { organizationId, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.serviceItem.findMany({
        where: { organizationId, active: true },
        orderBy: { sortOrder: "asc" },
        take: 5,
        select: { id: true, name: true, category: true, icon: true, _count: { select: { requests: true } } },
      }),
      this.prisma.incident.groupBy({
        by: ["assigneeId"],
        where: { organizationId, status: { in: ["NEW", "IN_PROGRESS"] } },
        _count: { _all: true },
        orderBy: { _count: { assigneeId: "desc" } },
        take: 6,
      }),
      this.prisma.serviceComment.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          body: true,
          createdAt: true,
          author: { select: { fullName: true } },
        },
      }),
    ])

    const workloadRows = await this.prisma.user.findMany({
      where: { id: { in: workload.map((w) => w.assigneeId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, fullName: true, email: true },
    })
    const nameOf = new Map(workloadRows.map((u) => [u.id, u.fullName ?? u.email]))

    // SLA compliance + MTTR over resolved incidents in the window.
    let metOnTime = 0
    let measurable = 0
    let resolveHours = 0
    let responseMinutes = 0
    let responseSamples = 0
    for (const inc of resolvedIncidents) {
      if (inc.resolveDueAt && inc.resolvedAt) {
        measurable += 1
        if (inc.resolvedAt <= inc.resolveDueAt) metOnTime += 1
      }
      if (inc.resolvedAt) {
        resolveHours += (inc.resolvedAt.getTime() - inc.createdAt.getTime()) / 3_600_000
      }
      if (inc.firstRespondedAt) {
        responseMinutes += (inc.firstRespondedAt.getTime() - inc.createdAt.getTime()) / 60_000
        responseSamples += 1
      }
    }

    const byStatus = (rows: { status: string; _count: { _all: number } }[]) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = r._count._all
        return acc
      }, {})

    const activityNumbers = new Map<string, string>()
    const [requestRefs, incidentRefs] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where: { organizationId, id: { in: recentComments.filter((c) => c.entityType === "REQUEST").map((c) => c.entityId) } },
        select: { id: true, number: true },
      }),
      this.prisma.incident.findMany({
        where: { organizationId, id: { in: recentComments.filter((c) => c.entityType === "INCIDENT").map((c) => c.entityId) } },
        select: { id: true, number: true },
      }),
    ])
    for (const r of requestRefs) activityNumbers.set(r.id, r.number)
    for (const i of incidentRefs) activityNumbers.set(i.id, i.number)

    return {
      requests: {
        total: totalRequests,
        open: openRequests,
        pendingApprovals,
        byStatus: byStatus(requestsByStatus),
      },
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        breached: breachedIncidents,
        unassigned: unassignedIncidents,
        byStatus: byStatus(incidentsByStatus),
        byPriority: incidentsByPriority.reduce<Record<string, number>>((acc, r) => {
          acc[r.priority] = r._count._all
          return acc
        }, {}),
      },
      sla: {
        compliance: measurable > 0 ? Math.round((metOnTime / measurable) * 100) : null,
        measurable,
        avgResolutionHours: resolvedIncidents.length > 0 ? Math.round((resolveHours / resolvedIncidents.length) * 10) / 10 : null,
        avgFirstResponseMinutes: responseSamples > 0 ? Math.round(responseMinutes / responseSamples) : null,
      },
      satisfaction: {
        average: ratedRequests._avg.rating ? Math.round(ratedRequests._avg.rating * 100) / 100 : null,
        responses: ratedRequests._count.rating,
      },
      topItems: topItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        icon: item.icon,
        requests: item._count.requests,
      })),
      workload: workload.map((w) => ({
        assigneeId: w.assigneeId,
        name: w.assigneeId ? nameOf.get(w.assigneeId) ?? "—" : null,
        open: w._count._all,
      })),
      recentActivity: recentComments.map((c) => ({
        id: c.id,
        entityType: c.entityType,
        entityId: c.entityId,
        reference: activityNumbers.get(c.entityId) ?? null,
        body: c.body.slice(0, 140),
        author: c.author?.fullName ?? "Portal",
        createdAt: c.createdAt,
      })),
      myQueue: await this.getQueue(organizationId, userId),
    }
  }

  // ------------------------------------------------------------------ //
  //  Public portal helpers                                              //
  // ------------------------------------------------------------------ //

  /** Resolve the organization a public (unauthenticated) caller targets. */
  async resolvePortalOrg(slugFromRequest?: string) {
    const slug = slugFromRequest?.trim() || this.portalOrgSlug
    const org = await this.prisma.organization.findFirst({
      where: { slug },
      select: { id: true, name: true, slug: true },
    })
    if (!org) throw new NotFoundException("Service portal not found for this organization")
    return org
  }

  async publicCatalog(organizationId: string) {
    const items = await this.listCatalog(organizationId)
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      icon: item.icon,
      estimatedDays: item.estimatedDays,
      formSchema: item.formSchema as unknown as FormField[],
    }))
  }

  /** Submit a request from the public portal (no authenticated user). */
  async createPublicRequest(
    organizationId: string,
    dto: { name: string; email: string; title: string; description: string; itemId?: string; priority?: string; formData?: Record<string, unknown> }
  ) {
    const item = dto.itemId ? await this.getCatalogItem(organizationId, dto.itemId) : null
    const priority = (dto.priority as ServicePriority) ?? "P3"
    const sla = (await this.slaTargets(organizationId)).get(priority)
    const now = new Date()
    const request = await this.prisma.serviceRequest.create({
      data: {
        organizationId,
        number: await this.nextNumber(organizationId, "REQ"),
        itemId: item?.id ?? null,
        title: dto.title,
        description: dto.description,
        priority,
        status: item?.requiresApproval ? "PENDING_APPROVAL" : "APPROVED",
        formData: (dto.formData ?? {}) as Prisma.InputJsonValue,
        requesterEmail: dto.email,
        requesterName: dto.name,
        approvedAt: item?.requiresApproval ? null : now,
        targetAt: item?.estimatedDays ? addSlaMinutes(now, item.estimatedDays * 24 * 60, false) : null,
        dueAt: sla ? addSlaMinutes(now, sla.resolveMinutes, sla.businessHoursOnly) : null,
        source: "portal",
      },
    })
    await this.audit.log({
      organizationId,
      userId: null,
      action: "service.portal_request_created",
      entityType: "service_request",
      entityId: request.id,
      metadata: { number: request.number, email: dto.email },
    })
    this.emit(organizationId, { kind: "request", id: request.id, number: request.number })
    return { id: request.id, number: request.number, status: request.status, dueAt: request.dueAt, targetAt: request.targetAt }
  }

  async createPublicIncident(
    organizationId: string,
    dto: { name: string; email: string; title: string; description: string; priority?: string; category?: string }
  ) {
    const priority = (dto.priority as ServicePriority) ?? "P3"
    const sla = (await this.slaTargets(organizationId)).get(priority)
    const now = new Date()
    const incident = await this.prisma.incident.create({
      data: {
        organizationId,
        number: await this.nextNumber(organizationId, "INC"),
        title: dto.title,
        description: dto.description,
        priority,
        category: dto.category ?? null,
        requesterEmail: dto.email,
        requesterName: dto.name,
        responseDueAt: sla ? addSlaMinutes(now, sla.responseMinutes, sla.businessHoursOnly) : null,
        resolveDueAt: sla ? addSlaMinutes(now, sla.resolveMinutes, sla.businessHoursOnly) : null,
        source: "portal",
      },
    })
    await this.audit.log({
      organizationId,
      userId: null,
      action: "service.portal_incident_created",
      entityType: "incident",
      entityId: incident.id,
      metadata: { number: incident.number, email: dto.email },
    })
    this.emit(organizationId, { kind: "incident", id: incident.id, number: incident.number })
    return { id: incident.id, number: incident.number, status: incident.status, dueAt: incident.resolveDueAt }
  }

  /** Track a ticket with number + the email it was raised with. */
  async trackTicket(organizationId: string, number: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const request = await this.prisma.serviceRequest.findFirst({
      where: { organizationId, number: number.trim().toUpperCase(), requesterEmail: normalizedEmail },
      select: {
        id: true, number: true, title: true, status: true, priority: true,
        createdAt: true, updatedAt: true, targetAt: true, dueAt: true,
        item: { select: { name: true } },
      },
    })
    if (request) return { kind: "request", ...request }

    const incident = await this.prisma.incident.findFirst({
      where: { organizationId, number: number.trim().toUpperCase(), requesterEmail: normalizedEmail },
      select: {
        id: true, number: true, title: true, status: true, priority: true,
        createdAt: true, updatedAt: true, resolveDueAt: true, resolvedAt: true,
      },
    })
    if (incident) return { kind: "incident", ...incident }
    return null
  }

  // ------------------------------------------------------------------ //
  //  Helpers                                                             //
  // ------------------------------------------------------------------ //

  /** Members that can be assigned tickets (used by the UI pickers). */
  async listAgents(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId, role: { in: ["OWNER", "ADMIN", "MANAGER", "MEMBER"] } },
      orderBy: { createdAt: "asc" },
      select: { userId: true, role: true, user: { select: { id: true, fullName: true, email: true } } },
    })
  }

  /** Managers can approve; used to gate the UI and enforce in the service. */
  async assertCanDecide(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    })
    const rank: Record<string, number> = { VIEWER: 0, MEMBER: 1, MANAGER: 2, ADMIN: 3, OWNER: 4 }
    if (!member || (rank[member.role] ?? 0) < 2) {
      throw new ForbiddenException("Only managers can decide service requests")
    }
  }

  private async notify(organizationId: string, userId: string, type: NotificationType, title: string, body?: string, link?: string) {
    try {
      await this.notifications.create(organizationId, userId, type, title, body, link)
    } catch (e) {
      this.logger.warn(`Notification failed: ${(e as Error).message}`)
    }
  }

  private emit(organizationId: string, payload: { kind: string; id: string; number?: string }) {
    this.events.emit("service.updated", { organizationId, ...payload })
  }
}