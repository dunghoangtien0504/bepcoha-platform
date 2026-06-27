import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'node:crypto';
import { Op } from 'sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { AppUserEntity, UserEntity } from '../../database/models';

/** Tiền tố bắt buộc của Internal Token cấp cho nhân viên (khớp InternalTokenGuard). */
export const INTERNAL_TOKEN_PREFIX = 'storo_live_';

/**
 * Thông tin Internal Token của một nhân sự (RBAC users) — phục vụ trang phân bổ
 * và self-service. Mỗi nhân viên chỉ có duy nhất 1 token (lưu ở app_users).
 */
export interface InternalTokenInfo {
  /** ID nhân sự trong bảng RBAC users (UUID). */
  userId: string;
  email: string;
  fullName: string;
  /** Token hiện tại, null nếu nhân viên chưa từng được cấp. */
  internalToken: string | null;
  hasToken: boolean;
}

/**
 * Nghiệp vụ quản lý Internal Token: mỗi nhân viên (RBAC users) ánh xạ sang app_users
 * theo email; token sinh phía server để đảm bảo duy nhất. Cho phép xem / sinh token ứng
 * viên (chưa lưu) / lưu token đã chọn — đúng UX: refresh sinh token mới rồi bấm "Lưu".
 */
@Injectable()
export class InternalTokenService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(AppUserEntity) private readonly appUserModel: typeof AppUserEntity,
    @InjectModel(UserEntity) private readonly userModel: typeof UserEntity,
  ) {
    this.logger.setContext(InternalTokenService.name);
  }

  /** Sinh một token ứng viên mới (chưa lưu) — phía client bấm "Lưu" mới persist. */
  generateCandidate(): string {
    return `${INTERNAL_TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
  }

  /** Lấy token hiện tại của nhân sự theo ID RBAC (UUID). */
  async getByRbacUserId(rbacUserId: string): Promise<InternalTokenInfo> {
    const rbacUser = await this.requireRbacUser(rbacUserId);
    const appUser = await this.appUserModel.findOne({ where: { email: rbacUser.email } });
    return {
      userId: rbacUser.id,
      email: rbacUser.email,
      fullName: rbacUser.fullName,
      internalToken: appUser?.internalToken ?? null,
      hasToken: Boolean(appUser?.internalToken),
    };
  }

  /**
   * Lưu (đặt lại) token cho nhân sự: validate tiền tố + tính duy nhất, tìm-hoặc-tạo
   * app_user theo email rồi gán token. Trả về thông tin token sau khi lưu.
   */
  async saveForRbacUserId(rbacUserId: string, token: string): Promise<InternalTokenInfo> {
    const rbacUser = await this.requireRbacUser(rbacUserId);
    const normalized = (token ?? '').trim();
    if (!normalized.startsWith(INTERNAL_TOKEN_PREFIX)) {
      throw new BadRequestException(
        `Internal token phải bắt đầu bằng "${INTERNAL_TOKEN_PREFIX}".`,
      );
    }
    if (normalized.length < INTERNAL_TOKEN_PREFIX.length + 16) {
      throw new BadRequestException('Internal token quá ngắn, vui lòng sinh lại.');
    }

    let appUser = await this.appUserModel.findOne({ where: { email: rbacUser.email } });

    // Đảm bảo token chưa bị nhân viên KHÁC sử dụng (cột internal_token là unique).
    const clash = await this.appUserModel.findOne({
      where: appUser
        ? { internalToken: normalized, id: { [Op.ne]: appUser.id } }
        : { internalToken: normalized },
    });
    if (clash) {
      throw new ConflictException('Token này đã được dùng cho nhân viên khác, hãy sinh lại.');
    }

    if (appUser) {
      await appUser.update({ internalToken: normalized });
    } else {
      appUser = await this.appUserModel.create({
        email: rbacUser.email,
        fullName: rbacUser.fullName,
        role: 'DEVELOPER',
        internalToken: normalized,
        passwordHash: null,
        hourlyRateUsd: 0,
        isActive: true,
      } as AppUserEntity);
    }

    this.logger.logBusiness(InternalTokenService.name, 'Lưu Internal Token', {
      rbacUserId: rbacUser.id,
      email: rbacUser.email,
    });

    return {
      userId: rbacUser.id,
      email: rbacUser.email,
      fullName: rbacUser.fullName,
      internalToken: appUser.internalToken,
      hasToken: true,
    };
  }

  private async requireRbacUser(rbacUserId: string): Promise<UserEntity> {
    const rbacUser = await this.userModel.findByPk(rbacUserId);
    if (!rbacUser) {
      throw new NotFoundException('Không tìm thấy nhân sự tương ứng.');
    }
    return rbacUser;
  }
}
