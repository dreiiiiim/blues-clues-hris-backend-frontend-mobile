import { Injectable } from '@nestjs/common';
import { ApiCenterSdkService } from '@app/api-center';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly apiCenterSdkService: ApiCenterSdkService,
  ) {}

  async getHealth() {
    const [database, apiCenter] = await Promise.all([
      this.supabaseService.ping(),
      this.apiCenterSdkService.ping(),
    ]);

    const status = database && apiCenter ? 'ok' : database || apiCenter ? 'degraded' : 'error';

    return {
      status,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: {
        database,
        apiCenter,
      },
    };
  }
}
