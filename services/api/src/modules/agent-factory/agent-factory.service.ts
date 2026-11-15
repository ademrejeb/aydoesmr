import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { promises as dns } from "node:dns"
import { randomUUID } from "node:crypto"
import * as net from "node:net"
import { PrismaService } from "../../prisma/prisma.service"
import { EncryptionService } from "../ai/encryption.service"
import { CreateAgentConnectionDto, RunAgentDto, UpdateAgentConnectionDto } from "./dto"

type ConnectionRow = {
  id: string
  organizationId: string
  name: string
  baseUrl: string
  agentId: string
  apiKeyEncrypted: string | null
  apiKeyHint: string | null
  status: string
  lastTestAt: Date | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}

const MAX_INPUT_BYTES = 128 * 1024

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase()
    // DNS commonly returns IPv4-mapped IPv6 addresses for dual-stack hosts.
    // Treat the embedded IPv4 address with the same rules instead of letting
    // ::ffff:127.0.0.1 (and friends) through.
    const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
    if (mapped) return isPrivateAddress(mapped[1])
    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16)
      const low = Number.parseInt(mappedHex[2], 16)
      return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
    }
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80")
    )
  }
  return true
}

@Injectable()
export class AgentFactoryService {
  private readonly logger = new Logger(AgentFactoryService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService
  ) {}

  private sanitize(row: ConnectionRow) {
    const { apiKeyEncrypted: _key, ...rest } = row
    return rest
  }

  private async assertBaseUrl(raw: string): Promise<string> {
    let url: URL
    try {
      url = new URL(raw.trim())
    } catch {
      throw new BadRequestException("Agent base URL is not a valid URL")
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new BadRequestException("Agent base URL must use http or https")
    }
    if (url.username || url.password) {
      throw new BadRequestException("Agent base URL must not contain userinfo")
    }
    const allowPrivate =
      this.config.get<string>("AGENT_FACTORY_ALLOW_PRIVATE") === "true" ||
      this.config.get<string>("NODE_ENV") !== "production"
    if (!allowPrivate) {
      // WHATWG URL keeps literal IPv6 hostnames in brackets; strip them so
      // net.isIP/dns.lookup see the address itself and public IPv6 works.
      const host = url.hostname.replace(/^\[|\]$/g, "")
      const addresses = net.isIP(host)
        ? [{ address: host }]
        : await dns.lookup(host, { all: true }).catch(() => [])
      if (addresses.length === 0) {
        throw new BadRequestException("Agent base URL host could not be resolved")
      }
      for (const entry of addresses) {
        if (entry.address === "169.254.169.254" || isPrivateAddress(entry.address)) {
          throw new BadRequestException(
            "Agent base URL cannot target a private or link-local address. " +
              "Set AGENT_FACTORY_ALLOW_PRIVATE=true only for trusted internal services."
          )
        }
      }
    }
    return raw.trim().replace(/\/+$/, "")
  }

  private apiKey(row: ConnectionRow): string {
    if (!row.apiKeyEncrypted) {
      throw new BadRequestException("This agent connection has no API key")
    }
    return this.encryption.decrypt(row.apiKeyEncrypted)
  }

  private audit(organizationId: string, userId: string | null, action: string, metadata?: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        entityType: "agent_connection",
        metadata: (metadata ?? {}) as object,
      },
    })
  }

  async list(organizationId: string) {
    const rows = await this.prisma.agentConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => this.sanitize(row as ConnectionRow))
  }

  async listRuns(organizationId: string, connectionId?: string) {
    return this.prisma.agentRun.findMany({
      where: { organizationId, ...(connectionId ? { connectionId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { connection: { select: { id: true, name: true } } },
    })
  }

  async create(organizationId: string, userId: string, dto: CreateAgentConnectionDto) {
    const baseUrl = await this.assertBaseUrl(dto.baseUrl)
    const encrypted = dto.apiKey?.trim()
      ? this.encryption.encrypt(dto.apiKey.trim())
      : null
    const conn = await this.prisma.agentConnection.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        baseUrl,
        agentId: dto.agentId.trim(),
        apiKeyEncrypted: encrypted?.cipher ?? null,
        apiKeyHint: encrypted?.hint ?? null,
        createdById: userId,
      },
    })
    await this.audit(organizationId, userId, "agent.connection.created", {
      name: conn.name,
      agentId: conn.agentId,
    })
    return this.sanitize(conn as ConnectionRow)
  }

  async update(organizationId: string, userId: string, connectionId: string, dto: UpdateAgentConnectionDto) {
    const conn = await this.find(organizationId, connectionId)
    const baseUrl = dto.baseUrl !== undefined ? await this.assertBaseUrl(dto.baseUrl) : undefined
    const encrypted = dto.apiKey?.trim()
      ? this.encryption.encrypt(dto.apiKey.trim())
      : null
    const updated = await this.prisma.agentConnection.update({
      where: { id: conn.id },
      data: {
        name: dto.name?.trim(),
        baseUrl,
        agentId: dto.agentId?.trim(),
        apiKeyEncrypted: encrypted?.cipher,
        apiKeyHint: encrypted?.hint,
        status: dto.status,
      },
    })
    await this.audit(organizationId, userId, "agent.connection.updated", {
      name: updated.name,
      fields: Object.keys(dto).join(","),
    })
    return this.sanitize(updated as ConnectionRow)
  }

  async remove(organizationId: string, userId: string, connectionId: string) {
    const conn = await this.find(organizationId, connectionId)
    await this.prisma.agentConnection.delete({ where: { id: conn.id } })
    await this.audit(organizationId, userId, "agent.connection.deleted", { name: conn.name })
    return { ok: true }
  }

  async find(organizationId: string, connectionId: string) {
    const conn = await this.prisma.agentConnection.findFirst({
      where: { id: connectionId, organizationId },
    })
    if (!conn) throw new NotFoundException("Agent connection not found")
    return conn as ConnectionRow
  }

  async test(organizationId: string, userId: string, connectionId: string) {
    const conn = await this.find(organizationId, connectionId)
    const started = Date.now()
    try {
      // Re-check at request time: a stored hostname can be re-pointed after
      // the connection was created. This does not fully close DNS rebinding,
      // but it rejects a host that already resolves to a private address.
      await this.assertBaseUrl(conn.baseUrl)
      const res = await fetch(
        `${conn.baseUrl}/api/v1/gateway/agents/${encodeURIComponent(conn.agentId)}`,
        {
          headers: { authorization: `Bearer ${this.apiKey(conn)}` },
          signal: AbortSignal.timeout(8000),
        }
      )
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "object" && body.error && "message" in body.error
            ? String((body.error as { message?: unknown }).message)
            : `Factory returned HTTP ${res.status}`
        )
      }
      const deployment = body.deployment as { status?: string } | null
      if (!deployment || deployment.status !== "active") {
        throw new Error("Agent has no active deployment. Publish it in AI Agent Factory first.")
      }
      await this.prisma.agentConnection.update({
        where: { id: conn.id },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: "ok",
          lastTestError: null,
          status: "active",
        },
      })
      await this.audit(organizationId, userId, "agent.connection.tested", {
        ok: true,
        durationMs: Date.now() - started,
      })
      return {
        ok: true,
        agent: {
          id: body.id,
          name: body.name,
          lifecycleStatus: body.lifecycle_status,
          deployment,
        },
        durationMs: Date.now() - started,
      }
    } catch (err) {
      const message = (err as Error).message.slice(0, 500)
      await this.prisma.agentConnection.update({
        where: { id: conn.id },
        data: { lastTestAt: new Date(), lastTestStatus: "fail", lastTestError: message },
      })
      await this.audit(organizationId, userId, "agent.connection.tested", { ok: false, error: message })
      return { ok: false, error: message, durationMs: Date.now() - started }
    }
  }

  async run(organizationId: string, userId: string, connectionId: string, dto: RunAgentDto) {
    const conn = await this.find(organizationId, connectionId)
    if (conn.status !== "active") {
      throw new BadRequestException("This agent connection is disabled")
    }
    await this.assertBaseUrl(conn.baseUrl)
    const raw = JSON.stringify(dto.input ?? {})
    if (Buffer.byteLength(raw, "utf8") > MAX_INPUT_BYTES) {
      throw new BadRequestException("Agent input is too large (max 128 KB)")
    }
    const started = Date.now()
    const idempotencyKey = `techverse-${randomUUID()}`
    let response: Response
    try {
      response = await fetch(
        `${conn.baseUrl}/api/v1/agents/${encodeURIComponent(conn.agentId)}/runs`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey(conn)}`,
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({ input: dto.input ?? {} }),
          signal: AbortSignal.timeout(75_000),
        }
      )
    } catch {
      const run = await this.prisma.agentRun.create({
        data: {
          organizationId,
          connectionId: conn.id,
          status: "failed",
          input: dto.input as never,
          error: "AI Agent Factory is unreachable",
          durationMs: Date.now() - started,
          createdById: userId,
        },
      })
      await this.audit(organizationId, userId, "agent.run", { ok: false, runId: run.id })
      return run
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const ok = response.ok
    const run = await this.prisma.agentRun.create({
      data: {
        organizationId,
        connectionId: conn.id,
        status: ok ? "completed" : "failed",
        input: dto.input as never,
        output: ok ? (payload as never) : undefined,
        error: ok
          ? null
          : typeof payload.error === "object" && payload.error && "message" in payload.error
            ? String((payload.error as { message?: unknown }).message).slice(0, 1000)
            : `Factory returned HTTP ${response.status}`,
        durationMs: Date.now() - started,
        providerRunId: typeof payload.run_id === "string" ? payload.run_id : null,
        createdById: userId,
      },
    })
    await this.audit(organizationId, userId, "agent.run", {
      ok,
      runId: run.id,
      providerRunId: run.providerRunId,
    })
    if (!ok) this.logger.warn(`Agent run failed for ${conn.name}: ${run.error}`)
    return run
  }
}
