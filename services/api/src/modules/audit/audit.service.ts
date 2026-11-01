import { Injectable } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"

export interface AuditInput {
  organizationId: string
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    })
  }
}