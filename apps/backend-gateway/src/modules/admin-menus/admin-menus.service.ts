import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { AdminMenuEntity, IconType } from '../../database/models';
import { AuthService } from '../auth/auth.service';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';

export interface MenuNode {
  id: string;
  name: string;
  parentId: string | null;
  sort: number;
  requirePermissions: string | null;
  routePath: string | null;
  iconType: IconType;
  iconValue: string | null;
  isActive: boolean;
  children: MenuNode[];
}

@Injectable()
export class AdminMenusService {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: AppLoggerService,
    @InjectModel(AdminMenuEntity) private readonly menuModel: typeof AdminMenuEntity,
  ) {
    this.logger.setContext(AdminMenusService.name);
  }

  /** Cây menu đầy đủ phục vụ màn hình quản lý. */
  async getTree(): Promise<MenuNode[]> {
    const rows = await this.menuModel.findAll({ order: [['sort', 'ASC']] });
    return this.buildTree(rows, null);
  }

  /**
   * Cây menu đã lọc theo quyền của user đang đăng nhập (dùng dựng sidebar động).
   * Hiển thị node lá khi require_permissions rỗng hoặc user có quyền; node cha hiển thị
   * khi còn ít nhất một con hợp lệ hoặc bản thân có route + quyền hợp lệ.
   */
  async getMenusForUser(roleId: string, isAdmin: boolean): Promise<MenuNode[]> {
    const granted = await this.authService.resolvePermissionCodes(roleId, isAdmin);
    const grantedSet = new Set(granted);
    const rows = await this.menuModel.findAll({
      where: { isActive: true },
      order: [['sort', 'ASC']],
    });
    const fullTree = this.buildTree(rows, null);
    return this.filterTree(fullTree, grantedSet, grantedSet.has('*'));
  }

  async create(dto: CreateMenuDto): Promise<AdminMenuEntity> {
    return this.menuModel.create({
      name: dto.name,
      parentId: dto.parentId ?? null,
      sort: dto.sort ?? 0,
      requirePermissions: dto.requirePermissions ?? null,
      routePath: dto.routePath ?? null,
      iconType: dto.iconType ?? 'letter',
      iconValue: dto.iconValue ?? null,
    } as AdminMenuEntity);
  }

  async update(id: string, dto: UpdateMenuDto): Promise<AdminMenuEntity> {
    const menu = await this.menuModel.findByPk(id);
    if (!menu) throw new NotFoundException('Không tìm thấy menu');
    await menu.update({
      name: dto.name ?? menu.name,
      parentId: dto.parentId ?? menu.parentId,
      sort: dto.sort ?? menu.sort,
      requirePermissions: dto.requirePermissions ?? menu.requirePermissions,
      routePath: dto.routePath ?? menu.routePath,
      iconType: dto.iconType ?? menu.iconType,
      iconValue: dto.iconValue ?? menu.iconValue,
      isActive: dto.isActive ?? menu.isActive,
    });
    return menu;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.menuModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy menu');
  }

  private buildTree(rows: AdminMenuEntity[], parentId: string | null): MenuNode[] {
    return rows
      .filter((row) => row.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        sort: row.sort,
        requirePermissions: row.requirePermissions,
        routePath: row.routePath,
        iconType: row.iconType,
        iconValue: row.iconValue,
        isActive: row.isActive,
        children: this.buildTree(rows, row.id),
      }));
  }

  private filterTree(nodes: MenuNode[], granted: Set<string>, isAdmin: boolean): MenuNode[] {
    const result: MenuNode[] = [];
    for (const node of nodes) {
      const children = this.filterTree(node.children, granted, isAdmin);
      const selfAllowed =
        !node.requirePermissions || isAdmin || granted.has(node.requirePermissions);
      // Node cha (không route) chỉ hiển thị khi còn con hợp lệ.
      const isVisible = node.routePath ? selfAllowed : children.length > 0;
      if (isVisible) {
        result.push({ ...node, children });
      }
    }
    return result;
  }
}
