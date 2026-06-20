import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ModuleEntity, PermissionEntity } from '../../database/models';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/role.dto';
import { RbacService, RoleWithPermissions } from './rbac.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/admin')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @RequirePermissions('admin.modules.view')
  @Get('modules')
  listModules(): Promise<ModuleEntity[]> {
    return this.rbacService.listModules();
  }

  @RequirePermissions('admin.permissions.view')
  @Get('permissions')
  listPermissions(): Promise<PermissionEntity[]> {
    return this.rbacService.listPermissions();
  }

  @RequirePermissions('admin.roles.view')
  @Get('roles')
  listRoles(): Promise<RoleWithPermissions[]> {
    return this.rbacService.listRoles();
  }

  @RequirePermissions('admin.roles.view')
  @Get('roles/:id')
  getRole(@Param('id') id: string): Promise<RoleWithPermissions> {
    return this.rbacService.getRole(id);
  }

  @RequirePermissions('admin.roles.create')
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto): Promise<RoleWithPermissions> {
    return this.rbacService.createRole(dto);
  }

  @RequirePermissions('admin.roles.update')
  @Put('roles/:id')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<RoleWithPermissions> {
    return this.rbacService.updateRole(id, dto);
  }

  @RequirePermissions('admin.roles.update')
  @Put('roles/:id/permissions')
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
  ): Promise<RoleWithPermissions> {
    return this.rbacService.setPermissions(id, dto.permissionCodes);
  }

  @RequirePermissions('admin.roles.delete')
  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.rbacService.deleteRole(id);
    return { success: true };
  }
}
