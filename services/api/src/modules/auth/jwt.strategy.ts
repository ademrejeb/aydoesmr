import { Injectable, UnauthorizedException } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../../prisma/prisma.service"

interface JwtPayload {
  sub: string
  email: string
  type: "access" | "refresh"
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET", "dev-secret-change-me-in-production"),
    })
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== "access") throw new UnauthorizedException("Invalid token type")

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new UnauthorizedException("User no longer exists")

    return { id: user.id, email: user.email }
  }
}