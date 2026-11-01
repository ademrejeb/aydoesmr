import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator"
import { Transform } from "class-transformer"

export class AnalyzeCodeDto {
  @IsString()
  source!: string

  @IsOptional()
  @IsIn(["rust", "typescript", "javascript", "python", "go", "java", "c", "csharp", "cpp", "php", "ruby"])
  language?: string

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  repositoryId?: string
}

export class CreateRepositoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsString()
  url!: string

  @IsOptional()
  @IsString()
  provider?: string

  @IsOptional()
  @IsString()
  defaultBranch?: string

  @IsOptional()
  @IsString()
  language?: string

  @IsOptional()
  @IsString()
  token?: string

  @IsOptional()
  @IsString()
  projectId?: string
}

export class UpdateRepositoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  provider?: string

  @IsOptional()
  @IsString()
  defaultBranch?: string

  @IsOptional()
  @IsBoolean()
  scanOnPush?: boolean

  @IsOptional()
  @IsString()
  token?: string

  @IsOptional()
  @IsString()
  projectId?: string | null
}

export class ScanRepositoryDto {
  @IsOptional()
  @IsString()
  branch?: string
}

export class QueryIssuesDto {
  @IsOptional()
  @IsIn(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"])
  severity?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  isFixed?: string

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  limit?: string

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? undefined
      : Array.isArray(value)
        ? value
        : String(value)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
  )
  @IsArray()
  @IsString({ each: true })
  ruleIds?: string[]

  @IsOptional()
  @IsString()
  ruleId?: string

  @IsOptional()
  @IsString()
  scanId?: string
}