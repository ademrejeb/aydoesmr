import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common"
import { Request, Response } from "express"
import { OrgRole } from "@prisma/client"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { CurrentOrg } from "../../common/decorators/current-org.decorator"
import type { AuthUser, OrgContext } from "../../common/interfaces/authenticated-request.interface"
import { TimesheetsService } from "./timesheets.service"
import {
  AddOffDayDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  ReviewLeaveRequestDto,
  UpdateLeaveBalanceDto,
  UpdateLeaveTypeDto,
  UpsertTimesheetEntryDto,
} from "./dto"

@Controller("organizations/:id/timesheets")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class TimesheetsController {
  /** Roles allowed to inspect other members' leave data. */
  private static readonly REVIEWER_ROLES: OrgRole[] = [OrgRole.MANAGER, OrgRole.ADMIN, OrgRole.OWNER]

  constructor(private readonly timesheets: TimesheetsService) {}

  @Get()
  listEntries(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("projectId") projectId?: string
  ) {
    return this.timesheets.listEntries(orgId, user.id, { from, to, projectId })
  }

  @Post()
  upsertEntry(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: UpsertTimesheetEntryDto) {
    return this.timesheets.upsertEntry(orgId, user.id, dto)
  }

  /**
   * CSV export. Default returns a downloadable .csv (text/csv); when
   * `?format=json` returns paginated metadata { entries, total… } for UIs.
   */
  @Get("export")
  async exportCsv(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("projectId") projectId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("format") format?: string,
    @Res({ passthrough: true }) res?: Response
  ) {
    const result = await this.timesheets.exportCsv(orgId, user.id, { from, to, projectId, page, limit })
    if (format === "json") return result
    res?.setHeader("Content-Type", "text/csv; charset=utf-8")
    res?.setHeader("Content-Disposition", `attachment; filename="timesheets-${from ?? "all"}.csv"`)
    res?.setHeader("X-Total-Rows", String(result.totalEntries))
    res?.setHeader("X-Page", String(result.page))
    return result.csv
  }

  /**
   * Bulk CSV import. Accepts a raw `text/csv` (or text/plain) body.
   * Recognizes the export headers plus a few common aliases.
   */
  @Post("import")
  async importCsv(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const body = typeof req.body === "string" ? req.body : null
    if (body === null) {
      throw new BadRequestException("Expected a raw CSV body (send Content-Type: text/csv)")
    }
    if (body.length > 5_000_000) {
      throw new BadRequestException("CSV payload exceeds the 5 MB limit")
    }
    return this.timesheets.importCsv(orgId, user.id, body)
  }

  @Get("leave-types")
  listLeaveTypes(@Param("id") orgId: string) {
    return this.timesheets.listLeaveTypes(orgId)
  }

  @Post("leave-types")
  @MinRole(OrgRole.MANAGER)
  createLeaveType(@Param("id") orgId: string, @Body() dto: CreateLeaveTypeDto) {
    return this.timesheets.createLeaveType(orgId, dto)
  }

  @Patch("leave-types/:typeId")
  @MinRole(OrgRole.MANAGER)
  updateLeaveType(@Param("id") orgId: string, @Param("typeId") typeId: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.timesheets.updateLeaveType(orgId, typeId, dto)
  }

  @Get("leave-balances")
  listBalances(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @CurrentOrg() org: OrgContext,
    @Query("year") year?: string,
    @Query("userId") userId?: string
  ) {
    // Managers+ may inspect and edit any member's balances; everyone else is
    // always scoped to their own.
    const canViewOthers = TimesheetsController.REVIEWER_ROLES.includes(org.role)
    const targetUserId = canViewOthers && userId ? userId : user.id
    return this.timesheets.listBalances(orgId, targetUserId, year)
  }

  @Patch("leave-balances/:balanceId")
  @MinRole(OrgRole.MANAGER)
  updateBalance(
    @Param("id") orgId: string,
    @Param("balanceId") balanceId: string,
    @Body() dto: UpdateLeaveBalanceDto
  ) {
    return this.timesheets.updateBalance(orgId, balanceId, dto)
  }

  @Get("leave-requests")
  listLeaveRequests(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @CurrentOrg() org: OrgContext,
    @Query("scope") scope?: string
  ) {
    const canViewAll = TimesheetsController.REVIEWER_ROLES.includes(org.role)
    const all = canViewAll && scope === "all"
    return this.timesheets.listLeaveRequests(orgId, user.id, { all })
  }

  @Post("leave-requests")
  createLeaveRequest(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateLeaveRequestDto) {
    return this.timesheets.createLeaveRequest(orgId, user.id, dto)
  }

  /** Cancel your own pending request (frees the pending balance hold). */
  @Patch("leave-requests/:requestId/cancel")
  cancelLeaveRequest(@Param("id") orgId: string, @Param("requestId") requestId: string, @CurrentUser() user: AuthUser) {
    return this.timesheets.cancelLeaveRequest(orgId, requestId, user.id)
  }

  @Get("leave-requests/pending")
  @MinRole(OrgRole.MANAGER)
  listPendingLeaveRequests(@Param("id") orgId: string) {
    return this.timesheets.listPendingLeaveRequests(orgId)
  }

  @Patch("leave-requests/:requestId/approve")
  @MinRole(OrgRole.MANAGER)
  approveLeaveRequest(
    @Param("id") orgId: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewLeaveRequestDto
  ) {
    return this.timesheets.approveLeaveRequest(orgId, requestId, user.id, dto)
  }

  @Patch("leave-requests/:requestId/reject")
  @MinRole(OrgRole.MANAGER)
  rejectLeaveRequest(
    @Param("id") orgId: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewLeaveRequestDto
  ) {
    return this.timesheets.rejectLeaveRequest(orgId, requestId, user.id, dto)
  }

  @Get("holidays")
  getHolidays(
    @Param("id") orgId: string,
    @Query("year") year?: string,
    @Query("country") country?: string,
    @Query("region") region?: string
  ) {
    return this.timesheets.getHolidays(orgId, year, country, region)
  }

  /** Days the company actually closes (selected from the holiday feed). */
  @Get("off-days")
  listOffDays(@Param("id") orgId: string, @Query("year") year?: string) {
    return this.timesheets.listOffDays(orgId, year)
  }

  @Post("off-days")
  @MinRole(OrgRole.MANAGER)
  addOffDay(@Param("id") orgId: string, @Body() dto: AddOffDayDto) {
    return this.timesheets.addOffDay(orgId, dto)
  }

  @Delete("off-days")
  @MinRole(OrgRole.MANAGER)
  removeOffDay(@Param("id") orgId: string, @Query("date") date?: string) {
    return this.timesheets.removeOffDay(orgId, date)
  }
}