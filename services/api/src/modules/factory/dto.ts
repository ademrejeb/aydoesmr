import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

const ROLES = [
  "TRIAGE",
  "ARCHITECT",
  "PLANNER",
  "FRONTEND",
  "BACKEND",
  "RUST",
  "QA",
  "REVIEWER",
  "SECURITY",
  "DEVOPS",
  "DOCS",
] as const

export class CreateAgentProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,80}$/, { message: "slug must be lowercase a-z, 0-9 and '-'" })
  slug!: string

  @IsIn(ROLES)
  role!: (typeof ROLES)[number]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  instructions?: string

  @IsOptional()
  @IsString()
  connectionId?: string

  @IsOptional()
  @IsString()
  modelProviderId?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string

  @IsOptional()
  @IsArray()
  capabilities?: string[]

  @IsOptional()
  @IsArray()
  allowedTools?: string[]

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(2_000_000)
  budgetTokens?: number

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  timeoutSeconds?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  maxRetries?: number

  @IsOptional()
  @IsIn(["active", "disabled"])
  status?: string
}

export class UpdateAgentProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  instructions?: string | null

  @IsOptional()
  @IsString()
  connectionId?: string | null

  @IsOptional()
  @IsString()
  modelProviderId?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string | null

  @IsOptional()
  @IsArray()
  capabilities?: string[]

  @IsOptional()
  @IsArray()
  allowedTools?: string[]

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(2_000_000)
  budgetTokens?: number

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  timeoutSeconds?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  maxRetries?: number

  @IsOptional()
  @IsIn(["active", "disabled"])
  status?: string
}

export class CreateFactoryRunDto {
  @IsString()
  taskId!: string

  @IsOptional()
  @IsString()
  repositoryId?: string

  @IsOptional()
  @IsString()
  agentProfileId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string
}

export class GeneratePlanDto {
  @IsOptional()
  @IsBoolean()
  useAi?: boolean
}

export class FactoryDecisionDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED"

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}

export class FactoryReviewDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED"

  @IsOptional()
  @IsArray()
  findings?: string[]

  @IsOptional()
  @IsString()
  reviewerAgentRunId?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}

export class ClassifyIssueDto {
  @IsOptional()
  @IsBoolean()
  useAi?: boolean
}

export class AutomationDecisionDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED"

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}
