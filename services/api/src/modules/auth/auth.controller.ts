import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { Request, Response } from "express"
import { AuthService, TokenMeta, parseTtlMs } from "./auth.service"
import { BasacoreExchangeDto, RegisterDto, LoginDto, RefreshDto } from "./dto"
import { Public } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"

const REFRESH_COOKIE = "refreshToken"

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(";")) {
    const idx = part.indexOf("=")
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    if (!key) continue
    out[key] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function tokenMeta(req: Request): TokenMeta {
  return {
    ip: req.ip,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  }
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
      // Scoped to the auth surface only — every other route never sees it.
      path: "/api/auth",
      maxAge: parseTtlMs(this.config.get<string>("JWT_REFRESH_TTL", "7d")),
    })
  }

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto)
    // The refresh token travels only in the httpOnly cookie, never the body.
    this.setRefreshCookie(res, result.refreshToken)
    const { refreshToken: _refresh, ...body } = result
    return body
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, tokenMeta(req))
    this.setRefreshCookie(res, result.refreshToken)
    const { refreshToken: _refresh, ...body } = result
    return body
  }

  /**
   * Rotating refresh. Reads the httpOnly cookie (browsers) or the body
   * (non-browser clients), always rotates the token and re-sets the cookie.
   */
  @Public()
  @Post("basacore/exchange")
  async basacoreExchange(
    @Body() dto: BasacoreExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.auth.basacoreExchange(dto, tokenMeta(req))
    this.setRefreshCookie(res, result.refreshToken)
    const { refreshToken: _refresh, ...body } = result
    return body
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = parseCookies(req.headers.cookie)
    const presented = cookies[REFRESH_COOKIE] ?? dto.refreshToken
    const result = await this.auth.refresh(presented ?? "", tokenMeta(req))
    this.setRefreshCookie(res, result.refreshToken)
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn }
  }

  /** Revokes the current refresh session and clears the cookie. */
  @Public()
  @Post("logout")
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = parseCookies(req.headers.cookie)
    const presented = cookies[REFRESH_COOKIE] ?? dto.refreshToken
    await this.auth.logout(presented)
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" })
    return { ok: true }
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user)
  }
}