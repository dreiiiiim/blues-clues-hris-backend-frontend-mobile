// src/applicants/applicants.service.ts

import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { ApplicantLoginDto } from './dto/applicant-login.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class ApplicantsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateApplicantDto, companyId?: string) {
    const supabase = this.supabaseService.getClient();

    // 1. Check for duplicate email
    const { data: existing } = await supabase
      .from('applicant_profile')
      .select('applicant_id, company_id')
      .eq('email', dto.email)
      .maybeSingle();

    if (existing) {
      if (existing.company_id && companyId && existing.company_id !== companyId) {
        throw new ConflictException(
          'An account with this email is already registered under a different company. ' +
          'You cannot apply here with this account. Please use a different email address.',
        );
      }
      throw new ConflictException(
        'An account with this email already exists. Please sign in instead.',
      );
    }

    // 2. Hash the password
    const password_hash = await bcrypt.hash(dto.password, 12);

    // 3. Generate unique IDs
    const applicant_id = crypto.randomUUID();
    const applicant_code = `APP-${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 4. Insert the applicant
    const { error: insertError } = await supabase
      .from('applicant_profile')
      .insert({
        applicant_id,
        applicant_code,
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
        phone_number: dto.phone_number ?? null,
        password_hash,
        role: 'Applicant',
        status: 'unverified',
        company_id: companyId ?? null,
        created_at: new Date().toISOString(),
      });

    if (insertError) throw new InternalServerErrorException(insertError.message);

    // 5. Generate email verification token (raw → email, hashed → DB)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase
      .from('email_verifications')
      .insert({
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
    } catch (error: any) {
      console.log('EMAIL ERROR:', error.message);
      console.log('==========================================');
      console.log('DEV MODE — verification link:');
      console.log(verifyLink);
      console.log('==========================================');
    }

    return {
      applicant_id,
      applicant_code,
      email: dto.email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      message: 'Account created. Please check your email to verify your address.',
    };
  }

  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('Verification token is required');

    const supabase = this.supabaseService.getClient();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: record, error } = await supabase
      .from('email_verifications')
      .select('verification_id, applicant_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !record) throw new UnauthorizedException('Invalid or expired verification link');
    if (record.used_at) throw new UnauthorizedException('This verification link has already been used');
    if (new Date(record.expires_at) <= new Date()) throw new UnauthorizedException('This verification link has expired');

    await supabase
      .from('email_verifications')
      .update({ used_at: new Date().toISOString() })
      .eq('verification_id', record.verification_id);

    await supabase
      .from('applicant_profile')
      .update({ status: 'active' })
      .eq('applicant_id', record.applicant_id);

    return { message: 'Email verified successfully. You can now sign in.' };
  }

  async login(dto: ApplicantLoginDto) {
    const supabase = this.supabaseService.getClient();

    // 1. Find applicant by email
    const { data: applicant, error } = await supabase
      .from('applicant_profile')
      .select('applicant_id, email, password_hash, first_name, last_name, status, role, company_id')
      .eq('email', dto.email)
      .maybeSingle();

    if (error || !applicant) throw new UnauthorizedException('User not found');

    // 2. Block unverified accounts
    if (applicant.status === 'unverified') {
      throw new UnauthorizedException('Please verify your email before signing in.');
    }

    // 3. Check password
    const isMatch = await bcrypt.compare(dto.password, applicant.password_hash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const session_id = crypto.randomUUID();

    // 4. Issue 15-minute access token
    const access_token = await this.jwtService.signAsync(
      {
        type: 'access',
        sub_userid: applicant.applicant_id,
        role_name: applicant.role,
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        company_id: applicant.company_id ?? null,
      },
      { expiresIn: '15m' },
    );

    // 5. Issue 7-day refresh token
    const refresh_token = await this.jwtService.signAsync(
      {
        type: 'refresh',
        role_name: applicant.role,   // 'Applicant' — used to distinguish from staff refresh
        sub_userid: applicant.applicant_id,
        session_id,
      },
      { expiresIn: '7d' },
    );

    // 6. Persist the refresh session
    const decoded: any = this.jwtService.decode(refresh_token);
    const expires_at = new Date(decoded.exp * 1000).toISOString();

    await supabase.from('refresh_session').insert({
      user_id: applicant.applicant_id,   // UUID column — no type conflict
      token_hash: sha256(refresh_token),
      expires_at,
    });

    return { access_token, refresh_token };
  }

  async refresh(refreshToken: string) {
    const supabase = this.supabaseService.getClient();

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token type');
    if (decoded.role_name !== 'Applicant') throw new UnauthorizedException('Not an applicant refresh token');

    const token_hash = sha256(refreshToken);

    const { data: session, error } = await supabase
      .from('refresh_session')
      .select('expires_at, revoked_at')
      .eq('user_id', decoded.sub_userid)
      .eq('token_hash', token_hash)
      .maybeSingle();

    if (error || !session) throw new UnauthorizedException('Session not found');
    if (session.revoked_at) throw new UnauthorizedException('Session revoked');
    if (new Date(session.expires_at) <= new Date()) throw new UnauthorizedException('Session expired');

    // Fetch fresh applicant data
    const { data: applicant, error: appErr } = await supabase
      .from('applicant_profile')
      .select('applicant_id, first_name, last_name, role, company_id, status')
      .eq('applicant_id', decoded.sub_userid)
      .maybeSingle();

    if (appErr || !applicant) throw new UnauthorizedException('Applicant not found');
    if (applicant.status === 'inactive') throw new UnauthorizedException('Account deactivated');

    const access_token = await this.jwtService.signAsync(
      {
        type: 'access',
        sub_userid: applicant.applicant_id,
        role_name: applicant.role,
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        company_id: applicant.company_id ?? null,
      },
      { expiresIn: '15m' },
    );

    return { access_token };
  }

  async logout(refreshToken: string, accessToken?: string) {
    const supabase = this.supabaseService.getClient();

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (decoded.role_name !== 'Applicant') throw new UnauthorizedException('Not an applicant token');

    const token_hash = sha256(refreshToken);

    // Revoke the refresh session
    await supabase
      .from('refresh_session')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', decoded.sub_userid)
      .eq('token_hash', token_hash);

    // Blacklist the access token so it cannot be used after logout
    if (accessToken) {
      try {
        const accessDecoded: any = await this.jwtService.verifyAsync(accessToken);
        if (accessDecoded?.exp) {
          await supabase.from('token_blacklist').insert({
            token_hash: sha256(accessToken),
            expires_at: new Date(accessDecoded.exp * 1000).toISOString(),
          });
        }
      } catch { /* best-effort */ }
    }

    return { message: 'Logged out' };
  }
}
