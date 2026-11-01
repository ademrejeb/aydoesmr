import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator"

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const TYPES = ["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  title!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsIn(TYPES)
  type?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string

  @IsOptional()
  @IsString()
  assigneeId?: string

  @IsOptional()
  @IsString()
  columnId?: string

  @IsOptional()
  @IsString()
  sprintId?: string

  @IsOptional()
  @IsString()
  epicId?: string

  @IsOptional()
  @IsString()
  parentId?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  storyPoints?: number

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsNumber()
  estimateHours?: number
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string

  @IsOptional()
  @IsString()
  description?: string | null

  @IsOptional()
  @IsIn(TYPES)
  type?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string

  @IsOptional()
  @IsString()
  assigneeId?: string | null

  @IsOptional()
  @IsString()
  sprintId?: string | null

  @IsOptional()
  @IsString()
  epicId?: string | null

  @IsOptional()
  @IsString()
  columnId?: string | null

  @IsOptional()
  @IsString()
  parentId?: string | null

  @IsOptional()
  @IsInt()
  @Min(0)
  storyPoints?: number | null

  @IsOptional()
  @IsNumber()
  estimateHours?: number | null

  @IsOptional()
  @IsNumber()
  order?: number

  @IsOptional()
  @IsDateString()
  dueDate?: string | null
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body!: string
}