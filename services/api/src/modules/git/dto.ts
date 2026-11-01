import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator"

export class CreateGitRepositoryDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsString()
  visibility?: "private" | "public"

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsBoolean()
  initReadme?: boolean

  @IsOptional()
  @IsString()
  defaultBranch?: string
}

export class CommitFileDto {
  @IsString()
  path!: string

  @IsString()
  content!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string
}

export class CreateGitTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string
}