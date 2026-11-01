import { ArrayMinSize, IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator"
import { AI_ACTION_KEYS } from "./actions"
import type { AiActionKind } from "./actions"

export class RunAiActionDto {
  @IsIn(AI_ACTION_KEYS as unknown as string[])
  action!: AiActionKind

  @IsObject()
  input!: Record<string, unknown>
}

export class StepsInput {
  @IsString()
  name!: string

  @IsString()
  @MinLength(1)
  command!: string
}

export class OptimizePipelineInputDto {
  @IsOptional()
  @IsString()
  pipelineId?: string

  @IsOptional()
  @IsObject()
  steps?: unknown
}

export class FixScanIssuesInputDto {
  @ArrayMinSize(1)
  issueIds!: string[]

  @IsOptional()
  @IsString()
  projectId?: string
}