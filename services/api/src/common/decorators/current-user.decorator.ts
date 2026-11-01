import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { AuthenticatedRequest, AuthUser, OrgContext } from "../interfaces/authenticated-request.interface"

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user!
  }
)

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgContext => {
    return ctx.switchToHttp().getRequest<AuthenticatedRequest>().org!
  }
)