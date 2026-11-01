import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "node:crypto"
import { PrismaService } from "../../prisma/prisma.service"
import { OrganizationsService } from "../organizations/organizations.service"
import { MailService } from "../../mail/mail.service"
import { RegisterDto, LoginDto } from "./dto"
import * as bcrypt from "bcryptjs"
import type { SignOptions } from "jsonwebtoken"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"

export interface TokenMeta {
  ip?: string
  userAgent?: string
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/** User shape safe to return over the wire (no password hash, no provider ids). */
export interface SafeUser {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  locale: string
  timezone: string
  createdAt: Date
}

/** bcrypt silently truncates at 72 bytes — reject longer secrets instead. */
const MAX_PASSWORD_LENGTH = 72

/**
 * Valid bcrypt hash compared against when the account does not exist, so
 * "unknown email" and "wrong password" cost the same wall-clock time and
 * cannot be distinguished by timing. Computed once (cost 12) on first use.
 */
let dummyPasswordHash: string | null = null
function getDummyPasswordHash(): string {
  if (!dummyPasswordHash) dummyPasswordHash = bcrypt.hashSync(randomUUID(), 12)
  return dummyPasswordHash
}

const MAX_LOGIN_FAILURES = 5
const LOGIN_LOCK_MS = 15 * 60 * 1000

interface LockEntry {
  failures: number
  lockedUntil: number
}

/** Public view of issued tokens — `jti` never leaves the server. */
function stripJti(tokens: IssuedTokens & { jti: string }): IssuedTokens {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  }
}

export function parseTtlMs(value: string, fallbackMs: number = 7 * 86_400_000): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value.trim())
  if (!match) return fallbackMs
  const amount = Number(match[1])
  const unit = match[2] ?? "s"
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000
  return amount * factor
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  /**
   * Failed-login counters, keyed by lowercased email. In-memory on purpose:
   * a single-process deployment is the supported topology for this limiter;
   * swap for a Redis-backed store before scaling horizontally.
   */
  private readonly loginLocks = new Map<string, LockEntry>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly organizations: OrganizationsService,
    private readonly mail: MailService
  ) {}

  private get refreshTtlMs(): number {
    return parseTtlMs(this.config.get<string>("JWT_REFRESH_TTL", "7d"), 7 * 86_400_000)
  }

  private assertJwtSecret() {
    const secret = this.config.get<string>("JWT_SECRET", "")
    if (this.config.get<string>("NODE_ENV") === "production" && (!secret || secret === "dev-secret-change-me-in-production")) {
      throw new Error(
        "JWT_SECRET must be set to a strong, non-default value when NODE_ENV=production. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
      )
    }
  }

  /**
   * Signs an access token plus a refresh token whose `jti` is persisted as a
   * `RefreshToken` row — the database row is the source of truth for
   * validity, so logout / reuse detection invalidate tokens server-side.
   * The `jti` is returned alongside the tokens so callers can link the
   * rotation chain (`replacedById`).
   */
  private async issueTokens(
    user: { id: string; email: string },
    meta?: TokenMeta
  ): Promise<IssuedTokens & { jti: string }> {
    this.assertJwtSecret()
    const access = this.jwt.sign(
      { sub: user.id, email: user.email, type: "access" },
      { expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "900s") as SignOptions["expiresIn"] }
    )

    const jti = randomUUID()
    const refreshTtl = this.refreshTtlMs
    const refresh = this.jwt.sign(
      { sub: user.id, email: user.email, type: "refresh", jti },
      { expiresIn: Math.floor(refreshTtl / 1000) as SignOptions["expiresIn"] }
    )

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshTtl),
        ip: meta?.ip?.slice(0, 64) ?? null,
        userAgent: meta?.userAgent?.slice(0, 256) ?? null,
      },
    })

    return { accessToken: access, refreshToken: refresh, expiresIn: 900, jti }
  }

  private getLock(email: string): LockEntry | undefined {
    const entry = this.loginLocks.get(email)
    if (!entry) return undefined
    if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
      this.loginLocks.delete(email)
      return undefined
    }
    return entry
  }

  private registerFailure(email: string) {
    const entry = this.loginLocks.get(email) ?? { failures: 0, lockedUntil: 0 }
    entry.failures += 1
    if (entry.failures >= MAX_LOGIN_FAILURES) {
      entry.lockedUntil = Date.now() + LOGIN_LOCK_MS
      this.logger.warn(`login lock engaged for ${email} (${entry.failures} failures)`)
    }
    this.loginLocks.set(email, entry)
  }

  async register(dto: RegisterDto) {
    if (Buffer.byteLength(dto.password, "utf8") > MAX_PASSWORD_LENGTH) {
      throw new ConflictException(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`)
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException("Email already registered")

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName ?? null,
        locale: dto.locale ?? "ar",
      },
    })

    let organizationId: string | null = null
    if (dto.inviteToken) {
      try {
        const accepted = await this.organizations.acceptInvite(dto.inviteToken, user.id)
        organizationId = accepted.organizationId
      } catch {
        // Invalid or expired invite — continue without organization
      }
    }

    await this.mail.send(
      "welcome",
      user.email,
      {
        name: user.fullName ?? user.email,
        actionUrl: `/dashboard`,
        actionLabel: "Open TechVerse",
        preview: "Welcome to TechVerse",
      },
      user.locale
    ).catch(() => {})

    const tokens = await this.issueTokens(user)
    return { user: this.sanitize(user), ...stripJti(tokens), organizationId }
  }

  async login(dto: LoginDto, meta?: TokenMeta) {
    const email = dto.email.toLowerCase()

    const lock = this.getLock(email)
    if (lock && lock.lockedUntil > Date.now()) {
      const seconds = Math.ceil((lock.lockedUntil - Date.now()) / 1000)
      throw new UnauthorizedException(`Too many failed attempts. Try again in ${seconds}s`)
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) {
      // Equalize timing with the existing-user path.
      await bcrypt.compare(dto.password, getDummyPasswordHash())
      this.registerFailure(email)
      throw new UnauthorizedException("Invalid credentials")
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      this.registerFailure(email)
      throw new UnauthorizedException("Invalid credentials")
    }

    this.loginLocks.delete(email)
    // Opportunistically drop this user's expired sessions.
    await this.prisma.refreshToken
      .deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } })
      .catch(() => {})

    const tokens = await this.issueTokens(user, meta)
    return { user: this.sanitize(user), ...tokens }
  }

  /**
   * Rotating refresh: the presented token's `jti` must exist and be active.
   * A token that is already revoked but still verifies means it leaked —
   * revoke every active session for that user (reuse detection) and reject.
   */
  async refresh(refreshToken: string, meta?: TokenMeta): Promise<IssuedTokens & { user: SafeUser }> {
    this.assertJwtSecret()
    let payload: { sub?: string; email?: string; type?: string; jti?: string }
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>("JWT_SECRET", "dev-secret-change-me-in-production"),
      })
    } catch {
      throw new UnauthorizedException("Invalid refresh token")
    }
    if (payload.type !== "refresh" || !payload.jti || !payload.sub) {
      throw new UnauthorizedException("Invalid token type")
    }

    const row = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } })
    if (!row || row.userId !== payload.sub) throw new UnauthorizedException("Invalid refresh token")

    if (row.revokedAt) {
      this.logger.warn(`refresh-token reuse detected for user ${row.userId}; revoking all sessions`)
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException("Session revoked")
    }
    if (row.expiresAt <= new Date()) throw new UnauthorizedException("Refresh token expired")

    const user = await this.prisma.user.findUnique({ where: { id: row.userId } })
    if (!user) throw new UnauthorizedException("User no longer exists")

    const issued = await this.issueTokens(user, meta)
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), replacedById: issued.jti },
    })

    return { ...stripJti(issued), user: this.sanitize(user) }
  }

  /** Revokes the presented refresh token (the caller's current session). */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return
    try {
      const payload = this.jwt.verify<{ sub?: string; type?: string; jti?: string }>(refreshToken, {
        secret: this.config.get<string>("JWT_SECRET", "dev-secret-change-me-in-production"),
      })
      if (payload.type === "refresh" && payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      }
    } catch {
      // Already invalid — nothing to revoke.
    }
  }

  async me(user: AuthUser) {
    const u = await this.prisma.user.findUnique({ where: { id: user.id } })
    return this.sanitize(u!)
  }

  private sanitize(u: {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    locale: string
    timezone: string
    status: string
    statusNote: string | null
    statusUntil: Date | null
    lastSeenAt: Date | null
    createdAt: Date
  }) {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      locale: u.locale,
      timezone: u.timezone,
      status: u.status,
      statusNote: u.statusNote,
      statusUntil: u.statusUntil,
      lastSeenAt: u.lastSeenAt,
      createdAt: u.createdAt,
    }
  }
}