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
import { ProjectCategoryEntity, TaskCategoryEntity } from '../../database/models';
import { JwtAuthGuard, JwtRequest } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import {
  CreateProjectCategoryDto,
  CreateTaskCategoryDto,
  UpdateProjectCategoryDto,
  UpdateTaskCategoryDto,
} from './dto/work.dto';

@UseGuards(JwtAuthGuard)
@Controller('v1/work')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /* ----------------------------- Project categories ----------------------------- */

  @Get('project-categories')
  listProjectCategories(): Promise<ProjectCategoryEntity[]> {
    return this.categoriesService.listProjectCategories();
  }

  @Post('project-categories')
  createProjectCategory(
    @Body() dto: CreateProjectCategoryDto,
    @Req() request: JwtRequest,
  ): Promise<ProjectCategoryEntity> {
    return this.categoriesService.createProjectCategory(dto, request.user.sub);
  }

  @Put('project-categories/:id')
  updateProjectCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectCategoryDto,
    @Req() request: JwtRequest,
  ): Promise<ProjectCategoryEntity> {
    return this.categoriesService.updateProjectCategory(id, dto, request.user.sub);
  }

  @Delete('project-categories/:id')
  async deleteProjectCategory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    await this.categoriesService.deleteProjectCategory(id);
    return { success: true };
  }

  /* ----------------------------- Task categories ----------------------------- */

  @Get('task-categories')
  listTaskCategories(@Query('projectId') projectId?: string): Promise<TaskCategoryEntity[]> {
    return this.categoriesService.listTaskCategories(
      projectId ? Number.parseInt(projectId, 10) : undefined,
    );
  }

  @Post('task-categories')
  createTaskCategory(
    @Body() dto: CreateTaskCategoryDto,
    @Req() request: JwtRequest,
  ): Promise<TaskCategoryEntity> {
    return this.categoriesService.createTaskCategory(dto, request.user.sub);
  }

  @Put('task-categories/:id')
  updateTaskCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskCategoryDto,
    @Req() request: JwtRequest,
  ): Promise<TaskCategoryEntity> {
    return this.categoriesService.updateTaskCategory(id, dto, request.user.sub);
  }

  @Delete('task-categories/:id')
  async deleteTaskCategory(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.categoriesService.deleteTaskCategory(id);
    return { success: true };
  }
}
