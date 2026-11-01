import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { PrismaService } from "../../prisma/prisma.service"
import { MIN_ROLE, REQUIRED_ROLE } from "../decorators/roles.decorator"
import { AuthenticatedRequest, OrgContext } from "../interfaces/authenticated-request.interface"
import { OrgRole } from "@prisma/client"

const ROLE_RANK: Record<OrgRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
}

/**
 * Requires an `X-Organization-Id` header, verifies the authenticated user is a
 * member of that organization, then attaches the resolved membership (role)
 * to the request. Optionally enforces a minimum role via @MinRole(Role).
 */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = req.user
    if (!user) throw new ForbiddenException("Authentication required")

    const organizationId = req.headers["x-organization-id"]
    if (!organizationId || Array.isArray(organizationId)) {
      throw new ForbiddenException("Missing X-Organization-Id header")
    }

    const orgId = String(organizationId)

    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    })

    if (!member) throw new ForbiddenException("Not a member of this organization")

    const orgCtx: OrgContext = {
      organizationId: orgId,
      memberId: member.id,
      role: member.role,
    }
    req.org = orgCtx

    // Minimum role enforcement.
    //
    // The class-level @MinRole(MEMBER) that most controllers carry exists to
    // protect *mutations*. For reads (GET) it is lifted so the documented
    // read-only VIEWER role can actually browse data (the access matrix grants
    // it "view" / "service_read" / "git_read"). Higher class minimums
    // (MANAGER+, ADMIN, OWNER) and any route-level decorator still apply, and
    // non-GET requests are always subject to the class minimum.
    const routeMinRole = this.reflector.get<OrgRole>(MIN_ROLE, context.getHandler())
    const classMinRole = this.reflector.get<OrgRole>(MIN_ROLE, context.getClass())
    const isRead = req.method === "GET" || req.method === "HEAD"
    const minRole =
      routeMinRole ??
      (isRead
        ? classMinRole && ROLE_RANK[classMinRole] > ROLE_RANK[OrgRole.MEMBER]
          ? classMinRole
          : null
        : classMinRole)
    if (minRole && ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(`Requires role ${minRole} or higher`)
    }

    // Required exact role
    const requiredRole = this.reflector.getAllAndOverride<OrgRole>(REQUIRED_ROLE, [
      context.getHandler(),
      context.getClass(),
    ])
    if (requiredRole && member.role !== requiredRole) {
      throw new ForbiddenException(`Requires role ${requiredRole}`)
    }

    return true
  }
}