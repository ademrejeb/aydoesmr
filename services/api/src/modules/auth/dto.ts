import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from "class-validator"

export class RegisterDto {
  @IsEmail()
  email!: string

  // bcrypt truncates at 72 bytes; refuse longer secrets instead of silently
  // comparing a prefix of them.
  @Length(8, 72)
  password!: string

  @IsOptional()
  @IsString()
  fullName?: string

  @IsOptional()
  @IsString()
  @Length(2, 5)
  locale?: string

  @IsOptional()
  @IsString()
  inviteToken?: string
}

export class LoginDto {
  @IsEmail()
  email!: string

  @IsNotEmpty()
  password!: string
}

export class RefreshDto {
  /**
   * Optional: browsers carry the refresh token in the httpOnly `refreshToken`
   * cookie; non-browser clients may still send it in the body.
   */
  @IsOptional()
  @IsString()
  refreshToken?: string
}
export class BasacoreExchangeDto {
  @IsString()
  @IsNotEmpty()
  code!: string

  @IsString()
  @IsNotEmpty()
  codeVerifier!: string

  @IsString()
  @IsNotEmpty()
  redirectUri!: string

  @IsOptional()
  @IsString()
  nonce?: string
}
