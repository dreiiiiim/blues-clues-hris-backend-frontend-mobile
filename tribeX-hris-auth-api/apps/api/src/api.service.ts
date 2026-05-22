import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiService {
  getServiceInfo(): { service: string; version: string } {
    return {
      service: 'tribe-backend',
      version: '1.0.0',
    };
  }
}
