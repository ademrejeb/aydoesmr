import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator"
import { Type } from "class-transformer"
import type { AiProviderType } from "./providers"

const PROVIDER_TYPES: AiProviderType[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "mistral",
  "openrouter",
  "azure",
  "ollama",
  "openai_compatible",
]

export class CreateAiProviderDto {
  @IsString()
  name!: string

  @IsIn(PROVIDER_TYPES)
  type!: AiProviderType

  @IsOptional()
  @IsString()
  baseUrl?: string

  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  models?: string[]

  @IsOptional()
  @IsString()
  defaultModel?: string
}

export class UpdateAiProviderDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  baseUrl?: string

  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  models?: string[]

  @IsOptional()
  @IsString()
  defaultModel?: string

  @IsOptional()
  @IsIn(["active", "disabled"])
  status?: "active" | "disabled"
}

export class AiChatMessageInput {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant"

  @IsString()
  content!: string
}

export class AiChatDto {
  @IsString()
  model!: string

  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => AiChatMessageInput)
  messages!: AiChatMessageInput[]

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  maxTokens?: number
}

export class AssistantQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question!: string
}