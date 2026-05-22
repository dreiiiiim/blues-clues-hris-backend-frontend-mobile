import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '@app/common';
import { FileOvertimeRequestDto } from './dto/file-overtime-request.dto';
import { ReviewOvertimeRequestDto } from './dto/review-overtime-request.dto';
import { OvertimeService } from './overtime.service';

const SCHEDULE_MANAGERS = [
  'System Admin',
  'HR Officer',
  'HR Recruiter',
  'HR Interviewer',
  'Manager',
  'manager',
];

@ApiTags('Overtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Post('requests')
  @HttpCode(201)
  @ApiOperation({ summary: 'Employee files an overtime request' })
  createOvertimeRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FileOvertimeRequestDto,
  ) {
    return this.overtimeService.createOvertimeRequest(req.user.sub_userid, dto, req);
  }

  @Get('requests/me')
  @ApiOperation({ summary: 'Employee gets own overtime request history' })
  getMyOvertimeRequests(@Req() req: AuthenticatedRequest) {
    return this.overtimeService.getMyOvertimeRequests(req.user.sub_userid);
  }

  @Get('my-summary')
  @ApiOperation({ summary: 'Employee gets approved overtime summary' })
  @ApiQuery({ name: 'month', required: false, example: '2026-05' })
  getMyOvertimeSummary(
    @Req() req: AuthenticatedRequest,
    @Query('month') month?: string,
  ) {
    return this.overtimeService.getMyOvertimeSummary(req.user.sub_userid, month);
  }

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles(...SCHEDULE_MANAGERS)
  @ApiOperation({ summary: 'HR gets overtime requests for approval' })
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
  @ApiOperation({ summary: 'HR reviews an overtime request' })
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
