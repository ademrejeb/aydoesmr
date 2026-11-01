import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { AuthenticatedRequest, OrgContext } from "../interfaces/authenticated-request.interface"

/**
 * Resolved membership of the caller inside the org addressed by the request
 * (set by `OrgGuard`). Gives handlers access to `role`, `memberId` and
 * `organizationId` without re-querying membership.
 */
export const CurrentOrg = createParamDecorator((_data: unknown, context: ExecutionContext): OrgContext => {
  const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
  if (!req.org) throw new Error("OrgGuard must run before @CurrentOrg is used")
  return req.org
})