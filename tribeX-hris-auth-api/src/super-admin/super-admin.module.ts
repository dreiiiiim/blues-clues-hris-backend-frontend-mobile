import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SupabaseModule } from '../supabase/supabase.module';
import { MailModule } from '../mail/mail.module';
import { SuperAdminGuard } from './super-admin.guard';
import { SuperAdminAuthController } from './auth/super-admin-auth.controller';
import { SuperAdminAuthService } from './auth/super-admin-auth.service';
import { SuperAdminCompaniesController } from './companies/companies.controller';
import { SuperAdminCompaniesService } from './companies/companies.service';
import { SuperAdminDashboardController } from './dashboard/dashboard.controller';
import { SuperAdminDashboardService } from './dashboard/dashboard.service';
import { SuperAdminRenewalsController } from './renewals/renewals.controller';
import { SuperAdminRenewalsService } from './renewals/renewals.service';
import { SuperAdminSubscriptionsController } from './subscriptions/subscriptions.controller';
import { SuperAdminSubscriptionsService } from './subscriptions/subscriptions.service';
import { SuperAdminSettingsController } from './settings/settings.controller';
import { SuperAdminSettingsService } from './settings/settings.service';
import { InternalInstancesController } from './internal/internal-instances.controller';

@Module({
  imports: [SupabaseModule, MailModule, JwtModule],
  controllers: [
    SuperAdminAuthController,
    SuperAdminCompaniesController,
    SuperAdminDashboardController,
    SuperAdminRenewalsController,
    SuperAdminSubscriptionsController,
    SuperAdminSettingsController,
    InternalInstancesController,
  ],
  providers: [
    SuperAdminGuard,
    SuperAdminAuthService,
    SuperAdminCompaniesService,
    SuperAdminDashboardService,
    SuperAdminRenewalsService,
    SuperAdminSubscriptionsService,
    SuperAdminSettingsService,
  ],
})
export class SuperAdminModule {}
