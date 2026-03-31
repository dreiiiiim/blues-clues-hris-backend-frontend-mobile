import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createNotification(dto: CreateNotificationDto) {
    const supabase = this.supabaseService.getClient();
    const notification_id = crypto.randomUUID();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        notification_id,
        applicant_id: dto.applicant_id,
        message: dto.message,
        type: dto.notification_type ?? 'status_update',
        job_posting_id: dto.job_posting_id ?? null,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async getUnreadNotifications(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('applicant_id', applicantId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async getAllNotifications(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async markNotificationAsRead(notificationId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Notification not found');
    return data;
  }

  async markAllAsRead(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('applicant_id', applicantId)
      .eq('is_read', false);

    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'All notifications marked as read' };
  }
}
