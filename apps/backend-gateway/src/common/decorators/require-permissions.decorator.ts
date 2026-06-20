import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Gắn danh sách permission code yêu cầu cho một handler. PermissionsGuard sẽ đối chiếu.
 * Ví dụ: @RequirePermissions('admin.users.view')
 */
export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
