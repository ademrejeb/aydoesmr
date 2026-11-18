import { Type } from "class-transformer"
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
  ValidateNested,
} from "class-validator"
import type { PolicyOperator } from "./policy.engine"

const EFFECTS = ["ALLOW", "DENY", "REQUIRE_APPROVAL", "WARN"] as const
const SCOPES = ["ORGANIZATION", "PROJECT", "REPOSITORY"] as const
const OPERATORS: PolicyOperator[] = [
  "eq",
  "neq",
  "in",
  "not_in",
  "exists",
  "gt",
  "gte",
  "lt",
  "lte",
  "starts_with",
  "contains",
  "overlaps",
  "glob",
]

export class PolicyConditionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  key!: string

  @IsIn(OPERATORS)
  op!: PolicyOperator

  @IsOptional()
  value?: unknown
}

export class CreatePolicyRuleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9._-]{2,100}$/, {
    message: "key must start with a lowercase letter and use a-z, 0-9, '.', '_' or '-'",
  })
  key!: string

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @IsOptional()
  @IsIn(["project", "git", "agent", "quality", "security", "deployment"])
  category?: string

  @IsIn(EFFECTS)
  effect!: (typeof EFFECTS)[number]

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number]

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subject!: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyConditionDto)
  conditions?: PolicyConditionDto[]

  @IsOptional()
  @IsObject()
  actions?: Record<string, unknown>

  @IsOptional()
  @IsString()
  projectId?: string | null

  @IsOptional()
  @IsString()
  repositoryId?: string | null
}

export class UpdatePolicyRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @IsOptional()
  @IsIn(["project", "git", "agent", "quality", "security", "deployment"])
  category?: string

  @IsOptional()
  @IsIn(EFFECTS)
  effect?: (typeof EFFECTS)[number]

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number]

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subject?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyConditionDto)
  conditions?: PolicyConditionDto[]

  @IsOptional()
  @IsObject()
  actions?: Record<string, unknown>

  @IsOptional()
  @IsString()
  projectId?: string | null

  @IsOptional()
  @IsString()
  repositoryId?: string | null
}

export class EvaluatePolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subject!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  repositoryId?: string

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>
}
