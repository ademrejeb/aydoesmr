import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"
import { connect } from "net"
import { PrismaService } from "../../prisma/prisma.service"
import { runCommand, generateProvision } from "./exec.engine"
import {
  CreateDeployedAppDto,
  CreateServerDto,
  DEFAULT_PORTS,
  ExecCommandDto,
  ExecHealthDto,
  ProvisionDto,
  UpdateDeployedAppDto,
  UpdateServerDto,
  type ServerProtocol,
} from "./dto"

const IV_LENGTH = 12
const TAG_LENGTH = 16

type ServerRow = {
  id: string
  organizationId: string
  label: string
  host: string
  port: number
  protocol: string
  username: string | null
  credentialEncrypted: string | null
  credentialNonce: string | null
  lastProbeAt: Date | null
  lastProbeOk: boolean | null
  lastProbeError: string | null
  createdAt: Date
  updatedAt: Date
  apps?: unknown[]
  _count?: { apps: number }
}

/** Strips credential material from a server connection before it leaves the API. */
function sanitize(row: ServerRow) {
  const { credentialEncrypted, credentialNonce, ...rest } = row
  return { ...rest, hasCredential: Boolean(credentialEncrypted) }
}

/**
 * Server / VPS connector: high-privilege host registration with encrypted
 * credentials at rest. Only organization OWNERs may mutate connections; the
 * "test" endpoint is a plain TCP reachability probe (no SSH session is ever
 * opened from the API).
 */
@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name)
  private readonly key: Buffer

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2
  ) {
    const configured = (process.env.SERVER_CREDENTIAL_KEY ?? "").replace(/\s+/g, "")
    if (/^[0-9a-fA-F]{64}$/.test(configured)) {
      this.key = Buffer.from(configured, "hex")
    } else {
      this.key = createHash("sha256")
        .update(process.env.JWT_SECRET ?? "techdebt-server-credential-dev-secret")
        .digest()
      this.logger.warn(
        "SERVER_CREDENTIAL_KEY missing/invalid — deriving the server credential key from JWT_SECRET. Set a 64-char hex key in production."
      )
    }
  }

  private audit(organizationId: string, userId: string, action: string, entityType: string, metadata?: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        entityType,
        metadata: (metadata ?? {}) as object,
      },
    })
  }

  private emit(organizationId: string) {
    this.events.emit("servers.updated", { organizationId })
  }

  private encrypt(plain: string): { cipher: string; nonce: string } {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv("aes-256-gcm", this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return {
      cipher: Buffer.concat([encrypted, tag]).toString("base64"),
      nonce: iv.toString("base64"),
    }
  }

  private decrypt(payload: string, nonce: string): string {
    const raw = Buffer.from(payload, "base64")
    const data = raw.subarray(0, raw.length - TAG_LENGTH)
    const tag = raw.subarray(raw.length - TAG_LENGTH)
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(nonce, "base64"))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  }

  private async findServer(organizationId: string, serverId: string) {
    const server = await this.prisma.serverConnection.findFirst({
      where: { id: serverId, organizationId },
    })
    if (!server) throw new NotFoundException("Server connection not found")
    return server
  }

  private async findApp(organizationId: string, appId: string) {
    const app = await this.prisma.deployedApp.findFirst({
      where: { id: appId, organizationId },
      include: { connection: { select: { id: true, label: true, host: true } } },
    })
    if (!app) throw new NotFoundException("Deployed app not found")
    return app
  }

  /** Plain TCP reachability probe. Deliberately NOT an SSH/command session. */
  private probe(host: string, port: number): Promise<{ ok: boolean; error: string | null; latencyMs: number }> {
    return new Promise((resolve) => {
      const started = Date.now()
      let settled = false
      const socket = connect({ host, port, timeout: 5000 })
      const done = (ok: boolean, error: string | null) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve({ ok, error, latencyMs: Date.now() - started })
      }
      socket.once("connect", () => done(true, null))
      socket.once("error", (err) => done(false, err.message))
      socket.once("timeout", () => done(false, "Connection timed out"))
    })
  }

  // ------------------------------------------------------------------ //
  //  Server connections                                                 //
  // ------------------------------------------------------------------ //

  async list(organizationId: string) {
    const servers = await this.prisma.serverConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { apps: true } } },
    })
    return servers.map((s) => sanitize(s as unknown as ServerRow))
  }

  async get(organizationId: string, serverId: string) {
    const server = await this.findServer(organizationId, serverId)
    return sanitize(server as unknown as ServerRow)
  }

  async create(organizationId: string, userId: string, dto: CreateServerDto) {
    const protocol = (dto.protocol ?? "ssh") as ServerProtocol
    const port = dto.port ?? DEFAULT_PORTS[protocol]
    const credential = dto.credential?.trim()
    const encrypted = credential ? this.encrypt(credential) : null

    const server = await this.prisma.serverConnection.create({
      data: {
        organizationId,
        label: dto.label.trim(),
        host: dto.host.trim(),
        port,
        protocol,
        username: dto.username?.trim() || null,
        credentialEncrypted: encrypted?.cipher ?? null,
        credentialNonce: encrypted?.nonce ?? null,
      },
    })
    await this.audit(organizationId, userId, "server.created", "server_connection", {
      label: server.label,
      host: server.host,
    })
    this.emit(organizationId)
    return sanitize(server as unknown as ServerRow)
  }

  async update(organizationId: string, userId: string, serverId: string, dto: UpdateServerDto) {
    const server = await this.findServer(organizationId, serverId)
    const credential = dto.credential?.trim()
    const encrypted = credential ? this.encrypt(credential) : null

    const updated = await this.prisma.serverConnection.update({
      where: { id: server.id },
      data: {
        label: dto.label?.trim(),
        host: dto.host?.trim(),
        port: dto.port,
        protocol: dto.protocol,
        username: dto.username !== undefined ? (dto.username?.trim() || null) : undefined,
        credentialEncrypted: encrypted ? encrypted.cipher : undefined,
        credentialNonce: encrypted ? encrypted.nonce : undefined,
      },
    })
    await this.audit(organizationId, userId, "server.updated", "server_connection", { label: updated.label })
    this.emit(organizationId)
    return sanitize(updated as unknown as ServerRow)
  }

  async remove(organizationId: string, userId: string, serverId: string) {
    const server = await this.findServer(organizationId, serverId)
    await this.prisma.serverConnection.delete({ where: { id: server.id } })
    await this.audit(organizationId, userId, "server.deleted", "server_connection", { label: server.label })
    this.emit(organizationId)
    return { ok: true }
  }

  async test(organizationId: string, userId: string, serverId: string) {
    const server = await this.findServer(organizationId, serverId)
    const result = await this.probe(server.host, server.port)
    await this.prisma.serverConnection.update({
      where: { id: server.id },
      data: {
        lastProbeAt: new Date(),
        lastProbeOk: result.ok,
        lastProbeError: result.ok ? null : (result.error ?? "").slice(0, 500),
      },
    })
    await this.audit(organizationId, userId, result.ok ? "server.probe_ok" : "server.probe_fail", "server_connection", {
      label: server.label,
      host: server.host,
      port: server.port,
    })
    this.emit(organizationId)
    const updated = await this.findServer(organizationId, serverId)
    return { server: sanitize(updated as unknown as ServerRow), ...result }
  }

  // ------------------------------------------------------------------ //
  //  Deployed apps                                                      //
  // ------------------------------------------------------------------ //

  async listApps(organizationId: string, serverId: string) {
    await this.findServer(organizationId, serverId)
    return this.prisma.deployedApp.findMany({
      where: { connectionId: serverId, organizationId },
      orderBy: { createdAt: "desc" },
    })
  }

  async createApp(organizationId: string, userId: string, serverId: string, dto: CreateDeployedAppDto) {
    const server = await this.findServer(organizationId, serverId)
    const app = await this.prisma.deployedApp.create({
      data: {
        organizationId,
        connectionId: server.id,
        label: dto.label.trim(),
        url: dto.url.trim(),
        probePath: dto.probePath?.trim() || null,
        probeMethod: dto.probeMethod ?? "GET",
      },
    })
    await this.audit(organizationId, userId, "server.app_created", "deployed_app", { label: app.label })
    this.emit(organizationId)
    return app
  }

  async updateApp(organizationId: string, userId: string, appId: string, dto: UpdateDeployedAppDto) {
    const app = await this.findApp(organizationId, appId)
    const updated = await this.prisma.deployedApp.update({
      where: { id: app.id },
      data: {
        label: dto.label?.trim(),
        url: dto.url?.trim(),
        probePath: dto.probePath !== undefined ? (dto.probePath?.trim() || null) : undefined,
        probeMethod: dto.probeMethod,
      },
    })
    await this.audit(organizationId, userId, "server.app_updated", "deployed_app", { label: updated.label })
    this.emit(organizationId)
    return updated
  }

  async removeApp(organizationId: string, userId: string, appId: string) {
    const app = await this.findApp(organizationId, appId)
    await this.prisma.deployedApp.delete({ where: { id: app.id } })
    await this.audit(organizationId, userId, "server.app_deleted", "deployed_app", { label: app.label })
    this.emit(organizationId)
    return { ok: true }
  }

  async testApp(organizationId: string, userId: string, appId: string) {
    const app = await this.findApp(organizationId, appId)
    const target = app.probePath ? new URL(app.probePath, app.url).toString() : app.url
    const method = app.probeMethod ?? "GET"
    let result: { ok: boolean; status: number | null; error: string | null }
    try {
      const res = await fetch(target, {
        method,
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      })
      result = { ok: res.ok, status: res.status, error: null }
    } catch (e) {
      result = { ok: false, status: null, error: (e as Error).message.slice(0, 500) }
    }
    await this.prisma.deployedApp.update({
      where: { id: app.id },
      data: {
        lastCheckAt: new Date(),
        lastStatus: result.ok ? "ok" : "fail",
      },
    })
    await this.audit(organizationId, userId, result.ok ? "server.app_probe_ok" : "server.app_probe_fail", "deployed_app", {
      label: app.label,
      url: target,
    })
    this.emit(organizationId)
    const updated = await this.findApp(organizationId, appId)
    return { app: updated, ...result }
  }

  // ------------------------------------------------------------------ //
  //  Sandbox exec console + IaC provisioning                            //
  // ------------------------------------------------------------------ //

  async exec(organizationId: string, userId: string, serverId: string, dto: ExecCommandDto) {
    const server = await this.findServer(organizationId, serverId)
    const result = await runCommand(dto.command)
    await this.audit(organizationId, userId, "server.exec", "server_connection", {
      label: server.label,
      command: dto.command.slice(0, 300),
      simulated: result.simulated,
      exitCode: result.exitCode,
    })
    this.emit(organizationId)
    return { serverId, ...result }
  }

  async execHealth(organizationId: string, userId: string, serverId: string, dto: ExecHealthDto) {
    const server = await this.findServer(organizationId, serverId)
    const host = dto.host?.trim() || server.host
    const port = dto.port ?? 22
    const probe = await this.probe(host, port)
    await this.audit(organizationId, userId, "server.exec_health", "server_connection", {
      label: server.label,
      host,
      port,
      ok: probe.ok,
    })
    this.emit(organizationId)
    return { serverId, ...probe }
  }

  async provision(organizationId: string, userId: string, serverId: string, dto: ProvisionDto) {
    const server = await this.findServer(organizationId, serverId)
    const artifact = generateProvision(dto.template, dto.name.trim())
    const deployCommand = artifact.deployCommand
    await this.audit(organizationId, userId, "server.provision", "server_connection", {
      label: server.label,
      template: artifact.template,
      name: artifact.name,
      files: artifact.files.length,
      deployCommand,
    })
    this.emit(organizationId)
    return {
      serverId,
      template: artifact.template,
      name: artifact.name,
      files: artifact.files,
      steps: artifact.steps,
      deployCommand,
      simulated: true,
    }
  }
}