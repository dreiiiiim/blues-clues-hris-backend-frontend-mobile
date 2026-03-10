// src/applicants/applicants.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Applicants')
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  // PUBLIC route — no JwtAuthGuard, applicants don't have tokens yet.
  // Still guarded by ThrottlerGuard to prevent signup abuse.
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Applicant self-registration via Career Portal' })
  register(@Body() dto: CreateApplicantDto) {
    return this.applicantsService.register(dto);
  }
}
