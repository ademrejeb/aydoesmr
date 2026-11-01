import { Injectable, Logger } from "@nestjs/common"
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { JwtService } from "@nestjs/jwt"
import type { Server, Socket } from "socket.io"
import { PrismaService } from "../prisma/prisma.service"

interface AuthPayload {
  token?: string
  organizationId?: string
}

/** Realtime push for the platform: notifications, task updates, scan progress. */
@Injectable()
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: "/",
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name)
  private readonly online = new Map<string, { sockets: number; organizationId: string }>()

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly events: EventEmitter2,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    this.events.on("notification.created", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("notification", payload)
    })

    this.events.on("task.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("task:updated", payload)
    })

    // Chat events — pushed to the org room; clients filter by membership.
    this.events.on("conversation.new", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("conversation:new", payload)
    })

    this.events.on("message.sent", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("message:new", payload)
    })

    this.events.on("message.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("message:updated", payload)
    })

    this.events.on("conversation.archived", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("conversation:archived", payload)
    })

    this.events.on("conversation.read", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("message:read", payload)
    })

    this.events.on("conversation.typing", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("typing", payload)
    })

    this.events.on("user.status", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("user:status", payload)
    })

    this.events.on("sprint.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("sprint:updated", payload)
    })

    this.events.on("workflow.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("workflow:updated", payload)
    })

    this.events.on("repo.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("repo:updated", payload)
    })

    this.events.on("gitrepo.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("gitrepo:updated", payload)
    })

    this.events.on("pipeline.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("pipeline:updated", payload)
    })

    this.events.on("ai.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("ai:updated", payload)
    })

this.events.on("ai.actions.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("ai.actions:updated", payload)
    })

    this.events.on("service.updated", (payload) => {
      const room = `org:${payload.organizationId}`
      this.server?.to(room).emit("service:updated", payload)
    })
  }

  handleConnection(client: Socket) {
    const auth = (client.handshake.auth ?? {}) as AuthPayload
    const headerOrg = client.handshake.headers["x-organization-id"]
    const organizationId =
      auth.organizationId ?? (Array.isArray(headerOrg) ? headerOrg[0] : headerOrg)

    const token = auth.token ?? client.handshake.auth?.token
    if (!token) {
      this.logger.warn(`Realtime connection rejected (no token): ${client.id}`)
      client.disconnect(true)
      return
    }

    const payload = this.verifyAndDecode(token)
    if (!payload) {
      this.logger.warn(`Realtime connection rejected (bad token): ${client.id}`)
      client.disconnect(true)
      return
    }

    client.join(`user:${payload.sub}`)
    if (organizationId) {
      client.join(`org:${organizationId}`)
      const entry = this.online.get(payload.sub) ?? { sockets: 0, organizationId }
      entry.sockets += 1
      entry.organizationId = organizationId
      this.online.set(payload.sub, entry)
      this.prisma.user
        .updateMany({ where: { id: payload.sub }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined)
      this.server?.to(`org:${organizationId}`).emit("presence", {
        organizationId,
        userId: payload.sub,
        online: true,
      })
    }
  }

  handleDisconnect(client: Socket) {
    const token = (client.handshake.auth as AuthPayload)?.token
    const userId = token ? this.verifyAndDecode(token)?.sub : undefined
    if (!userId) return
    const entry = this.online.get(userId)
    if (!entry) return
    entry.sockets -= 1
    if (entry.sockets <= 0) {
      this.online.delete(userId)
      this.server?.to(`org:${entry.organizationId}`).emit("presence", {
        organizationId: entry.organizationId,
        userId,
        online: false,
      })
      void this.prisma.user.updateMany({
        where: { id: userId },
        data: { status: "OFFLINE", lastSeenAt: new Date() },
      })
      this.server?.to(`org:${entry.organizationId}`).emit("user:status", {
        organizationId: entry.organizationId,
        userId,
        status: "OFFLINE",
        statusNote: null,
        statusUntil: null,
        lastSeenAt: new Date(),
      })
    }
  }

  /** Returns decoded payload or null. */
  private verifyAndDecode(token: string): { sub: string; type: string } | null {
    try {
      const payload = this.jwt.verify(token) as { sub: string; type: string }
      if (payload.type !== "access") return null
      return payload
    } catch {
      return null
    }
  }

  private decodeUser(client: Socket): string | null {
    const token = (client.handshake.auth as AuthPayload)?.token
    return token ? this.verifyAndDecode(token)?.sub ?? null : null
  }

  /** Both users must be members of the conversation before signaling is relayed. */
  private async canSignal(a: string, b: string, conversationId: string): Promise<boolean> {
    try {
      const conv = await this.prisma.conversation.findFirst({
        where: { id: conversationId },
        select: { members: { select: { userId: true } } },
      })
      if (!conv) return false
      const ids = new Set(conv.members.map((m) => m.userId))
      return ids.has(a) && ids.has(b)
    } catch {
      return false
    }
  }

  // WebRTC call signaling (Phase 7) — the gateway only relays SDP/ICE between
  // members of the same conversation; media flows peer-to-peer in the browser.
  @SubscribeMessage("call:offer")
  async onCallOffer(client: Socket, payload: { conversationId: string; to: string; offer: unknown }) {
    const from = this.decodeUser(client)
    if (!from || !payload?.to || !payload?.conversationId) return
    if (!(await this.canSignal(from, payload.to, payload.conversationId))) return
    this.server?.to(`user:${payload.to}`).emit("call:incoming", {
      conversationId: payload.conversationId,
      from,
      offer: payload.offer,
    })
  }

  @SubscribeMessage("call:answer")
  async onCallAnswer(client: Socket, payload: { conversationId: string; to: string; answer: unknown }) {
    const from = this.decodeUser(client)
    if (!from || !payload?.to || !payload?.conversationId) return
    if (!(await this.canSignal(from, payload.to, payload.conversationId))) return
    this.server?.to(`user:${payload.to}`).emit("call:answered", {
      conversationId: payload.conversationId,
      from,
      answer: payload.answer,
    })
  }

  @SubscribeMessage("call:ice")
  async onCallIce(client: Socket, payload: { conversationId: string; to: string; candidate: unknown }) {
    const from = this.decodeUser(client)
    if (!from || !payload?.to || !payload?.conversationId) return
    if (!(await this.canSignal(from, payload.to, payload.conversationId))) return
    this.server?.to(`user:${payload.to}`).emit("call:ice", {
      conversationId: payload.conversationId,
      from,
      candidate: payload.candidate,
    })
  }

  @SubscribeMessage("call:end")
  async onCallEnd(client: Socket, payload: { conversationId: string; to: string }) {
    const from = this.decodeUser(client)
    if (!from || !payload?.to || !payload?.conversationId) return
    if (!(await this.canSignal(from, payload.to, payload.conversationId))) return
    this.server?.to(`user:${payload.to}`).emit("call:ended", {
      conversationId: payload.conversationId,
      from,
    })
  }
}