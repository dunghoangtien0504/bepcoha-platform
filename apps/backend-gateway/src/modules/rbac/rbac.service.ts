import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  ModuleEntity,
  ModuleScopeEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
} from '../../database/models';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

export interface RoleWithPermissions {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissionCodes: string[];
}

@Injectable()
export class RbacService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly logger: AppLoggerService,
    @InjectModel(ModuleEntity) private readonly moduleModel: typeof ModuleEntity,
    @InjectModel(PermissionEntity) private readonly permissionModel: typeof PermissionEntity,
    @InjectModel(RoleEntity) private readonly roleModel: typeof RoleEntity,
    @InjectModel(RolePermissionEntity)
    private readonly rolePermissionModel: typeof RolePermissionEntity,
  ) {
    this.logger.setContext(RbacService.name);
  }

  listModules(): Promise<ModuleEntity[]> {
    return this.moduleModel.findAll({
      include: [ModuleScopeEntity],
      order: [
        ['sort', 'ASC'],
        [{ model: ModuleScopeEntity, as: 'scopes' }, 'sort', 'ASC'],
      ],
    });
  }

  listPermissions(): Promise<PermissionEntity[]> {
    return this.permissionModel.findAll({ order: [['sort', 'ASC']] });
  }

  async listRoles(): Promise<RoleWithPermissions[]> {
    const roles = await this.roleModel.findAll({
      include: [RolePermissionEntity],
      order: [['name', 'ASC']],
    });
    return roles.map((role) => this.toRoleView(role));
  }

  async getRole(id: string): Promise<RoleWithPermissions> {
    const role = await this.roleModel.findByPk(id, { include: [RolePermissionEntity] });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    return this.toRoleView(role);
  }

  async createRole(dto: CreateRoleDto): Promise<RoleWithPermissions> {
    const code = dto.code?.trim() || this.generateRoleCode(dto.name);
    const existing = await this.roleModel.findOne({ where: { code } });
    if (existing) throw new ConflictException(`Mã vai trò '${code}' đã tồn tại`);

    const role = await this.sequelize.transaction(async (transaction) => {
      const created = await this.roleModel.create(
        { code, name: dto.name, description: dto.description ?? null } as RoleEntity,
        { transaction },
      );
      await this.replacePermissions(created.id, dto.permissionCodes ?? [], transaction);
      return created;
    });
    this.logger.logBusiness(RbacService.name, 'Tạo vai trò', { code });
    return this.getRole(role.id);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleWithPermissions> {
    const role = await this.roleModel.findByPk(id);
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    await role.update({
      name: dto.name ?? role.name,
      description: dto.description ?? role.description,
      isActive: dto.isActive ?? role.isActive,
    });
    return this.getRole(id);
  }

  async setPermissions(id: string, permissionCodes: string[]): Promise<RoleWithPermissions> {
    const role = await this.roleModel.findByPk(id);
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    await this.assertPermissionsExist(permissionCodes);
    await this.sequelize.transaction((transaction) =>
      this.replacePermissions(id, permissionCodes, transaction),
    );
    return this.getRole(id);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.roleModel.findByPk(id);
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (role.code === 'super_admin') {
      throw new BadRequestException('Không thể xóa vai trò super_admin');
    }
    await this.sequelize.transaction(async (transaction) => {
      await this.rolePermissionModel.destroy({ where: { roleId: id }, transaction });
      await role.destroy({ transaction });
    });
  }

  private async replacePermissions(
    roleId: string,
    permissionCodes: string[],
    transaction: Transaction,
  ): Promise<void> {
    await this.rolePermissionModel.destroy({ where: { roleId }, transaction });
    const unique = Array.from(new Set(permissionCodes));
    if (unique.length === 0) return;
    await this.rolePermissionModel.bulkCreate(
      unique.map((permissionCode) => ({ roleId, permissionCode })) as RolePermissionEntity[],
      { transaction },
    );
  }

  private async assertPermissionsExist(permissionCodes: string[]): Promise<void> {
    const unique = Array.from(new Set(permissionCodes));
    if (unique.length === 0) return;
    const found = await this.permissionModel.count({ where: { code: unique } });
    if (found !== unique.length) {
      throw new BadRequestException('Tồn tại permission code không hợp lệ');
    }
  }

  private toRoleView(role: RoleEntity): RoleWithPermissions {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      permissionCodes: (role.rolePermissions ?? []).map((rp) => rp.permissionCode),
    };
  }

  private generateRoleCode(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    const suffix = randomBytes(3).toString('hex');
    return slug ? `${slug}_${suffix}` : `role_${suffix}`;
  }
}
