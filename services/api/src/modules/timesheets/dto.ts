import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator"

export class UpsertTimesheetEntryDto {
  @IsISO8601({ strict: false })
  workDate!: string

  @IsNumber()
  @Min(0)
  hours!: number

  @IsOptional()
  @IsString()
  activity?: string

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  taskId?: string
}

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsString()
  @MinLength(1)
  code!: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  daysPerYear?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  carryOverDays?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  accrualPerMonth?: number

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  daysPerYear?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  carryOverDays?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  accrualPerMonth?: number

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class CreateLeaveRequestDto {
  @IsString()
  typeId!: string

  @IsISO8601({ strict: false })
  startDate!: string

  @IsISO8601({ strict: false })
  endDate!: string

  @IsNumber()
  @Min(0)
  days!: number

  @IsOptional()
  @IsString()
  reason?: string
}

export class ReviewLeaveRequestDto {
  @IsOptional()
  @IsString()
  reviewNote?: string
}

export class UpdateLeaveBalanceDto {
  @IsOptional()
  @IsNumber()
  granted?: number

  @IsOptional()
  @IsNumber()
  carriedOver?: number

  @IsOptional()
  @IsNumber()
  adjusted?: number

  @IsOptional()
  @IsNumber()
  pending?: number

  @IsOptional()
  @IsNumber()
  used?: number
}

export class AddOffDayDto {
  @IsISO8601({ strict: false })
  date!: string

  @IsOptional()
  @IsString()
  name?: string
}