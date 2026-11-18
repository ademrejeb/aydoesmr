import { OrgRole } from "@prisma/client"

export interface AuthUser {
  id: string
  email: string
}

export interface OrgContext {
  organizationId: string
  memberId: string
  role: OrgRole
}

export interface AuthenticatedRequest {
  method: string
  user?: AuthUser
  org?: OrgContext
  headers: Record<string, string | string[] | undefined>
  params?: Record<string, string | undefined>
}