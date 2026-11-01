import { OrgRole } from "@prisma/client"

export const ROLE_RANK: Record<OrgRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
}