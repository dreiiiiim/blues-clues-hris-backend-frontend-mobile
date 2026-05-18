import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OvertimeService } from './overtime.service';
import { FileOvertimeRequestDto } from './dto/file-overtime-request.dto';
import { ReviewOvertimeRequestDto } from './dto/review-overtime-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

const SCHEDULE_MANAGERS = ['System Admin', 'HR Officer', 'HR Recruiter', 'HR Interviewer'];

@ApiTags('Overtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  // ── EMPLOYEE ROUTES ──────────────────────────────────────────

  @Post('requests')
  @HttpCode(201)
  @ApiOperation({ summary: 'Employee: File an overtime request' })
  createOvertimeRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FileOvertimeRequestDto,
  ) {
    return this.overtimeService.createOvertimeRequest(req.user.sub_userid, dto, req);
  }

  @Get('requests/me')
  @ApiOperation({ summary: 'Employee: Get own overtime request history' })
  getMyOvertimeRequests(@Req() req: AuthenticatedRequest) {
    return this.overtimeService.getMyOvertimeRequests(req.user.sub_userid);
  }

  @Get('my-summary')
  @ApiOperation({ summary: 'Employee: Approved OT hours for current (or given) month' })
  @ApiQuery({ name: 'month', required: false, example: '2026-05' })
  getMyOvertimeSummary(
    @Req() req: AuthenticatedRequest,
    @Query('month') month?: string,
  ) {
    return this.overtimeService.getMyOvertimeSummary(req.user.sub_userid, month);
  }

  // ── HR ROUTES ────────────────────────────────────────────────

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({ summary: 'HR: Get all overtime requests for company' })
  @ApiQuery({ name: 'status', required: false, example: 'PENDING' })
  @ApiQuery({ name: 'type', required: false, example: 'NORMAL' })
  getOvertimeRequests(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.overtimeService.getOvertimeRequests(req.user.company_id, status, type);
  }

  @Patch('requests/:otId/review')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({ summary: 'HR: Approve or deny an overtime request' })
  reviewOvertimeRequest(
    @Param('otId') otId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReviewOvertimeRequestDto,
  ) {
    return this.overtimeService.reviewOvertimeRequest(
      otId,
      dto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }
}
