import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly defaultClient: SupabaseClient | null;
  private readonly scopedClients = new Map<string, SupabaseClient>();

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL')?.trim();
    const serviceRoleKey = this.config
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim();

    this.defaultClient =
      url && serviceRoleKey
        ? createClient(url, serviceRoleKey, {
            auth: { persistSession: false },
          })
        : null;

    const env = process.env;
    for (const [key, value] of Object.entries(env)) {
      if (!key.endsWith('_SUPABASE_URL') || !value) continue;
      const prefix = key.slice(0, -'_SUPABASE_URL'.length);
      const secretKey = env[`${prefix}_SUPABASE_SECRET_KEY`];
      if (!secretKey) continue;

      this.scopedClients.set(
        prefix.toLowerCase(),
        createClient(value, secretKey, {
          auth: { persistSession: false },
        }),
      );
    }
  }

  getClient(): SupabaseClient {
    if (!this.defaultClient) {
      throw new Error('Default Supabase client is not configured');
    }
    return this.defaultClient;
  }

  getClientForService(serviceName: string): SupabaseClient | null {
    return this.scopedClients.get(this.normalizeServiceName(serviceName)) ?? null;
  }

  listConfiguredServices(): string[] {
    return [...this.scopedClients.keys()].map((name) => name.toUpperCase());
  }

  async ping(serviceName?: string): Promise<boolean> {
    try {
      const client = serviceName
        ? this.getClientForService(serviceName)
        : this.defaultClient;

      if (!client) return false;

      const operation = client.auth.admin.listUsers({ page: 1, perPage: 1 });
      await Promise.race([
        operation,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase ping timeout')), 3000),
        ),
      ]);

      return true;
    } catch {
      return false;
    }
  }

  private normalizeServiceName(serviceName: string): string {
    return serviceName.trim().replace(/-/g, '_').toLowerCase();
  }
}
