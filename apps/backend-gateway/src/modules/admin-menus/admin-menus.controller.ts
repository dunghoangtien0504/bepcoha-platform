import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AdminMenuEntity } from '../../database/models';
import { JwtAuthGuard, JwtRequest } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AdminMenusService, MenuNode } from './admin-menus.service';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';

@Controller('v1/admin/menus')
export class AdminMenusController {
  constructor(private readonly menusService: AdminMenusService) {}

  /** Menu điều hướng đã lọc theo quyền của user — mọi user đăng nhập đều gọi được. */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  myMenus(@Req() request: JwtRequest): Promise<MenuNode[]> {
    return this.menusService.getMenusForUser(request.user.roleId, request.user.isAdmin);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin.menus.view')
  @Get()
  tree(): Promise<MenuNode[]> {
    return this.menusService.getTree();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin.menus.create')
  @Post()
  create(@Body() dto: CreateMenuDto): Promise<AdminMenuEntity> {
    return this.menusService.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin.menus.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto): Promise<AdminMenuEntity> {
    return this.menusService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin.menus.delete')
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.menusService.remove(id);
    return { success: true };
  }
}
