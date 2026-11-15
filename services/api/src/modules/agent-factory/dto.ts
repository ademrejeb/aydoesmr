import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator"

export class CreateAgentConnectionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(500)
  baseUrl!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  agentId!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string
}

export class UpdateAgentConnectionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(500)
  baseUrl?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  agentId?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string

  @IsOptional()
  @IsIn(["active", "disabled"])
  status?: string
}

export class RunAgentDto {
  @IsObject()
  input!: Record<string, unknown>
}
