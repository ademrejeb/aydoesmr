import { IsEmail, IsISO8601, IsOptional, IsString, Matches, MinLength, Max, IsInt, Min } from "class-validator"
import { OrgRole } from "@prisma/client"
import { IsIn } from "class-validator"

export const USER_STATUSES = ["ACTIVE", "AWAY", "BUSY", "OFFLINE"] as const

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers, dashes" })
  slug?: string

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsString()
  locale?: string
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

  @IsOptional()
  @IsString()
  billingEmail?: string

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsString()
  locale?: string

  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsString()
  holidayCountry?: string

  @IsOptional()
  @IsString()
  holidayRegion?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  workWeekStart?: number
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(8)
  token!: string
}

export class UpdateMemberRoleDto {
  @IsOptional()
  @IsIn(["ADMIN", "MANAGER", "MEMBER", "VIEWER"])
  role?: OrgRole

  @IsOptional()
  @IsString()
  title?: string
}

export class UpdateUserStatusDto {
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number]

  @IsOptional()
  @IsString()
  statusNote?: string | null

  @IsOptional()
  @IsISO8601()
  statusUntil?: string | null
}

export class AddMemberDto {
  @IsEmail()
  email!: string

  @IsOptional()
  @IsIn(["ADMIN", "MANAGER", "MEMBER", "VIEWER"])
  role?: OrgRole

  @IsOptional()
  @IsString()
  title?: string
}