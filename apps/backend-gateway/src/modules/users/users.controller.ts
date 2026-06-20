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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { PublicUser, UsersService } from './users.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions('admin.users.view')
  @Get()
  list(): Promise<PublicUser[]> {
    return this.usersService.list();
  }

  @RequirePermissions('admin.users.view')
  @Get(':id')
  findOne(@Param('id') id: string): Promise<PublicUser> {
    return this.usersService.findOne(id);
  }

  @RequirePermissions('admin.users.create')
  @Post()
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.usersService.create(dto);
  }

  @RequirePermissions('admin.users.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<PublicUser> {
    return this.usersService.update(id, dto);
  }

  @RequirePermissions('admin.users.delete')
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.usersService.remove(id);
    return { success: true };
  }
}
