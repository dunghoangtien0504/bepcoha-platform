import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AiTaskEntity, TaskEntity } from '../../database/models';
import { JwtAuthGuard, JwtRequest } from '../auth/jwt-auth.guard';
import { AssignAiDto, CreateTaskDto, ListQueryDto, UpdateTaskDto } from './dto/work.dto';
import type { PaginatedResult } from './work-projects.service';
import {
  AiAssignmentInfo,
  TaskListFilters,
  TaskOverviewReport,
  WorkTasksService,
} from './work-tasks.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/work/tasks')
export class WorkTasksController {
  constructor(private readonly tasksService: WorkTasksService) {}

  private parseFilters(raw: Record<string, string | undefined>): TaskListFilters {
    return {
      status: raw.status,
      priority: raw.priority,
      projectId: raw.projectId ? Number.parseInt(raw.projectId, 10) : undefined,
      projectPhaseId: raw.projectPhaseId ? Number.parseInt(raw.projectPhaseId, 10) : undefined,
      taskCategoryId: raw.taskCategoryId ? Number.parseInt(raw.taskCategoryId, 10) : undefined,
      assignedToUserId: raw.assignedToUserId,
      fromDate: raw.fromDate,
      toDate: raw.toDate,
    };
  }

  @Get()
  list(
    @Query() query: ListQueryDto,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('projectId') projectId?: string,
    @Query('projectPhaseId') projectPhaseId?: string,
    @Query('taskCategoryId') taskCategoryId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<PaginatedResult<TaskEntity>> {
    return this.tasksService.listTasks(
      query,
      this.parseFilters({
        status,
        priority,
        projectId,
        projectPhaseId,
        taskCategoryId,
        assignedToUserId,
        fromDate,
        toDate,
      }),
    );
  }

  @Get('overview')
  overview(
    @Query('projectId') projectId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('taskCategoryId') taskCategoryId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<TaskOverviewReport> {
    return this.tasksService.getOverview({
      projectId: projectId ? Number.parseInt(projectId, 10) : undefined,
      assignedToUserId,
      status,
      priority,
      taskCategoryId: taskCategoryId ? Number.parseInt(taskCategoryId, 10) : undefined,
      fromDate,
      toDate,
    });
  }

  // Toàn bộ việc đã giao cho AI (cột "AI nhận việc"). Khai báo trước :id để không bị nuốt route.
  @Get('ai-assignments')
  aiAssignments(): Promise<AiAssignmentInfo[]> {
    return this.tasksService.listAiAssignments();
  }

  @Get(':id/ai-assignment')
  aiAssignment(@Param('id', ParseIntPipe) id: number): Promise<AiAssignmentInfo | null> {
    return this.tasksService.getAiAssignment(id);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<TaskEntity> {
    return this.tasksService.getTask(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @Req() request: JwtRequest): Promise<TaskEntity> {
    return this.tasksService.createTask(dto, request.user.sub);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @Req() request: JwtRequest,
  ): Promise<TaskEntity> {
    return this.tasksService.updateTask(id, dto, request.user.sub);
  }

  @Post(':id/assign-ai')
  assignAi(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAiDto,
    @Req() request: JwtRequest,
  ): Promise<AiTaskEntity> {
    return this.tasksService.assignToAi(id, dto, request.user.sub);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.tasksService.deleteTask(id);
    return { success: true };
  }
}
