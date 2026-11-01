import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator"

export const PAYROLL_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export const PAYROLL_CURRENCIES = ["MAD", "USD", "EUR", "TND", "AED", "SAR", "GBP"] as const
export type PayrollCurrency = (typeof PAYROLL_CURRENCIES)[number]

export const PAYROLL_MAX_RATE = 10_000
export const PAYROLL_MAX_BONUS = 1_000_000

export class CreatePayrollRunDto {
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  @Matches(PAYROLL_MONTH_PATTERN, { message: "month must be in YYYY-MM format" })
  month!: string

  @IsOptional()
  @IsIn([...PAYROLL_CURRENCIES])
  currency?: PayrollCurrency

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}

export class MemberPayrollRateDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(PAYROLL_MAX_RATE)
  rate?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(PAYROLL_MAX_BONUS)
  bonus?: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}

export class ImportPayrollOverridesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000_000)
  csv!: string
}
