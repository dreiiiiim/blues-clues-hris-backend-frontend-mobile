import { Controller, Get, Patch, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsString, IsOptional, MinLength } from 'class-validator';
import { SuperAdminGuard } from '../super-admin.guard';
import { SuperAdminSettingsService } from './settings.service';

class UpdateProfileDto { @IsString() @IsOptional() name: string; }

class UpdateNotificationsDto {
  @IsBoolean() notify_new_signup: boolean;
  @IsBoolean() notify_payment: boolean;
  @IsBoolean() notify_renewal_due: boolean;
  @IsBoolean() notify_expiry: boolean;
}

class ChangePasswordDto {
  @IsString() current_password: string;
  @IsString() @MinLength(8) new_password: string;
  @IsString() confirm_password: string;
}

@Controller('super-admin/settings')
@UseGuards(SuperAdminGuard)
export class SuperAdminSettingsController {
  constructor(private readonly service: SuperAdminSettingsService) {}

  @Get('profile')
  getProfile(@Req() req: any) { return this.service.getProfile(req.user.sub); }

  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(req.user.sub, dto.name);
  }

  @Patch('password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException('New passwords do not match');
    }
    return this.service.changePassword(req.user.sub, req.user.email, dto.current_password, dto.new_password);
  }

  @Get('notifications')
  getNotifications(@Req() req: any) { return this.service.getNotifications(req.user.sub); }

  @Patch('notifications')
  updateNotifications(@Req() req: any, @Body() dto: UpdateNotificationsDto) {
    return this.service.updateNotifications(req.user.sub, dto);
  }

  @Get('audit-log')
  getAuditLog() { return this.service.getAuditLog(); }

  @Get('system')
  getSystem() { return this.service.getSystemSettings(); }
}
