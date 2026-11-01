import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../../prisma/prisma.service"
import { EncryptionService } from "./encryption.service"
import {
  AiChatDto,
  AssistantQueryDto,
  CreateAiProviderDto,
  UpdateAiProviderDto,
} from "./dto"
import {
  fetchModelList,
  providerChat,
  specFor,
  testProviderConnection,
  type AiChatMessage,
  type AiProviderType,
} from "./providers"

type ProviderWithRelations = {
  id: string
  organizationId: string
  name: string
  type: string
  baseUrl: string | null
  apiKeyEncrypted: string | null
  apiKeyHint: string | null
  models: unknown
  defaultModel: string | null
  status: string
  lastTestAt: Date | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
  createdBy?: { id: string; fullName: string | null; email: string } | null
}

function sanitize(p: ProviderWithRelations) {
  const { apiKeyEncrypted, ...rest } = p
  return rest
}

const PROVIDER_TYPES: AiProviderType[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "mistral",
  "openrouter",
  "azure",
  "ollama",
  "openai_compatible",
]

/** AI providers: connect cloud, hosted and fully local model providers with encrypted keys. */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService
  ) {}

  /**
   * Returns the configured code-analysis gateway (Go engine) endpoint plus a
   * live health check. FEATURE 1's UI reads this to learn where to POST code.
   */
  async gatewayStatus() {
    const baseUrl = this.config.get<string>("GATEWAY_URL", "http://localhost:8080").replace(/\/+$/, "")
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { version?: string; status?: string } | null
        return {
          baseUrl,
          healthy: true,
          status: body?.status ?? "healthy",
          version: typeof body?.version === "string" ? body.version : undefined,
        }
      }
      return { baseUrl, healthy: false, status: res.statusText, version: undefined }
    } catch {
      return { baseUrl, healthy: false, status: "unreachable", version: undefined }
    }
  }

  private audit(organizationId: string, userId: string | null, action: string, entityType: string, metadata?: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        entityType,
        metadata: (metadata ?? {}) as object,
      },
    })
  }

  private emit(organizationId: string, providerId: string) {
    this.events.emit("ai.updated", { organizationId, id: providerId })
  }

  private async findProvider(organizationId: string, providerId: string) {
    const provider = await this.prisma.aiProvider.findFirst({
      where: { id: providerId, organizationId },
      include: { createdBy: { select: { id: true, fullName: true, email: true } } },
    })
    if (!provider) throw new NotFoundException("AI provider not found")
    return provider
  }

  specs() {
    return PROVIDER_SPECS_ALL
  }

  async list(organizationId: string) {
    const providers = await this.prisma.aiProvider.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, fullName: true, email: true } } },
    })
    return providers.map(sanitize)
  }

  async get(organizationId: string, providerId: string) {
    const provider = await this.findProvider(organizationId, providerId)
    return sanitize(provider as unknown as ProviderWithRelations)
  }

  async create(organizationId: string, userId: string, dto: CreateAiProviderDto) {
    const type = dto.type
    const spec = specFor(type)
    const baseUrl = (dto.baseUrl?.trim() || spec.defaultBaseUrl || null) as string | null
    const key = dto.apiKey?.trim()
    if (spec.needsKey && !dto.apiKey) {
      throw new BadRequestException(`An API key is required for ${spec.label}`)
    }
    const encrypted = key ? this.encryption.encrypt(key) : null
    const models = (dto.models ?? spec.defaultModels).map((m) => m.trim()).filter(Boolean)

    const provider = await this.prisma.aiProvider.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        type,
        baseUrl,
        apiKeyEncrypted: encrypted?.cipher ?? null,
        apiKeyHint: encrypted?.hint ?? null,
        models: models as never,
        defaultModel: dto.defaultModel?.trim() || models[0] || null,
        createdById: userId,
      },
    })
    await this.audit(organizationId, userId, "ai.provider.created", "ai_provider", {
      name: provider.name,
      type: provider.type,
    })
    this.emit(organizationId, provider.id)
    return sanitize(provider as unknown as ProviderWithRelations)
  }

  async update(organizationId: string, userId: string, providerId: string, dto: UpdateAiProviderDto) {
    const provider = await this.findProvider(organizationId, providerId)
    const encrypted = dto.apiKey ? this.encryption.encrypt(dto.apiKey.trim()) : null
    const keys: string[] = []
    if (dto.models) keys.push("models")
    if (dto.apiKey) keys.push("apiKey")
    if (dto.name) keys.push("name")
    if (dto.baseUrl !== undefined) keys.push("baseUrl")
    if (dto.defaultModel !== undefined) keys.push("defaultModel")
    if (dto.status !== undefined) keys.push("status")

    const updated = await this.prisma.aiProvider.update({
      where: { id: providerId },
      data: {
        name: dto.name?.trim(),
        baseUrl: dto.baseUrl !== undefined ? dto.baseUrl.trim() || null : undefined,
        apiKeyEncrypted: encrypted ? encrypted.cipher : undefined,
        apiKeyHint: encrypted ? encrypted.hint : undefined,
        models: dto.models ? (dto.models.map((m) => m.trim()).filter(Boolean) as never) : undefined,
        defaultModel: dto.defaultModel !== undefined ? dto.defaultModel.trim() || null : undefined,
        status: dto.status,
      },
    })
    await this.audit(organizationId, userId, "ai.provider.updated", "ai_provider", {
      name: updated.name,
      fields: keys.join(","),
    })
    this.emit(organizationId, providerId)
    return sanitize(updated as unknown as ProviderWithRelations)
  }

  async remove(organizationId: string, userId: string, providerId: string) {
    const provider = await this.findProvider(organizationId, providerId)
    await this.prisma.aiProvider.delete({ where: { id: providerId } })
    await this.audit(organizationId, userId, "ai.provider.deleted", "ai_provider", { name: provider.name })
    this.emit(organizationId, providerId)
    return { ok: true }
  }

  async test(organizationId: string, userId: string, providerId: string) {
    const provider = await this.findProvider(organizationId, providerId)
    const apiKey = provider.apiKeyEncrypted ? this.encryption.decrypt(provider.apiKeyEncrypted) : null
    const result = await testProviderConnection(
      provider.type as AiProviderType,
      provider.baseUrl,
      apiKey,
      provider.defaultModel
    )

    if (result.ok) {
      const merged = this.mergeModels((provider.models as string[]) ?? [], result.models)
      await this.prisma.aiProvider.update({
        where: { id: providerId },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: "ok",
          lastTestError: null,
          models: merged as never,
        },
      })
      await this.audit(organizationId, userId, "ai.test_ok", "ai_provider", { name: provider.name })
    } else {
      await this.prisma.aiProvider.update({
        where: { id: providerId },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: "fail",
          lastTestError: (result.error ?? "").slice(0, 500),
        },
      })
      await this.audit(organizationId, userId, "ai.test_fail", "ai_provider", {
        name: provider.name,
        error: (result.error ?? "").slice(0, 200),
      })
    }
    this.emit(organizationId, providerId)
    const sanitized = sanitize(
      (await this.findProvider(organizationId, providerId)) as unknown as ProviderWithRelations
    )
    return { ok: result.ok, provider: sanitized, error: result.error ?? null }
  }

  async fetchModels(organizationId: string, userId: string, providerId: string) {
    const provider = await this.findProvider(organizationId, providerId)
    const apiKey = provider.apiKeyEncrypted ? this.encryption.decrypt(provider.apiKeyEncrypted) : null
    let fetched: string[] = []
    try {
      fetched = await fetchModelList(provider.type as AiProviderType, provider.baseUrl, apiKey)
    } catch (err) {
      throw new BadRequestException(`Failed to fetch models: ${(err as Error).message}`)
    }
    if (fetched.length === 0) {
      throw new BadRequestException("This provider does not expose a model list — add models manually.")
    }
    const merged = this.mergeModels(fetched, (provider.models as string[]) ?? [])
    await this.prisma.aiProvider.update({
      where: { id: providerId },
      data: { models: merged as never },
    })
    await this.audit(organizationId, userId, "ai.models_fetched", "ai_provider", {
      name: provider.name,
      count: fetched.length,
    })
    this.emit(organizationId, providerId)
    return merged
  }

  async chat(organizationId: string, userId: string, providerId: string, dto: AiChatDto) {
    const provider = await this.findProvider(organizationId, providerId)
    if (provider.status !== "active") throw new BadRequestException("This AI provider is disabled")
    if (!provider.apiKeyEncrypted) throw new BadRequestException("No API key configured for this provider")
    const apiKey = this.encryption.decrypt(provider.apiKeyEncrypted)
    const models = (provider.models as string[]) ?? []
    if (models.length > 0 && !models.includes(dto.model)) {
      throw new BadRequestException(`Model "${dto.model}" is not in the provider catalog`)
    }
    const messages = dto.messages.map((m) => ({ role: m.role, content: m.content })) as AiChatMessage[]
    const startedAt = Date.now()
    try {
      const result = await providerChat(
        provider.type as AiProviderType,
        provider.baseUrl,
        apiKey || null,
        dto.model,
        messages,
        dto.maxTokens ?? 512
      )
      await this.audit(organizationId, userId, "ai.chat", "ai_provider", {
        name: provider.name,
        model: dto.model,
        durationMs: result.durationMs,
        ok: true,
      })
      return { ...result, requestedAt: new Date().toISOString() }
    } catch (err) {
      await this.prisma.aiProvider.update({
        where: { id: providerId },
        data: { lastTestAt: new Date(), lastTestStatus: "fail", lastTestError: (err as Error).message.slice(0, 500) },
      })
      await this.audit(organizationId, userId, "ai.chat", "ai_provider", {
        name: provider.name,
        model: dto.model,
        ok: false,
        error: (err as Error).message.slice(0, 200),
      })
      this.emit(organizationId, providerId)
      throw new BadRequestException((err as Error).message)
    }
  }

  /**
   * Manager AI assistant: answers management questions against a live org
   * snapshot. Uses the first active AI provider when one is configured,
   * otherwise falls back to a deterministic summary.
   */
  async assistantQuery(organizationId: string, userId: string, dto: AssistantQueryDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException("Organization not found")

    const context = await this.buildAssistantContext(organizationId, org.name)
    const lang = org.locale === "ar" ? "Arabic" : org.locale === "fr" ? "French" : "English"
    const system =
      "You are TechVerse's manager assistant. Reply in the organization's locale (" + lang + "). " +
      "Use the snapshot below as ground truth and answer concisely with concrete numbers. " +
      "If the question is outside that data, say you only have access to that snapshot.\n\n" +
      `Organization snapshot:\n${context.text}`

    const provider = await this.prisma.aiProvider.findFirst({
      where: { organizationId, status: "active" },
      orderBy: { updatedAt: "desc" },
    })

    if (provider?.apiKeyEncrypted) {
      const apiKey = this.encryption.decrypt(provider.apiKeyEncrypted)
      const models = (provider.models as string[]) ?? []
      const model = provider.defaultModel ?? models[0]
      if (apiKey && model) {
        try {
          const result = await providerChat(
            provider.type as AiProviderType,
            provider.baseUrl,
            apiKey,
            model,
            [
              { role: "assistant", content: system },
              { role: "user", content: dto.question },
            ],
            700
          )
          await this.audit(organizationId, userId, "ai.assistant_query", "assistant", {
            mode: "ai",
            provider: provider.name,
            model: result.model,
            ok: true,
          })
          return {
            answer: result.reply,
            mode: "ai",
            provider: provider.name,
            model: result.model,
            context: context.summary,
          }
        } catch (err) {
          this.logger.warn(`Assistant AI round-trip failed, switching to summary: ${(err as Error).message}`)
        }
      }
    }

    const answer = this.summaryAnswer(context.summary)
    await this.audit(organizationId, userId, "ai.assistant_query", "assistant", { mode: "summary", ok: true })
    return { answer, mode: "summary", provider: null, model: null, context: context.summary }
  }

  private async buildAssistantContext(organizationId: string, orgName: string) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const [members, teams, projects, openTasks, pendingLeave, issueGroups, monthEntries] = await Promise.all([
      this.prisma.organizationMember.findMany({ where: { organizationId }, select: { role: true } }),
      this.prisma.team.count({ where: { organizationId } }),
      this.prisma.project.count({ where: { organizationId } }),
      this.prisma.task.count({ where: { organizationId, status: { not: "DONE" } } }),
      this.prisma.leaveRequest.count({ where: { organizationId, status: "PENDING" } }),
      this.prisma.devIssue.groupBy({
        by: ["severity"],
        where: { organizationId, isFixed: false },
        _count: { _all: true },
      }),
      this.prisma.timesheetEntry.aggregate({
        where: { organizationId, workDate: { gte: monthStart, lt: nextMonth } },
        _count: true,
        _sum: { hours: true },
      }),
    ])

    const byRole = { owner: 0, admin: 0, manager: 0, member: 0, viewer: 0 }
    for (const m of members) {
      const key = m.role.toLowerCase() as keyof typeof byRole
      byRole[key] = (byRole[key] ?? 0) + 1
    }
    const openIssues: Record<string, number> = {}
    let openIssuesTotal = 0
    for (const g of issueGroups) {
      const count = g._count._all
      openIssues[g.severity.toLowerCase()] = count
      openIssuesTotal += count
    }

    const summary = {
      org: orgName,
      members: { total: members.length, ...byRole },
      teams,
      projects,
      openTasks,
      pendingLeaveRequests: pendingLeave,
      openIssues,
      openIssuesTotal,
      month: {
        entries: monthEntries._count,
        hours: Math.round((monthEntries._sum.hours ?? 0) * 100) / 100,
      },
    }

    const text = [
      `- ${summary.members.total} members (${byRole.owner} owners, ${byRole.admin} admins, ${byRole.manager} managers, ${byRole.member} members, ${byRole.viewer} viewers)`,
      `- ${summary.teams} teams, ${summary.projects} projects, ${summary.openTasks} open tasks`,
      `- ${summary.pendingLeaveRequests} leave requests awaiting review`,
      `- ${openIssuesTotal} unresolved code issues${openIssuesTotal > 0 ? ` (${Object.entries(openIssues).map(([k, v]) => `${v} ${k}`).join(", ")})` : ""}`,
      `- current month: ${summary.month.entries} timesheet entries, ${summary.month.hours} logged hours`,
    ].join("\n")

    return { summary, text }
  }

  private summaryAnswer(s: {
    org: string
    members: { total: number; owner: number; admin: number; manager: number; member: number; viewer: number }
    teams: number
    projects: number
    openTasks: number
    pendingLeaveRequests: number
    openIssues: Record<string, number>
    openIssuesTotal: number
    month: { entries: number; hours: number }
  }) {
    const issues =
      s.openIssuesTotal === 0
        ? "no unresolved code issues"
        : Object.entries(s.openIssues)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
    return (
      `${s.org} — ${s.members.total} members (${s.members.owner} owners, ${s.members.admin} admins, ` +
      `${s.members.manager} managers, ${s.members.member} members, ${s.members.viewer} viewers), ${s.teams} teams, ${s.projects} projects, ` +
      `${s.openTasks} open tasks. ${s.pendingLeaveRequests} leave request(s) awaiting review. ${issues}. ` +
      `This month: ${s.month.entries} timesheet entries totaling ${s.month.hours} hours.`
    )
  }

  /**
   * Explain a specific dev issue found by the analysis engine. Uses the first
   * active AI provider when configured, otherwise a deterministic template
   * built from the engine's own message/suggestion.
   */
  async explainIssue(organizationId: string, userId: string, issueId: string) {
    const issue = await this.prisma.devIssue.findFirst({
      where: { id: issueId, organizationId },
      include: { scan: { select: { startedAt: true, repository: { select: { name: true } } } } },
    })
    if (!issue) throw new NotFoundException("Issue not found in this organization")

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    const lang = org?.locale === "ar" ? "Arabic" : org?.locale === "fr" ? "French" : "English"
    const repoName = issue.scan?.repository?.name ?? "(inline)"
    const snippet = issue.codeSnippet?.trim() ?? issue.message

    const context = [
      `- rule: ${issue.ruleId ?? "unknown"}`,
      `- severity: ${issue.severity}`,
      `- category: ${issue.category ?? "n/a"}`,
      `- location: ${issue.filePath}${issue.lineNumber ? `:${issue.lineNumber}` : ""} (repo: ${repoName})`,
      `- engine message: ${issue.message}`,
      `- snippet: ${JSON.stringify(snippet)}`,
      issue.suggestion ? `- suggested action: ${issue.suggestion}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const system =
      `You are an expert code reviewer for TechVerse. Explain the code issue below ` +
      `in ${lang}, in plain language: what the problem is, why it matters, ` +
      `and how to fix it. Keep it under 180 words. Be concrete.\n\n` +
      `Issue:\n${context}`

    const provider = await this.prisma.aiProvider.findFirst({
      where: { organizationId, status: "active" },
      orderBy: { updatedAt: "desc" },
    })

    if (provider?.apiKeyEncrypted && provider.defaultModel) {
      try {
        const apiKey = this.encryption.decrypt(provider.apiKeyEncrypted)
        if (apiKey) {
          const result = await providerChat(
            provider.type as AiProviderType,
            provider.baseUrl,
            apiKey,
            provider.defaultModel,
            [
              { role: "assistant", content: system },
              { role: "user", content: `Explain issue ${issue.ruleId ?? issueId}.` },
            ],
            500
          )
          await this.audit(organizationId, userId, "ai.explain_issue", "dev_issue", {
            issueId,
            mode: "ai",
            provider: provider.name,
            model: result.model,
            ok: true,
          })
          return { issueId, explanation: result.reply, mode: "ai", provider: provider.name, model: result.model }
        }
      } catch (err) {
        this.logger.warn(`Issue explanation AI round-trip failed, using template: ${(err as Error).message}`)
      }
    }

    const explanation = [
      `${issue.message.trim()}`,
      issue.suggestion ? `Recommended fix: ${issue.suggestion}` : null,
      `See ${issue.filePath}${issue.lineNumber ? ` line ${issue.lineNumber}` : ""}.`,
    ]
      .filter(Boolean)
      .join("\n")
    await this.audit(organizationId, userId, "ai.explain_issue", "dev_issue", { issueId, mode: "template", ok: true })
    return { issueId, explanation, mode: "template", provider: null, model: null }
  }

  private mergeModels(...lists: string[][]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const list of lists) {
      for (const m of list) {
        const id = m.trim()
        if (id && !seen.has(id)) {
          seen.add(id)
          out.push(id)
        }
      }
    }
    return out
  }
}

const PROVIDER_SPECS_ALL = PROVIDER_TYPES.map((t) => specFor(t))