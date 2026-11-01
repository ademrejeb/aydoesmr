import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class PlanUploadDto {
  @IsOptional()
  @IsString()
  sprintName?: string

  @IsOptional()
  @IsString()
  teamId?: string
}

export class ApplyPlanDto {
  @IsNotEmpty()
  @IsString()
  projectId!: string

  @IsOptional()
  @IsString()
  teamId?: string

  @IsOptional()
  @IsString()
  sprintName?: string
}