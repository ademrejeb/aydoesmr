import { IsIn, IsNotEmpty, IsOptional, IsString, IsDateString } from "class-validator"
import { ProjectType, ProjectVisibility } from "@prisma/client"

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  key?: string

  @IsOptional()
  @IsIn(["GENERAL", "ENGINEERING", "MARKETING", "SALES", "HR", "OTHER"])
  type?: ProjectType

  @IsOptional()
  @IsIn(["PRIVATE", "INTERNAL", "PUBLIC"])
  visibility?: ProjectVisibility

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsString()
  repoUrl?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsString()
  repoUrl?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsIn(["PRIVATE", "INTERNAL", "PUBLIC"])
  visibility?: ProjectVisibility
}