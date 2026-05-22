import { Controller, Get } from '@nestjs/common';
import { ApiService } from './api.service';

@Controller()
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get()
  getServiceInfo(): { service: string; version: string } {
    return this.apiService.getServiceInfo();
  }
}
