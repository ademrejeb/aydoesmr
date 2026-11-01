import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from "class-validator"

export const MESSAGE_KINDS = ["TEXT", "STICKER", "GIPHY", "ATTACHMENT"] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export class OpenDirectDto {
  @IsString()
  userId!: string
}

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  memberIds?: string[]
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  body?: string

  @IsOptional()
  @IsString()
  replyToId?: string

  @IsOptional()
  @IsString()
  attachmentId?: string

  @IsOptional()
  @IsIn(MESSAGE_KINDS)
  kind?: string

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  mediaUrl?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  mediaWidth?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  mediaHeight?: number

  @IsOptional()
  @IsString()
  mimeType?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[]
}

export class SetReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4)
  emoji!: string
}

export class ArchiveConversationDto {
  @IsBoolean()
  archived!: boolean
}

export class AddConversationMemberDto {
  @IsString()
  userId!: string
}

export class TypingDto {
  @IsOptional()
  typing?: boolean
}

export class MarkReadDto {
  @IsOptional()
  @IsISO8601()
  at?: string
}