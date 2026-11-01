import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
} from "@nestjs/common"
import type { Request } from "express"
import { Public } from "../../common/decorators/roles.decorator"
import { ServiceDeskService } from "./service-desk.service"
import { PublicCatalogQueryDto, PublicIncidentDto, PublicRequestDto, PublicTrackQueryDto } from "./dto"

/** Simple in-memory fixed-window limiter — one process, enough for abuse control. */
class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(key: string) {
    const now = Date.now()
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      if (this.hits.size > 5000) {
        for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k)
      }
      return
    }
    entry.count += 1
    if (entry.count > this.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      throw new HttpException(`Too many requests, retry in ${retryAfter}s`, HttpStatus.TOO_MANY_REQUESTS)
    }
  }
}

const HOUR = 60 * 60 * 1000

@Controller("service-desk/public")
@Public()
export class ServiceDeskPublicController {
  private readonly logger = new Logger(ServiceDeskPublicController.name)
  private readonly submitLimiter = new RateLimiter(10, HOUR)
  private readonly readLimiter = new RateLimiter(60, HOUR)

  constructor(private readonly serviceDesk: ServiceDeskService) {}

  private clientKey(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"]
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    return ip || req.socket.remoteAddress || "unknown"
  }

  /**
   * Public tenants are resolved from an explicit slug, then the `x-org-slug`
   * header, then a subdomain, then the configured default organization.
   */
  private resolveOrg(req: Request, explicit?: string) {
    const header = req.headers["x-org-slug"]
    const headerSlug = Array.isArray(header) ? header[0] : header
    let subdomain: string | undefined
    const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "").toString().split(",")[0].trim()
    if (host) {
      const labels = host.replace(/:\d+$/, "").split(".")
      if (labels.length >= 3 && !["www", "app", "api", "support"].includes(labels[0])) subdomain = labels[0]
    }
    return this.serviceDesk.resolvePortalOrg(explicit || headerSlug || subdomain)
  }

  /** Self-service catalog shown on the portal landing page. */
  @Get("catalog")
  async catalog(@Req() req: Request, @Query() query: PublicCatalogQueryDto) {
    this.readLimiter.check(this.clientKey(req))
    const org = await this.resolveOrg(req, query.orgSlug)
    return { organization: org, items: await this.serviceDesk.publicCatalog(org.id) }
  }

  /** Submit a service request without an account. */
  @Post("requests")
  async submitRequest(@Req() req: Request, @Body() dto: PublicRequestDto) {
    this.submitLimiter.check(this.clientKey(req))
    const org = await this.resolveOrg(req, dto.orgSlug)

    // Honeypot: answer like a success so bots do not learn, store nothing.
    if (dto.website) {
      this.logger.warn(`Honeypot triggered for request submission from ${this.clientKey(req)}`)
      return {
        id: null,
        number: `REQ-${String(Math.floor(Math.random() * 900000) + 100000)}`,
        status: "SUBMITTED",
        received: true,
      }
    }

    const { orgSlug, website, ...payload } = dto
    const result = await this.serviceDesk.createPublicRequest(org.id, payload)
    return { ...result, organization: org.name, received: true }
  }

  /** Report an outage without an account. */
  @Post("incidents")
  async submitIncident(@Req() req: Request, @Body() dto: PublicIncidentDto) {
    this.submitLimiter.check(this.clientKey(req))
    const org = await this.resolveOrg(req, dto.orgSlug)

    if (dto.website) {
      this.logger.warn(`Honeypot triggered for incident submission from ${this.clientKey(req)}`)
      return {
        id: null,
        number: `INC-${String(Math.floor(Math.random() * 900000) + 100000)}`,
        status: "NEW",
        received: true,
      }
    }

    const { orgSlug, website, ...payload } = dto
    const result = await this.serviceDesk.createPublicIncident(org.id, payload)
    return { ...result, organization: org.name, received: true }
  }

  /** Track any ticket with its number plus the email it was raised with. */
  @Get("track")
  @HttpCode(200)
  async track(@Req() req: Request, @Query() query: PublicTrackQueryDto) {
    this.readLimiter.check(this.clientKey(req))
    const org = await this.resolveOrg(req, query.orgSlug)
    const ticket = await this.serviceDesk.trackTicket(org.id, query.number, query.email)
    if (!ticket) {
      throw new NotFoundException("No ticket matches that number and email address")
    }
    return { organization: org.name, ticket }
  }
}