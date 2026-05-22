import { Controller, Patch, Param, Body, Headers, UnauthorizedException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';

@Controller('super-admin/internal/instances')
export class InternalInstancesController {
  private readonly logger = new Logger(InternalInstancesController.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private verify(secret: string | undefined) {
    const expected = this.config.get<string>('INTERNAL_API_SECRET');
    if (!expected || secret !== expected) throw new UnauthorizedException('Invalid internal secret');
  }

  @Patch(':id/activate')
  async activate(
    @Param('id') id: string,
    @Headers('x-internal-secret') secret: string,
  ) {
    this.verify(secret);
    const db = this.supabase.getClient();

    const { error } = await db
      .from('instances')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('instance_id', id);

    if (error) throw new InternalServerErrorException(error.message);

    // Also flip company_registrations subscription_status to Active if not already
    const { data: instance } = await db
      .from('instances')
      .select('company_id')
      .eq('instance_id', id)
      .maybeSingle();

    if (instance?.company_id) {
      await db
        .from('company_registrations')
        .update({ subscription_status: 'Active' })
        .eq('company_id', instance.company_id)
        .neq('subscription_status', 'Active');
    }

    this.logger.log(`Instance ${id} activated`);
    return { success: true };
  }

  @Patch(':id/fail')
  async fail(
    @Param('id') id: string,
    @Headers('x-internal-secret') secret: string,
    @Body() body: { error?: string },
  ) {
    this.verify(secret);
    const db = this.supabase.getClient();

    const { data: instance, error: fetchErr } = await db
      .from('instances')
      .select('instance_id')
      .eq('instance_id', id)
      .maybeSingle();

    if (fetchErr || !instance) throw new NotFoundException('Instance not found');

    const { error } = await db
      .from('instances')
      .update({
        status: 'failed',
        error_message: body.error ?? 'GHA provision job failed',
        updated_at: new Date().toISOString(),
      })
      .eq('instance_id', id);

    if (error) throw new InternalServerErrorException(error.message);

    this.logger.warn(`Instance ${id} marked failed: ${body.error}`);
    return { success: true };
  }
}
