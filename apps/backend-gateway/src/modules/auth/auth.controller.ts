import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthProfile, AuthService, LoginResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard, JwtRequest } from './jwt-auth.guard';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: JwtRequest): Promise<AuthProfile> {
    return this.authService.getProfileBySub(request.user.sub);
  }
}
