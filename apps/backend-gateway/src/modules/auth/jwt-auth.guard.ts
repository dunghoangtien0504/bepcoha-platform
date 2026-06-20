import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from './auth.service';

export interface JwtRequest extends Request {
  user: JwtPayload;
}

/**
 * Guard bảo vệ các endpoint quản trị của Dashboard bằng JWT (Bearer).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<JwtRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Yêu cầu đăng nhập quản trị');
    }
    try {
      const token = authHeader.slice('Bearer '.length).trim();
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
  }
}
