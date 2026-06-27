import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { AuthIdentity } from '../../common/interfaces/request-context.interface';
import { verifyPassword } from '../../common/utils/password.util';
import {
  AppUserEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
} from '../../database/models';

export interface JwtPayload {
  sub: string;
  email: string;
  roleId: string;
  isAdmin: boolean;
}

export interface AuthProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  isAdmin: boolean;
  role: { id: string; code: string; name: string } | null;
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  user: AuthProfile;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: AppLoggerService,
    @InjectModel(AppUserEntity) private readonly appUserModel: typeof AppUserEntity,
    @InjectModel(UserEntity) private readonly userModel: typeof UserEntity,
    @InjectModel(RolePermissionEntity)
    private readonly rolePermissionModel: typeof RolePermissionEntity,
  ) {
    this.logger.setContext(AuthService.name);
  }

  /**
   * Xác thực Internal Token (storo_live_...) đến từ IDE — định danh dev cho tầng Gateway.
   */
  async resolveInternalToken(token: string): Promise<AuthIdentity> {
    const user = await this.appUserModel.findOne({
      where: { internalToken: token, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('Internal token không hợp lệ hoặc đã bị vô hiệu hóa');
    }
    // Liên kết app_user (gateway) -> users (RBAC) theo email để xác định chủ thể hạn ngạch.
    const dashboardUser = await this.userModel.findOne({ where: { email: user.email } });
    return {
      userId: user.email,
      email: user.email,
      internalToken: token,
      quotaUserId: dashboardUser?.id ?? null,
    };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.userModel.findOne({
      where: { email, isActive: true },
      include: [RoleEntity],
    });
    if (!user || !verifyPassword(password, user.passwordHashed)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      isAdmin: user.isAdmin,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: await this.buildProfile(user) };
  }

  async getProfileBySub(sub: string): Promise<AuthProfile> {
    const user = await this.userModel.findByPk(sub, { include: [RoleEntity] });
    if (!user) throw new UnauthorizedException('Không tìm thấy người dùng');
    return this.buildProfile(user);
  }

  /**
   * Tập hợp mã quyền của một vai trò. User isAdmin được cấp '*' (toàn quyền).
   */
  async resolvePermissionCodes(roleId: string, isAdmin: boolean): Promise<string[]> {
    if (isAdmin) return ['*'];
    const rows = await this.rolePermissionModel.findAll({ where: { roleId } });
    return rows.map((row) => row.permissionCode);
  }

  private async buildProfile(user: UserEntity): Promise<AuthProfile> {
    const permissions = await this.resolvePermissionCodes(user.roleId, user.isAdmin);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      role: user.role
        ? { id: user.role.id, code: user.role.code, name: user.role.name }
        : null,
      permissions,
    };
  }
}
