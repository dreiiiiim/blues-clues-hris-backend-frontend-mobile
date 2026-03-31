import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ApiTags,
  ApiOperation,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new notification (internal use)' })
  createNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.createNotification(dto);
  }

  @Get('applicant/:applicant_id/unread')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get unread notifications for an applicant (bypasses auth)' })
  getUnreadNotifications(@Param('applicant_id') applicantId: string) {
    return this.notificationsService.getUnreadNotifications(applicantId);
  }

  @Get('applicant/:applicant_id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all notifications for an applicant (bypasses auth)' })
  getAllNotifications(@Param('applicant_id') applicantId: string) {
    return this.notificationsService.getAllNotifications(applicantId);
  }

  @Patch('applicant/:applicant_id/mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read for an applicant' })
  markAllAsRead(@Param('applicant_id') applicantId: string) {
    return this.notificationsService.markAllAsRead(applicantId);
  }

  @Patch(':notification_id/mark-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markNotificationAsRead(@Param('notification_id') notificationId: string) {
    return this.notificationsService.markNotificationAsRead(notificationId);
  }
}
