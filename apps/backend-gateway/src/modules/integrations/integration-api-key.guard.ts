import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IntegrationConfig } from '../../config/configuration';

/**
 * Guard cho API outbound dành cho hệ thống bên thứ ba (machine-to-machine) đọc usage/ROI.
 * Xác thực qua header `X-AIGG-Api-Key`.
 */
@Injectable()
export class IntegrationApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-aigg-api-key'];
    const expected = this.configService.getOrThrow<IntegrationConfig>('integration').apiKey;
    if (!apiKey || apiKey !== expected) {
      throw new UnauthorizedException('Thiếu hoặc sai X-AIGG-Api-Key');
    }
    return true;
  }
}
