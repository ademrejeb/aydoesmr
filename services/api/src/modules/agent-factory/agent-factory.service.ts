import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { promises as dns } from "node:dns"
import { randomUUID } from "node:crypto"
import * as net from "node:net"
import { PrismaService } from "../../prisma/prisma.service"
import { EncryptionService } from "../ai/encryption.service"
import { CreateAgentConnectionDto, RunAgentDto, UpdateAgentConnectionDto } from "./dto"
import { isPrivateAddress, requestJson, type JsonResponse } from "./egress"

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

  private allowPrivate(): boolean {
    return (
      this.config.get<string>("AGENT_FACTORY_ALLOW_PRIVATE") === "true" ||
      this.config.get<string>("NODE_ENV") !== "production"
    )
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
    if (!this.allowPrivate()) {
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
      await this.assertBaseUrl(conn.baseUrl)
      const res = await requestJson(
        `${conn.baseUrl}/api/v1/gateway/agents/${encodeURIComponent(conn.agentId)}`,
        {
          method: "GET",
          headers: { authorization: `Bearer ${this.apiKey(conn)}` },
          timeoutMs: 8000,
          allowPrivate: this.allowPrivate(),
        }
      )
      const body = (res.body ?? {}) as Record<string, unknown>
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
    let response: JsonResponse
    try {
      response = await requestJson(
        `${conn.baseUrl}/api/v1/agents/${encodeURIComponent(conn.agentId)}/runs`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey(conn)}`,
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({ input: dto.input ?? {} }),
          timeoutMs: 75_000,
          allowPrivate: this.allowPrivate(),
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
    const payload = (response.body ?? {}) as Record<string, unknown>
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
