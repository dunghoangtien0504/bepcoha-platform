import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { formatDateOnly } from '../../common/utils/cycle.util';
import {
  TokenQuotaAddonEntity,
  UserEntity,
  UserTokenQuotaEntity,
} from '../../database/models';
import { CreateAddonDto, UpsertQuotaDto } from './dto/quota.dto';

/**
 * Một dòng trong bảng "Danh sách phân bổ": Nhân viên | Hạn ngạch chuẩn | Cấp thêm.
 */
export interface QuotaAllocationRow {
  userId: string;
  email: string;
  fullName: string;
  displayName: string;
  title: string | null;
  hasQuota: boolean;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  taskLimit: number;
  /** Tổng token addon còn hiệu lực (cộng dồn) — cột "Cấp thêm". */
  addonTotal: number;
}

/**
 * Nghiệp vụ cấu hình hạn ngạch & addon từ Admin Dashboard (Quota & Addon Console).
 */
@Injectable()
export class QuotaAdminService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(UserTokenQuotaEntity) private readonly quotaModel: typeof UserTokenQuotaEntity,
    @InjectModel(TokenQuotaAddonEntity) private readonly addonModel: typeof TokenQuotaAddonEntity,
    @InjectModel(UserEntity) private readonly userModel: typeof UserEntity,
  ) {
    this.logger.setContext(QuotaAdminService.name);
  }

  listQuotas(): Promise<UserTokenQuotaEntity[]> {
    return this.quotaModel.findAll({ include: [UserEntity], order: [['userId', 'ASC']] });
  }

  /**
   * Danh sách phân bổ: liệt kê MỌI nhân sự (users) kèm hạn ngạch chuẩn + tổng addon còn hiệu lực.
   * Nhân sự chưa có quota vẫn hiển thị (hasQuota=false) để admin tạo mới.
   */
  async listAllocations(): Promise<QuotaAllocationRow[]> {
    const [users, quotas, addons] = await Promise.all([
      this.userModel.findAll({ where: { isActive: true }, order: [['fullName', 'ASC']] }),
      this.quotaModel.findAll(),
      this.addonModel.findAll({
        where: { status: 'ACTIVE', startDate: { [Op.lte]: formatDateOnly(new Date()) } },
      }),
    ]);

    const quotaByUser = new Map(quotas.map((q) => [q.userId, q]));
    const addonTotalByUser = new Map<string, number>();
    for (const addon of addons) {
      addonTotalByUser.set(
        addon.userId,
        (addonTotalByUser.get(addon.userId) ?? 0) + addon.addonTokens,
      );
    }

    return users.map((user) => {
      const quota = quotaByUser.get(user.id);
      return {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        title: user.title,
        hasQuota: Boolean(quota),
        dailyLimit: quota?.dailyLimit ?? 0,
        weeklyLimit: quota?.weeklyLimit ?? 0,
        monthlyLimit: quota?.monthlyLimit ?? 0,
        taskLimit: quota?.taskLimit ?? 0,
        addonTotal: addonTotalByUser.get(user.id) ?? 0,
      };
    });
  }

  async upsertQuota(dto: UpsertQuotaDto): Promise<UserTokenQuotaEntity> {
    const existing = await this.quotaModel.findOne({ where: { userId: dto.userId } });
    if (existing) {
      await existing.update({
        dailyLimit: dto.dailyLimit ?? existing.dailyLimit,
        weeklyLimit: dto.weeklyLimit ?? existing.weeklyLimit,
        monthlyLimit: dto.monthlyLimit ?? existing.monthlyLimit,
        taskLimit: dto.taskLimit ?? existing.taskLimit,
      });
      return existing;
    }
    return this.quotaModel.create({
      userId: dto.userId,
      dailyLimit: dto.dailyLimit ?? 0,
      weeklyLimit: dto.weeklyLimit ?? 0,
      monthlyLimit: dto.monthlyLimit ?? 0,
      taskLimit: dto.taskLimit ?? 0,
    } as UserTokenQuotaEntity);
  }

  listAddons(userId?: string): Promise<TokenQuotaAddonEntity[]> {
    return this.addonModel.findAll({
      where: userId ? { userId } : undefined,
      order: [['startDate', 'DESC']],
    });
  }

  async createAddon(dto: CreateAddonDto): Promise<TokenQuotaAddonEntity> {
    const addon = await this.addonModel.create({
      userId: dto.userId,
      addonTokens: dto.addonTokens,
      cycleType: dto.cycleType,
      startDate: dto.startDate,
      status: 'ACTIVE',
    } as TokenQuotaAddonEntity);
    this.logger.logBusiness(QuotaAdminService.name, 'Cấp addon token', {
      userId: dto.userId,
      addonTokens: dto.addonTokens,
      cycleType: dto.cycleType,
    });
    return addon;
  }

  async revokeAddon(id: number): Promise<void> {
    await this.addonModel.update({ status: 'EXPIRED' }, { where: { id } });
  }
}
