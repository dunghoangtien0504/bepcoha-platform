import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { AuthService } from './auth.service';
import { JwtRequest } from './jwt-auth.guard';

/**
 * Đối chiếu quyền của user (theo role) với danh sách permission yêu cầu trên handler.
 * Phải đặt sau JwtAuthGuard để request.user đã có. User isAdmin ('*') bỏ qua mọi kiểm tra.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<JwtRequest>();
    const { roleId, isAdmin } = request.user;
    const granted = await this.authService.resolvePermissionCodes(roleId, isAdmin);

    if (granted.includes('*')) return true;
    const missing = required.filter((permission) => !granted.includes(permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`Thiếu quyền: ${missing.join(', ')}`);
    }
    return true;
  }
}
