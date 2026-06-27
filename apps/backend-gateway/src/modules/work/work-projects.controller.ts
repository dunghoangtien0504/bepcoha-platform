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
import { ProjectEntity, ProjectPhaseEntity } from '../../database/models';
import { JwtAuthGuard, JwtRequest } from '../auth/jwt-auth.guard';
import { CreateProjectDto, ListQueryDto, PhaseInputDto, UpdateProjectDto } from './dto/work.dto';
import { PaginatedResult, WorkProjectsService } from './work-projects.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/work/projects')
export class WorkProjectsController {
  constructor(private readonly projectsService: WorkProjectsService) {}

  @Get()
  list(
    @Query() query: ListQueryDto,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<PaginatedResult<ProjectEntity>> {
    return this.projectsService.listProjects(query, {
      status,
      categoryId: categoryId ? Number.parseInt(categoryId, 10) : undefined,
      fromDate,
      toDate,
    });
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<ProjectEntity> {
    return this.projectsService.getProject(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() request: JwtRequest): Promise<ProjectEntity> {
    return this.projectsService.createProject(dto, request.user.sub);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @Req() request: JwtRequest,
  ): Promise<ProjectEntity> {
    return this.projectsService.updateProject(id, dto, request.user.sub);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.projectsService.deleteProject(id);
    return { success: true };
  }

  // --- Phase CRUD (giai đoạn) phục vụ timeline/kanban ở trang chi tiết dự án ---
  @Post(':id/phases')
  createPhase(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PhaseInputDto,
    @Req() request: JwtRequest,
  ): Promise<ProjectPhaseEntity> {
    return this.projectsService.createPhase(id, dto, request.user.sub);
  }

  @Put(':id/phases/:phaseId')
  updatePhase(
    @Param('id', ParseIntPipe) id: number,
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: PhaseInputDto,
    @Req() request: JwtRequest,
  ): Promise<ProjectPhaseEntity> {
    return this.projectsService.updatePhase(id, phaseId, dto, request.user.sub);
  }

  @Delete(':id/phases/:phaseId')
  async removePhase(
    @Param('id', ParseIntPipe) id: number,
    @Param('phaseId', ParseIntPipe) phaseId: number,
  ): Promise<{ success: boolean }> {
    await this.projectsService.deletePhase(id, phaseId);
    return { success: true };
  }
}
