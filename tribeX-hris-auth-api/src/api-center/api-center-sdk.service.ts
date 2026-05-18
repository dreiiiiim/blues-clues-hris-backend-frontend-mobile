import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ApiCenterResponse<T> {
  data: T;
  correlationId?: string;
}

const VERSIONED_PREFIXES = [
  '/tribes/',
  '/shared/',
  '/external/',
  '/auth/',
  '/registry/',
  '/health',
];

@Injectable()
export class ApiCenterSdkService {
  private readonly logger = new Logger(ApiCenterSdkService.name);
  private readonly baseUrl: string;
  private readonly tribeId?: string;
  private readonly tribeSecret?: string;
  private readonly legacyApiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('API_CENTER_BASE_URL') ?? '').trim();
    this.tribeId = this.configService.get<string>('API_CENTER_TRIBE_ID');
    this.tribeSecret = this.configService.get<string>('API_CENTER_TRIBE_SECRET');
    this.legacyApiKey = this.configService.get<string>('API_CENTER_API_KEY');
  }

  async get<T>(path: string): Promise<ApiCenterResponse<T>> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<ApiCenterResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async ping(): Promise<boolean> {
    try {
      await this.get<unknown>('/health');
      return true;
    } catch (error) {
      this.logger.warn(
        `APICenter health check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return false;
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<ApiCenterResponse<T>> {
    if (!this.baseUrl) {
      throw new Error('API_CENTER_BASE_URL is not configured');
    }

    const url = this.buildUrl(path);
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`APICenter request failed (${response.status}) for ${method} ${url}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
      ? ((await response.json()) as T)
      : ((await response.text()) as unknown as T);

    return {
      data,
      correlationId: response.headers.get('x-correlation-id') ?? undefined,
    };
  }

  private buildUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const needsPrefix = VERSIONED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
    const versionedPath = needsPrefix ? `/api/v1${normalized}` : normalized;
    return `${this.baseUrl.replace(/\/$/, '')}${versionedPath}`;
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.tribeId && this.tribeSecret) {
      headers['X-Tribe-Id'] = this.tribeId;
      headers['X-Tribe-Secret'] = this.tribeSecret;
    } else if (this.legacyApiKey) {
      headers['X-API-Key'] = this.legacyApiKey;
    }

    return headers;
  }
}
