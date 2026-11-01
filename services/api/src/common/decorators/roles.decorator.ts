import { SetMetadata } from "@nestjs/common"
import { OrgRole } from "@prisma/client"

export const PUBLIC = "isPublic"
export const Public = () => SetMetadata(PUBLIC, true)

export const REQUIRED_ROLE = "requiredRole"
export const RequireRole = (role: OrgRole) => SetMetadata(REQUIRED_ROLE, role)

export const MIN_ROLE = "minRole"
export const MinRole = (role: OrgRole) => SetMetadata(MIN_ROLE, role)