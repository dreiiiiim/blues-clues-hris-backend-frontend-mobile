import { Module } from '@nestjs/common';
import { ApiCenterSdkService } from './api-center-sdk.service';

@Module({
  providers: [ApiCenterSdkService],
  exports: [ApiCenterSdkService],
})
export class ApiCenterSdkModule {}
