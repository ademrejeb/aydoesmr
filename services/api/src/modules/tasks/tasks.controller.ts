import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { TasksService } from "./tasks.service"
import { CreateCommentDto, CreateTaskDto, UpdateTaskDto } from "./dto"
import { OrgGuard } from "../../common/guards/org.guard"
import { CurrentOrg, CurrentUser } from "../../common/decorators/current-user.decorator"
import { MinRole } from "../../common/decorators/roles.decorator"
import { OrgRole } from "@prisma/client"
import type { AuthUser, OrgContext } from "../../common/interfaces/authenticated-request.interface"

@Controller("organizations/:id/projects/:projectId")
@UseGuards(OrgGuard)
@MinRole(OrgRole.MEMBER)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post("tasks")
  createTask(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskDto
  ) {
    return this.tasks.createTask(orgId, projectId, user.id, dto)
  }

  @Get("tasks")
  listTasks(
    @Param("projectId") projectId: string,
    @CurrentOrg() org: OrgContext,
    @Query("status") status?: string,
    @Query("assigneeId") assigneeId?: string,
    @Query("sprintId") sprintId?: string,
    @Query("type") type?: string,
    @Query("epicId") epicId?: string,
    @Query("teamId") teamId?: string
  ) {
    return this.tasks.listTasks(org.organizationId, projectId, { status, assigneeId, sprintId, type, epicId, teamId })
  }

  @Patch("tasks/:taskId")
  updateTask(
    @Param("id") orgId: string,
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateTaskDto
  ) {
    return this.tasks.updateTask(orgId, projectId, taskId, dto)
  }

  @Post("tasks/:taskId/comments")
  addComment(
    @Param("id") orgId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto
  ) {
    return this.tasks.addComment(orgId, taskId, user.id, dto)
  }

  @Get("tasks/:taskId/comments")
  comments(@Param("taskId") taskId: string) {
    return this.tasks.listComments(taskId)
  }
}