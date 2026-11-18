import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../../prisma/prisma.service"
import { DEFAULT_POLICIES } from "./defaults"
import { CreatePolicyRuleDto, EvaluatePolicyDto, UpdatePolicyRuleDto } from "./dto"
import { evaluatePolicy, type PolicyDecision, type PolicyInput, type PolicyRuleLike } from "./policy.engine"

const MAX_RULES = 500

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2
  ) {}

  private asRule(row: {
    id: string
    key: string
    name: string
    effect: string
    priority: number
    scope: string
    subject: string
    projectId: string | null
    repositoryId: string | null
    conditions: Prisma.JsonValue
    actions: Prisma.JsonValue
    createdAt: Date
  }): PolicyRuleLike {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      effect: row.effect,
      priority: row.priority,
      scope: row.scope,
      subject: row.subject,
      projectId: row.projectId,
      repositoryId: row.repositoryId,
      conditions: row.conditions,
      actions: row.actions,
      createdAt: row.createdAt,
    }
  }

  private async validateScope(organizationId: string, projectId?: string | null, repositoryId?: string | null) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } })
      if (!project) throw new BadRequestException("Project not found in this organization")
    }
    if (repositoryId) {
      const repo = await this.prisma.gitRepository.findFirst({
        where: { id: repositoryId, organizationId },
        select: { id: true },
      })
      if (!repo) throw new BadRequestException("Repository not found in this organization")
    }
  }

  /**
   * Idempotently install the conservative baseline for an organization.
   * Called from reads so existing tenants get governance without a data
   * migration; a unique key prevents duplicate rows under concurrency.
   */
  async ensureDefaults(organizationId: string) {
    for (const item of DEFAULT_POLICIES) {
      const existing = await this.prisma.policyRule.findUnique({
        where: { organizationId_key: { organizationId, key: item.key } },
        select: { id: true },
      })
      if (existing) continue
      try {
        const rule = await this.prisma.policyRule.create({
          data: {
            organizationId,
            key: item.key,
            name: item.name,
            description: item.description,
            category: item.category,
            subject: item.subject,
            effect: item.effect,
            priority: item.priority,
            conditions: item.conditions as unknown as Prisma.InputJsonValue,
            actions: item.actions as unknown as Prisma.InputJsonValue,
            scope: "ORGANIZATION",
          },
        })
        await this.prisma.policyRuleVersion.create({
          data: {
            organizationId,
            ruleId: rule.id,
            version: 1,
            snapshot: rule as unknown as Prisma.InputJsonValue,
          },
        })
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error
      }
    }
  }

  async list(organizationId: string) {
    await this.ensureDefaults(organizationId)
    return this.prisma.policyRule.findMany({
      where: { organizationId },
      orderBy: [{ priority: "desc" }, { key: "asc" }],
    })
  }

  async history(organizationId: string, limit = 100) {
    return this.prisma.policyEvaluation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    })
  }

  async create(organizationId: string, userId: string, dto: CreatePolicyRuleDto) {
    await this.validateScope(organizationId, dto.projectId, dto.repositoryId)
    const existing = await this.prisma.policyRule.findUnique({
      where: { organizationId_key: { organizationId, key: dto.key } },
      select: { id: true },
    })
    if (existing) throw new BadRequestException("A policy with that key already exists")

    const rule = await this.prisma.policyRule.create({
      data: {
        organizationId,
        projectId: dto.projectId ?? null,
        repositoryId: dto.repositoryId ?? null,
        key: dto.key,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        category: dto.category ?? "agent",
        effect: dto.effect,
        priority: dto.priority ?? 100,
        enabled: dto.enabled ?? true,
        scope: dto.scope ?? (dto.repositoryId ? "REPOSITORY" : dto.projectId ? "PROJECT" : "ORGANIZATION"),
        subject: dto.subject.trim(),
        conditions: (dto.conditions ?? []) as unknown as Prisma.InputJsonValue,
        actions: (dto.actions ?? {}) as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    })
    await this.prisma.policyRuleVersion.create({
      data: {
        organizationId,
        ruleId: rule.id,
        version: 1,
        snapshot: rule as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    })
    await this.audit(organizationId, userId, "policy.created", rule.id, { key: rule.key, effect: rule.effect })
    this.events.emit("policy.updated", { organizationId, ruleId: rule.id })
    return rule
  }

  async update(organizationId: string, userId: string, ruleId: string, dto: UpdatePolicyRuleDto) {
    const existing = await this.prisma.policyRule.findFirst({ where: { id: ruleId, organizationId } })
    if (!existing) throw new NotFoundException("Policy not found")
    if (dto.projectId !== undefined) await this.validateScope(organizationId, dto.projectId, dto.repositoryId)
    if (dto.repositoryId !== undefined) await this.validateScope(organizationId, dto.projectId, dto.repositoryId)

    const data: Prisma.PolicyRuleUpdateInput = {
      name: dto.name?.trim(),
      description: dto.description === undefined ? undefined : dto.description?.trim() || null,
      category: dto.category,
      effect: dto.effect,
      priority: dto.priority,
      enabled: dto.enabled,
      scope: dto.scope,
      subject: dto.subject?.trim(),
      conditions: dto.conditions as unknown as Prisma.InputJsonValue | undefined,
      actions: dto.actions as unknown as Prisma.InputJsonValue | undefined,
      projectId: dto.projectId,
      repositoryId: dto.repositoryId,
      version: { increment: 1 },
      updatedById: userId,
    }

    const rule = await this.prisma.policyRule.update({ where: { id: ruleId }, data })
    await this.prisma.policyRuleVersion.create({
      data: {
        organizationId,
        ruleId,
        version: rule.version,
        snapshot: rule as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    })
    await this.audit(organizationId, userId, "policy.updated", rule.id, { key: rule.key, version: rule.version })
    this.events.emit("policy.updated", { organizationId, ruleId: rule.id })
    return rule
  }

  async remove(organizationId: string, userId: string, ruleId: string) {
    const rule = await this.prisma.policyRule.findFirst({ where: { id: ruleId, organizationId } })
    if (!rule) throw new NotFoundException("Policy not found")
    await this.prisma.policyRule.delete({ where: { id: ruleId } })
    await this.audit(organizationId, userId, "policy.deleted", ruleId, { key: rule.key })
    this.events.emit("policy.updated", { organizationId, ruleId })
    return { ok: true }
  }

  /** Evaluate and persist the decision. Never throws for a deny. */
  async check(organizationId: string, input: PolicyInput, actorId?: string | null): Promise<PolicyDecision & { evaluationId: string }> {
    // Baseline governance must exist even if nobody opened the policies page.
    await this.ensureDefaults(organizationId)
    const rows = await this.prisma.policyRule.findMany({
      where: { organizationId, enabled: true },
      orderBy: [{ priority: "desc" }, { key: "asc" }],
      take: MAX_RULES,
    })
    const decision = evaluatePolicy(rows.map((row) => this.asRule(row)), input)
    const evaluation = await this.prisma.policyEvaluation.create({
      data: {
        organizationId,
        projectId: input.projectId ?? null,
        subject: input.subject,
        action: input.action ?? null,
        decision: decision.decision,
        allowed: decision.allowed,
        reasons: decision.reasons as Prisma.InputJsonValue,
        context: (input.context ?? {}) as Prisma.InputJsonValue,
        ruleIds: decision.matchedRuleIds as Prisma.InputJsonValue,
        createdById: actorId ?? null,
      },
    })
    return { ...decision, evaluationId: evaluation.id }
  }

  async evaluate(organizationId: string, userId: string, dto: EvaluatePolicyDto) {
    await this.ensureDefaults(organizationId)
    const decision = await this.check(
      organizationId,
      {
        subject: dto.subject,
        action: dto.action,
        projectId: dto.projectId,
        repositoryId: dto.repositoryId,
        context: dto.context,
      },
      userId
    )
    const ruleIds = decision.matchedRuleIds
    const rules = ruleIds.length
      ? await this.prisma.policyRule.findMany({
          where: { organizationId, id: { in: ruleIds } },
          select: { id: true, key: true, name: true, effect: true, version: true },
        })
      : []
    return { ...decision, rules }
  }

  async seedDefaults(organizationId: string, userId: string) {
    await this.ensureDefaults(organizationId)
    await this.audit(organizationId, userId, "policy.defaults_seeded", null, {})
    return this.list(organizationId)
  }

  private async audit(
    organizationId: string,
    userId: string | null,
    action: string,
    entityId: string | null,
    metadata: Record<string, unknown>
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          entityType: "policy_rule",
          entityId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      this.logger.warn(`Policy audit failed: ${(error as Error).message}`)
    }
  }
}
