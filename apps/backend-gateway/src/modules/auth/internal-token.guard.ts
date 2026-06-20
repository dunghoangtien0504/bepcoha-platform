import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/interfaces/request-context.interface';
import { AuthService } from './auth.service';

/**
 * Guard cho tầng Proxy: bắt buộc header `Authorization: Bearer storo_live_...` và `X-Task-ID`.
 * Sau khi xác thực, gắn identity + taskId vào request để các tầng sau sử dụng.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu header Authorization Bearer token');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token.startsWith('storo_live_')) {
      throw new UnauthorizedException('Token nội bộ phải có tiền tố storo_live_');
    }

    const taskId = request.headers['x-task-id'];
    if (!taskId || typeof taskId !== 'string') {
      throw new BadRequestException('Thiếu header X-Task-ID để định danh phạm vi công việc');
    }

    const projectId = request.headers['x-project-id'];
    const conversationId = request.headers['x-conversation-id'];

    request.identity = await this.authService.resolveInternalToken(token);
    request.taskId = taskId;
    request.projectId = typeof projectId === 'string' ? projectId : null;
    request.conversationId = typeof conversationId === 'string' ? conversationId : null;
    return true;
  }
}
