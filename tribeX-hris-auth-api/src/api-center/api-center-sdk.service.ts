import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Mock TribeClient stub to bypass private package requirements during development
class TribeClient {
  constructor(config: any) {}
  async authenticate() {
    return true;
  }
  async paymentCreateCheckoutSession(dto: any) {
    return { checkoutId: 'mock-checkout-id', redirectUrl: 'https://mock.payment.gateway/checkout' };
  }
  async paymentGetCheckoutSession(checkoutId: string) {
    return { status: 'paid', referenceId: 'mock-ref-id', checkoutId };
  }
}

@Injectable()
export class ApiCenterSdkService {
  private readonly logger = new Logger(ApiCenterSdkService.name);
  private client: TribeClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  getClient(): TribeClient {
    if (this.client) return this.client;

    const gatewayUrl = this.configService.get<string>('APICENTER_BASE_URL')
      ?? this.configService.get<string>('API_CENTER_BASE_URL');
    const tribeId = this.configService.get<string>('APICENTER_TRIBE_ID')
      ?? this.configService.get<string>('API_CENTER_TRIBE_ID');
    const secret = this.configService.get<string>('APICENTER_TRIBE_SECRET')
      ?? this.configService.get<string>('API_CENTER_TRIBE_SECRET');

    if (!gatewayUrl || !tribeId || !secret) {
      throw new Error(
        'APICENTER_BASE_URL, APICENTER_TRIBE_ID, and APICENTER_TRIBE_SECRET must all be configured.',
      );
    }

    const timeoutRaw = this.configService.get<string>('APICENTER_TIMEOUT_MS')
      ?? this.configService.get<string>('API_CENTER_TIMEOUT_MS');
    const timeout = timeoutRaw ? Number(timeoutRaw) : undefined;

    this.client = new TribeClient({ gatewayUrl, tribeId, secret, timeout });
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      await this.getClient().authenticate();
      return true;
    } catch (error) {
      this.logger.warn(
        `APICenter health check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return false;
    }
  }
}
