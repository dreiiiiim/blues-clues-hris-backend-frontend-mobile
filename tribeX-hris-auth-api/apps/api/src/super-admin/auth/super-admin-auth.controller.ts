import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';

@Controller('super-admin/auth')
export class SuperAdminAuthController {
  constructor(private readonly service: SuperAdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: SuperAdminLoginDto) {
    return this.service.login(dto);
  }
}
