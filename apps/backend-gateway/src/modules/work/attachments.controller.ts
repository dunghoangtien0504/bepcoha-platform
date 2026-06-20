import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EntityAttachmentEntity } from '../../database/models';
import type { AttachmentEntityType } from '../../database/models';
import { JwtAuthGuard, JwtRequest } from '../auth/jwt-auth.guard';
import { AttachmentsService, ProjectAttachments } from './attachments.service';
import { CreateAttachmentDto } from './dto/work.dto';

@UseGuards(JwtAuthGuard)
@Controller('v1/work/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  list(
    @Query('entityType') entityType: AttachmentEntityType,
    @Query('entityId') entityId: string,
  ): Promise<EntityAttachmentEntity[]> {
    return this.attachmentsService.list(entityType, Number.parseInt(entityId, 10));
  }

  @Get('project/:projectId')
  listByProject(@Param('projectId', ParseIntPipe) projectId: number): Promise<ProjectAttachments> {
    return this.attachmentsService.listByProject(projectId);
  }

  @Post()
  create(
    @Body() dto: CreateAttachmentDto,
    @Req() request: JwtRequest,
  ): Promise<EntityAttachmentEntity> {
    return this.attachmentsService.create(dto, request.user.sub);
  }

  @Get(':id/download')
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response): Promise<void> {
    const file = await this.attachmentsService.getForDownload(id);
    res.download(file.filePath, file.fileName);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.attachmentsService.delete(id);
    return { success: true };
  }
}
