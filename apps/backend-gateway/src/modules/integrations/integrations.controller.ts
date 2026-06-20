import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateConnectionDto, UpdateConnectionDto } from './dto/integration.dto';
import { ExternalApiService, TaskUsageReport } from './external-api.service';
import { IntegrationApiKeyGuard } from './integration-api-key.guard';
import { IntegrationsService, SyncResult } from './integrations.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('v1/integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly externalApiService: ExternalApiService,
  ) {}

  // ---- Quản trị kết nối (Admin Dashboard, JWT) ----

  @UseGuards(JwtAuthGuard)
  @Get('connections')
  list(): ReturnType<IntegrationsService['list']> {
    return this.integrationsService.list();
  }

  @UseGuards(JwtAuthGuard)
  @Post('connections')
  create(@Body() dto: CreateConnectionDto): ReturnType<IntegrationsService['create']> {
    return this.integrationsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('connections/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConnectionDto,
  ): ReturnType<IntegrationsService['update']> {
    return this.integrationsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('connections/:id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.integrationsService.remove(id);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('connections/:id/sync')
  sync(@Param('id', ParseIntPipe) id: number): Promise<SyncResult> {
    return this.integrationsService.sync(id);
  }

  // ---- Webhook đẩy từ hệ thống bên thứ ba (xác thực bằng chữ ký HMAC/secret) ----

  @Post('webhooks/:id')
  async webhook(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RawBodyRequest,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ accepted: boolean; taskId?: string }> {
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(payload);
    return this.integrationsService.handleWebhook(id, rawBody, request.headers, payload);
  }

  // ---- API outbound machine-to-machine cho hệ thống PM bên thứ ba (X-AIGG-Api-Key) ----

  @UseGuards(IntegrationApiKeyGuard)
  @Get('external/tasks/:taskId/usage')
  taskUsage(@Param('taskId') taskId: string): Promise<TaskUsageReport> {
    return this.externalApiService.getTaskUsage(taskId);
  }
}
