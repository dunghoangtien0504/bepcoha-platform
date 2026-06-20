import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'ai-governance-gateway',
      timestamp: new Date().toISOString(),
    };
  }
}
