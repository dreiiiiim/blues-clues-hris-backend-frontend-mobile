import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiCenterSdkModule } from '@app/api-center';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { validateEnv } from '@app/common';
import { CorrelationIdMiddleware } from '@app/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from '@app/supabase';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { TimekeepingModule } from './timekeeping/timekeeping.module';
import { ApplicantsModule } from './applicants/applicants.module';
import { JobsModule } from './jobs/jobs.module';
import { AuditModule } from './audit/audit.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { LeaveModule } from './leave/leave.module';
import { OvertimeModule } from './overtime/overtime.module';
import { LeaveBalancesModule } from './leave-balances/leave-balances.module';
import { PayrollModule } from './payroll/payroll.module';
import { CnbModule } from './cnb/cnb.module';
import { OffboardingModule } from './offboarding/offboarding.module';
import { PerformanceModule } from './performance/performance.module';
import { SuperAdminModule } from './super-admin/super-admin.module';

const shouldValidateEnv = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      ...(shouldValidateEnv ? { validate: validateEnv } : {}),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    SupabaseModule,
    ApiCenterSdkModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MailModule,
    TimekeepingModule,
    ApplicantsModule,
    JobsModule,
    AuditModule,
    OnboardingModule,
    NotificationsModule,
    SubscriptionModule,
    LeaveModule,
    OvertimeModule,
    LeaveBalancesModule,
    PayrollModule,
    CnbModule,
    OffboardingModule,
    PerformanceModule,
    SuperAdminModule,
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
