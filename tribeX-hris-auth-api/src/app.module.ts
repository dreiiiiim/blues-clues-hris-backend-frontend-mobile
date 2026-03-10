// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { TimekeepingModule } from './timekeeping/timekeeping.module'; // ← ADD THIS

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    MailModule,
    TimekeepingModule, // ← ADD THIS
  ],
})
export class AppModule {}