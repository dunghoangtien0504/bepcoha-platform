import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { hashPassword } from '../../common/utils/password.util';
import { AdminSeedConfig, AppConfig } from '../../config/configuration';
import {
  AdminMenuEntity,
  ModuleEntity,
  ModuleScopeEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
} from '../models';
import {
  MENU_SEEDS,
  MODULE_SEEDS,
  MenuSeed,
  OBSOLETE_MENU_NAMES,
  SCOPE_SEEDS,
} from '../../modules/rbac/rbac.catalog';

const SUPER_ADMIN_ROLE_CODE = 'super_admin';

/**
 * Seed toàn bộ dữ liệu RBAC + admin menus + tài khoản admin đầu tiên (idempotent).
 * Chạy sau khi schema đã sync. Mọi thao tác findOrCreate để rerun an toàn.
 */
@Injectable()
export class RbacSeeder implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    @InjectModel(ModuleEntity) private readonly moduleModel: typeof ModuleEntity,
    @InjectModel(ModuleScopeEntity) private readonly scopeModel: typeof ModuleScopeEntity,
    @InjectModel(PermissionEntity) private readonly permissionModel: typeof PermissionEntity,
    @InjectModel(RoleEntity) private readonly roleModel: typeof RoleEntity,
    @InjectModel(RolePermissionEntity)
    private readonly rolePermissionModel: typeof RolePermissionEntity,
    @InjectModel(UserEntity) private readonly userModel: typeof UserEntity,
    @InjectModel(AdminMenuEntity) private readonly menuModel: typeof AdminMenuEntity,
  ) {
    this.logger.setContext(RbacSeeder.name);
  }

  async onModuleInit(): Promise<void> {
    const app = this.configService.getOrThrow<AppConfig>('app');
    if (!app.dbSeed) return;

    try {
      const permissionCodes = await this.seedCatalog();
      const role = await this.seedSuperAdminRole(permissionCodes);
      await this.seedAdminUser(role);
      await this.pruneObsoleteMenus();
      await this.seedMenus(MENU_SEEDS, null);
      this.logger.logBusiness(RbacSeeder.name, 'Seed RBAC & admin menus hoàn tất', {
        permissions: permissionCodes.length,
      });
    } catch (error) {
      this.logger.error('Seed RBAC thất bại', (error as Error).stack);
    }
  }

  private async seedCatalog(): Promise<string[]> {
    for (const seed of MODULE_SEEDS) {
      await this.moduleModel.findOrCreate({
        where: { code: seed.code },
        defaults: {
          code: seed.code,
          name: seed.name,
          description: seed.description,
          sort: seed.sort,
        } as ModuleEntity,
      });
    }

    const permissionCodes: string[] = [];
    let permissionSort = 0;
    for (const scope of SCOPE_SEEDS) {
      const moduleRow = await this.moduleModel.findOne({ where: { code: scope.moduleCode } });
      if (!moduleRow) continue;

      await this.scopeModel.findOrCreate({
        where: { code: scope.code },
        defaults: {
          moduleId: moduleRow.id,
          code: scope.code,
          name: scope.name,
          sort: scope.sort,
        } as ModuleScopeEntity,
      });

      for (const { action, name } of scope.actions) {
        const code = `${scope.moduleCode}.${scope.code}.${action}`;
        permissionCodes.push(code);
        await this.permissionModel.findOrCreate({
          where: { code },
          defaults: {
            module: scope.moduleCode,
            scope: scope.code,
            code,
            name: `${name} (${scope.name})`,
            sort: (permissionSort += 1),
          } as PermissionEntity,
        });
      }
    }
    return permissionCodes;
  }

  private async seedSuperAdminRole(permissionCodes: string[]): Promise<RoleEntity> {
    const [role] = await this.roleModel.findOrCreate({
      where: { code: SUPER_ADMIN_ROLE_CODE },
      defaults: {
        code: SUPER_ADMIN_ROLE_CODE,
        name: 'Super Admin',
        description: 'Toàn quyền hệ thống',
      } as RoleEntity,
    });

    for (const permissionCode of permissionCodes) {
      await this.rolePermissionModel.findOrCreate({
        where: { roleId: role.id, permissionCode },
        defaults: { roleId: role.id, permissionCode } as RolePermissionEntity,
      });
    }
    return role;
  }

  private async seedAdminUser(role: RoleEntity): Promise<void> {
    const admin = this.configService.getOrThrow<AdminSeedConfig>('adminSeed');
    const existing = await this.userModel.findOne({ where: { email: admin.email } });
    if (existing) return;

    await this.userModel.create({
      roleId: role.id,
      fullName: 'Bếp Cô Hạ',
      displayName: 'Cô Hạ',
      email: admin.email,
      passwordHashed: hashPassword(admin.password),
      gender: 'female',
      title: 'Quản trị viên',
      isAdmin: true,
      isActive: true,
    } as UserEntity);
    this.logger.logBusiness(RbacSeeder.name, 'Đã seed tài khoản admin đầu tiên', {
      email: admin.email,
    });
  }

  /**
   * Gỡ các menu cũ đã bị thay thế khi tái cấu trúc điều hướng (idempotent).
   */
  private async pruneObsoleteMenus(): Promise<void> {
    if (OBSOLETE_MENU_NAMES.length === 0) return;
    const removed = await this.menuModel.destroy({ where: { name: OBSOLETE_MENU_NAMES } });
    if (removed > 0) {
      this.logger.logBusiness(RbacSeeder.name, 'Đã gỡ menu cũ', { removed, names: OBSOLETE_MENU_NAMES });
    }
  }

  private async seedMenus(menus: ReadonlyArray<MenuSeed>, parentId: string | null): Promise<void> {
    for (const menu of menus) {
      const [row] = await this.menuModel.findOrCreate({
        where: { name: menu.name, parentId },
        defaults: {
          name: menu.name,
          parentId,
          sort: menu.sort,
          requirePermissions: menu.requirePermissions,
          routePath: menu.routePath,
          iconType: menu.iconType,
          iconValue: menu.iconValue,
        } as AdminMenuEntity,
      });
      if (menu.children?.length) {
        await this.seedMenus(menu.children, row.id);
      }
    }
  }
}
