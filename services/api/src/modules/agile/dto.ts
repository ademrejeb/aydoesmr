import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min, MinLength } from "class-validator"
import { SprintStatus } from "@prisma/client"

export class CreateSprintDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsString()
  goal?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsString()
  teamId?: string

  @IsOptional()
  @IsIn(["PLANNING", "ACTIVE", "COMPLETED"])
  status?: string
}

export class UpdateSprintDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

  @IsOptional()
  @IsString()
  goal?: string

  @IsOptional()
  @IsISO8601()
  startDate?: string

  @IsOptional()
  @IsISO8601()
  endDate?: string

  @IsOptional()
  @IsString()
  teamId?: string | null
}

export class SprintStatusDto {
  @IsIn(["PLANNING", "ACTIVE", "COMPLETED"])
  status!: string
}

export class WorkflowColumnInput {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  @MinLength(1)
  name!: string

  @IsString()
  @MinLength(1)
  status!: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  wipLimit?: number

  @IsOptional()
  @IsBoolean()
  isBacklog?: boolean
}

export class SaveWorkflowDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

  @IsOptional()
  @IsString()
  method?: string

  @IsArray()
  @ArrayMinSize(1)
  columns!: WorkflowColumnInput[]
}

export class LinkTeamDto {
  @IsString()
  teamId!: string
}