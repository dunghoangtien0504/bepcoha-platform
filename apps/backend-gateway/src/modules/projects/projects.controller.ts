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
import { AiTaskEntity, ProjectEntity } from '../../database/models';
import { JwtAuthGuard, JwtRequest } from '../auth/jwt-auth.guard';
import {
  CreateProjectDto,
  CreateTaskDto,
  UpdateProjectDto,
  UpdateTaskDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard)
@Controller('v1')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('projects')
  listProjects(): Promise<ProjectEntity[]> {
    return this.projectsService.listProjects();
  }

  @Post('projects')
  createProject(
    @Body() dto: CreateProjectDto,
    @Req() request: JwtRequest,
  ): Promise<ProjectEntity> {
    return this.projectsService.createProject(dto, request.user.sub);
  }

  @Put('projects/:id')
  updateProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectEntity> {
    return this.projectsService.updateProject(id, dto);
  }

  @Delete('projects/:id')
  async deleteProject(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.projectsService.deleteProject(id);
    return { success: true };
  }

  @Get('tasks')
  listTasks(
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
  ): Promise<AiTaskEntity[]> {
    return this.projectsService.listTasks(
      projectId ? Number.parseInt(projectId, 10) : undefined,
      assigneeId || undefined,
    );
  }

  @Post('tasks')
  createTask(@Body() dto: CreateTaskDto): Promise<AiTaskEntity> {
    return this.projectsService.createTask(dto);
  }

  @Put('tasks/:id')
  updateTask(@Param('id') id: string, @Body() dto: UpdateTaskDto): Promise<AiTaskEntity> {
    return this.projectsService.updateTask(id, dto);
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.projectsService.deleteTask(id);
    return { success: true };
  }
}
