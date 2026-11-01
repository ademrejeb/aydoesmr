import { Controller, Get } from "@nestjs/common"
import { Public } from "../common/decorators/roles.decorator"
import { PrismaService } from "../prisma/prisma.service"

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    let db = "ok"
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      db = "unavailable"
    }
    return {
      status: "ok",
      service: "techverse-api",
      version: "0.1.0",
      db,
      timestamp: new Date().toISOString(),
    }
  }
}