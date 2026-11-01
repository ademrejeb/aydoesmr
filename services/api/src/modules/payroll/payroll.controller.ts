import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Header, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger"
import { OrgRole } from "@prisma/client"
import { OrgGuard } from "../../common/guards/org.guard"
import { MinRole } from "../../common/decorators/roles.decorator"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { AuthUser } from "../../common/interfaces/authenticated-request.interface"
import { PayrollService } from "./payroll.service"
import { CreatePayrollRunDto, ImportPayrollOverridesDto, MemberPayrollRateDto } from "./dto"

@ApiTags("Payroll")
@ApiBearerAuth()
@Controller("organizations/:id/payroll")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MANAGER)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("runs")
  @ApiOperation({ summary: "List payroll runs for the organization" })
  @ApiParam({ name: "id", description: "Organization id" })
  listRuns(@Param("id") orgId: string) {
    return this.payroll.listRuns(orgId)
  }

  @Get("runs/:runId")
  @ApiOperation({ summary: "Get a single payroll run" })
  @ApiParam({ name: "id", description: "Organization id" })
  @ApiParam({ name: "runId", description: "Payroll run id" })
  getRun(@Param("id") orgId: string, @Param("runId") runId: string) {
    return this.payroll.getRun(orgId, runId)
  }

  @Get("runs/:runId/payslips.csv")
  @ApiOperation({ summary: "Export run payslips as CSV" })
  @ApiParam({ name: "id", description: "Organization id" })
  @ApiParam({ name: "runId", description: "Payroll run id" })
  @Header("Content-Type", "text/csv; charset=utf-8")
  payslipCsv(@Param("id") orgId: string, @Param("runId") runId: string) {
    return this.payroll.payslipCsv(orgId, runId)
  }

  @Post("runs")
  @MinRole(OrgRole.ADMIN)
  @ApiOperation({ summary: "Create a new payroll run for a month" })
  @ApiParam({ name: "id", description: "Organization id" })
  @ApiBody({ type: CreatePayrollRunDto })
  createRun(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Body() dto: CreatePayrollRunDto) {
    return this.payroll.createRun(orgId, user, dto)
  }

  @Post("runs/:runId/generate")
  @MinRole(OrgRole.ADMIN)
  @ApiOperation({ summary: "Generate run entries from timesheets" })
  @ApiParam({ name: "id", description: "Organization id" })
  @ApiParam({ name: "runId", description: "Payroll run id" })
  generate(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("runId") runId: string) {
    return this.payroll.generate(orgId, user, runId)
  }

  @Post("runs/:runId/import")
  @MinRole(OrgRole.ADMIN)
  @ApiOperation({ summary: "Import payroll overrides from CSV (member_id | member_name, rate, bonus)" })
  @ApiParam({ name: "id", description: "Organization id" })
  @ApiParam({ name: "runId", description: "Payroll run id" })
  @ApiBody({ type: ImportPayrollOverridesDto })
  importOverrides(
    @Param("id") orgId: string,
    @CurrentUser() user: AuthUser,
    @Param("runId") runId: string,
    @Body() dto: ImportPayrollOverridesDto
  ) {
    return this.payroll.importOverrides(orgId, user, runId, dto)
  }

  @Patch("runs/:runId/mark-paid")
  @MinRole(OrgRole.ADMIN)
  @ApiOperation({ summary: "Mark a payroll run as paid" })
  @ApiParam({ name: "id", description: "Organization id" })
  @ApiParam({ name: "runId", description: "Payroll run id" })
  markPaid(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("runId") runId: string) {
    return this.payroll.markPaid(orgId, user, runId)
  }

  @Get("overrides")
  @ApiOperation({ summary: "List overrides on the latest payroll run" })
  @ApiParam({ name: "id", description: "Organization id" })
  listOverrides(@Param("id") orgId: string) {
    return this.payroll.overrides(orgId)
  }

  @Patch("overrides/:memberId")
  @MinRole(OrgRole.ADMIN)
  @ApiOperation({ summary: "Apply a rate/bonus override to a member in the latest run" })
  @ApiParam({ name: "id", description: "Organization id" })
  @ApiParam({ name: "memberId", description: "Organization member user id" })
  @ApiBody({ type: MemberPayrollRateDto })
  setOverride(@Param("id") orgId: string, @CurrentUser() user: AuthUser, @Param("memberId") memberId: string, @Body() dto: MemberPayrollRateDto) {
    return this.payroll.setOverride(orgId, user, memberId, dto)
  }
}