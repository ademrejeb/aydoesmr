import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { PrismaService } from "../../prisma/prisma.service"
import { hashToken } from "./git-host"
import { OrgRole } from "@prisma/client"
import type { AuthenticatedRequest, AuthUser, OrgContext } from "../../common/interfaces/authenticated-request.interface"

const ROLE_RANK: Record<OrgRole, number> = { VIEWER: 0, MEMBER: 1, MANAGER: 2, ADMIN: 3, OWNER: 4 }

/**
 * Auth gate for the Smart HTTP git endpoints. Accepts, in order:
 *  - Basic:  username = user email, password = JWT access token OR Git access token
 *  - Bearer: standard JWT access token
 * Resolves the organization from the URL segment (slug or id), verifies membership,
 * and enforces VIEWER+ for reads and MEMBER+ for pushes.
 */
@Injectable()
export class GitAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest & { params: { owner: string } }>()
    const auth = req.headers["authorization"]

    let user: AuthUser | null = null
    if (auth && !Array.isArray(auth)) {
      user = await this.resolve(auth)
    }
    const url = String((req as { url?: string }).url ?? Object(req).url ?? "")
    const write = url.includes("receive-pack")
    if (!user) {
      // No credentials: hand off to the controller, which either serves public reads
      // or issues a 401 challenge so git retries with the URL credentials.
      ;(req as { gitAnonymous?: boolean }).gitAnonymous = true
      return true
    }

    const member = await this.resolveMember(user.id, req.params.owner)
    if (!member) throw new ForbiddenException("Not a member of this organization")

    const minRole: OrgRole = write ? OrgRole.MEMBER : OrgRole.VIEWER
    if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(`Requires ${minRole}+ to ${write ? "push" : "read"}`)
    }

    req.user = user
    req.org = { organizationId: member.organizationId, memberId: member.id, role: member.role }
    return true
  }

  private async resolve(authHeader: string): Promise<AuthUser | null> {
    const [scheme, raw] = authHeader.split(" ")
    if (scheme?.toLowerCase() === "bearer" && raw) {
      const payload = this.verifyAccessToken(raw)
      if (!payload) return null
      return { id: payload.sub, email: payload.email }
    }
    if (scheme?.toLowerCase() === "basic" && raw) {
      let decoded = ""
      try { decoded = Buffer.from(raw, "base64").toString("utf8") } catch { return null }
      const sep = decoded.indexOf(":")
      if (sep < 0) return null
      // Username is advisory only (git URLs or `x-access-token`); the credential identifies the user.
      const username = decoded.slice(0, sep).toLowerCase()
      const password = decoded.slice(sep + 1)

      const payload = this.verifyAccessToken(password)
      if (payload) {
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
        if (user) return { id: user.id, email: user.email }
      }

      const token = await this.prisma.gitToken.findFirst({
        where: { tokenHash: hashToken(password), revokedAt: null },
      })
      if (token) {
        const owner = await this.prisma.user.findUnique({ where: { id: token.userId } })
        if (!owner) return null
        if (username && !username.endsWith("x-access-token") && username.includes("@") && username !== owner.email.toLowerCase()) {
          return null
        }
        await this.prisma.gitToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
        return { id: owner.id, email: owner.email }
      }
      return null
    }
    return null
  }

  private verifyAccessToken(token: string): { sub: string; email: string } | null {
    try {
      const payload = this.jwt.verify(token) as { sub: string; email?: string; type?: string }
      if (payload.type && payload.type !== "access") return null
      return { sub: payload.sub, email: payload.email ?? "" }
    } catch {
      return null
    }
  }

  private async resolveMember(userId: string, owner: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: owner }, { slug: owner }] },
      select: { id: true, slug: true },
    })
    if (!org) return null
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId } },
    })
    return member
  }
}