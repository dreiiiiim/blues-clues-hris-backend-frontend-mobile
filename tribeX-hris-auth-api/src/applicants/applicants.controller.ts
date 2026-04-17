// src/applicants/applicants.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { ApplicantLoginDto } from './dto/applicant-login.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

const APPLICANT_COOKIE = 'applicant_refresh_token';

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days
    path: '/api/tribeX/auth/applicants', // scoped to applicant routes only
  } as const;
}

@ApiTags('Applicants')
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Applicant self-registration via Career Portal' })
  register(@Body() dto: CreateApplicantDto, @Query('company') companyId?: string) {
    return this.applicantsService.register(dto, companyId);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Applicant login — returns access token + sets HttpOnly refresh cookie' })
  async login(
    @Body() dto: ApplicantLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token } = await this.applicantsService.login(dto);
    res.cookie(APPLICANT_COOKIE, refresh_token, cookieOptions());
    return { access_token, refresh_token };
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue new access token from applicant refresh cookie' })
  async refresh(@Req() req: Request) {
    const token: string | undefined = (req.cookies as Record<string, string>)[APPLICANT_COOKIE];
    if (!token) throw new UnauthorizedException('No applicant refresh token cookie');
    return this.applicantsService.refresh(token);
  }

  @Post('logout')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke applicant session and blacklist access token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') authHeader?: string,
  ) {
    const refreshToken: string | undefined = (req.cookies as Record<string, string>)[APPLICANT_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('No applicant refresh token cookie');

    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    await this.applicantsService.logout(refreshToken, accessToken);

    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(APPLICANT_COOKIE, {
      path: '/api/tribeX/auth/applicants',
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    } as const);

    return { message: 'Logged out' };
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify applicant email address via token' })
  verifyEmail(@Query('token') token: string) {
    return this.applicantsService.verifyEmail(token);
  }

  @Post('resend-verification')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email to an unverified applicant' })
  resendVerification(@Body() body: { email: string }) {
    return this.applicantsService.resendVerification(body.email);
  }
}
