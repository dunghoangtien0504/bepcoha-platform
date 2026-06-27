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
import { TokenQuotaAddonEntity, UserTokenQuotaEntity } from '../../database/models';
import { JwtAuthGuard, JwtRequest } from '../auth/jwt-auth.guard';
import { CreateAddonDto, SaveInternalTokenDto, UpsertQuotaDto } from './dto/quota.dto';
import { InternalTokenInfo, InternalTokenService } from './internal-token.service';
import { QuotaAdminService, QuotaAllocationRow } from './quota-admin.service';
import { QuotaService, QuotaSnapshot } from './quota.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/quotas')
export class QuotaController {
  constructor(
    private readonly quotaAdminService: QuotaAdminService,
    private readonly quotaService: QuotaService,
    private readonly internalTokenService: InternalTokenService,
  ) {}

  /** Self-service: sinh token ứng viên (chưa lưu) để nhân viên xem trước khi bấm Lưu. */
  @Get('internal-token/generate')
  generateInternalToken(): { internalToken: string } {
    return { internalToken: this.internalTokenService.generateCandidate() };
  }

  /** Self-service: token nội bộ của chính người đang đăng nhập. */
  @Get('me/internal-token')
  myInternalToken(@Req() request: JwtRequest): Promise<InternalTokenInfo> {
    return this.internalTokenService.getByRbacUserId(request.user.sub);
  }

  /** Self-service: lưu / đổi token nội bộ của chính mình. */
  @Put('me/internal-token')
  saveMyInternalToken(
    @Req() request: JwtRequest,
    @Body() dto: SaveInternalTokenDto,
  ): Promise<InternalTokenInfo> {
    return this.internalTokenService.saveForRbacUserId(request.user.sub, dto.internalToken);
  }

  /** Self-service: hạn ngạch + mức sử dụng của chính mình. */
  @Get('me')
  myQuota(
    @Req() request: JwtRequest,
    @Query('taskId') taskId = 'N/A',
  ): Promise<QuotaSnapshot> {
    return this.quotaService.buildSnapshot(request.user.sub, taskId);
  }

  /** Admin: token nội bộ của một nhân sự (theo ID RBAC). */
  @Get('internal-token/:userId')
  getInternalToken(@Param('userId') userId: string): Promise<InternalTokenInfo> {
    return this.internalTokenService.getByRbacUserId(userId);
  }

  /** Admin: lưu / đổi token nội bộ cho một nhân sự. */
  @Put('internal-token/:userId')
  saveInternalToken(
    @Param('userId') userId: string,
    @Body() dto: SaveInternalTokenDto,
  ): Promise<InternalTokenInfo> {
    return this.internalTokenService.saveForRbacUserId(userId, dto.internalToken);
  }

  @Get()
  listQuotas(): Promise<UserTokenQuotaEntity[]> {
    return this.quotaAdminService.listQuotas();
  }

  @Get('allocations')
  listAllocations(): Promise<QuotaAllocationRow[]> {
    return this.quotaAdminService.listAllocations();
  }

  @Put()
  upsertQuota(@Body() dto: UpsertQuotaDto): Promise<UserTokenQuotaEntity> {
    return this.quotaAdminService.upsertQuota(dto);
  }

  @Get('addons')
  listAddons(@Query('userId') userId?: string): Promise<TokenQuotaAddonEntity[]> {
    return this.quotaAdminService.listAddons(userId);
  }

  @Post('addons')
  createAddon(@Body() dto: CreateAddonDto): Promise<TokenQuotaAddonEntity> {
    return this.quotaAdminService.createAddon(dto);
  }

  @Delete('addons/:id')
  async revokeAddon(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.quotaAdminService.revokeAddon(id);
    return { success: true };
  }

  @Get('usage/:userId')
  usage(
    @Param('userId') userId: string,
    @Query('taskId') taskId = 'N/A',
  ): Promise<QuotaSnapshot> {
    return this.quotaService.buildSnapshot(userId, taskId);
  }
}
