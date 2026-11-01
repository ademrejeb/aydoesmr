import { IsBoolean, IsIn, IsOptional, IsString, ValidateNested, ArrayMinSize } from "class-validator"
import { Type } from "class-transformer"

export class PipelineStepInput {
  @IsString()
  name!: string

  @IsString()
  command!: string
}

export class CreatePipelineDto {
  @IsString()
  repositoryId!: string

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsIn(["manual", "push"])
  trigger?: "manual" | "push"

  @IsOptional()
  @IsString()
  branch?: string

  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => PipelineStepInput)
  steps!: PipelineStepInput[]
}

export class UpdatePipelineDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsIn(["manual", "push"])
  trigger?: "manual" | "push"

  @IsOptional()
  @IsString()
  branch?: string

  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => PipelineStepInput)
  steps?: PipelineStepInput[]

  @IsOptional()
  @IsIn(["active", "disabled"])
  status?: "active" | "disabled"
}

export class TriggerRunDto {
  @IsOptional()
  @IsString()
  branch?: string
}
