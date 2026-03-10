// src/applicants/applicants.service.ts

import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class ApplicantsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: CreateApplicantDto) {
    const supabase = this.supabaseService.getClient();

    // 1. Check for duplicate email
    const { data: existing } = await supabase
      .from('applicant_profile')      // ← use the applicant-specific table
      .select('applicant_id')
      .eq('email', dto.email)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    // 2. Hash the password — same salt rounds as auth.service.ts (12)
    const password_hash = await bcrypt.hash(dto.password, 12);

    // 3. Generate a unique ID
    const applicant_id = crypto.randomUUID();

    // 4. Insert the applicant — role and status are always set server-side
    const { error: insertError } = await supabase
      .from('applicant_profile')
      .insert({
        applicant_id,
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
        password_hash,               // hashed — never store plaintext
        role: 'Applicant',           // always hardcoded, never from request
        status: 'unverified',        // always hardcoded, verified after email click
        created_at: new Date().toISOString(),
      });

    if (insertError) throw new InternalServerErrorException(insertError.message);

    // 5. Generate email verification token (raw → email, hashed → DB)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24hr

    const { error: tokenError } = await supabase
      .from('email_verifications')   // ← create this table in Supabase
      .insert({
        verification_id: crypto.randomUUID(),
        applicant_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (tokenError) throw new InternalServerErrorException(tokenError.message);

    // 6. Send verification email
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyLink = `${appUrl}/applicant/verify-email?token=${rawToken}`;

    try {
      await this.mailService.sendVerificationEmail(dto.email, verifyLink);
    } catch {
      // DEV fallback — log to terminal if email service fails (e.g. unverified Resend domain)
      console.log('==========================================');
      console.log('DEV MODE — verification link:');
      console.log(verifyLink);
      console.log('==========================================');
    }

    // 7. Return only safe fields — NEVER return password_hash
    return {
      applicant_id,
      email: dto.email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      message: 'Account created. Please check your email to verify your address.',
    };
  }
}
