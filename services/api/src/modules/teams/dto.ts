import { IsOptional, IsString, MinLength } from "class-validator"

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  departmentId?: string
}

export class AddTeamMemberDto {
  @IsString()
  userId!: string

  @IsOptional()
  @IsString()
  role?: string
}