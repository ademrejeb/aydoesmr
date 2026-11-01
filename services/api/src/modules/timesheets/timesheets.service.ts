import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma, Organization } from "@prisma/client"
import Holidays from "date-holidays"
import { PrismaService } from "../../prisma/prisma.service"
import {
  AddOffDayDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  ReviewLeaveRequestDto,
  UpdateLeaveBalanceDto,
  UpdateLeaveTypeDto,
  UpsertTimesheetEntryDto,
} from "./dto"

const ALSACE_MOSELLE_STATE = "67" // Bas-Rhin; "57" (Moselle) & "68" (Haut-Rhin) carry identical Good Friday + Dec-26 rules
const ALSACE_MOSELLE_ALIASES = new Set([
  "am",
  "als",
  "alsace",
  "alsacemoselle",
  "grandest",
  "moselle",
  "57",
  "67",
  "68",
])

function utcDate(input: string): Date {
  const d = new Date(input)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    const s = value === null || value === undefined ? "" : String(value)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")
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

const EXPORT_HEADERS = ["workDate", "day", "hours", "projectId", "projectKey", "projectName", "taskId", "task", "activity", "status"]

// Column aliases accepted on CSV import (normalized via normalizeHeader).
const COLUMN_ALIASES: Record<string, string[]> = {
  workDate: ["workdate", "date", "dayofwork"],
  hours: ["hours", "workedhours", "hoursworked"],
  projectId: ["projectid"],
  projectKey: ["projectkey", "projectcode"],
  projectName: ["projectname", "project"],
  taskId: ["taskid"],
  task: ["task", "tasktitle"],
  activity: ["activity", "description", "notes"],
}

function normalizeRegion(value?: string | null): string {
  return (value ?? "").replace(/[\s_-]+/g, "").toLowerCase()
}

function isAlsaceMoselle(region: string): boolean {
  return region.length > 0 && ALSACE_MOSELLE_ALIASES.has(region)
}

interface HolidayTarget {
  country: string
  state?: string
}

/**
 * Resolve the org's public-holiday target to a date-holidays (country, state) pair.
 * Alsace-Moselle is not a date-holidays region; for FR it maps to the state whose
 * rules add Good Friday + Dec 26 (identical for "57"|"67"|"68").
 */
function resolveHolidayTarget(org: Pick<Organization, "holidayCountry" | "holidayRegion" | "locale">): HolidayTarget | null {
  const locale = (org.locale ?? "").toLowerCase()
  const rawCountry = (org.holidayCountry ?? "").trim().toUpperCase()
  const region = normalizeRegion(org.holidayRegion)

  if (!rawCountry) {
    // No explicit country: pick a sensible default from the org locale so every
    // org sees public holidays without any admin setup.
    if (locale.startsWith("fr")) return { country: "FR", state: ALSACE_MOSELLE_STATE }
    if (locale.startsWith("ar")) return { country: "EG" }
    if (locale.startsWith("en")) return { country: "US" }
    return null
  }

  if (rawCountry === "FR" && isAlsaceMoselle(region)) {
    return { country: "FR", state: ALSACE_MOSELLE_STATE }
  }
  return { country: rawCountry, state: region.match(/^[0-9]{2}$/)?.[0] }
}

type EntryRow = Prisma.TimesheetEntryGetPayload<{
  include: { project: { select: { id: true; name: true } }; task: { select: { id: true; title: true } } }
}>
type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: { type: true } }>
type LeaveRowWithUser = Prisma.LeaveRequestGetPayload<{
  include: { type: true; user: { select: { id: true; fullName: true; email: true; avatarUrl: true } } }
}>

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

@Injectable()
export class TimesheetsService {
  private readonly holidayCache = new Map<string, { value: unknown; fetchedAt: number }>()
  private readonly holidayTtlMs = Number(process.env.HOLIDAYS_CACHE_TTL_MS ?? 6 * 60 * 60 * 1000)

  constructor(private readonly prisma: PrismaService) {}

  private serializeEntry(e: EntryRow) {
    return {
      id: e.id,
      organizationId: e.organizationId,
      userId: e.userId,
      workDate: dateKey(e.workDate),
      projectId: e.projectId,
      taskId: e.taskId,
      project: e.project ? { id: e.project.id, name: e.project.name } : null,
      task: e.task ? { id: e.task.id, title: e.task.title } : null,
      hours: e.hours,
      activity: e.activity,
      status: e.status,
      submittedAt: e.submittedAt ? e.submittedAt.toISOString() : null,
      reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }
  }

  private serializeLeaveRequest(row: LeaveRow | LeaveRowWithUser) {
    const user = "user" in row ? row.user : null
    return {
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      typeId: row.typeId,
      startDate: dateKey(row.startDate),
      endDate: dateKey(row.endDate),
      days: row.days,
      reason: row.reason,
      status: row.status,
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewNote: row.reviewNote ?? null,
      createdAt: row.createdAt.toISOString(),
      type: row.type,
      ...(user ? { user } : {}),
    }
  }

  async listEntries(
    orgId: string,
    userId: string,
    opts: { from?: string; to?: string; projectId?: string }
  ) {
    const where: Prisma.TimesheetEntryWhereInput = { organizationId: orgId, userId }
    if (opts.from) where.workDate = { ...(where.workDate as object), gte: utcDate(opts.from) }
    if (opts.to) where.workDate = { ...(where.workDate as object), lte: utcDate(opts.to) }
    if (opts.projectId) where.projectId = opts.projectId

    const rows = await this.prisma.timesheetEntry.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { workDate: "desc" },
    })
    return rows.map((e) => this.serializeEntry(e))
  }

  async upsertEntry(orgId: string, userId: string, dto: UpsertTimesheetEntryDto) {
    const workDate = utcDate(dto.workDate)
    const row = await this.prisma.timesheetEntry.upsert({
      where: { organizationId_userId_workDate: { organizationId: orgId, userId, workDate } },
      create: {
        organizationId: orgId,
        userId,
        workDate,
        hours: dto.hours,
        activity: dto.activity,
        projectId: dto.projectId,
        taskId: dto.taskId,
      },
      update: {
        hours: dto.hours,
        activity: dto.activity,
        projectId: dto.projectId,
        taskId: dto.taskId,
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    })
    return this.serializeEntry(row)
  }

  // ------------------------------------------------------------------ //
  //  CSV export / import                                                //
  // ------------------------------------------------------------------ //

  async exportCsv(
    orgId: string,
    userId: string,
    opts: { from?: string; to?: string; projectId?: string; page?: string; limit?: string } = {}
  ) {
    const where: Prisma.TimesheetEntryWhereInput = { organizationId: orgId, userId }
    if (opts.from) where.workDate = { ...(where.workDate as object), gte: utcDate(opts.from) }
    if (opts.to) where.workDate = { ...(where.workDate as object), lte: utcDate(opts.to) }
    if (opts.projectId) where.projectId = opts.projectId

    const page = Math.max(1, parseInt(opts.page ?? "1", 10) || 1)
    const limit = Math.min(5000, Math.max(1, parseInt(opts.limit ?? "500", 10) || 500))

    const [total, aggregate, entries] = await Promise.all([
      this.prisma.timesheetEntry.count({ where }),
      this.prisma.timesheetEntry.aggregate({ where, _sum: { hours: true } }),
      this.prisma.timesheetEntry.findMany({
        where,
        include: {
          project: { select: { id: true, key: true, name: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { workDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const rows = entries.map((e) => [
      e.workDate.toISOString().slice(0, 10),
      e.workDate.toLocaleDateString("en-US", { weekday: "long" }),
      e.hours,
      e.project?.id ?? "",
      e.project?.key ?? "",
      e.project?.name ?? "",
      e.task?.id ?? "",
      e.task?.title ?? "",
      e.activity ?? "",
      e.status,
    ])

    return {
      csv: toCsv(EXPORT_HEADERS, rows),
      totalEntries: total,
      totalHours: aggregate._sum.hours ?? 0,
      page,
      limit,
    }
  }

  async importCsv(orgId: string, userId: string, text: string) {
    const cleaned = text.replace(/^\uFEFF/, "")
    const lines = parseCsv(cleaned).filter((row) => row.some((cell) => cell.trim() !== ""))
    if (lines.length < 2) {
      throw new BadRequestException("CSV must contain a header row and at least one data row")
    }

    const header = lines[0].map(normalizeHeader)
    const columnIndex = (aliases: string[]): number => {
      const idx = aliases.map((a) => header.indexOf(a)).find((i) => i >= 0)
      return idx ?? -1
    }
    const idx = (field: keyof typeof COLUMN_ALIASES) => columnIndex(COLUMN_ALIASES[field])!

    const dataRows = lines.slice(1)
    const imported: number[] = []
    const errors: { row: number; message: string }[] = []

    // Resolve lookup maps lazily so we don't hammer the DB for small files.
    let projectsByKey: Map<string, { id: string; key: string | null; name: string }> | null = null
    let projectsByName: Map<string, { id: string; key: string | null; name: string }> | null = null
    let tasksByTitle: Map<string, string[]> = new Map()
    let loadedProjects = false

    const ensureProjects = async () => {
      if (loadedProjects) return
      loadedProjects = true
      const projects = await this.prisma.project.findMany({
        where: { organizationId: orgId },
        select: { id: true, key: true, name: true },
      })
      projectsByKey = new Map(
        projects.filter((p) => p.key).map((p) => [p.key!.toLowerCase(), p])
      )
      projectsByName = new Map(projects.map((p) => [p.name.toLowerCase(), p]))
      const tasks = await this.prisma.task.findMany({
        where: { organizationId: orgId },
        select: { id: true, title: true, projectId: true },
      })
      tasksByTitle = new Map<string, string[]>()
      for (const task of tasks) {
        const bucket = tasksByTitle.get(task.title.toLowerCase())
        if (bucket) bucket.push(task.id)
        else tasksByTitle.set(task.title.toLowerCase(), [task.id])
      }
    }

    if (dataRows.length > 10_000) {
      throw new BadRequestException("CSV is too large — maximum 10,000 data rows")
    }

    for (const [offset, row] of dataRows.entries()) {
      const rowNumber = offset + 2
      const read = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "")
      const rawDate = read(idx("workDate"))
      const rawHours = read(idx("hours"))

      if (!rawDate || rawHours === "") {
        errors.push({ row: rowNumber, message: "Missing workDate or hours" })
        continue
      }
      const hours = Number(rawHours)
      if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
        errors.push({ row: rowNumber, message: `hours must be a number between 0 and 24 (got "${rawHours}")` })
        continue
      }
      const workDate = utcDate(rawDate)
      if (Number.isNaN(workDate.getTime()) || workDate.getUTCFullYear() < 1970) {
        errors.push({ row: rowNumber, message: `Invalid date "${rawDate}" — use YYYY-MM-DD` })
        continue
      }

      let projectId: string | undefined
      let taskId: string | undefined

      const rawProjectId = read(idx("projectId"))
      if (rawProjectId) {
        const project = await this.prisma.project.findFirst({
          where: { id: rawProjectId, organizationId: orgId },
          select: { id: true },
        })
        if (!project) {
          errors.push({ row: rowNumber, message: `Unknown projectId "${rawProjectId}"` })
          continue
        }
        projectId = project.id
      } else {
        const key = read(idx("projectKey")).toLowerCase() || read(idx("projectName")).toLowerCase()
        if (key) {
          await ensureProjects()
          const byKey = projectsByKey!.get(key)
          const byName = projectsByName!.get(key)
          const project = byKey ?? byName
          if (!project) {
            errors.push({ row: rowNumber, message: `Unknown project "${read(idx("projectKey")) || read(idx("projectName"))}"` })
            continue
          }
          projectId = project.id
        }
      }

      const rawTaskId = read(idx("taskId"))
      if (rawTaskId) {
        const task = await this.prisma.task.findFirst({
          where: { id: rawTaskId, organizationId: orgId, ...(projectId ? { projectId } : {}) },
          select: { id: true },
        })
        if (!task) {
          errors.push({ row: rowNumber, message: `Unknown taskId "${rawTaskId}"` })
          continue
        }
        taskId = task.id
      } else {
        const taskTitle = read(idx("task"))
        if (taskTitle) {
          await ensureProjects()
          const candidates = tasksByTitle.get(taskTitle.toLowerCase()) ?? []
          if (candidates.length === 0) {
            errors.push({ row: rowNumber, message: `Unknown task "${taskTitle}"` })
            continue
          }
          taskId = candidates[0]
        }
      }

      const activity = read(idx("activity")) || null
      try {
        await this.prisma.timesheetEntry.upsert({
          where: { organizationId_userId_workDate: { organizationId: orgId, userId, workDate } },
          create: { organizationId: orgId, userId, workDate, hours, activity, projectId, taskId },
          update: { hours, activity, projectId, taskId },
        })
        imported.push(rowNumber)
      } catch (e) {
        errors.push({ row: rowNumber, message: (e as Error).message.slice(0, 200) })
      }
    }

    return { imported: imported.length, skipped: errors.length, errors, totalRows: dataRows.length }
  }

  async listLeaveTypes(orgId: string) {
    return this.prisma.leaveType.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    })
  }

  async createLeaveType(orgId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        code: dto.code,
        color: dto.color,
        isPaid: dto.isPaid,
        daysPerYear: dto.daysPerYear,
        carryOverDays: dto.carryOverDays,
        accrualPerMonth: dto.accrualPerMonth,
        requiresApproval: dto.requiresApproval,
        isActive: dto.isActive,
      },
    })
  }

  async updateLeaveType(orgId: string, typeId: string, dto: UpdateLeaveTypeDto) {
    const result = await this.prisma.leaveType.updateMany({
      where: { id: typeId, organizationId: orgId },
      data: dto,
    })
    if (result.count === 0) throw new NotFoundException("Leave type not found")
    return this.prisma.leaveType.findUnique({ where: { id: typeId } })
  }

  async listBalances(orgId: string, userId: string, yearInput?: string) {
    const year = yearInput && /^\d{4}$/.test(yearInput) ? parseInt(yearInput, 10) : new Date().getUTCFullYear()
    const types = await this.prisma.leaveType.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: "asc" },
    })
    // Materialize one balance row per active type/year so every listed balance is
    // editable through PATCH /leave-balances/:balanceId even for fresh orgs.
    await Promise.all(
      types.map((type) =>
        this.prisma.leaveBalance.upsert({
          where: {
            organizationId_userId_typeId_year: { organizationId: orgId, userId, typeId: type.id, year },
          },
          create: {
            organizationId: orgId,
            userId,
            typeId: type.id,
            year,
            granted: type.daysPerYear,
            carriedOver: type.carryOverDays,
            used: 0,
            pending: 0,
            adjusted: 0,
          },
          update: {},
        })
      )
    )
    const balances = await this.prisma.leaveBalance.findMany({
      where: { organizationId: orgId, userId, year },
      include: { type: true },
    })
    return balances.map((b) => ({
      id: b.id,
      typeId: b.typeId,
      type: { id: b.type.id, name: b.type.name, code: b.type.code, color: b.type.color, isPaid: b.type.isPaid },
      year,
      granted: b.granted,
      carriedOver: b.carriedOver,
      used: b.used,
      pending: b.pending,
      adjusted: b.adjusted,
      remaining: b.granted + b.carriedOver + b.adjusted - b.used - b.pending,
    }))
  }

  async updateBalance(orgId: string, balanceId: string, dto: UpdateLeaveBalanceDto) {
    const existing = await this.prisma.leaveBalance.findFirst({
      where: { id: balanceId, organizationId: orgId },
      include: { type: true },
    })
    if (!existing) throw new NotFoundException("Leave balance not found")
    const updated = await this.prisma.leaveBalance.update({
      where: { id: balanceId },
      data: dto,
      include: { type: true },
    })
    return {
      id: updated.id,
      typeId: updated.typeId,
      type: {
        id: updated.type.id,
        name: updated.type.name,
        code: updated.type.code,
        color: updated.type.color,
        isPaid: updated.type.isPaid,
      },
      year: updated.year,
      granted: updated.granted,
      carriedOver: updated.carriedOver,
      used: updated.used,
      pending: updated.pending,
      adjusted: updated.adjusted,
      remaining: updated.granted + updated.carriedOver + updated.adjusted - updated.used - updated.pending,
    }
  }

  async listLeaveRequests(orgId: string, userId: string, opts?: { all?: boolean }) {
    if (opts?.all) {
      const rows = await this.prisma.leaveRequest.findMany({
        where: { organizationId: orgId },
        include: {
          type: true,
          user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return rows.map((r) => this.serializeLeaveRequest(r))
    }
    const rows = await this.prisma.leaveRequest.findMany({
      where: { organizationId: orgId, userId },
      include: { type: true },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((r) => this.serializeLeaveRequest(r))
  }

  async createLeaveRequest(orgId: string, userId: string, dto: CreateLeaveRequestDto) {
    const type = await this.prisma.leaveType.findFirst({ where: { id: dto.typeId, organizationId: orgId } })
    if (!type) throw new NotFoundException("Leave type not found")

    const startDate = utcDate(dto.startDate)
    const endDate = utcDate(dto.endDate)
    // Types configured as "no approval required" are granted instantly and
    // consume the balance right away instead of sitting in the pending pool.
    const autoApproved = type.requiresApproval === false
    const request = await this.prisma.leaveRequest.create({
      data: {
        organizationId: orgId,
        userId,
        typeId: dto.typeId,
        startDate,
        endDate,
        days: dto.days,
        reason: dto.reason,
        status: autoApproved ? "APPROVED" : "PENDING",
        reviewedAt: autoApproved ? new Date() : null,
      },
    })
    const year = startDate.getUTCFullYear()
    if (autoApproved) {
      await this.prisma.leaveBalance.upsert({
        where: { organizationId_userId_typeId_year: { organizationId: orgId, userId, typeId: dto.typeId, year } },
        create: { organizationId: orgId, userId, typeId: dto.typeId, year, used: dto.days },
        update: { used: { increment: dto.days } },
      })
    } else {
      await this.prisma.leaveBalance.upsert({
        where: { organizationId_userId_typeId_year: { organizationId: orgId, userId, typeId: dto.typeId, year } },
        create: { organizationId: orgId, userId, typeId: dto.typeId, year, pending: dto.days },
        update: { pending: { increment: dto.days } },
      })
    }
    return request
  }

  async cancelLeaveRequest(orgId: string, requestId: string, userId: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, organizationId: orgId, userId, status: "PENDING" },
    })
    if (!request) throw new NotFoundException("Leave request not found or not pending")

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", reviewedAt: new Date() },
    })
    const year = request.startDate.getUTCFullYear()
    await this.prisma.leaveBalance.updateMany({
      where: { organizationId: orgId, userId, typeId: request.typeId, year, pending: { gte: request.days } },
      data: { pending: { decrement: request.days } },
    })
    return updated
  }

  async listPendingLeaveRequests(orgId: string) {
    const rows = await this.prisma.leaveRequest.findMany({
      where: { organizationId: orgId, status: "PENDING" },
      include: {
        type: true,
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { startDate: "asc" },
    })
    return rows.map((r) => this.serializeLeaveRequest(r))
  }

  // ------------------------------------------------------------------ //
  //  Company off days (selected public holidays)                        //
  // ------------------------------------------------------------------ //

  async listOffDays(orgId: string, yearInput?: string) {
    const year = yearInput && /^\d{4}$/.test(yearInput) ? parseInt(yearInput, 10) : undefined
    const where: Prisma.CompanyOffDayWhereInput = { organizationId: orgId }
    if (year) {
      where.date = { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
    }
    const rows = await this.prisma.companyOffDay.findMany({ where, orderBy: { date: "asc" } })
    return rows.map((r) => ({ date: dateKey(r.date), name: r.name }))
  }

  async addOffDay(orgId: string, dto: AddOffDayDto) {
    const date = utcDate(dto.date)
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date")
    const name = dto.name?.trim() || null
    await this.prisma.companyOffDay.upsert({
      where: { organizationId_date: { organizationId: orgId, date } },
      create: { organizationId: orgId, date, name },
      update: { name },
    })
    return { date: dateKey(date), name }
  }

  async removeOffDay(orgId: string, dateInput?: string) {
    if (!dateInput) throw new BadRequestException("Missing date")
    const date = utcDate(dateInput)
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date")
    const { count } = await this.prisma.companyOffDay.deleteMany({
      where: { organizationId: orgId, date },
    })
    return { removed: count }
  }

  async approveLeaveRequest(orgId: string, requestId: string, reviewerId: string, dto?: ReviewLeaveRequestDto) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, organizationId: orgId, status: "PENDING" },
    })
    if (!request) throw new NotFoundException("Leave request not found or not pending")

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto?.reviewNote ?? request.reviewNote,
      },
    })

    const year = request.startDate.getUTCFullYear()
    await this.prisma.leaveBalance.upsert({
      where: { organizationId_userId_typeId_year: { organizationId: orgId, userId: request.userId, typeId: request.typeId, year } },
      create: { organizationId: orgId, userId: request.userId, typeId: request.typeId, year, used: request.days },
      update: { pending: { decrement: request.days }, used: { increment: request.days } },
    })
    return updated
  }

  async rejectLeaveRequest(orgId: string, requestId: string, reviewerId: string, dto?: ReviewLeaveRequestDto) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, organizationId: orgId, status: "PENDING" },
    })
    if (!request) throw new NotFoundException("Leave request not found or not pending")

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto?.reviewNote ?? request.reviewNote,
      },
    })

    const year = request.startDate.getUTCFullYear()
    await this.prisma.leaveBalance.updateMany({
      where: { organizationId: orgId, userId: request.userId, typeId: request.typeId, year, pending: { gte: request.days } },
      data: { pending: { decrement: request.days } },
    })
    return updated
  }

  async getHolidays(orgId: string, yearInput?: string, countryOverride?: string, regionOverride?: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) throw new NotFoundException("Organization not found")

    const target = countryOverride
      ? resolveHolidayTarget({ holidayCountry: countryOverride, holidayRegion: regionOverride ?? "", locale: org.locale })
      : resolveHolidayTarget(org)
    if (!target) return []

    const year = yearInput && /^\d{4}$/.test(yearInput) ? parseInt(yearInput, 10) : new Date().getUTCFullYear()
    const cacheKey = `${orgId}:${year}:${target.country}:${target.state ?? ""}`
    const cached = this.holidayCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < this.holidayTtlMs) {
      return cached.value
    }

    let holidays: Holidays
    try {
      holidays = target.state ? new Holidays(target.country, target.state) : new Holidays(target.country)
    } catch {
      return []
    }
    const prefix = (org.locale ?? "").toLowerCase()
    const lang = ["ar", "en", "fr"].includes(prefix) ? prefix : "en"
    const localized = holidays.getHolidays(year, lang)
    const english = holidays.getHolidays(year, "en")
    const englishNames = new Map(english.map((h) => [h.start.toISOString().slice(0, 10), h.name]))
    const value = localized
      .filter((h) => h.type === "public" || h.type === "bank")
      .map((h) => {
        const date = h.start.toISOString().slice(0, 10)
        const englishName = englishNames.get(date)
        return {
          date,
          name: h.name,
          localName: lang !== "en" && englishName && englishName !== h.name ? englishName : h.name,
          type: h.type,
          source: target.country,
        }
      })

    this.holidayCache.set(cacheKey, { value, fetchedAt: Date.now() })
    return value
  }
}