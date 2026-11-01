import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PayrollRunStatus, Prisma, TimesheetStatus } from "@prisma/client"
import { PrismaService } from "../../prisma/prisma.service"
import type { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import type { CreatePayrollRunDto, ImportPayrollOverridesDto, MemberPayrollRateDto } from "./dto"
import { PAYROLL_MAX_BONUS, PAYROLL_MAX_RATE } from "./dto"

export interface PayrollEntry {
  memberId: string
  memberName: string
  hours: number
  regularHours: number
  overtimeHours: number
  rate: number
  gross: number
  bonus: number
  net: number
  override?: boolean
}

const DEFAULT_HOURLY_RATE = 25
const REGULAR_MONTHLY_HOURS = 160

function monthRange(month: string): { from: Date; to: Date } {
  const [year, m] = month.split("-").map(Number)
  if (!year || !m || m < 1 || m > 12) {
    throw new BadRequestException("month must be in YYYY-MM format")
  }
  const from = new Date(Date.UTC(year, m - 1, 1))
  const to = new Date(Date.UTC(year, m, 1))
  return { from, to }
}

function entryName(entry: { fullName?: string | null; email?: string | null }): string {
  return entry.fullName?.trim() || entry.email || "Unknown"
}

function parseEntries(raw: unknown): PayrollEntry[] {
  if (!Array.isArray(raw)) return []
  return raw as PayrollEntry[]
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1
      row.push(field)
      field = ""
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

const IMPORT_ALIASES: Record<string, string[]> = {
  memberId: ["memberid", "member_id", "userid", "user_id", "employeeid", "employee_id"],
  memberName: ["membername", "member_name", "name", "fullname", "full_name", "employee", "employeename"],
  rate: ["rate", "hourlyrate", "hourly_rate", "hourly"],
  bonus: ["bonus", "bonusamount", "bonus_amount"],
}

interface ImportRow {
  memberId?: string
  memberName?: string
  rate?: number
  bonus?: number
  line: number
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnedRun(orgId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, organizationId: orgId },
    })
    if (!run) throw new NotFoundException("Payroll run not found")
    return run
  }

  private async getLatestRun(orgId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    })
    if (!run) throw new NotFoundException("No payroll run exists for this organization")
    return run
  }

  async listRuns(orgId: string) {
    return this.prisma.payrollRun.findMany({
      where: { organizationId: orgId },
      orderBy: { month: "desc" },
    })
  }

  async getRun(orgId: string, runId: string) {
    return this.getOwnedRun(orgId, runId)
  }

  async payslipCsv(orgId: string, runId: string) {
    const run = await this.getOwnedRun(orgId, runId)
    const entries = parseEntries((run.entries as Prisma.JsonValue) ?? [])
    const header = ["member_id", "member_name", "hours", "regular_hours", "overtime_hours", "rate", "gross", "bonus", "net"]
    const rows = entries.map((e) => [
      e.memberId,
      e.memberName,
      e.hours,
      e.regularHours,
      e.overtimeHours,
      e.rate,
      e.gross,
      e.bonus,
      e.net,
    ])
    const escape = (value: string | number) => {
      const s = String(value)
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    return [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")
  }

  async createRun(orgId: string, user: AuthUser, dto: CreatePayrollRunDto) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { organizationId_month: { organizationId: orgId, month: dto.month } },
    })
    if (existing) throw new BadRequestException(`A payroll run already exists for ${dto.month}`)

    return this.prisma.payrollRun.create({
      data: {
        organizationId: orgId,
        month: dto.month,
        currency: dto.currency ?? "MAD",
        notes: dto.notes,
        createdById: user.id,
        status: PayrollRunStatus.PENDING,
        entries: [],
      },
    })
  }

  async generate(orgId: string, user: AuthUser, runId: string) {
    const run = await this.getOwnedRun(orgId, runId)
    if (run.status === PayrollRunStatus.PAID) {
      throw new BadRequestException("Cannot regenerate a paid payroll run")
    }

    const { from, to } = monthRange(run.month)
    const [members, timesheets] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.timesheetEntry.findMany({
        where: {
          organizationId: orgId,
          workDate: { gte: from, lt: to },
          status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED] },
        },
        select: { userId: true, hours: true },
      }),
    ])

    const hoursByUser = new Map<string, number>()
    for (const t of timesheets) {
      hoursByUser.set(t.userId, (hoursByUser.get(t.userId) ?? 0) + t.hours)
    }

    const entries: PayrollEntry[] = members.map((m) => {
      const hours = hoursByUser.get(m.userId) ?? 0
      const regularHours = Math.min(hours, REGULAR_MONTHLY_HOURS)
      const overtimeHours = Math.max(0, hours - REGULAR_MONTHLY_HOURS)
      const rate = DEFAULT_HOURLY_RATE
      const gross = Math.round(regularHours * rate + overtimeHours * rate * 1.5)
      const net = Math.round(gross * 0.8)
      return {
        memberId: m.userId,
        memberName: entryName(m.user),
        hours,
        regularHours,
        overtimeHours,
        rate,
        gross,
        bonus: 0,
        net,
      }
    })

    const grossTotal = entries.reduce((sum, e) => sum + e.gross, 0)
    const netTotal = entries.reduce((sum, e) => sum + e.net, 0)

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { entries: entries as unknown as Prisma.InputJsonValue, grossTotal, netTotal },
    })
    return { ...updated, entries, generatedBy: user.id }
  }

  async importOverrides(orgId: string, user: AuthUser, runId: string, dto: ImportPayrollOverridesDto) {
    const run = await this.getOwnedRun(orgId, runId)
    if (run.status === PayrollRunStatus.PAID) {
      throw new BadRequestException("Cannot import overrides into a paid payroll run")
    }

    const cleaned = dto.csv.replace(/^\uFEFF/, "")
    const lines = parseCsv(cleaned).filter((row) => row.some((cell) => cell.trim() !== ""))
    if (lines.length < 2) {
      throw new BadRequestException("CSV must contain a header row and at least one data row")
    }

    const header = lines[0].map(normalizeHeader)
    const columnIndex = (aliases: string[]): number => {
      const idx = aliases.map((a) => header.indexOf(a)).find((i) => i >= 0)
      return idx ?? -1
    }
    const findCol = (field: keyof typeof IMPORT_ALIASES) => {
      const i = columnIndex(IMPORT_ALIASES[field])
      return i >= 0 ? i : null
    }
    const idCol = findCol("memberId")
    const nameCol = findCol("memberName")
    const rateCol = findCol("rate")
    const bonusCol = findCol("bonus")
    if (idCol === null && nameCol === null) {
      throw new BadRequestException("CSV must include a member_id or member_name column")
    }
    if (rateCol === null && bonusCol === null) {
      throw new BadRequestException("CSV must include a rate or bonus column")
    }

    const entries = parseEntries((run.entries as Prisma.JsonValue) ?? [])
    if (entries.length === 0) {
      throw new BadRequestException("Run has no entries yet — generate the run before importing overrides")
    }

    const rows: ImportRow[] = []
    const errors: { line: number; message: string }[] = []

    for (const [offset, raw] of lines.slice(1).entries()) {
      const lineNumber = offset + 2
      const trim = (i: number | null) => (i === null ? "" : (raw[i] ?? "").trim())
      const memberId = trim(idCol)
      const memberName = trim(nameCol)
      const rateRaw = trim(rateCol)
      const bonusRaw = trim(bonusCol)

      if (!memberId && !memberName) {
        errors.push({ line: lineNumber, message: "Missing member_id/member_name" })
        continue
      }
      if (!rateRaw && !bonusRaw) {
        errors.push({ line: lineNumber, message: "Missing rate and bonus" })
        continue
      }

      const rate = rateRaw ? Number(rateRaw) : undefined
      const bonus = bonusRaw ? Number(bonusRaw) : undefined
      if (rate !== undefined && (!Number.isFinite(rate) || rate < 0 || rate > PAYROLL_MAX_RATE)) {
        errors.push({ line: lineNumber, message: `Invalid rate "${rateRaw}" (0..${PAYROLL_MAX_RATE})` })
        continue
      }
      if (bonus !== undefined && (!Number.isFinite(bonus) || bonus < 0 || bonus > PAYROLL_MAX_BONUS)) {
        errors.push({ line: lineNumber, message: `Invalid bonus "${bonusRaw}" (0..${PAYROLL_MAX_BONUS})` })
        continue
      }

      rows.push({ memberId: memberId || undefined, memberName: memberName || undefined, rate, bonus, line: lineNumber })
    }

    const memberIds = new Set(entries.map((e) => e.memberId))
    const nameLookup = new Map<string, PayrollEntry[]>()
    for (const e of entries) {
      const key = e.memberName.trim().toLowerCase()
      const bucket = nameLookup.get(key)
      if (bucket) bucket.push(e)
      else nameLookup.set(key, [e])
    }

    const applied: number[] = []
    for (const row of rows) {
      let entry: PayrollEntry | null = null
      if (row.memberId && memberIds.has(row.memberId)) {
        entry = entries.find((e) => e.memberId === row.memberId) ?? null
      }
      if (!entry && row.memberName) {
        const matches = nameLookup.get(row.memberName.trim().toLowerCase())
        entry = matches && matches.length === 1 ? matches[0] : null
      }
      if (!entry) {
        errors.push({ line: row.line, message: `Unknown member ${row.memberId ?? row.memberName}` })
        continue
      }
      entry.override = true
      if (row.rate !== undefined) entry.rate = row.rate
      if (row.bonus !== undefined) entry.bonus = row.bonus
      entry.gross = entry.regularHours * entry.rate + entry.overtimeHours * entry.rate * 1.5 + entry.bonus
      entry.net = Math.round(entry.gross * 0.8)
      applied.push(row.line)
    }

    if (applied.length === 0 && errors.length > 0) {
      throw new BadRequestException(`No rows could be applied — ${errors.length} error(s): ${errors[0].message}`)
    }

    const grossTotal = entries.reduce((sum, e) => sum + e.gross, 0)
    const netTotal = entries.reduce((sum, e) => sum + e.net, 0)

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { entries: entries as unknown as Prisma.InputJsonValue, grossTotal, netTotal },
    })

    return {
      runId,
      applied: applied.length,
      skipped: errors.length,
      errors,
      grossTotal,
      netTotal,
      importedBy: user.id,
      run: updated,
    }
  }

  async markPaid(orgId: string, user: AuthUser, runId: string) {
    const run = await this.getOwnedRun(orgId, runId)
    if (run.status === PayrollRunStatus.PAID) {
      throw new BadRequestException("Payroll run is already marked as paid")
    }
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: PayrollRunStatus.PAID, paidAt: new Date() },
    })
  }

  async overrides(orgId: string) {
    const runs = await this.prisma.payrollRun.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 1,
    })
    if (runs.length === 0) return { runId: null, overrides: [] }
    const run = runs[0]
    const entries = parseEntries((run.entries as Prisma.JsonValue) ?? [])
    return {
      runId: run.id,
      overrides: entries
        .filter((e) => e.override)
        .map((e) => ({ memberId: e.memberId, memberName: e.memberName, rate: e.rate, bonus: e.bonus, net: e.net })),
    }
  }

  async setOverride(orgId: string, user: AuthUser, memberId: string, dto: MemberPayrollRateDto) {
    const run = await this.getLatestRun(orgId)
    if (run.status === PayrollRunStatus.PAID) {
      throw new BadRequestException("Cannot override a paid payroll run")
    }

    const entries = parseEntries((run.entries as Prisma.JsonValue) ?? [])
    const entry = entries.find((e) => e.memberId === memberId)
    if (!entry) {
      throw new NotFoundException("Member not found in the latest payroll run — generate the run first")
    }

    entry.override = true
    if (dto.rate !== undefined) entry.rate = dto.rate
    if (dto.bonus !== undefined) entry.bonus = dto.bonus
    entry.gross = entry.regularHours * entry.rate + entry.overtimeHours * entry.rate * 1.5 + entry.bonus
    entry.net = Math.round(entry.gross * 0.8)

    const grossTotal = entries.reduce((sum, e) => sum + e.gross, 0)
    const netTotal = entries.reduce((sum, e) => sum + e.net, 0)

    return this.prisma.payrollRun.update({
      where: { id: run.id },
      data: { entries: entries as unknown as Prisma.InputJsonValue, grossTotal, netTotal },
    })
  }
}